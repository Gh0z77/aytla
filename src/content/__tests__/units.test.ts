/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'
import { buildLessonSession, buildReviewSession } from '../../core/exercises'
import { normalize } from '../../core/text'
import { validateCourse } from '../../core/validate'
import { BASE_LANGS, type Course, type Unit } from '../../core/types'

/**
 * Validates EVERY unit file in ../units on its own, whether or not it is
 * registered in course.ts yet. Authors run one unit with:
 *
 *   npx vitest run src/content/__tests__/units.test.ts -t u07
 */
const files = import.meta.glob('../units/*.json', { eager: true, import: 'default' }) as Record<string, Unit>
const units = Object.entries(files)
  .map(([file, unit]) => ({ file: file.split('/').pop() ?? file, unit }))
  .sort((a, b) => a.file.localeCompare(b.file))

const courseOf = (unit: Unit): Course => ({
  id: 'single',
  title: 'single',
  sections: [{ id: 's', order: 1, cefr: 'A1', title: { en: 's', uz: 's', ru: 's', tr: 's' }, unitIds: [unit.id] }],
  units: [unit],
})

describe.each(units)('unit file $file', ({ file, unit }) => {
  it(`${unit.id}: file name matches the unit id`, () => {
    expect(file).toBe(`${unit.id}.json`)
  })

  it(`${unit.id}: passes the content validator with no errors and no warnings`, () => {
    const report = validateCourse(courseOf(unit))
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
  })

  it(`${unit.id}: has 5 lessons of 8 sentences, 40 sentences, 26-34 words`, () => {
    expect(unit.lessons).toHaveLength(5)
    unit.lessons.forEach((l) => expect(l.sentences).toHaveLength(8))
    expect(unit.sentences).toHaveLength(40)
    expect(unit.words.length).toBeGreaterThanOrEqual(26)
    expect(unit.words.length).toBeLessThanOrEqual(34)
    unit.lessons.forEach((l) => {
      expect(l.words.length).toBeGreaterThanOrEqual(4)
      expect(l.words.length).toBeLessThanOrEqual(8)
    })
  })

  it(`${unit.id}: no two words share a translation in any language`, () => {
    for (const lang of BASE_LANGS) {
      const seen = new Map<string, string>()
      for (const w of unit.words) {
        const key = normalize(w.native[lang], lang)
        expect(seen.get(key), `${lang}: "${w.native[lang]}" is used by ${seen.get(key)} and ${w.id}`).toBeUndefined()
        seen.set(key, w.id)
      }
    }
  })

  it(`${unit.id}: no duplicated English sentences`, () => {
    const seen = new Set<string>()
    for (const s of unit.sentences) {
      const key = normalize(s.en, 'en')
      expect(seen.has(key), `duplicate sentence "${s.en}"`).toBe(false)
      seen.add(key)
    }
  })

  it(`${unit.id}: every lesson and the review generate in uz, ru and tr`, () => {
    for (const baseLang of BASE_LANGS) {
      const opts = { baseLang, seed: 11, canListen: true, canSpeak: true }
      unit.lessons.forEach((_, i) => expect(buildLessonSession(unit, i, opts).exercises.length).toBeGreaterThanOrEqual(10))
      expect(buildReviewSession(unit, opts).exercises.length).toBeGreaterThanOrEqual(10)
    }
  })
})
