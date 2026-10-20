import { describe, expect, it } from 'vitest'
import { COURSE } from '../../content/course'
import { GOAL_IDS, GOAL_ONLY, courseForGoal, goalPlan, isGoalUnit } from '../goals'
import { createInitialState } from '../progress'
import { pathUnitIds } from '../placement'

describe('goal-shaped course', () => {
  it('shows every learner exactly one goal-only unit, right after Base Camp', () => {
    const baseCamp = COURSE.sections.find((s) => s.order === 1)?.unitIds ?? []
    for (const goal of GOAL_IDS) {
      const path = pathUnitIds(courseForGoal(COURSE, goal))
      const goalOnly = path.filter((id) => GOAL_ONLY[id] !== undefined)
      expect(goalOnly).toHaveLength(1)
      expect(GOAL_ONLY[goalOnly[0] as string]).toBe(goal)
      expect(path.slice(0, baseCamp.length)).toEqual(baseCamp)
      expect(path[baseCamp.length]).toBe(goalOnly[0])
      expect(isGoalUnit(goal, goalOnly[0] as string)).toBe(true)
    }
  })

  it('keeps every shared unit on every path, each once', () => {
    const shared = COURSE.units.map((u) => u.id).filter((id) => GOAL_ONLY[id] === undefined)
    for (const goal of GOAL_IDS) {
      const path = pathUnitIds(courseForGoal(COURSE, goal))
      expect(new Set(path).size).toBe(path.length)
      shared.forEach((id) => expect(path).toContain(id))
    }
  })

  it('treats a learner without a goal as "everyday"', () => {
    expect(pathUnitIds(courseForGoal(COURSE, undefined))).toEqual(pathUnitIds(courseForGoal(COURSE, 'everyday')))
  })

  it('estimates the weeks to the end of the goal units', () => {
    const fresh = createInitialState(0)
    const travel = goalPlan(COURSE, { lessons: {}, profile: { ...fresh.profile, goal: 'travel' } })
    const everyday = goalPlan(COURSE, { lessons: {}, profile: { ...fresh.profile, goal: 'everyday' } })
    expect(travel.remaining).toBe(travel.total)
    expect(travel.weeks).toBeGreaterThanOrEqual(1)
    // "everyday" means the whole path, so it can never be shorter than a goal's stretch
    expect(everyday.total).toBeGreaterThanOrEqual(travel.total)
  })
})
