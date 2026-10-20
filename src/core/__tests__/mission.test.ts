import { describe, expect, it } from 'vitest'
import { COURSE } from '../../content/course'
import { CHALLENGE_GEMS, CHALLENGE_XP, challengeSentence, comeback, completeChallenge, todayMission } from '../mission'
import { createInitialState } from '../progress'
import { dayKey } from '../time'

const NOON = Date.UTC(2026, 9, 20, 12, 0, 0)
const DAY = 86_400_000

describe('daily mission', () => {
  it('starts with the first lesson and the sentence of the day', () => {
    const state = createInitialState(NOON)
    const mission = todayMission(COURSE, state, NOON)
    expect(mission.steps.map((s) => s.kind)).toEqual(['lesson', 'challenge'])
    expect(mission.done).toBe(0)
    expect(mission.next?.kind).toBe('lesson')
    const first = mission.steps[0]
    if (first?.kind === 'lesson') expect(first.node.id).toBe('u01-l1')
  })

  it('picks the same sentence all day and a known one once there are any', () => {
    const fresh = createInitialState(NOON)
    const a = challengeSentence(COURSE, fresh, NOON)
    const b = challengeSentence(COURSE, fresh, NOON + 5 * 3_600_000)
    expect(a?.sentenceId).toBe(b?.sentenceId)
    expect(a?.sentenceId.startsWith('u01.s.')).toBe(true)
    const learned = { ...fresh, srs: { 'u03.s.07': { box: 2, due: '2026-10-22', lapses: 0 }, 'u03.w.mother': { box: 1, due: '2026-10-21', lapses: 0 } } }
    expect(challengeSentence(COURSE, learned, NOON)?.sentenceId).toBe('u03.s.07')
  })

  it('rewards the challenge once per day and marks the step done', () => {
    const state = createInitialState(NOON)
    const first = completeChallenge(state, 'u01.s.01', true, NOON)
    expect(first.rewards.xp).toBeGreaterThanOrEqual(CHALLENGE_XP)
    expect(first.rewards.gems).toBeGreaterThanOrEqual(CHALLENGE_GEMS)
    expect(first.state.days[dayKey(NOON)]?.challenge).toBe(true)
    expect(todayMission(COURSE, first.state, NOON).steps.find((s) => s.kind === 'challenge')?.done).toBe(true)
    const again = completeChallenge(first.state, 'u01.s.01', true, NOON + 60_000)
    expect(again.state).toBe(first.state)
    expect(again.rewards.xp).toBe(0)
  })

  it('welcomes a learner back without guilt, scaled to the pause', () => {
    const base = createInitialState(NOON)
    expect(comeback(base, NOON)).toBeNull()
    const active = (daysAgo: number) => ({ ...base, days: { [dayKey(NOON - daysAgo * DAY)]: { xp: 20, lessons: 1, perfect: 0, practice: 0, maxCombo: 0, seconds: 60 } } })
    expect(comeback(active(0), NOON)).toBeNull()
    expect(comeback(active(1), NOON)).toBeNull()
    expect(comeback(active(2), NOON)).toBe('back1')
    expect(comeback(active(4), NOON)).toBe('back3')
    expect(comeback(active(9), NOON)).toBe('back7')
    expect(comeback(active(40), NOON)).toBe('back30')
  })
})
