import { describe, expect, it } from 'vitest'
import { buildLessonSession, buildReviewSession } from '../../core/exercises'
import { validateCourse } from '../../core/validate'
import { BASE_LANGS } from '../../core/types'
import { COURSE, findLesson, findUnit } from '../course'

describe('course content', () => {
  const report = validateCourse(COURSE)

  it('has no structural errors', () => {
    expect(report.errors).toEqual([])
  })

  it('contains at least one full unit', () => {
    expect(report.stats.units).toBeGreaterThanOrEqual(1)
    expect(report.stats.sentences).toBeGreaterThanOrEqual(30)
  })

  it('can generate every lesson and review in every base language', () => {
    for (const unit of COURSE.units) {
      for (const baseLang of BASE_LANGS) {
        const opts = { baseLang, seed: 5, canListen: true, canSpeak: true }
        unit.lessons.forEach((_, i) => expect(buildLessonSession(unit, i, opts).exercises.length).toBeGreaterThanOrEqual(8))
        expect(buildReviewSession(unit, opts).exercises.length).toBeGreaterThanOrEqual(8)
      }
    }
  })

  it('resolves lessons and reviews by id', () => {
    const unit = COURSE.units[0]
    expect(unit).toBeDefined()
    if (!unit) return
    expect(findUnit(unit.id)).toBe(unit)
    expect(findLesson(`${unit.id}-review`)).toEqual({ unit, lessonIndex: null })
    expect(findLesson(unit.lessons[0]?.id ?? '')).toEqual({ unit, lessonIndex: 0 })
    expect(findLesson('missing')).toBeUndefined()
  })
})
