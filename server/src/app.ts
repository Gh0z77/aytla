import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { AttemptLimiter, cleanName, createUser, findOrCreateClerkUser, findUserByEmail, hashPassword, isPlaceholderEmail, issueToken, normalizeEmail, revokeToken, userForToken, validPassword, verifyPassword, type User } from './auth.ts'
import type { ClerkVerifier } from './clerk.ts'
import type { CoachProvider } from './coach.ts'
import { COACH_DAILY_LIMIT, SCENARIOS, cleanCoachRequest } from './coach.ts'
import type { Db } from './db.ts'
import { leagueView, recordWeeklyXp } from './league.ts'
import { cleanBotLang, findOrCreateTelegramUser, pollLogin, startLogin } from './telegram.ts'
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
  /** the running Telegram bot's @username (null until Telegram has confirmed the token); omit to turn Telegram sign-in off */
  telegramBot?: () => string | null
  /** verifies Clerk session tokens (Google sign-in); omit to turn it off */
  clerk?: ClerkVerifier | null
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
  const clerk = options.clerk ?? null
  const loginLimiter = new AttemptLimiter(10, 15 * 60 * 1000)
  const telegramLimiter = new AttemptLimiter(20, 15 * 60 * 1000)
  const interestLimiter = new AttemptLimiter(10, 60 * 60 * 1000)
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

  // Telegram and Clerk accounts have no real email: their internal key is not shown to anyone
  const publicUser = (u: User) => ({ id: Number(u.id), email: isPlaceholderEmail(u.email) ? '' : u.email, telegram: u.provider === 'telegram', google: u.provider === 'google', name: u.name, guide: u.guide, tier: u.tier })
  const session = async (user: User, status: 200 | 201 = 200) => ({ token: await issueToken(db, user.id, now()), user: publicUser(user), status })

  // -- accounts ---------------------------------------------------------------

  app.post('/auth/register', async (c) => {
    const body = await readJson(c.req.raw)
    const email = normalizeEmail(body?.email)
    if (!email) return c.json({ error: 'invalid_email' }, 400)
    const password = body?.password
    if (!validPassword(password)) return c.json({ error: 'weak_password' }, 400)
    if (await findUserByEmail(db, email)) return c.json({ error: 'email_taken' }, 409)
    const user = await createUser(db, email, password, cleanName(body?.name), now())
    const { token } = await session(user)
    return c.json({ token, user: publicUser(user) }, 201)
  })

  app.post('/auth/login', async (c) => {
    const body = await readJson(c.req.raw)
    const email = normalizeEmail(body?.email)
    const password = typeof body?.password === 'string' ? body.password : ''
    const key = email ?? 'invalid'
    if (!loginLimiter.allow(key, now())) return c.json({ error: 'too_many_attempts' }, 429)
    const found = email ? await findUserByEmail(db, email) : null
    const ok = verifyPassword(password, found?.password_hash ?? decoyHash) && found !== null && found.provider === 'email'
    if (!found || !ok) return c.json({ error: 'invalid_credentials' }, 401)
    loginLimiter.reset(key)
    const { token } = await session(found)
    return c.json({ token, user: publicUser(found) })
  })

  app.get('/auth/providers', (c) => c.json({ telegram: Boolean(options.telegramBot?.()), google: clerk !== null }))

  // -- the Pro waiting list: an email, nothing else, told once when Pro ships ---------

  app.post('/pro/interest', async (c) => {
    const caller = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'direct'
    if (!interestLimiter.allow(caller, now())) return c.json({ error: 'too_many_attempts' }, 429)
    const body = await readJson(c.req.raw)
    const email = normalizeEmail(body?.email)
    if (!email) return c.json({ error: 'invalid_email' }, 400)
    await db.run('INSERT INTO pro_interest (email, lang, created_at) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING', email, cleanBotLang(body?.lang), now())
    return c.json({ ok: true }, 201)
  })

  // -- sign in with Google through Clerk (see clerk.ts) ----------------------------

  app.post('/auth/clerk', async (c) => {
    if (!clerk) return c.json({ error: 'clerk_unavailable' }, 503)
    const body = await readJson(c.req.raw)
    if (typeof body?.token !== 'string' || !body.token) return c.json({ error: 'invalid_request' }, 400)
    let identity
    try {
      identity = await clerk.verify(body.token)
    } catch {
      return c.json({ error: 'invalid_credentials' }, 401)
    }
    const email = normalizeEmail(body.email) ?? ''
    const user = await findOrCreateClerkUser(db, identity.id, email, cleanName(body.name), now())
    const { token } = await session(user)
    return c.json({ token, user: publicUser(user) })
  })

  // -- sign in with Telegram (see telegram.ts) -------------------------------------

  app.post('/auth/telegram/start', async (c) => {
    const bot = options.telegramBot?.()
    if (!bot) return c.json({ error: 'telegram_unavailable' }, 503)
    const caller = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'direct'
    if (!telegramLimiter.allow(caller, now())) return c.json({ error: 'too_many_attempts' }, 429)
    const body = await readJson(c.req.raw)
    const login = await startLogin(db, cleanBotLang(body?.lang), now())
    return c.json({ code: login.code, secret: login.secret, url: `https://t.me/${bot}?start=${login.code}`, expiresAt: login.expiresAt }, 201)
  })

  app.post('/auth/telegram/poll', async (c) => {
    const body = await readJson(c.req.raw)
    if (typeof body?.code !== 'string' || typeof body.secret !== 'string') return c.json({ error: 'invalid_request' }, 400)
    const outcome = await pollLogin(db, body.code, body.secret, now())
    if (outcome.status === 'expired') return c.json({ error: 'telegram_expired' }, 410)
    if (outcome.status === 'pending') return c.json({ status: 'pending' })
    const user = await findOrCreateTelegramUser(db, outcome.telegramId, outcome.name, now())
    const { token } = await session(user)
    return c.json({ status: 'confirmed', token, user: publicUser(user) })
  })

  // -- everything below needs a bearer token ------------------------------------

  const authed = new Hono<Env>()
  authed.use('*', async (c, next) => {
    const header = c.req.header('Authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    const user = token ? await userForToken(db, token, now()) : null
    if (!user) return c.json({ error: 'unauthorized' }, 401)
    c.set('user', user)
    c.set('token', token)
    return next()
  })

  authed.post('/auth/logout', async (c) => {
    await revokeToken(db, c.get('token'))
    return c.json({ ok: true })
  })

  authed.get('/me', (c) => c.json({ user: publicUser(c.get('user')) }))

  authed.delete('/me', async (c) => {
    // deleting the account removes sessions, state and league history (ON DELETE CASCADE)
    await db.run('DELETE FROM users WHERE id = ?', c.get('user').id)
    return c.json({ ok: true })
  })

  // -- cloud sync: last write wins on the learner's own `updatedAt` clock ---------

  authed.get('/sync', async (c) => {
    const row = await db.get<{ state: string; updated_at: number }>('SELECT state, updated_at FROM states WHERE user_id = ?', c.get('user').id)
    return c.json({ state: row ? (JSON.parse(row.state) as unknown) : null, updatedAt: row ? Number(row.updated_at) : 0 })
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

    const outcome = await db.transaction(async (tx) => {
      const stored = await tx.get<{ state: string; updated_at: number }>('SELECT state, updated_at FROM states WHERE user_id = ?', user.id)
      if (stored && Number(stored.updated_at) > summary.updatedAt) {
        // another device is ahead: the caller should adopt the stored state
        return { adopted: 'server' as const, state: JSON.parse(stored.state) as unknown, updatedAt: Number(stored.updated_at) }
      }
      await tx.run('INSERT INTO states (user_id, state, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at', user.id, JSON.stringify(state), summary.updatedAt)
      await tx.run('UPDATE users SET name = ?, guide = ? WHERE id = ?', summary.name, summary.guide, user.id)
      const week = weekId(now())
      if (summary.weekId === week) await recordWeeklyXp(tx, user.id, week, summary.weeklyXp)
      return { adopted: 'client' as const, state: null, updatedAt: summary.updatedAt }
    })
    return c.json(outcome)
  })

  // -- leagues ----------------------------------------------------------------

  authed.get('/league', async (c) => c.json(await leagueView(db, c.get('user').id, weekId(now()))))

  // -- AI conversation practice --------------------------------------------------

  authed.get('/coach/scenarios', (c) => c.json({ available: coach !== null, dailyLimit: COACH_DAILY_LIMIT, scenarios: SCENARIOS.map((s) => ({ id: s.id, guide: s.guide, level: s.level })) }))

  authed.post('/coach/chat', async (c) => {
    if (!coach) return c.json({ error: 'coach_unavailable' }, 503)
    const request = cleanCoachRequest(await readJson(c.req.raw))
    if (!request) return c.json({ error: 'invalid_request' }, 400)

    const user = c.get('user')
    const day = new Date(now()).toISOString().slice(0, 10)
    const used = await db.get<{ count: number }>('SELECT count FROM coach_usage WHERE user_id = ? AND day = ?', user.id, day)
    if ((used?.count ?? 0) >= COACH_DAILY_LIMIT) return c.json({ error: 'coach_limit_reached' }, 429)
    await db.run('INSERT INTO coach_usage (user_id, day, count) VALUES (?, ?, 1) ON CONFLICT(user_id, day) DO UPDATE SET count = coach_usage.count + 1', user.id, day)

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
