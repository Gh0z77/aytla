import { hashString, createRng, shuffle } from './rng'
import { addDays, dayKey, diffDays, weekId } from './time'
import type { BaseLang, CharacterId, DailyGoal, DayStats, LessonResult, Profile, Quest, QuestKind, Rewards, UserState } from './types'

/**
 * Learner progress and the game economy: XP, hearts, streak (with freezes),
 * daily quests, achievements, spaced repetition and the shop.
 * Every function is pure: (state, input, now) → new state.
 */

export const MAX_HEARTS = 5
export const HEART_REFILL_MS = 4 * 60 * 60 * 1000
export const START_GEMS = 500
export const CHEST_GEMS = 20
export const FIRST_COMPLETION_GEMS = 5
export const XP_BOOST_MINUTES = 15

export const XP_RULES = {
  lesson: 10,
  lessonReplay: 5,
  review: 20,
  reviewReplay: 10,
  practice: 5,
  perfectBonus: 5,
  combo5Bonus: 2,
  combo10Bonus: 5,
} as const

export const SHOP = {
  streakFreeze: { cost: 200, max: 2 },
  heartRefill: { cost: 350 },
  xpBoost: { cost: 150 },
} as const
export type ShopItem = keyof typeof SHOP

/** Leitner boxes: days until an item is due again after reaching the box. */
export const SRS_INTERVALS = [0, 1, 3, 7, 14, 30] as const
const MAX_BOX = SRS_INTERVALS.length - 1

export const ACHIEVEMENTS = [
  { id: 'streak', thresholds: [3, 7, 14, 30, 60, 100, 365] },
  { id: 'xp', thresholds: [100, 500, 1000, 2500, 5000, 10000] },
  { id: 'lessons', thresholds: [1, 10, 25, 50, 100, 250] },
  { id: 'perfect', thresholds: [1, 5, 20, 50, 100] },
  { id: 'words', thresholds: [20, 50, 100, 200, 400] },
] as const
export type AchievementId = (typeof ACHIEVEMENTS)[number]['id']
export const ACHIEVEMENT_GEMS_PER_LEVEL = 25

/** Word ids contain this marker (content convention: `<unit>.w.<slug>`). */
export const WORD_ID_MARKER = '.w.'

const EMPTY_DAY: DayStats = { xp: 0, lessons: 0, perfect: 0, practice: 0, maxCombo: 0, seconds: 0 }

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function createInitialState(now: number, profile?: Partial<Profile>): UserState {
  const base: Profile = {
    name: '',
    baseLang: 'uz' as BaseLang,
    dailyGoalXp: 20 as DailyGoal,
    guide: 'everest' as CharacterId,
    soundOn: true,
    hapticsOn: true,
    onboarded: false,
    createdAt: now,
  }
  const today = dayKey(now)
  const merged = { ...base, ...profile }
  return {
    version: 1,
    profile: merged,
    xp: 0,
    gems: START_GEMS,
    hearts: { count: MAX_HEARTS, lastRefillAt: now },
    streak: { current: 0, longest: 0, lastGoalDay: null, freezes: 0, frozenDays: [] },
    lessons: {},
    chests: [],
    days: {},
    quests: { day: today, items: dailyQuests(today, merged.dailyGoalXp) },
    srs: {},
    achievements: {},
    league: { weekId: weekId(now), weeklyXp: 0, tier: 0 },
    xpBoostUntil: 0,
    updatedAt: now,
  }
}

export function updateProfile(state: UserState, patch: Partial<Profile>, now: number): UserState {
  return { ...state, profile: { ...state.profile, ...patch }, updatedAt: now }
}

// ---------------------------------------------------------------------------
// Hearts
// ---------------------------------------------------------------------------

export function syncHearts(state: UserState, now: number): UserState {
  const { count, lastRefillAt } = state.hearts
  if (count >= MAX_HEARTS) return state
  const gained = Math.floor((now - lastRefillAt) / HEART_REFILL_MS)
  if (gained <= 0) return state
  const next = Math.min(MAX_HEARTS, count + gained)
  return { ...state, hearts: { count: next, lastRefillAt: next >= MAX_HEARTS ? now : lastRefillAt + gained * HEART_REFILL_MS } }
}

export function msUntilNextHeart(state: UserState, now: number): number | null {
  if (state.hearts.count >= MAX_HEARTS) return null
  return Math.max(0, state.hearts.lastRefillAt + HEART_REFILL_MS - now)
}

export function loseHeart(state: UserState, now: number): UserState {
  const synced = syncHearts(state, now)
  if (synced.hearts.count <= 0) return synced
  const wasFull = synced.hearts.count >= MAX_HEARTS
  return { ...synced, hearts: { count: synced.hearts.count - 1, lastRefillAt: wasFull ? now : synced.hearts.lastRefillAt }, updatedAt: now }
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

const QUEST_TARGETS: Record<Exclude<QuestKind, 'xp'>, number[]> = {
  lessons: [2, 3],
  perfect: [1, 2],
  combo: [5, 8],
  practice: [1],
}

/** Three quests per day, the same for a given day and goal (so reinstalling does not reroll them). */
export function dailyQuests(day: string, goal: DailyGoal): Quest[] {
  const rng = createRng(hashString(`quests:${day}`))
  const kinds = shuffle(rng, Object.keys(QUEST_TARGETS) as Array<Exclude<QuestKind, 'xp'>>).slice(0, 2)
  const xpTarget = Math.max(20, goal) + (rng() < 0.5 ? 0 : 10)
  const quests: Quest[] = [{ id: `${day}:xp`, kind: 'xp', target: xpTarget, rewardGems: 10, claimed: false }]
  kinds.forEach((kind) => {
    const targets = QUEST_TARGETS[kind]
    const target = targets[Math.floor(rng() * targets.length)] ?? targets[0] ?? 1
    quests.push({ id: `${day}:${kind}`, kind, target, rewardGems: 10, claimed: false })
  })
  return quests
}

export function questValue(quest: Quest, stats: DayStats | undefined): number {
  const s = stats ?? EMPTY_DAY
  switch (quest.kind) {
    case 'xp':
      return s.xp
    case 'lessons':
      return s.lessons
    case 'perfect':
      return s.perfect
    case 'combo':
      return s.maxCombo
    case 'practice':
      return s.practice
  }
}

// ---------------------------------------------------------------------------
// Day roll-over: streak freezes, fresh quests, weekly league reset
// ---------------------------------------------------------------------------

export function rollDay(state: UserState, now: number): UserState {
  const today = dayKey(now)
  let next = state

  // streak: every fully missed day needs a freeze, otherwise the streak ends
  const last = state.streak.lastGoalDay
  if (last !== null && state.streak.current > 0 && diffDays(last, today) > 1) {
    let { current, freezes } = state.streak
    const frozenDays = [...state.streak.frozenDays]
    let cursor = last
    while (diffDays(cursor, today) > 1) {
      const missed = addDays(cursor, 1)
      if (freezes > 0) {
        freezes -= 1
        frozenDays.push(missed)
        cursor = missed
      } else {
        current = 0
        break
      }
    }
    next = { ...next, streak: { ...state.streak, current, freezes, frozenDays, lastGoalDay: current > 0 ? cursor : last } }
  }

  if (next.quests.day !== today) {
    next = { ...next, quests: { day: today, items: dailyQuests(today, next.profile.dailyGoalXp) } }
  }

  const week = weekId(now)
  if (next.league.weekId !== week) {
    next = { ...next, league: { ...next.league, weekId: week, weeklyXp: 0 } }
  }
  return next
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export function achievementCounters(state: UserState): Record<AchievementId, number> {
  const lessons = Object.values(state.lessons).reduce((n, l) => n + l.completed, 0)
  const perfect = Object.values(state.days).reduce((n, d) => n + d.perfect, 0)
  const words = Object.keys(state.srs).filter((id) => id.includes(WORD_ID_MARKER)).length
  return { streak: state.streak.longest, xp: state.xp, lessons, perfect, words }
}

export function achievementThresholds(id: AchievementId): readonly number[] {
  return ACHIEVEMENTS.find((a) => a.id === id)?.thresholds ?? []
}

export function achievementLevel(id: AchievementId, value: number): number {
  return achievementThresholds(id).filter((t) => value >= t).length
}

// ---------------------------------------------------------------------------
// Completing a session
// ---------------------------------------------------------------------------

export function accuracyOf(result: Pick<LessonResult, 'total' | 'mistakes'>): number {
  const answers = result.total + result.mistakes
  return answers === 0 ? 100 : Math.round((100 * result.total) / answers)
}

export function xpFor(result: LessonResult, alreadyCompleted: boolean, boosted: boolean): number {
  let xp: number
  if (result.sessionKind === 'practice') xp = XP_RULES.practice
  else if (result.sessionKind === 'review') xp = alreadyCompleted ? XP_RULES.reviewReplay : XP_RULES.review
  else xp = alreadyCompleted ? XP_RULES.lessonReplay : XP_RULES.lesson
  if (result.mistakes === 0 && result.total > 0) xp += XP_RULES.perfectBonus
  if (result.maxCombo >= 10) xp += XP_RULES.combo10Bonus
  else if (result.maxCombo >= 5) xp += XP_RULES.combo5Bonus
  return boosted ? xp * 2 : xp
}

export function applyLessonResult(input: UserState, result: LessonResult, now: number): { state: UserState; rewards: Rewards } {
  let state = rollDay(syncHearts(input, now), now)
  const today = dayKey(now)
  const perfect = result.mistakes === 0 && result.total > 0
  const lessonId = result.lessonId
  const previous = lessonId ? state.lessons[lessonId] : undefined
  const alreadyCompleted = (previous?.completed ?? 0) > 0
  const accuracy = accuracyOf(result)
  const xp = xpFor(result, alreadyCompleted, state.xpBoostUntil > now)
  let gems = 0

  // day counters
  const day = state.days[today] ?? EMPTY_DAY
  const dayNext: DayStats = {
    xp: day.xp + xp,
    lessons: day.lessons + (result.sessionKind === 'practice' ? 0 : 1),
    perfect: day.perfect + (perfect ? 1 : 0),
    practice: day.practice + (result.sessionKind === 'practice' ? 1 : 0),
    maxCombo: Math.max(day.maxCombo, result.maxCombo),
    seconds: day.seconds + result.seconds,
  }

  // lesson record
  const lessons = { ...state.lessons }
  if (lessonId) {
    lessons[lessonId] = { completed: (previous?.completed ?? 0) + 1, bestAccuracy: Math.max(previous?.bestAccuracy ?? 0, accuracy), lastAt: now }
    if (!alreadyCompleted) gems += FIRST_COMPLETION_GEMS
  }

  // spaced repetition
  const srs = { ...state.srs }
  result.items.forEach(({ itemId, correct }) => {
    const prev = srs[itemId]
    const box = correct ? Math.min(MAX_BOX, (prev?.box ?? 0) + 1) : 1
    srs[itemId] = { box, due: addDays(today, SRS_INTERVALS[box] ?? 1), lapses: (prev?.lapses ?? 0) + (correct ? 0 : 1) }
  })

  // hearts: practising earns one back
  let hearts = state.hearts
  let heartsRestored = 0
  if (result.sessionKind === 'practice' && hearts.count < MAX_HEARTS) {
    heartsRestored = 1
    const count = hearts.count + 1
    hearts = { count, lastRefillAt: count >= MAX_HEARTS ? now : hearts.lastRefillAt }
  }

  // streak
  let streak = state.streak
  const goalReachedToday = dayNext.xp >= state.profile.dailyGoalXp
  let streakExtended = false
  if (goalReachedToday && streak.lastGoalDay !== today) {
    const current = streak.current + 1
    streak = { ...streak, current, longest: Math.max(streak.longest, current), lastGoalDay: today }
    streakExtended = true
  }

  state = {
    ...state,
    xp: state.xp + xp,
    hearts,
    streak,
    lessons,
    srs,
    days: { ...state.days, [today]: dayNext },
    league: { ...state.league, weeklyXp: state.league.weeklyXp + xp },
  }

  // quests
  const questsCompleted: Quest[] = []
  const items = state.quests.items.map((q) => {
    if (q.claimed || questValue(q, dayNext) < q.target) return q
    gems += q.rewardGems
    const done = { ...q, claimed: true }
    questsCompleted.push(done)
    return done
  })
  state = { ...state, quests: { ...state.quests, items } }

  // achievements
  const counters = achievementCounters(state)
  const achievements = { ...state.achievements }
  const unlocked: Rewards['achievements'] = []
  ACHIEVEMENTS.forEach(({ id }) => {
    const level = achievementLevel(id, counters[id])
    const had = achievements[id]?.level ?? 0
    if (level > had) {
      achievements[id] = { level, at: now }
      unlocked.push({ id, level })
      gems += (level - had) * ACHIEVEMENT_GEMS_PER_LEVEL
    }
  })

  state = { ...state, achievements, gems: state.gems + gems, updatedAt: now }

  return {
    state,
    rewards: {
      xp,
      gems,
      accuracy,
      perfect,
      goalReachedToday,
      streakExtended,
      newStreak: streak.current,
      questsCompleted,
      achievements: unlocked,
      heartsRestored,
    },
  }
}

// ---------------------------------------------------------------------------
// Shop & chests
// ---------------------------------------------------------------------------

export type BuyFailure = 'gems' | 'max' | 'full'

export function buy(state: UserState, item: ShopItem, now: number): { state: UserState; ok: true } | { state: UserState; ok: false; reason: BuyFailure } {
  const synced = syncHearts(state, now)
  const cost = SHOP[item].cost
  if (synced.gems < cost) return { state: synced, ok: false, reason: 'gems' }
  if (item === 'streakFreeze') {
    if (synced.streak.freezes >= SHOP.streakFreeze.max) return { state: synced, ok: false, reason: 'max' }
    return { ok: true, state: { ...synced, gems: synced.gems - cost, streak: { ...synced.streak, freezes: synced.streak.freezes + 1 }, updatedAt: now } }
  }
  if (item === 'heartRefill') {
    if (synced.hearts.count >= MAX_HEARTS) return { state: synced, ok: false, reason: 'full' }
    return { ok: true, state: { ...synced, gems: synced.gems - cost, hearts: { count: MAX_HEARTS, lastRefillAt: now }, updatedAt: now } }
  }
  const from = Math.max(now, synced.xpBoostUntil)
  return { ok: true, state: { ...synced, gems: synced.gems - cost, xpBoostUntil: from + XP_BOOST_MINUTES * 60_000, updatedAt: now } }
}

export function openChest(state: UserState, chestId: string, now: number): { state: UserState; gems: number } {
  if (state.chests.includes(chestId)) return { state, gems: 0 }
  return { state: { ...state, chests: [...state.chests, chestId], gems: state.gems + CHEST_GEMS, updatedAt: now }, gems: CHEST_GEMS }
}

// ---------------------------------------------------------------------------
// Practice selection
// ---------------------------------------------------------------------------

/** Items due for review today, most overdue and weakest first. */
export function dueItems(state: UserState, now: number, limit = 12): string[] {
  const today = dayKey(now)
  return Object.entries(state.srs)
    .filter(([, e]) => e.due <= today)
    .sort(([, a], [, b]) => (a.due === b.due ? a.box - b.box : a.due < b.due ? -1 : 1))
    .slice(0, limit)
    .map(([id]) => id)
}

/** Items the learner keeps missing. */
export function weakItems(state: UserState, limit = 12): string[] {
  return Object.entries(state.srs)
    .filter(([, e]) => e.lapses > 0)
    .sort(([, a], [, b]) => b.lapses - a.lapses || a.box - b.box)
    .slice(0, limit)
    .map(([id]) => id)
}

/** Something to practise even on day one: due items, then weak items, then anything seen. */
export function practiceItems(state: UserState, now: number, limit = 12): string[] {
  const out = new Set<string>(dueItems(state, now, limit))
  if (out.size < limit) weakItems(state, limit).forEach((id) => out.size < limit && out.add(id))
  if (out.size < limit) Object.keys(state.srs).forEach((id) => out.size < limit && out.add(id))
  return [...out]
}
