import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { AttemptLimiter, cleanName, createUser, findUserByEmail, hashPassword, issueToken, normalizeEmail, revokeToken, userForToken, validPassword, verifyPassword, type User } from './auth.ts'
import type { CoachProvider } from './coach.ts'
import { COACH_DAILY_LIMIT, SCENARIOS, cleanCoachRequest } from './coach.ts'
import { transaction, type Db } from './db.ts'
import { leagueView, recordWeeklyXp } from './league.ts'
import { weekId } from './time.ts'

/**
 * HTTP API. Every response is JSON; errors are `{ error: <code> }` with a
 * stable machine-readable code the apps translate for the learner.
 */

export interface AppOptions {
  db: Db
  now?: () => number
  corsOrigins?: string[]
  coach?: CoachProvider | null
}

const MAX_STATE_BYTES = 512 * 1024
const GUIDES = new Set(['everest', 'lumi', 'pix', 'nubi', 'rocky', 'aero'])

type Env = { Variables: { user: User; token: string } }

interface StateSummary {
  updatedAt: number
  name: string
  guide: string
  weekId: string
  weeklyXp: number
}

/** The state blob is opaque to the server except for the few fields leagues and profiles need. */
function summarize(state: unknown): StateSummary | null {
  if (typeof state !== 'object' || state === null) return null
  const s = state as Record<string, unknown>
  if (s.version !== 1 || typeof s.updatedAt !== 'number' || !Number.isFinite(s.updatedAt)) return null
  const profile = (typeof s.profile === 'object' && s.profile !== null ? s.profile : {}) as Record<string, unknown>
  const league = (typeof s.league === 'object' && s.league !== null ? s.league : {}) as Record<string, unknown>
  const guide = typeof profile.guide === 'string' && GUIDES.has(profile.guide) ? profile.guide : 'everest'
  return {
    updatedAt: s.updatedAt,
    name: cleanName(profile.name),
    guide,
    weekId: typeof league.weekId === 'string' ? league.weekId : '',
    weeklyXp: typeof league.weeklyXp === 'number' && Number.isFinite(league.weeklyXp) ? league.weeklyXp : 0,
  }
}

export function createApp(options: AppOptions): Hono<Env> {
  const { db } = options
  const now = options.now ?? Date.now
  const coach = options.coach ?? null
  const loginLimiter = new AttemptLimiter(10, 15 * 60 * 1000)
  // a constant-cost hash to verify against when the email is unknown, so timing does not reveal which emails exist
  const decoyHash = hashPassword('decoy-password-for-constant-time')

  const app = new Hono<Env>()
  app.use('*', cors({ origin: options.corsOrigins && options.corsOrigins.length > 0 ? options.corsOrigins : '*', allowHeaders: ['Authorization', 'Content-Type'], maxAge: 600 }))

  app.onError((err, c) => {
    console.error(err)
    return c.json({ error: 'server_error' }, 500)
  })
  app.notFound((c) => c.json({ error: 'not_found' }, 404))

  app.get('/health', (c) => c.json({ ok: true, coach: coach !== null }))

  const readJson = async (req: Request): Promise<Record<string, unknown> | null> => {
    try {
      const body: unknown = await req.json()
      return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null
    } catch {
      return null
    }
  }

  const publicUser = (u: User) => ({ id: u.id, email: u.email, name: u.name, guide: u.guide, tier: u.tier })

  // -- accounts ---------------------------------------------------------------

  app.post('/auth/register', async (c) => {
    const body = await readJson(c.req.raw)
    const email = normalizeEmail(body?.email)
    if (!email) return c.json({ error: 'invalid_email' }, 400)
    const password = body?.password
    if (!validPassword(password)) return c.json({ error: 'weak_password' }, 400)
    if (findUserByEmail(db, email)) return c.json({ error: 'email_taken' }, 409)
    const user = createUser(db, email, password, cleanName(body?.name), now())
    return c.json({ token: issueToken(db, user.id, now()), user: publicUser(user) }, 201)
  })

  app.post('/auth/login', async (c) => {
    const body = await readJson(c.req.raw)
    const email = normalizeEmail(body?.email)
    const password = typeof body?.password === 'string' ? body.password : ''
    const key = email ?? 'invalid'
    if (!loginLimiter.allow(key, now())) return c.json({ error: 'too_many_attempts' }, 429)
    const found = email ? findUserByEmail(db, email) : null
    const ok = verifyPassword(password, found?.password_hash ?? decoyHash) && found !== null
    if (!found || !ok) return c.json({ error: 'invalid_credentials' }, 401)
    loginLimiter.reset(key)
    return c.json({ token: issueToken(db, found.id, now()), user: publicUser(found) })
  })

  // -- everything below needs a bearer token ------------------------------------

  const authed = new Hono<Env>()
  authed.use('*', async (c, next) => {
    const header = c.req.header('Authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    const user = token ? userForToken(db, token, now()) : null
    if (!user) return c.json({ error: 'unauthorized' }, 401)
    c.set('user', user)
    c.set('token', token)
    return next()
  })

  authed.post('/auth/logout', (c) => {
    revokeToken(db, c.get('token'))
    return c.json({ ok: true })
  })

  authed.get('/me', (c) => c.json({ user: publicUser(c.get('user')) }))

  authed.delete('/me', (c) => {
    // deleting the account removes sessions, state and league history (ON DELETE CASCADE)
    db.prepare('DELETE FROM users WHERE id = ?').run(c.get('user').id)
    return c.json({ ok: true })
  })

  // -- cloud sync: last write wins on the learner's own `updatedAt` clock ---------

  authed.get('/sync', (c) => {
    const row = db.prepare('SELECT state, updated_at FROM states WHERE user_id = ?').get(c.get('user').id) as { state: string; updated_at: number } | undefined
    return c.json({ state: row ? (JSON.parse(row.state) as unknown) : null, updatedAt: row?.updated_at ?? 0 })
  })

  authed.put('/sync', async (c) => {
    const raw = await c.req.text()
    if (raw.length > MAX_STATE_BYTES) return c.json({ error: 'state_too_large' }, 413)
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return c.json({ error: 'invalid_json' }, 400)
    }
    const state = (body as { state?: unknown } | null)?.state
    const summary = summarize(state)
    if (!summary) return c.json({ error: 'invalid_state' }, 400)
    const user = c.get('user')

    const outcome = transaction(db, () => {
      const stored = db.prepare('SELECT state, updated_at FROM states WHERE user_id = ?').get(user.id) as { state: string; updated_at: number } | undefined
      if (stored && stored.updated_at > summary.updatedAt) {
        // another device is ahead: the caller should adopt the stored state
        return { adopted: 'server' as const, state: JSON.parse(stored.state) as unknown, updatedAt: stored.updated_at }
      }
      db.prepare('INSERT INTO states (user_id, state, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at').run(
        user.id,
        JSON.stringify(state),
        summary.updatedAt
      )
      db.prepare('UPDATE users SET name = ?, guide = ? WHERE id = ?').run(summary.name, summary.guide, user.id)
      const week = weekId(now())
      if (summary.weekId === week) recordWeeklyXp(db, user.id, week, summary.weeklyXp)
      return { adopted: 'client' as const, state: null, updatedAt: summary.updatedAt }
    })
    return c.json(outcome)
  })

  // -- leagues ----------------------------------------------------------------

  authed.get('/league', (c) => c.json(leagueView(db, c.get('user').id, weekId(now()))))

  // -- AI conversation practice --------------------------------------------------

  authed.get('/coach/scenarios', (c) => c.json({ available: coach !== null, dailyLimit: COACH_DAILY_LIMIT, scenarios: SCENARIOS.map((s) => ({ id: s.id, guide: s.guide, level: s.level })) }))

  authed.post('/coach/chat', async (c) => {
    if (!coach) return c.json({ error: 'coach_unavailable' }, 503)
    const request = cleanCoachRequest(await readJson(c.req.raw))
    if (!request) return c.json({ error: 'invalid_request' }, 400)

    const user = c.get('user')
    const day = new Date(now()).toISOString().slice(0, 10)
    const used = db.prepare('SELECT count FROM coach_usage WHERE user_id = ? AND day = ?').get(user.id, day) as { count: number } | undefined
    if ((used?.count ?? 0) >= COACH_DAILY_LIMIT) return c.json({ error: 'coach_limit_reached' }, 429)
    db.prepare('INSERT INTO coach_usage (user_id, day, count) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1').run(user.id, day)

    try {
      const reply = await coach.reply(request)
      return c.json({ reply, remaining: COACH_DAILY_LIMIT - (used?.count ?? 0) - 1 })
    } catch (err) {
      console.error('coach provider failed', err)
      return c.json({ error: 'coach_failed' }, 502)
    }
  })

  app.route('/', authed)
  return app
}
