import type { Db } from './db.ts'
import { cleanBotLang, type BotLang, type TelegramCall } from './telegram.ts'

/**
 * Daily practice reminders through the Telegram bot, for learners who signed in
 * with Telegram and asked for them (a browser cannot notify; a phone reminds by
 * itself and sets `reminderVia: 'device'`, which is skipped here).
 *
 * A reminder goes out in the learner's chosen local hour, only if they have not
 * earned any XP that day, and at most once a day.
 */

const DEFAULT_TZ_OFFSET_MIN = 5 * 60 // Tashkent, for states saved before the app reported its offset
const MAX_TZ_OFFSET_MIN = 14 * 60

export interface DueReminder {
  userId: number
  telegramId: number
  lang: BotLang
  streak: number
  day: string
}

const TEXT: Record<BotLang, (streak: number) => string> = {
  uz: (n) => (n > 0 ? `🔥 ${n} kunlik seriyangiz bor. Bugun hali mashq qilmadingiz: 3 daqiqa yetadi.` : 'Bugun hali mashq qilmadingiz. 3 daqiqa ingliz tilida gapirib oling 🗣️'),
  ru: (n) => (n > 0 ? `🔥 Ваша серия: ${n} дн. Сегодня вы ещё не занимались: хватит трёх минут.` : 'Сегодня вы ещё не занимались. Поговорите по-английски три минуты 🗣️'),
  tr: (n) => (n > 0 ? `🔥 ${n} günlük serin var. Bugün henüz çalışmadın: 3 dakika yeter.` : 'Bugün henüz çalışmadın. 3 dakika İngilizce konuş 🗣️'),
}

export async function dueReminders(db: Db, now: number): Promise<DueReminder[]> {
  const rows = await db.all<{ id: number; telegram_id: string; state: string }>('SELECT u.id AS id, u.telegram_id AS telegram_id, s.state AS state FROM users u JOIN states s ON s.user_id = u.id WHERE u.telegram_id IS NOT NULL')
  const due: DueReminder[] = []
  for (const row of rows) {
    let state: Record<string, unknown>
    try {
      state = JSON.parse(row.state) as Record<string, unknown>
    } catch {
      continue
    }
    const profile = (typeof state.profile === 'object' && state.profile !== null ? state.profile : {}) as Record<string, unknown>
    const hour = profile.reminderHour
    if (profile.reminderVia !== 'telegram' || typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour > 23) continue

    const tz = typeof profile.tzOffsetMin === 'number' && Number.isFinite(profile.tzOffsetMin) && Math.abs(profile.tzOffsetMin) <= MAX_TZ_OFFSET_MIN ? profile.tzOffsetMin : DEFAULT_TZ_OFFSET_MIN
    const local = new Date(now + tz * 60_000)
    if (local.getUTCHours() !== hour) continue
    const day = local.toISOString().slice(0, 10)

    const days = (typeof state.days === 'object' && state.days !== null ? state.days : {}) as Record<string, { xp?: unknown } | undefined>
    const xpToday = days[day]?.xp
    if (typeof xpToday === 'number' && xpToday > 0) continue
    if (await db.get('SELECT 1 AS one FROM telegram_reminders WHERE user_id = ? AND day = ?', row.id, day)) continue

    const streak = (typeof state.streak === 'object' && state.streak !== null ? (state.streak as { current?: unknown }).current : 0) as unknown
    due.push({ userId: Number(row.id), telegramId: Number(row.telegram_id), lang: cleanBotLang(profile.baseLang), streak: typeof streak === 'number' && streak > 0 ? Math.floor(streak) : 0, day })
  }
  return due
}

/** Send what is due. A learner who blocked the bot is still marked, so nobody is retried all hour. */
export async function sendDueReminders(db: Db, call: TelegramCall, now: number): Promise<number> {
  let sent = 0
  for (const reminder of await dueReminders(db, now)) {
    await db.run('INSERT INTO telegram_reminders (user_id, day) VALUES (?, ?) ON CONFLICT (user_id, day) DO NOTHING', reminder.userId, reminder.day)
    try {
      await call('sendMessage', { chat_id: reminder.telegramId, text: TEXT[reminder.lang](reminder.streak) })
      sent += 1
    } catch (err) {
      console.error('telegram reminder failed', err instanceof Error ? err.message : 'unknown error')
    }
  }
  return sent
}
