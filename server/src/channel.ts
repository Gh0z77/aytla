import sentences from './sentences.json' with { type: 'json' }
import type { TelegramCall } from './telegram.ts'

/**
 * "Sentence of the day" in a public Telegram channel: every morning the bot
 * posts one sentence of the course with its Uzbek translation and a nudge to
 * say it aloud. The bot must be an admin of the channel (TELEGRAM_CHANNEL,
 * e.g. "@aytla_daily"). The same sentence the app shows that day.
 */

interface DailySentence {
  en: string
  uz: string
  ru: string
  tr: string
}

const LIST = sentences as DailySentence[]
const TASHKENT_OFFSET_MIN = 5 * 60

/** the sentence for a given day (days since the epoch in Tashkent), the same one for everybody */
export function sentenceForDay(now: number): DailySentence | null {
  if (LIST.length === 0) return null
  const day = Math.floor((now + TASHKENT_OFFSET_MIN * 60_000) / 86_400_000)
  return LIST[day % LIST.length] ?? null
}

export function dailyPost(now: number, site: string): string | null {
  const s = sentenceForDay(now)
  if (!s) return null
  return [`🗣 <b>Bugungi gap</b>`, '', `<b>${escape(s.en)}</b>`, `<i>${escape(s.uz)}</i>`, '', `Ovoz chiqarib ayting. Keyin ilovada tekshiring: ${site}`].join('\n')
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** ms until the next 09:00 in Tashkent */
export function msUntilNextPost(now: number, hour = 9): number {
  const local = now + TASHKENT_OFFSET_MIN * 60_000
  const dayStart = Math.floor(local / 86_400_000) * 86_400_000
  let next = dayStart + hour * 3_600_000
  if (next <= local) next += 86_400_000
  return next - local
}

export function startDailyChannel(call: TelegramCall, channel: string, site: string, now: () => number = Date.now): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const schedule = () => {
    timer = setTimeout(async () => {
      const text = dailyPost(now(), site)
      if (text) await call('sendMessage', { chat_id: channel, text, parse_mode: 'HTML' }).catch((err) => console.error('channel post failed', err instanceof Error ? err.message : err))
      schedule()
    }, msUntilNextPost(now()))
    timer.unref()
  }
  schedule()
  return () => {
    if (timer) clearTimeout(timer)
  }
}
