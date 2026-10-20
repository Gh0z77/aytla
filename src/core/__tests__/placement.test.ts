import { describe, expect, it } from 'vitest'
import u01 from '../../content/units/u01.json'
import { buildPlacementCheck } from '../exercises'
import { checkVerdict, placementCheckpoints, placementFor } from '../placement'
import type { Course, Unit } from '../types'

const base = u01 as unknown as Unit
// five copies of a real unit under different ids: enough to walk the stride logic
const clone = (n: number): Unit => {
  const id = `u0${n}`
  const swap = (s: string) => s.replace(/^u01/, id)
  return {
    ...base,
    id,
    words: base.words.map((w) => ({ ...w, id: swap(w.id) })),
    sentences: base.sentences.map((s) => ({ ...s, id: swap(s.id) })),
    lessons: base.lessons.map((l) => ({ ...l, id: swap(l.id), words: l.words.map(swap), sentences: l.sentences.map(swap) })),
  }
}
const units = [1, 2, 3, 4, 5].map(clone)
const title = { en: 'S', uz: 'S', ru: 'S', tr: 'S' }
const course: Course = {
  id: 'test',
  title: 'Test',
  sections: [
    { id: 's1', order: 1, cefr: 'A1', title, unitIds: ['u01', 'u02', 'u03'] },
    { id: 's2', order: 2, cefr: 'A1', title, unitIds: ['u04', 'u05'] },
  ],
  units,
}

describe('placement', () => {
  it('checks the later unit of every pair', () => {
    expect(placementCheckpoints(course)).toEqual(['u02', 'u04'])
  })

  it('decides a check in two questions, or three when they split', () => {
    expect(checkVerdict(1, 1)).toBe('more')
    expect(checkVerdict(2, 2)).toBe('pass')
    expect(checkVerdict(2, 0)).toBe('fail')
    expect(checkVerdict(2, 1)).toBe('more')
    expect(checkVerdict(3, 2)).toBe('pass')
    expect(checkVerdict(3, 1)).toBe('fail')
  })

  it('places the learner after the pairs they passed, never past the last unit', () => {
    expect(placementFor(course, 0)).toMatchObject({ unitId: 'u01', skippedUnits: 0, lessonIds: [] })
    const one = placementFor(course, 1)
    expect(one?.unitId).toBe('u03')
    expect(one?.lessonIds).toContain('u02-review')
    expect(one?.lessonIds).not.toContain('u03-review')
    expect(placementFor(course, 2)?.unitId).toBe('u05')
    expect(placementFor(course, 9)?.unitId).toBe('u05')
    expect(placementFor({ ...course, sections: [], units: [] }, 1)).toBeNull()
  })

  it('builds a word question and two sentences to build in English, none needing sound', () => {
    const check = buildPlacementCheck(base, { baseLang: 'uz', seed: 3, canListen: true, canSpeak: true })
    expect(check.map((e) => e.kind)).toEqual(['select', 'bank', 'bank'])
    check.forEach((e) => e.kind === 'bank' && expect(e.direction).toBe('native-en'))
    expect(new Set(check.map((e) => e.id)).size).toBe(3)
  })
})
