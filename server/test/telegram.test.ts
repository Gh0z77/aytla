import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.ts'
import { openDb } from '../src/db.ts'
import { LOGIN_TTL_MS, handleUpdate, type TelegramCall } from '../src/telegram.ts'

const T0 = Date.UTC(2026, 8, 21, 9, 0, 0)

function setup(botName: string | null = 'everest_test_bot') {
  const db = openDb(':memory:')
  let clock = T0
  const app = createApp({ db, now: () => clock, telegramBot: () => botName })
  const sent: Array<{ method: string; payload: Record<string, unknown> }> = []
  const call: TelegramCall = async (method, payload) => {
    sent.push({ method, payload })
    return true
  }
  const post = (path: string, body: unknown) => app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { db, app, sent, call, post, advance: (ms: number) => (clock += ms), now: () => clock }
}

const from = (id: number) => ({ id, first_name: 'Ali', last_name: 'Valiyev', language_code: 'uz' })

describe('sign in with Telegram', () => {
  it('is off when no bot is running', async () => {
    const { app, post } = setup(null)
    expect(await (await app.request('/auth/providers')).json()).toEqual({ telegram: false })
    expect((await post('/auth/telegram/start', { lang: 'uz' })).status).toBe(503)
  })

  it('logs a learner in after they confirm in the bot, exactly once', async () => {
    const t = setup()
    const started = (await (await t.post('/auth/telegram/start', { lang: 'ru' })).json()) as { code: string; secret: string; url: string }
    expect(started.url).toBe(`https://t.me/everest_test_bot?start=${started.code}`)
    expect(await (await t.post('/auth/telegram/poll', started)).json()).toEqual({ status: 'pending' })

    await handleUpdate(t.db, { update_id: 1, message: { text: `/start ${started.code}`, from: from(777), chat: { id: 777 } } }, t.call, t.now())
    expect(t.sent[0]?.method).toBe('sendMessage')
    expect(String(t.sent[0]?.payload.text)).toContain('Telegram') // asked in Russian, the language the app sent
    // opening the link is not enough
    expect(await (await t.post('/auth/telegram/poll', started)).json()).toEqual({ status: 'pending' })

    await handleUpdate(t.db, { update_id: 2, callback_query: { id: 'q', data: `ok:${started.code}`, from: from(777), message: { chat: { id: 777 }, message_id: 5 } } }, t.call, t.now())
    const done = (await (await t.post('/auth/telegram/poll', started)).json()) as { status: string; token: string; user: { name: string; email: string; telegram: boolean } }
    expect(done.status).toBe('confirmed')
    expect(done.user).toMatchObject({ name: 'Ali Valiyev', email: '', telegram: true })
    const me = await t.app.request('/me', { headers: { Authorization: `Bearer ${done.token}` } })
    expect(me.status).toBe(200)

    // the login is consumed
    expect((await t.post('/auth/telegram/poll', started)).status).toBe(410)
  })

  it('gives the same account to the same Telegram user', async () => {
    const t = setup()
    const ids: number[] = []
    for (let i = 0; i < 2; i++) {
      const started = (await (await t.post('/auth/telegram/start', { lang: 'uz' })).json()) as { code: string; secret: string }
      await handleUpdate(t.db, { update_id: 10 + i, message: { text: `/start ${started.code}`, from: from(42), chat: { id: 42 } } }, t.call, t.now())
      await handleUpdate(t.db, { update_id: 20 + i, callback_query: { id: 'q', data: `ok:${started.code}`, from: from(42) } }, t.call, t.now())
      ids.push(((await (await t.post('/auth/telegram/poll', started)).json()) as { user: { id: number } }).user.id)
    }
    expect(ids[0]).toBe(ids[1])
  })

  it('ignores a confirmation from somebody else, a wrong secret and an expired code', async () => {
    const t = setup()
    const started = (await (await t.post('/auth/telegram/start', { lang: 'uz' })).json()) as { code: string; secret: string }
    await handleUpdate(t.db, { update_id: 1, message: { text: `/start ${started.code}`, from: from(1), chat: { id: 1 } } }, t.call, t.now())
    await handleUpdate(t.db, { update_id: 2, callback_query: { id: 'q', data: `ok:${started.code}`, from: from(2) } }, t.call, t.now())
    expect(await (await t.post('/auth/telegram/poll', started)).json()).toEqual({ status: 'pending' })

    expect((await t.post('/auth/telegram/poll', { code: started.code, secret: 'not-the-secret' })).status).toBe(410)

    t.advance(LOGIN_TTL_MS + 1)
    expect((await t.post('/auth/telegram/poll', started)).status).toBe(410)
  })
})
