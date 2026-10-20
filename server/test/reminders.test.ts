import { describe, expect, it } from 'vitest'
import { openDb } from '../src/db.ts'
import { dueReminders, sendDueReminders } from '../src/reminders.ts'
import { findOrCreateTelegramUser, type TelegramCall } from '../src/telegram.ts'

// 2026-09-21 15:30 UTC is 20:30 in Tashkent (UTC+5)
const NOW = Date.UTC(2026, 8, 21, 15, 30, 0)

async function learner(profile: Record<string, unknown>, days: Record<string, { xp: number }> = {}) {
  const db = await openDb(':memory:')
  const user = await findOrCreateTelegramUser(db, 555, 'Ali', NOW)
  const state = { version: 1, updatedAt: NOW, profile: { baseLang: 'uz', ...profile }, days, streak: { current: 4 } }
  await db.run('INSERT INTO states (user_id, state, updated_at) VALUES (?, ?, ?)', user.id, JSON.stringify(state), NOW)
  return { db, user }
}

const due = async (profile: Record<string, unknown>, days?: Record<string, { xp: number }>) => dueReminders((await learner(profile, days)).db, NOW)

describe('Telegram reminders', () => {
  it('reminds in the chosen local hour, once, when nothing was earned today', async () => {
    const { db } = await learner({ reminderHour: 20, reminderVia: 'telegram', tzOffsetMin: 300 })
    expect(await dueReminders(db, NOW)).toMatchObject([{ telegramId: 555, lang: 'uz', streak: 4, day: '2026-09-21' }])

    const sent: string[] = []
    const call: TelegramCall = async (_method, payload) => {
      sent.push(String(payload.text))
      return true
    }
    expect(await sendDueReminders(db, call, NOW)).toBe(1)
    expect(sent[0]).toContain('4')
    expect(await sendDueReminders(db, call, NOW + 60_000)).toBe(0)
  })

  it('stays quiet in another hour, after practice, for phone reminders and when switched off', async () => {
    expect(await due({ reminderHour: 8, reminderVia: 'telegram', tzOffsetMin: 300 })).toEqual([])
    expect(await due({ reminderHour: 20, reminderVia: 'telegram', tzOffsetMin: 300 }, { '2026-09-21': { xp: 15 } })).toEqual([])
    expect(await due({ reminderHour: 20, reminderVia: 'device', tzOffsetMin: 300 })).toEqual([])
    expect(await due({ reminderHour: null, reminderVia: 'telegram' })).toEqual([])
  })

  it('uses the learner’s own time zone', async () => {
    // Istanbul is UTC+3: 15:30 UTC is 18:30 there
    expect(await due({ reminderHour: 18, reminderVia: 'telegram', tzOffsetMin: 180, baseLang: 'tr' })).toMatchObject([{ lang: 'tr' }])
  })
})
