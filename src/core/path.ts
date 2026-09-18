import { reviewLessonId } from './exercises'
import type { Course, Unit, UserState } from './types'

/**
 * The learning path: every unit is a run of lesson nodes, a gem chest in the
 * middle and a unit review at the end. Progress is linear: a node opens when
 * every lesson / review before it is done. Chests never block.
 */

export type NodeKind = 'lesson' | 'chest' | 'review'
export type NodeStatus = 'locked' | 'available' | 'completed'

export interface PathNode {
  id: string
  kind: NodeKind
  unitId: string
  /** index into unit.lessons, for lesson nodes */
  lessonIndex: number | null
  status: NodeStatus
}

export interface PathUnit {
  unit: Unit
  nodes: PathNode[]
  /** lessons + review done / total */
  progress: number
  completed: boolean
  locked: boolean
}

const CHEST_AFTER_LESSON = 2 // after the third lesson

export const chestId = (unit: Pick<Unit, 'id'>) => `${unit.id}-chest`

export function buildPath(course: Course, state: Pick<UserState, 'lessons' | 'chests'>): PathUnit[] {
  const isDone = (id: string) => (state.lessons[id]?.completed ?? 0) > 0
  const byId = new Map(course.units.map((u) => [u.id, u] as const))
  const ordered = course.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap((s) => s.unitIds.map((id) => byId.get(id)).filter((u): u is Unit => u !== undefined))

  let open = true // does the learner reach this point of the path?
  return ordered.map((unit) => {
    const nodes: PathNode[] = []
    const unitLockedAtStart = !open
    let blocking = 0
    let blockingDone = 0

    unit.lessons.forEach((lesson, lessonIndex) => {
      const done = isDone(lesson.id)
      nodes.push({ id: lesson.id, kind: 'lesson', unitId: unit.id, lessonIndex, status: done ? 'completed' : open ? 'available' : 'locked' })
      blocking += 1
      if (done) blockingDone += 1
      else open = false

      if (lessonIndex === CHEST_AFTER_LESSON && unit.lessons.length > CHEST_AFTER_LESSON + 1) {
        const id = chestId(unit)
        const opened = state.chests.includes(id)
        nodes.push({ id, kind: 'chest', unitId: unit.id, lessonIndex: null, status: opened ? 'completed' : done ? 'available' : 'locked' })
      }
    })

    const reviewId = reviewLessonId(unit)
    const reviewDone = isDone(reviewId)
    nodes.push({ id: reviewId, kind: 'review', unitId: unit.id, lessonIndex: null, status: reviewDone ? 'completed' : open ? 'available' : 'locked' })
    blocking += 1
    if (reviewDone) blockingDone += 1
    else open = false

    return { unit, nodes, progress: blocking === 0 ? 0 : blockingDone / blocking, completed: blockingDone === blocking, locked: unitLockedAtStart }
  })
}

/** The node the big "continue" button should start: the first open lesson or review. */
export function currentNode(path: readonly PathUnit[]): PathNode | null {
  for (const u of path) {
    const node = u.nodes.find((n) => n.kind !== 'chest' && n.status === 'available')
    if (node) return node
  }
  return null
}

/** Lesson ids to mark complete so that `unitId` becomes the first open unit (placement / "jump here"). */
export function lessonIdsBefore(course: Course, unitId: string): string[] {
  const out: string[] = []
  const byId = new Map(course.units.map((u) => [u.id, u] as const))
  for (const section of course.sections.slice().sort((a, b) => a.order - b.order)) {
    for (const id of section.unitIds) {
      if (id === unitId) return out
      const unit = byId.get(id)
      if (!unit) continue
      unit.lessons.forEach((l) => out.push(l.id))
      out.push(reviewLessonId(unit))
    }
  }
  return out
}
