import { describe, expect, it } from 'vitest'
import { openDb } from '../src/db.ts'
import { dueReminders, sendDueReminders } from '../src/reminders.ts'
import { findOrCreateTelegramUser, type TelegramCall } from '../src/telegram.ts'

// 2026-09-21 15:30 UTC is 20:30 in Tashkent (UTC+5)
const NOW = Date.UTC(2026, 8, 21, 15, 30, 0)

function learner(profile: Record<string, unknown>, days: Record<string, { xp: number }> = {}) {
  const db = openDb(':memory:')
  const user = findOrCreateTelegramUser(db, 555, 'Ali', NOW)
  const state = { version: 1, updatedAt: NOW, profile: { baseLang: 'uz', ...profile }, days, streak: { current: 4 } }
  db.prepare('INSERT INTO states (user_id, state, updated_at) VALUES (?, ?, ?)').run(user.id, JSON.stringify(state), NOW)
  return { db, user }
}

describe('Telegram reminders', () => {
  it('reminds in the chosen local hour, once, when nothing was earned today', async () => {
    const { db } = learner({ reminderHour: 20, reminderVia: 'telegram', tzOffsetMin: 300 })
    expect(dueReminders(db, NOW)).toMatchObject([{ telegramId: 555, lang: 'uz', streak: 4, day: '2026-09-21' }])

    const sent: string[] = []
    const call: TelegramCall = async (_method, payload) => {
      sent.push(String(payload.text))
      return true
    }
    expect(await sendDueReminders(db, call, NOW)).toBe(1)
    expect(sent[0]).toContain('4')
    expect(await sendDueReminders(db, call, NOW + 60_000)).toBe(0)
  })

  it('stays quiet in another hour, after practice, for phone reminders and when switched off', () => {
    expect(dueReminders(learner({ reminderHour: 8, reminderVia: 'telegram', tzOffsetMin: 300 }).db, NOW)).toEqual([])
    expect(dueReminders(learner({ reminderHour: 20, reminderVia: 'telegram', tzOffsetMin: 300 }, { '2026-09-21': { xp: 15 } }).db, NOW)).toEqual([])
    expect(dueReminders(learner({ reminderHour: 20, reminderVia: 'device', tzOffsetMin: 300 }).db, NOW)).toEqual([])
    expect(dueReminders(learner({ reminderHour: null, reminderVia: 'telegram' }).db, NOW)).toEqual([])
  })

  it('uses the learner’s own time zone', () => {
    // Istanbul is UTC+3: 15:30 UTC is 18:30 there
    expect(dueReminders(learner({ reminderHour: 18, reminderVia: 'telegram', tzOffsetMin: 180, baseLang: 'tr' }).db, NOW)).toMatchObject([{ lang: 'tr' }])
  })
})
