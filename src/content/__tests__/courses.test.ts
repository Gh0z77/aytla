import { describe, expect, it } from 'vitest'
import { buildLessonSession } from '../../core/exercises'
import { gradeSay } from '../../core/grading'
import { validateCourse } from '../../core/validate'
import { COURSE, courseFor, findLesson, findUnit, targetOfId } from '../course'

describe('the same course in other target languages', () => {
  it('keeps English as it was authored', () => {
    expect(courseFor('en')).toBe(COURSE)
    expect(targetOfId('u01-l1')).toBe('en')
  })

  it('moves the target text into place and keeps ids apart per course', () => {
    const ru = courseFor('ru')
    const unit = ru.units[0]!
    expect(unit.id).toBe('ru-u01')
    expect(unit.tip).toBeUndefined()
    const hello = unit.words.find((w) => w.id === 'ru-u01.w.hello')!
    expect(hello.en).toBe('привет')
    expect(hello.native.uz).toBe('salom')
    // the English moved into the Russian slot, which no Russian learner sees
    expect(hello.native.ru).toBe('hello')
    expect(unit.lessons[0]!.id).toBe('ru-u01-l1')
    expect(unit.lessons[0]!.words[0]).toBe('ru-u01.w.hello')
    expect(ru.sections[0]!.unitIds[0]).toBe('ru-u01')
    expect(findUnit('ru-u01')).toBe(unit)
    expect(findLesson('ru-u01-l1')?.unit.id).toBe('ru-u01')
    expect(findLesson('tr-u01-review')?.lessonIndex).toBeNull()
    expect(targetOfId('uz-u03-l2')).toBe('uz')
  })

  it('is a valid course for every target, and lessons grade in that language', () => {
    for (const target of ['ru', 'tr', 'uz'] as const) {
      const course = courseFor(target)
      expect(validateCourse(course).errors, target).toEqual([])
      const built = buildLessonSession(course.units[0]!, 0, { baseLang: target === 'uz' ? 'ru' : 'uz', target, seed: 3, canListen: false, canSpeak: false })
      expect(built.exercises.length).toBeGreaterThan(5)
      const say = built.exercises.find((e) => e.kind === 'say')
      expect(say?.lang).toBe(target)
      if (say?.kind === 'say') expect(gradeSay(say, say.answers[0]!, false).correct).toBe(true)
    }
  })

  it('accepts a Turkish answer typed with dotless i', () => {
    const tr = courseFor('tr')
    const built = buildLessonSession(tr.units[0]!, 0, { baseLang: 'uz', target: 'tr', seed: 1, canListen: false, canSpeak: false })
    const say = built.exercises.find((e): e is Extract<typeof e, { kind: 'say' }> => e.kind === 'say')!
    expect(gradeSay(say, say.answers[0]!.toLocaleUpperCase('tr'), false).correct).toBe(true)
  })
})
