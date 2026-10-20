import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { User } from './auth.ts'
import type { Db } from './db.ts'

/**
 * Sign in with Telegram, through the bot rather than the web widget, so the
 * same flow works in the browser, on Android and on iOS and needs no domain
 * to be registered with BotFather:
 *
 *   1. the app asks for a login: it gets a `code` (goes into the t.me link)
 *      and a `secret` (never leaves the app);
 *   2. the learner opens https://t.me/<bot>?start=<code> and presses Start;
 *      the bot asks "is this you?" and the learner confirms with a button;
 *   3. the app, polling with code + secret, receives its session token.
 *
 * Knowing the link alone is not enough to take the session (the secret is
 * needed), and nothing happens without the explicit confirmation in Telegram.
 */

export const LOGIN_TTL_MS = 10 * 60 * 1000
const CALLBACK_PREFIX = 'ok:'

export type BotLang = 'uz' | 'ru' | 'tr'
const LANGS = new Set<string>(['uz', 'ru', 'tr'])
export const cleanBotLang = (value: unknown): BotLang => (typeof value === 'string' && LANGS.has(value) ? (value as BotLang) : 'uz')

const hash = (value: string) => createHash('sha256').update(value).digest('hex')

export interface PendingLogin {
  code: string
  secret: string
  expiresAt: number
}

export function startLogin(db: Db, lang: BotLang, now: number): PendingLogin {
  db.prepare('DELETE FROM telegram_logins WHERE expires_at <= ?').run(now)
  const code = randomBytes(18).toString('base64url')
  const secret = randomBytes(24).toString('base64url')
  const expiresAt = now + LOGIN_TTL_MS
  db.prepare('INSERT INTO telegram_logins (code, secret_hash, lang, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(code, hash(secret), lang, now, expiresAt)
  return { code, secret, expiresAt }
}

interface LoginRow {
  code: string
  secret_hash: string
  lang: string
  expires_at: number
  telegram_id: number | null
  telegram_name: string | null
  confirmed: number
}

const findLogin = (db: Db, code: string, now: number): LoginRow | null =>
  (db.prepare('SELECT code, secret_hash, lang, expires_at, telegram_id, telegram_name, confirmed FROM telegram_logins WHERE code = ? AND expires_at > ?').get(code, now) as LoginRow | undefined) ?? null

export type PollOutcome = { status: 'pending' } | { status: 'expired' } | { status: 'confirmed'; telegramId: number; name: string }

/** Called by the app. A confirmed login is consumed: it can be collected exactly once. */
export function pollLogin(db: Db, code: string, secret: string, now: number): PollOutcome {
  const row = findLogin(db, code, now)
  if (!row) return { status: 'expired' }
  const expected = Buffer.from(row.secret_hash, 'hex')
  const actual = Buffer.from(hash(secret), 'hex')
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { status: 'expired' }
  if (!row.confirmed || row.telegram_id === null) return { status: 'pending' }
  db.prepare('DELETE FROM telegram_logins WHERE code = ?').run(code)
  return { status: 'confirmed', telegramId: row.telegram_id, name: row.telegram_name ?? '' }
}

export function findOrCreateTelegramUser(db: Db, telegramId: number, name: string, now: number): User {
  const existing = db.prepare('SELECT id, email, name, guide, tier FROM users WHERE telegram_id = ?').get(telegramId) as User | undefined
  if (existing) return existing
  // no email and no password: "tg:<id>" can never match a normalised email, and the hash scheme never verifies
  const email = `tg:${telegramId}`
  const clean = name.trim().slice(0, 24)
  const result = db.prepare('INSERT INTO users (email, password_hash, name, telegram_id, created_at) VALUES (?, ?, ?, ?, ?)').run(email, 'telegram$', clean, telegramId, now)
  return { id: Number(result.lastInsertRowid), email, name: clean, guide: 'everest', tier: 0 }
}

// -- the bot ----------------------------------------------------------------------

const TEXT: Record<BotLang, { ask: string; yes: string; done: string; stale: string; hello: string }> = {
  uz: {
    ask: 'Aytla ilovasiga shu Telegram akkaunt bilan kirmoqchimisiz?',
    yes: '✅ Ha, bu men',
    done: 'Tayyor! Ilovaga qayting, u o‘zi davom etadi.',
    stale: 'Bu havola eskirgan. Ilovada «Telegram orqali kirish» tugmasini qayta bosing.',
    hello: 'Salom! Men Aytla botiman. Kirish uchun ilovadagi «Telegram orqali kirish» tugmasini bosing.',
  },
  ru: {
    ask: 'Войти в приложение Aytla с этим аккаунтом Telegram?',
    yes: '✅ Да, это я',
    done: 'Готово! Вернитесь в приложение, оно продолжит само.',
    stale: 'Эта ссылка устарела. Нажмите в приложении «Войти через Telegram» ещё раз.',
    hello: 'Привет! Я бот Aytla. Чтобы войти, нажмите в приложении «Войти через Telegram».',
  },
  tr: {
    ask: 'Aytla uygulamasına bu Telegram hesabıyla giriş yapmak istiyor musun?',
    yes: '✅ Evet, benim',
    done: 'Hazır! Uygulamaya dön, kendisi devam edecek.',
    stale: 'Bu bağlantının süresi doldu. Uygulamada «Telegram ile giriş» düğmesine yeniden bas.',
    hello: 'Merhaba! Ben Aytla botuyum. Giriş yapmak için uygulamadaki «Telegram ile giriş» düğmesine bas.',
  },
}

interface TgUser {
  id: number
  first_name?: string
  last_name?: string
  language_code?: string
}

interface TgUpdate {
  update_id: number
  message?: { text?: string; from?: TgUser; chat: { id: number } }
  callback_query?: { id: string; data?: string; from: TgUser; message?: { chat: { id: number }; message_id: number } }
}

const displayName = (u: TgUser) => [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
const guessLang = (u: TgUser | undefined): BotLang => (u?.language_code === 'ru' ? 'ru' : u?.language_code === 'tr' ? 'tr' : 'uz')

export type TelegramCall = (method: string, payload: Record<string, unknown>) => Promise<unknown>

/** One update from Telegram. Exported so it can be exercised without the network. */
export async function handleUpdate(db: Db, update: TgUpdate, call: TelegramCall, now: number): Promise<void> {
  const message = update.message
  if (message?.text?.startsWith('/start') && message.from) {
    const code = message.text.split(/\s+/)[1] ?? ''
    const row = code ? findLogin(db, code, now) : null
    if (!code) {
      await call('sendMessage', { chat_id: message.chat.id, text: TEXT[guessLang(message.from)].hello })
      return
    }
    if (!row || row.confirmed) {
      await call('sendMessage', { chat_id: message.chat.id, text: TEXT[guessLang(message.from)].stale })
      return
    }
    // remember who opened the link; only that person's confirmation counts
    db.prepare('UPDATE telegram_logins SET telegram_id = ?, telegram_name = ? WHERE code = ?').run(message.from.id, displayName(message.from), code)
    const text = TEXT[cleanBotLang(row.lang)]
    await call('sendMessage', { chat_id: message.chat.id, text: text.ask, reply_markup: { inline_keyboard: [[{ text: text.yes, callback_data: `${CALLBACK_PREFIX}${code}` }]] } })
    return
  }

  const query = update.callback_query
  if (query?.data?.startsWith(CALLBACK_PREFIX)) {
    const code = query.data.slice(CALLBACK_PREFIX.length)
    const row = findLogin(db, code, now)
    const mine = row !== null && row.telegram_id === query.from.id
    if (mine) db.prepare('UPDATE telegram_logins SET confirmed = 1 WHERE code = ?').run(code)
    const text = TEXT[row ? cleanBotLang(row.lang) : guessLang(query.from)]
    await call('answerCallbackQuery', { callback_query_id: query.id })
    if (query.message) await call('sendMessage', { chat_id: query.message.chat.id, text: mine ? text.done : text.stale })
  }
}

export interface TelegramBot {
  /** the bot's @username once Telegram has confirmed the token, else null */
  username: () => string | null
  /** call a Bot API method (used for reminders) */
  call: TelegramCall
  stop: () => void
}

/** Long polling: no public webhook URL is needed, so it also works on a laptop. One process only. */
export function startTelegramBot(db: Db, token: string, now: () => number = Date.now): TelegramBot {
  let username: string | null = null
  let stopped = false
  const controller = new AbortController()

  const call: TelegramCall = async (method, payload) => {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const data = (await response.json()) as { ok: boolean; result?: unknown; description?: string }
    if (!data.ok) throw new Error(`telegram ${method}: ${data.description ?? response.status}`)
    return data.result
  }

  const loop = async () => {
    let offset = 0
    while (!stopped) {
      try {
        if (username === null) username = ((await call('getMe', {})) as { username?: string }).username ?? null
        const updates = (await call('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'callback_query'] })) as TgUpdate[]
        for (const update of updates) {
          offset = update.update_id + 1
          await handleUpdate(db, update, call, now()).catch((err) => console.error('telegram update failed', err))
        }
      } catch (err) {
        if (stopped) return
        // never log the request URL: it contains the bot token
        console.error('telegram polling failed', err instanceof Error ? err.message : 'unknown error')
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
  }
  void loop()

  return {
    username: () => username,
    call,
    stop: () => {
      stopped = true
      controller.abort()
    },
  }
}
