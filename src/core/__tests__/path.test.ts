import { describe, expect, it } from 'vitest'
import u01 from '../../content/units/u01.json'
import { buildPath, chestId, currentNode, lessonIdsBefore } from '../path'
import type { Course, LessonProgress, Unit } from '../types'

const first = u01 as unknown as Unit
const second: Unit = { ...first, id: 'u02', order: 2, lessons: first.lessons.map((l, i) => ({ ...l, id: `u02-l${i + 1}` })) }
const course: Course = {
  id: 'test',
  title: 'Test',
  sections: [{ id: 's1', order: 1, cefr: 'A1', title: { en: 'S', uz: 'S', ru: 'S', tr: 'S' }, unitIds: ['u01', 'u02'] }],
  units: [second, first],
}

const done = (ids: string[]): Record<string, LessonProgress> => Object.fromEntries(ids.map((id) => [id, { completed: 1, bestAccuracy: 100, lastAt: 0 }]))

describe('buildPath', () => {
  it('orders units by section and opens only the first lesson', () => {
    const path = buildPath(course, { lessons: {}, chests: [] })
    expect(path.map((u) => u.unit.id)).toEqual(['u01', 'u02'])
    const nodes = path[0]?.nodes ?? []
    expect(nodes.map((n) => n.kind)).toEqual(['lesson', 'lesson', 'lesson', 'chest', 'lesson', 'lesson', 'review'])
    expect(nodes[0]?.status).toBe('available')
    expect(nodes.slice(1).every((n) => n.status === 'locked')).toBe(true)
    expect(path[1]?.locked).toBe(true)
    expect(currentNode(path)?.id).toBe('u01-l1')
  })

  it('opens the next lesson and the chest as lessons are completed', () => {
    const path = buildPath(course, { lessons: done(['u01-l1', 'u01-l2', 'u01-l3']), chests: [] })
    const nodes = path[0]?.nodes ?? []
    expect(nodes.find((n) => n.id === chestId(first))?.status).toBe('available')
    expect(nodes.find((n) => n.id === 'u01-l4')?.status).toBe('available')
    expect(nodes.find((n) => n.id === 'u01-l5')?.status).toBe('locked')
    expect(path[0]?.progress).toBeCloseTo(3 / 6)
    expect(currentNode(path)?.id).toBe('u01-l4')
  })

  it('never lets a chest block progress', () => {
    const lessons = done(first.lessons.map((l) => l.id))
    const path = buildPath(course, { lessons, chests: [] })
    expect(path[0]?.nodes.find((n) => n.kind === 'review')?.status).toBe('available')
    expect(currentNode(path)?.id).toBe('u01-review')
  })

  it('unlocks the next unit after the review', () => {
    const lessons = done([...first.lessons.map((l) => l.id), 'u01-review'])
    const path = buildPath(course, { lessons, chests: [chestId(first)] })
    expect(path[0]?.completed).toBe(true)
    expect(path[0]?.nodes.find((n) => n.kind === 'chest')?.status).toBe('completed')
    expect(path[1]?.locked).toBe(false)
    expect(currentNode(path)?.id).toBe('u02-l1')
  })

  it('lists everything before a unit for placement', () => {
    expect(lessonIdsBefore(course, 'u01')).toEqual([])
    expect(lessonIdsBefore(course, 'u02')).toEqual([...first.lessons.map((l) => l.id), 'u01-review'])
  })
})
