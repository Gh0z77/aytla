import { courseForGoal } from './goals'
import { buildPath, currentNode, type PathNode } from './path'
import { SENTENCE_ID_MARKER } from './validate'
import { applyLessonResult, dueItems } from './progress'
import { dayKey } from './time'
import type { Course, Rewards, Unit, UserState } from './types'

/**
 * "What should I do today?" The daily mission answers that in three small
 * steps: the next lesson on the path, one sentence to say aloud, and a review
 * when enough words are due. It is the same question every day, so the app
 * never asks the learner to look for the next thing.
 */
export type MissionStep =
  | { kind: 'lesson'; node: PathNode; unit: Unit; done: boolean }
  | { kind: 'challenge'; sentenceId: string; unit: Unit; done: boolean }
  | { kind: 'review'; count: number; done: boolean }

export interface Mission {
  steps: MissionStep[]
  done: number
  next: MissionStep | null
}

export const CHALLENGE_XP = 10
export const CHALLENGE_GEMS = 5
const REVIEW_THRESHOLD = 5

const hashDay = (day: string) => [...day].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/** The sentence of the day: one the learner has met, chosen by the date, so everyone on a device sees the same one all day. */
export function challengeSentence(course: Course, state: UserState, now: number): { sentenceId: string; unit: Unit } | null {
  const known = Object.keys(state.srs).filter((id) => id.includes(SENTENCE_ID_MARKER))
  const pool = known.length > 0 ? known : (course.units[0]?.sentences.map((s) => s.id) ?? [])
  if (pool.length === 0) return null
  const sentenceId = pool[hashDay(dayKey(now)) % pool.length] as string
  const unit = course.units.find((u) => u.sentences.some((s) => s.id === sentenceId))
  return unit ? { sentenceId, unit } : null
}

export function todayMission(course: Course, state: UserState, now: number): Mission {
  const today = state.days[dayKey(now)]
  const steps: MissionStep[] = []

  const path = buildPath(courseForGoal(course, state.profile.goal), state)
  const node = currentNode(path)
  const unit = node ? path.find((pu) => pu.unit.id === node.unitId)?.unit : undefined
  if (node && unit) steps.push({ kind: 'lesson', node, unit, done: (today?.lessons ?? 0) > 0 })

  const challenge = challengeSentence(course, state, now)
  if (challenge) steps.push({ kind: 'challenge', ...challenge, done: today?.challenge === true })

  const due = dueItems(state, now, 99).length
  if (due >= REVIEW_THRESHOLD) steps.push({ kind: 'review', count: due, done: (today?.practice ?? 0) > 0 })

  const done = steps.filter((s) => s.done).length
  return { steps, done, next: steps.find((s) => !s.done) ?? null }
}

/** The sentence of the day was said: a small practice session plus a fixed bonus, once per day. */
export function completeChallenge(state: UserState, sentenceId: string, correct: boolean, now: number): { state: UserState; rewards: Rewards } {
  const today = dayKey(now)
  if (state.days[today]?.challenge) return { state, rewards: emptyRewards() }
  const applied = applyLessonResult(state, { sessionKind: 'practice', lessonId: null, items: [{ itemId: sentenceId, correct }], total: 1, mistakes: correct ? 0 : 1, maxCombo: correct ? 1 : 0, seconds: 20, spoken: 1 }, now)
  const day = applied.state.days[today]
  const next: UserState = {
    ...applied.state,
    xp: applied.state.xp + CHALLENGE_XP,
    gems: applied.state.gems + CHALLENGE_GEMS,
    days: { ...applied.state.days, [today]: { ...(day ?? { xp: 0, lessons: 0, perfect: 0, practice: 0, maxCombo: 0, seconds: 0 }), xp: (day?.xp ?? 0) + CHALLENGE_XP, challenge: true } },
    updatedAt: now,
  }
  return { state: next, rewards: { ...applied.rewards, xp: applied.rewards.xp + CHALLENGE_XP, gems: applied.rewards.gems + CHALLENGE_GEMS } }
}

function emptyRewards(): Rewards {
  return { xp: 0, gems: 0, accuracy: 0, perfect: false, streakExtended: false, newStreak: 0, goalReachedToday: false, questsCompleted: [], achievements: [], heartsRestored: 0, spoken: 0 }
}

export type Comeback = 'back1' | 'back3' | 'back7' | 'back30' | null

/**
 * No guilt. After a pause the app says how it will make today easy, not what
 * the learner lost: one day, three days, a week, a month, each with its own line.
 */
export function comeback(state: UserState, now: number): Comeback {
  const active = Object.entries(state.days)
    .filter(([, d]) => d.xp > 0)
    .map(([day]) => day)
    .sort()
  const last = active[active.length - 1]
  if (!last) return null
  const missed = Math.round((Date.parse(`${dayKey(now)}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86_400_000) - 1
  if (missed >= 30) return 'back30'
  if (missed >= 7) return 'back7'
  if (missed >= 3) return 'back3'
  if (missed >= 1) return 'back1'
  return null
}
