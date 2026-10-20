import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'
import { frontendApiFromPublishableKey, type ClerkVerifier } from '../src/clerk.ts'
import { openDb } from '../src/db.ts'

const T0 = Date.UTC(2026, 9, 20, 9, 0, 0)

/** a verifier that accepts "good:<id>" and rejects everything else, standing in for Clerk's JWKS */
const fakeClerk: ClerkVerifier = {
  async verify(token) {
    if (!token.startsWith('good:')) throw new Error('bad token')
    return { id: token.slice(5) }
  },
}

async function setup(clerk: ClerkVerifier | null = fakeClerk) {
  const db = await openDb(':memory:')
  const app = createApp({ db, now: () => T0, clerk })
  const post = (path: string, body: unknown, token?: string) =>
    app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
  return { db, app, post }
}

describe('sign in with Google through Clerk', () => {
  it('decodes the Frontend API host from the publishable key', () => {
    const encoded = Buffer.from('bright-fox-12.clerk.accounts.dev$').toString('base64')
    expect(frontendApiFromPublishableKey(`pk_test_${encoded}`)).toBe('bright-fox-12.clerk.accounts.dev')
    expect(frontendApiFromPublishableKey('sk_test_whatever')).toBeNull()
    expect(frontendApiFromPublishableKey('pk_test_!!!')).toBeNull()
  })

  it('is off without a verifier', async () => {
    const { app, post } = await setup(null)
    expect(await (await app.request('/auth/providers')).json()).toEqual({ telegram: false, google: false })
    expect((await post('/auth/clerk', { token: 'good:user_1' })).status).toBe(503)
  })

  it('issues an app token for a valid Clerk token and keeps the same account next time', async () => {
    const { app, post } = await setup()
    expect(await (await app.request('/auth/providers')).json()).toEqual({ telegram: false, google: true })

    const first = await post('/auth/clerk', { token: 'good:user_1', email: 'Ali@Example.com', name: 'Ali' })
    expect(first.status).toBe(200)
    const a = (await first.json()) as { token: string; user: { id: number; email: string; google: boolean; name: string } }
    expect(a.user).toMatchObject({ email: 'ali@example.com', google: true, telegram: false, name: 'Ali' })

    const me = await app.request('/me', { headers: { Authorization: `Bearer ${a.token}` } })
    expect(me.status).toBe(200)

    const second = await post('/auth/clerk', { token: 'good:user_1', email: 'ali@example.com', name: 'Ali' })
    const b = (await second.json()) as { user: { id: number } }
    expect(b.user.id).toBe(a.user.id)

    expect((await post('/auth/clerk', { token: 'forged' })).status).toBe(401)
    expect((await post('/auth/clerk', {})).status).toBe(400)
  })

  it('does not take over an email that belongs to a password account', async () => {
    const { app, post } = await setup()
    expect((await post('/auth/register', { email: 'ali@example.com', password: 'correct horse', name: 'Ali' })).status).toBe(201)
    const res = await post('/auth/clerk', { token: 'good:user_2', email: 'ali@example.com', name: 'Someone' })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { user: { email: string; google: boolean } }
    // the Google account gets its own record, with no visible email, instead of the password account
    expect(body.user).toMatchObject({ email: '', google: true })
    const login = await post('/auth/login', { email: 'ali@example.com', password: 'correct horse' })
    expect(login.status).toBe(200)
    expect(((await login.json()) as { user: { name: string } }).user.name).toBe('Ali')
    void app
  })
})
