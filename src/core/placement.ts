import { lessonIdsBefore } from './path'
import type { Course } from './types'

/**
 * Placement test: find where on the path a learner who already knows some
 * English should start, in about three minutes.
 *
 * The path is checked in strides of two units: the LATER unit of each pair is
 * tested, because whoever handles it can skip the pair. A check is two questions
 * (a word, then a sentence to build) with a third as the tie-break. The test
 * stops at the first failed check, so a beginner answers two or three questions
 * and a strong learner at most three per pair.
 */

export const PLACEMENT_STRIDE = 2
const QUESTIONS = 2
const QUESTIONS_WITH_TIE_BREAK = 3

export type CheckVerdict = 'pass' | 'fail' | 'more'

/** Units in the order the learner climbs them. */
export function pathUnitIds(course: Course): string[] {
  const known = new Set(course.units.map((u) => u.id))
  return course.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((s) => s.unitIds)
    .filter((id) => known.has(id))
}

/** The units the test checks, easiest first. */
export function placementCheckpoints(course: Course): string[] {
  return pathUnitIds(course).filter((_, i) => i % PLACEMENT_STRIDE === PLACEMENT_STRIDE - 1)
}

export function checkVerdict(asked: number, right: number): CheckVerdict {
  if (asked < QUESTIONS) return 'more'
  if (asked === QUESTIONS) return right === QUESTIONS ? 'pass' : right === 0 ? 'fail' : 'more'
  return right >= QUESTIONS_WITH_TIE_BREAK - 1 ? 'pass' : 'fail'
}

export interface Placement {
  /** the unit the learner starts in */
  unitId: string
  /** how many units are skipped */
  skippedUnits: number
  /** lessons and reviews to mark as done so that `unitId` is the first open unit */
  lessonIds: string[]
}

/** Where the learner lands after passing `passed` checks in a row. Nobody is placed past the last unit. */
export function placementFor(course: Course, passed: number): Placement | null {
  const path = pathUnitIds(course)
  if (path.length === 0) return null
  const index = Math.min(Math.max(0, passed) * PLACEMENT_STRIDE, path.length - 1)
  const unitId = path[index] as string
  return { unitId, skippedUnits: index, lessonIds: lessonIdsBefore(course, unitId) }
}
