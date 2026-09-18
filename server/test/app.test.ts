import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'
import { COACH_DAILY_LIMIT, type CoachProvider } from '../src/coach.ts'
import { openDb } from '../src/db.ts'
import { weekId } from '../src/time.ts'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MONDAY_NOON = new Date(2026, 8, 14, 12, 0, 0).getTime()

let clock = MONDAY_NOON
let app: ReturnType<typeof createApp>

const fakeCoach: CoachProvider = {
  reply: async (req) => ({ text: `Hello from ${req.scenarioId}! How are you?`, translation: 'Salom! Qalaysan?', correction: '', better: '' }),
}

beforeEach(() => {
  clock = MONDAY_NOON
  app = createApp({ db: openDb(':memory:'), now: () => clock, coach: fakeCoach })
})

const json = (body: unknown, token?: string): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
})
const auth = (token: string, method = 'GET'): RequestInit => ({ method, headers: { Authorization: `Bearer ${token}` } })

async function register(email: string, name = 'Ali'): Promise<string> {
  const res = await app.request('/auth/register', json({ email, password: 'correct horse', name }))
  expect(res.status).toBe(201)
  return ((await res.json()) as { token: string }).token
}

const stateOf = (updatedAt: number, weeklyXp: number, name = 'Ali') => ({
  version: 1,
  updatedAt,
  xp: weeklyXp,
  profile: { name, guide: 'pix' },
  league: { weekId: weekId(clock), weeklyXp, tier: 0 },
})

const putState = (token: string, state: unknown) => app.request('/sync', { ...json({ state }, token), method: 'PUT' })

describe('accounts', () => {
  it('registers, rejects duplicates and bad input', async () => {
    await register('ali@example.com')
    expect((await app.request('/auth/register', json({ email: 'ALI@example.com', password: 'correct horse' }))).status).toBe(409)
    expect((await app.request('/auth/register', json({ email: 'nope', password: 'correct horse' }))).status).toBe(400)
    expect((await app.request('/auth/register', json({ email: 'b@example.com', password: 'short' }))).status).toBe(400)
    expect((await app.request('/auth/register', { method: 'POST', body: 'not json' })).status).toBe(400)
  })

  it('logs in with the right password only', async () => {
    await register('ali@example.com')
    const ok = await app.request('/auth/login', json({ email: 'ali@example.com', password: 'correct horse' }))
    expect(ok.status).toBe(200)
    expect(((await ok.json()) as { user: { email: string } }).user.email).toBe('ali@example.com')
    expect((await app.request('/auth/login', json({ email: 'ali@example.com', password: 'wrong password' }))).status).toBe(401)
    expect((await app.request('/auth/login', json({ email: 'ghost@example.com', password: 'correct horse' }))).status).toBe(401)
  })

  it('locks out repeated failed logins for a while', async () => {
    await register('ali@example.com')
    for (let i = 0; i < 10; i++) await app.request('/auth/login', json({ email: 'ali@example.com', password: 'wrong password' }))
    expect((await app.request('/auth/login', json({ email: 'ali@example.com', password: 'correct horse' }))).status).toBe(429)
    clock += 16 * 60 * 1000
    expect((await app.request('/auth/login', json({ email: 'ali@example.com', password: 'correct horse' }))).status).toBe(200)
  })

  it('protects private routes and revokes tokens on logout', async () => {
    expect((await app.request('/me')).status).toBe(401)
    expect((await app.request('/me', auth('garbage'))).status).toBe(401)
    const token = await register('ali@example.com')
    expect((await app.request('/me', auth(token))).status).toBe(200)
    expect((await app.request('/auth/logout', auth(token, 'POST'))).status).toBe(200)
    expect((await app.request('/me', auth(token))).status).toBe(401)
  })

  it('deletes the account and everything attached to it', async () => {
    const token = await register('ali@example.com')
    await putState(token, stateOf(clock, 50))
    expect((await app.request('/me', auth(token, 'DELETE'))).status).toBe(200)
    expect((await app.request('/me', auth(token))).status).toBe(401)
    expect((await app.request('/auth/login', json({ email: 'ali@example.com', password: 'correct horse' }))).status).toBe(401)
  })
})

describe('sync', () => {
  it('stores the newest state and hands back a newer one from another device', async () => {
    const token = await register('ali@example.com')
    const empty = (await (await app.request('/sync', auth(token))).json()) as { state: unknown }
    expect(empty.state).toBeNull()

    const first = (await (await putState(token, stateOf(1000, 20))).json()) as { adopted: string }
    expect(first.adopted).toBe('client')

    const stale = (await (await putState(token, stateOf(500, 5))).json()) as { adopted: string; state: { updatedAt: number } }
    expect(stale.adopted).toBe('server')
    expect(stale.state.updatedAt).toBe(1000)

    const stored = (await (await app.request('/sync', auth(token))).json()) as { state: { updatedAt: number; profile: { guide: string } } }
    expect(stored.state.updatedAt).toBe(1000)
    expect(stored.state.profile.guide).toBe('pix')
  })

  it('rejects malformed and oversized states', async () => {
    const token = await register('ali@example.com')
    expect((await putState(token, { version: 2 })).status).toBe(400)
    expect((await putState(token, 'nope')).status).toBe(400)
    expect((await putState(token, { ...stateOf(1, 0), blob: 'x'.repeat(600 * 1024) })).status).toBe(413)
  })
})

describe('leagues', () => {
  it('ranks learners of the same week and never lowers recorded xp', async () => {
    const ali = await register('ali@example.com', 'Ali')
    const vali = await register('vali@example.com', 'Vali')
    const before = (await (await app.request('/league', auth(ali))).json()) as { joined: boolean }
    expect(before.joined).toBe(false)

    await putState(ali, stateOf(clock, 120, 'Ali'))
    await putState(vali, stateOf(clock, 300, 'Vali'))
    await putState(ali, stateOf(clock + 1, 80, 'Ali')) // a lower number must not reduce the score

    const view = (await (await app.request('/league', auth(ali))).json()) as { joined: boolean; tier: number; entries: Array<{ name: string; xp: number; rank: number; me: boolean }> }
    expect(view.joined).toBe(true)
    expect(view.tier).toBe(0)
    expect(view.entries.map((e) => [e.rank, e.name, e.xp, e.me])).toEqual([
      [1, 'Vali', 300, false],
      [2, 'Ali', 120, true],
    ])
  })

  it('ignores xp reported for a different week', async () => {
    const ali = await register('ali@example.com')
    const state = stateOf(clock, 500)
    state.league.weekId = '2020-W01'
    await putState(ali, state)
    const view = (await (await app.request('/league', auth(ali))).json()) as { joined: boolean }
    expect(view.joined).toBe(false)
  })

  it('promotes last week’s top learners when they return', async () => {
    const ali = await register('ali@example.com')
    await putState(ali, stateOf(clock, 200))
    clock += WEEK_MS
    await putState(ali, stateOf(clock, 10))
    const view = (await (await app.request('/league', auth(ali))).json()) as { tier: number; tierName: string }
    expect(view.tier).toBe(1)
    expect(view.tierName).toBe('Camp 1')
  })
})

describe('coach', () => {
  it('answers through the provider and counts usage', async () => {
    const token = await register('ali@example.com')
    const res = await app.request('/coach/chat', json({ scenarioId: 'cafe', baseLang: 'uz', messages: [] }, token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { reply: { text: string }; remaining: number }
    expect(body.reply.text).toContain('cafe')
    expect(body.remaining).toBe(COACH_DAILY_LIMIT - 1)
  })

  it('validates the request', async () => {
    const token = await register('ali@example.com')
    expect((await app.request('/coach/chat', json({ scenarioId: 'nope', baseLang: 'uz', messages: [] }, token))).status).toBe(400)
    expect((await app.request('/coach/chat', json({ scenarioId: 'cafe', baseLang: 'de', messages: [] }, token))).status).toBe(400)
    expect((await app.request('/coach/chat', json({ scenarioId: 'cafe', baseLang: 'uz', messages: [{ role: 'assistant', text: 'Hi' }] }, token))).status).toBe(400)
  })

  it('stops at the daily limit', async () => {
    const token = await register('ali@example.com')
    const ask = () => app.request('/coach/chat', json({ scenarioId: 'free', baseLang: 'ru', messages: [{ role: 'user', text: 'Hello' }] }, token))
    for (let i = 0; i < COACH_DAILY_LIMIT; i++) expect((await ask()).status).toBe(200)
    expect((await ask()).status).toBe(429)
  })

  it('reports itself unavailable without a provider', async () => {
    app = createApp({ db: openDb(':memory:'), now: () => clock, coach: null })
    const token = await register('ali@example.com')
    expect((await app.request('/coach/chat', json({ scenarioId: 'cafe', baseLang: 'uz', messages: [] }, token))).status).toBe(503)
    const health = (await (await app.request('/health')).json()) as { coach: boolean }
    expect(health.coach).toBe(false)
  })
})
