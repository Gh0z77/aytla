import { describe, expect, it } from 'vitest'
import {
  HEART_REFILL_MS,
  MAX_HEARTS,
  SHOP,
  START_GEMS,
  applyLessonResult,
  buy,
  createInitialState,
  dailyQuests,
  dueItems,
  loseHeart,
  msUntilNextHeart,
  openChest,
  practiceItems,
  rollDay,
  syncHearts,
} from '../progress'
import { dayKey, weekId } from '../time'
import type { LessonResult, UserState } from '../types'

const at = (day: number, hour = 10) => new Date(2026, 8, day, hour, 0, 0, 0).getTime() // September 2026
const HOUR = 3_600_000

const lessonResult = (over: Partial<LessonResult> = {}): LessonResult => ({
  sessionKind: 'lesson',
  lessonId: 'u01-l1',
  items: [
    { itemId: 'u01.w.hello', correct: true },
    { itemId: 'u01.s.01', correct: true },
  ],
  total: 12,
  mistakes: 0,
  maxCombo: 12,
  seconds: 90,
  ...over,
})

const fresh = (goal: 10 | 20 | 30 | 50 = 10): UserState => createInitialState(at(14), { dailyGoalXp: goal })

describe('time helpers', () => {
  it('computes ISO weeks, including the year boundary', () => {
    expect(weekId(new Date(2026, 8, 14))).toBe('2026-W38')
    expect(weekId(new Date(2026, 8, 13))).toBe('2026-W37')
    expect(weekId(new Date(2027, 0, 1))).toBe('2026-W53')
    expect(weekId(new Date(2027, 0, 4))).toBe('2027-W01')
  })
})

describe('initial state', () => {
  it('starts with full hearts, starter gems and three quests', () => {
    const s = fresh()
    expect(s.hearts.count).toBe(MAX_HEARTS)
    expect(s.gems).toBe(START_GEMS)
    expect(s.quests.items).toHaveLength(3)
    expect(s.quests.day).toBe(dayKey(at(14)))
  })
  it('generates the same quests for the same day', () => {
    expect(dailyQuests('2026-09-14', 20)).toEqual(dailyQuests('2026-09-14', 20))
    expect(new Set(dailyQuests('2026-09-14', 20).map((q) => q.kind)).size).toBe(3)
  })
})

describe('hearts', () => {
  it('loses hearts and refills one per interval', () => {
    let s = loseHeart(loseHeart(fresh(), at(14)), at(14))
    expect(s.hearts.count).toBe(3)
    expect(msUntilNextHeart(s, at(14))).toBe(HEART_REFILL_MS)
    s = syncHearts(s, at(14) + HEART_REFILL_MS + HOUR)
    expect(s.hearts.count).toBe(4)
    expect(msUntilNextHeart(s, at(14) + HEART_REFILL_MS + HOUR)).toBe(HEART_REFILL_MS - HOUR)
    s = syncHearts(s, at(14) + 10 * HEART_REFILL_MS)
    expect(s.hearts.count).toBe(MAX_HEARTS)
    expect(msUntilNextHeart(s, at(20))).toBeNull()
  })
  it('never goes below zero', () => {
    let s = fresh()
    for (let i = 0; i < 8; i++) s = loseHeart(s, at(14))
    expect(s.hearts.count).toBe(0)
  })
  it('restores a heart after a practice session', () => {
    const s = loseHeart(fresh(), at(14))
    const { state, rewards } = applyLessonResult(s, lessonResult({ sessionKind: 'practice', lessonId: null }), at(14, 11))
    expect(rewards.heartsRestored).toBe(1)
    expect(state.hearts.count).toBe(MAX_HEARTS)
  })
})

describe('applyLessonResult', () => {
  it('awards xp with perfect and combo bonuses, gems for a first completion', () => {
    const { state, rewards } = applyLessonResult(fresh(), lessonResult(), at(14))
    expect(rewards.xp).toBe(10 + 5 + 5)
    expect(rewards.perfect).toBe(true)
    expect(rewards.accuracy).toBe(100)
    expect(state.xp).toBe(20)
    expect(state.league.weeklyXp).toBe(20)
    expect(state.lessons['u01-l1']).toMatchObject({ completed: 1, bestAccuracy: 100 })
    expect(state.gems).toBeGreaterThanOrEqual(START_GEMS + 5)
    expect(state.days[dayKey(at(14))]).toMatchObject({ xp: 20, lessons: 1, perfect: 1, maxCombo: 12 })
  })

  it('gives less xp for a replay and computes accuracy from retries', () => {
    const first = applyLessonResult(fresh(), lessonResult(), at(14)).state
    const { rewards } = applyLessonResult(first, lessonResult({ mistakes: 4, maxCombo: 3 }), at(14, 12))
    expect(rewards.xp).toBe(5)
    expect(rewards.accuracy).toBe(75)
    expect(rewards.perfect).toBe(false)
  })

  it('doubles xp while a boost is active', () => {
    const bought = buy(fresh(), 'xpBoost', at(14))
    expect(bought.ok).toBe(true)
    const { rewards } = applyLessonResult(bought.state, lessonResult(), at(14) + 60_000)
    expect(rewards.xp).toBe(40)
  })

  it('claims quests that reach their target', () => {
    const s = fresh()
    const state: UserState = { ...s, quests: { day: s.quests.day, items: [{ id: 'q', kind: 'lessons', target: 1, rewardGems: 10, claimed: false }] } }
    const { rewards, state: next } = applyLessonResult(state, lessonResult(), at(14))
    expect(rewards.questsCompleted.map((q) => q.id)).toEqual(['q'])
    expect(next.quests.items[0]?.claimed).toBe(true)
    // a second lesson does not pay the quest again
    const again = applyLessonResult(next, lessonResult({ lessonId: 'u01-l2' }), at(14, 12))
    expect(again.rewards.questsCompleted).toEqual([])
  })

  it('unlocks achievements and pays gems for them', () => {
    const { rewards } = applyLessonResult(fresh(), lessonResult(), at(14))
    expect(rewards.achievements).toEqual(expect.arrayContaining([{ id: 'lessons', level: 1 }, { id: 'perfect', level: 1 }]))
  })
})

describe('streak', () => {
  const play = (s: UserState, day: number) => applyLessonResult(s, lessonResult({ lessonId: `u01-l${day}` }), at(day)).state

  it('extends once per day when the daily goal is reached', () => {
    let s = play(fresh(10), 14)
    expect(s.streak.current).toBe(1)
    s = applyLessonResult(s, lessonResult({ lessonId: 'u01-l9' }), at(14, 15)).state
    expect(s.streak.current).toBe(1)
    s = play(s, 15)
    expect(s.streak).toMatchObject({ current: 2, longest: 2, lastGoalDay: dayKey(at(15)) })
  })

  it('does not extend below the daily goal', () => {
    const s = applyLessonResult(fresh(50), lessonResult(), at(14)).state
    expect(s.streak.current).toBe(0)
  })

  it('breaks after a missed day without a freeze', () => {
    let s = play(play(fresh(10), 14), 15)
    s = rollDay(s, at(17))
    expect(s.streak.current).toBe(0)
    expect(s.streak.longest).toBe(2)
    s = play(s, 17)
    expect(s.streak.current).toBe(1)
  })

  it('spends a freeze per missed day and keeps the streak', () => {
    let s = play(play(fresh(10), 14), 15)
    const bought = buy(s, 'streakFreeze', at(15))
    expect(bought.ok).toBe(true)
    s = rollDay(bought.state, at(17))
    expect(s.streak).toMatchObject({ current: 2, freezes: 0, frozenDays: [dayKey(at(16))] })
    s = play(s, 17)
    expect(s.streak.current).toBe(3)
  })

  it('breaks when there are fewer freezes than missed days', () => {
    let s = play(play(fresh(10), 14), 15)
    s = buy(s, 'streakFreeze', at(15)).state
    s = rollDay(s, at(18))
    expect(s.streak.current).toBe(0)
  })

  it('refreshes quests and resets weekly xp on a new week', () => {
    let s = play(fresh(10), 14)
    s = rollDay(s, at(21))
    expect(s.quests.day).toBe(dayKey(at(21)))
    expect(s.league.weeklyXp).toBe(0)
    expect(s.league.weekId).toBe(weekId(at(21)))
  })
})

describe('shop and chests', () => {
  it('sells streak freezes up to the maximum', () => {
    let s = { ...fresh(), gems: 1000 }
    s = buy(s, 'streakFreeze', at(14)).state
    s = buy(s, 'streakFreeze', at(14)).state
    expect(s.streak.freezes).toBe(SHOP.streakFreeze.max)
    expect(s.gems).toBe(1000 - 2 * SHOP.streakFreeze.cost)
    expect(buy(s, 'streakFreeze', at(14))).toMatchObject({ ok: false, reason: 'max' })
  })
  it('refuses a heart refill at full hearts or without gems', () => {
    expect(buy(fresh(), 'heartRefill', at(14))).toMatchObject({ ok: false, reason: 'full' })
    const poor = { ...loseHeart(fresh(), at(14)), gems: 10 }
    expect(buy(poor, 'heartRefill', at(14))).toMatchObject({ ok: false, reason: 'gems' })
    const rich = loseHeart(fresh(), at(14))
    const done = buy(rich, 'heartRefill', at(14))
    expect(done.ok).toBe(true)
    expect(done.state.hearts.count).toBe(MAX_HEARTS)
  })
  it('opens a chest only once', () => {
    const first = openChest(fresh(), 'u01-chest', at(14))
    expect(first.gems).toBeGreaterThan(0)
    expect(openChest(first.state, 'u01-chest', at(14)).gems).toBe(0)
  })
})

describe('spaced repetition', () => {
  it('schedules wrong items for tomorrow and right items later', () => {
    const result = lessonResult({ items: [{ itemId: 'u01.w.hello', correct: true }, { itemId: 'u01.s.01', correct: false }], mistakes: 1 })
    const s = applyLessonResult(fresh(), result, at(14)).state
    expect(s.srs['u01.s.01']).toMatchObject({ box: 1, lapses: 1, due: dayKey(at(15)) })
    expect(s.srs['u01.w.hello']).toMatchObject({ box: 1, lapses: 0 })
    expect(dueItems(s, at(14))).toEqual([])
    expect(dueItems(s, at(15)).sort()).toEqual(['u01.s.01', 'u01.w.hello'])
    expect(practiceItems(s, at(14))).toContain('u01.s.01')
  })
})
