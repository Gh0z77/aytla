import { XP_RULES } from './progress'
import type { Course, DailyGoal, GoalId, UserState } from './types'
import { reviewLessonId } from './exercises'

/**
 * The learner's goal shapes the route. Base Camp (section 1) is the same for
 * everyone, because every goal needs greetings, numbers and "I am". From Camp 1
 * on, the units that serve the goal come first, so a traveller reaches
 * directions, shopping and hotels weeks before a student would.
 */
export const GOAL_IDS: readonly GoalId[] = ['everyday', 'travel', 'work', 'study']

/** Units that matter most for a goal, in the order they should be climbed. */
const PRIORITY: Record<GoalId, readonly string[]> = {
  everyday: ['u22'],
  travel: ['u19', 'u09', 'u10', 'u11', 'u15', 'u12', 'u16'],
  work: ['u20', 'u07', 'u11', 'u13', 'u17', 'u18'],
  study: ['u21', 'u07', 'u13', 'u14', 'u17', 'u18'],
}

/**
 * Units written for one goal only. They open Camp 1 for the learners who chose
 * that goal and do not exist on anybody else's path: a traveller gets the border
 * and lost luggage, a job seeker gets the interview.
 */
export const GOAL_ONLY: Readonly<Record<string, GoalId>> = { u19: 'travel', u20: 'work', u21: 'study', u22: 'everyday' }

/** The AI role-plays suggested first for each goal (ids from the server's scenario list). */
export const GOAL_SCENARIOS: Record<GoalId, readonly string[]> = {
  everyday: ['plans', 'meet', 'family', 'cafe', 'free'],
  travel: ['border', 'directions', 'cafe', 'shopping', 'meet'],
  work: ['interview', 'meet', 'free', 'cafe', 'directions'],
  study: ['exam', 'meet', 'free', 'family', 'shopping'],
}

/** The role-play a unit has been preparing the learner for (offered when its review is passed). */
export const UNIT_SCENARIO: Readonly<Record<string, string>> = { u19: 'border', u20: 'interview', u21: 'exam', u22: 'plans', u02: 'meet', u03: 'family', u04: 'cafe', u09: 'directions', u10: 'shopping' }

export const FIXED_SECTIONS = 1

export function courseForGoal(course: Course, goal: GoalId | undefined): Course {
  const mine = goal ?? 'everyday'
  const priority = PRIORITY[mine]
  const rank = (id: string) => {
    const i = priority.indexOf(id)
    return i < 0 ? priority.length : i
  }
  const onMyPath = (id: string) => GOAL_ONLY[id] === undefined || GOAL_ONLY[id] === mine
  return {
    ...course,
    sections: course.sections.map((section) => {
      const unitIds = section.unitIds.filter(onMyPath)
      if (section.order <= FIXED_SECTIONS) return { ...section, unitIds }
      // stable sort: units outside the goal keep their authored order behind the goal units
      return { ...section, unitIds: unitIds.map((id, i) => ({ id, i })).sort((a, b) => rank(a.id) - rank(b.id) || a.i - b.i).map((x) => x.id) }
    }),
  }
}

export function isGoalUnit(goal: GoalId | undefined, unitId: string): boolean {
  return PRIORITY[goal ?? 'everyday'].includes(unitId)
}

export interface GoalPlan {
  /** lessons and reviews still to do before the goal units are finished (the whole course for "everyday") */
  remaining: number
  total: number
  weeks: number
}

/** Roughly how many lessons a day a daily XP goal means (a first-time lesson is worth about 15 XP with bonuses). */
export function lessonsPerDay(goal: DailyGoal): number {
  return Math.max(1, Math.round(goal / (XP_RULES.lesson + XP_RULES.perfectBonus)))
}

/**
 * An honest estimate, not a promise: the steps that stand between the learner
 * and the end of their goal units, at the pace their daily goal implies.
 */
export function goalPlan(course: Course, state: Pick<UserState, 'lessons' | 'profile'>): GoalPlan {
  const goal = state.profile.goal ?? 'everyday'
  const ordered = courseForGoal(course, goal)
  const byId = new Map(course.units.map((u) => [u.id, u] as const))
  const path = ordered.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((s) => s.unitIds)

  // everything up to and including the last goal unit on the route
  const lastGoalIndex = goal === 'everyday' ? path.length - 1 : path.reduce((last, id, i) => (isGoalUnit(goal, id) ? i : last), -1)
  const scope = path.slice(0, lastGoalIndex + 1)

  let total = 0
  let done = 0
  for (const id of scope) {
    const unit = byId.get(id)
    if (!unit) continue
    const steps = [...unit.lessons.map((l) => l.id), reviewLessonId(unit)]
    total += steps.length
    done += steps.filter((step) => (state.lessons[step]?.completed ?? 0) > 0).length
  }
  const remaining = total - done
  return { remaining, total, weeks: Math.max(remaining === 0 ? 0 : 1, Math.ceil(remaining / (lessonsPerDay(state.profile.dailyGoalXp) * 7))) }
}
