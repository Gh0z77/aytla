import type { Db } from './db.ts'

/**
 * Product analytics and crash reports, kept in our own database: which
 * screens people reach, where lessons are abandoned, what breaks. Events are
 * anonymous (a random id per install) unless the learner is signed in; no
 * personal data is accepted in the properties.
 */

export const MAX_EVENTS_PER_BATCH = 50
const MAX_NAME = 40
const MAX_PROPS = 1000

export interface IncomingEvent {
  name: string
  ts: number
  props: Record<string, string | number | boolean>
}

const NAME = /^[a-z][a-z0-9_]{1,39}$/

export function cleanEvents(body: Record<string, unknown> | null): { anon: string; events: IncomingEvent[] } | null {
  if (!body || typeof body.anon !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(body.anon)) return null
  if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > MAX_EVENTS_PER_BATCH) return null
  const events: IncomingEvent[] = []
  for (const item of body.events as unknown[]) {
    if (typeof item !== 'object' || item === null) return null
    const { name, ts, props } = item as Record<string, unknown>
    if (typeof name !== 'string' || name.length > MAX_NAME || !NAME.test(name)) return null
    if (typeof ts !== 'number' || !Number.isFinite(ts)) return null
    const clean: IncomingEvent['props'] = {}
    if (props !== undefined) {
      if (typeof props !== 'object' || props === null) return null
      for (const [k, v] of Object.entries(props as Record<string, unknown>)) {
        if (!NAME.test(k)) continue
        if (typeof v === 'string') clean[k] = v.slice(0, 120)
        else if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v
        else if (typeof v === 'boolean') clean[k] = v
      }
    }
    if (JSON.stringify(clean).length > MAX_PROPS) return null
    events.push({ name, ts, props: clean })
  }
  return { anon: body.anon, events }
}

export async function storeEvents(db: Db, anon: string, userId: number | null, events: IncomingEvent[], receivedAt: number): Promise<void> {
  for (const e of events) {
    await db.run('INSERT INTO events (anon, user_id, name, props, ts, received_at) VALUES (?, ?, ?, ?, ?, ?)', anon, userId, e.name, JSON.stringify(e.props), e.ts, receivedAt)
  }
}

export interface IncomingError {
  anon: string
  message: string
  stack: string
  platform: string
  version: string
}

export function cleanError(body: Record<string, unknown> | null): IncomingError | null {
  if (!body || typeof body.message !== 'string' || !body.message.trim()) return null
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
  const anon = str(body.anon, 64) || 'unknown'
  return { anon, message: body.message.trim().slice(0, 500), stack: str(body.stack, 4000), platform: str(body.platform, 40), version: str(body.version, 40) }
}

export async function storeError(db: Db, error: IncomingError, userId: number | null, receivedAt: number): Promise<void> {
  await db.run('INSERT INTO client_errors (anon, user_id, message, stack, platform, version, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)', error.anon, userId, error.message, error.stack, error.platform, error.version, receivedAt)
}

/** what the founder looks at: the last two weeks in numbers */
export async function adminStats(db: Db, now: number): Promise<Record<string, unknown>> {
  const since = now - 14 * 24 * 60 * 60 * 1000
  const users = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users')
  const newUsers = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', since)
  const pro = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users WHERE pro_until > ?', now)
  const interest = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM pro_interest')
  const byName = await db.all<{ name: string; n: number; people: number }>('SELECT name, COUNT(*) AS n, COUNT(DISTINCT anon) AS people FROM events WHERE ts >= ? GROUP BY name ORDER BY n DESC', since)
  const active = await db.get<{ n: number }>('SELECT COUNT(DISTINCT anon) AS n FROM events WHERE ts >= ?', now - 7 * 24 * 60 * 60 * 1000)
  const errors = await db.all<{ message: string; platform: string; version: string; received_at: number }>('SELECT message, platform, version, received_at FROM client_errors ORDER BY received_at DESC LIMIT 20')
  return {
    users: Number(users?.n ?? 0),
    newUsers14d: Number(newUsers?.n ?? 0),
    proActive: Number(pro?.n ?? 0),
    proInterest: Number(interest?.n ?? 0),
    activeInstalls7d: Number(active?.n ?? 0),
    events14d: byName.map((r) => ({ name: r.name, count: Number(r.n), people: Number(r.people) })),
    lastErrors: errors.map((e) => ({ ...e, received_at: Number(e.received_at) })),
  }
}
