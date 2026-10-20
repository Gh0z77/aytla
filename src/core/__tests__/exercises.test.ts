import { describe, expect, it } from 'vitest'
import u01 from '../../content/units/u01.json'
import { buildLessonSession, buildPracticeSession, buildReviewSession, type SessionOptions } from '../exercises'
import { gradeBank, gradeFill, gradeListen, gradeSay, gradeSelect, gradeSpeak, gradeType } from '../grading'
import { normalize, tokenize } from '../text'
import type { BaseLang, Course, Exercise, Unit } from '../types'

const unit = u01 as unknown as Unit
const course: Course = { id: 'test', title: 'Test', sections: [{ id: 's1', order: 1, cefr: 'A1', title: { en: 'S', uz: 'S', ru: 'S', tr: 'S' }, unitIds: [unit.id] }], units: [unit] }
const opts = (over: Partial<SessionOptions> = {}): SessionOptions => ({ baseLang: 'uz', seed: 42, canListen: true, canSpeak: true, ...over })

function containsTiles(tokens: string[], answer: string, lang: 'en' | BaseLang) {
  const bank = tokens.map((t) => normalize(t, lang))
  for (const tile of tokenize(answer, lang)) {
    const i = bank.indexOf(normalize(tile, lang))
    if (i < 0) return false
    bank.splice(i, 1)
  }
  return true
}

describe('buildLessonSession', () => {
  it('is deterministic for a seed', () => {
    expect(buildLessonSession(unit, 0, opts())).toEqual(buildLessonSession(unit, 0, opts()))
  })

  it('teaches new words first, then practises sentences', () => {
    const { exercises } = buildLessonSession(unit, 0, opts())
    expect(exercises.length).toBeGreaterThanOrEqual(12)
    expect(exercises.slice(0, 4).every((e) => e.kind === 'select')).toBe(true)
    expect(exercises.some((e) => e.kind === 'match')).toBe(true)
    expect(exercises.some((e) => e.kind === 'bank')).toBe(true)
  })

  it('ends every lesson with a speaking finale', () => {
    for (let lesson = 0; lesson < unit.lessons.length; lesson++) {
      const { exercises } = buildLessonSession(unit, lesson, opts({ canListen: false, canSpeak: false }))
      const tail = exercises.slice(-3)
      expect(tail.every((e) => e.kind === 'say')).toBe(true)
    }
  })

  it('gives every exercise a unique id', () => {
    for (let lesson = 0; lesson < unit.lessons.length; lesson++) {
      const ids = buildLessonSession(unit, lesson, opts()).exercises.map((e) => e.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('respects missing listening and speaking capabilities', () => {
    for (let lesson = 0; lesson < unit.lessons.length; lesson++) {
      const { exercises } = buildLessonSession(unit, lesson, opts({ canListen: false, canSpeak: false }))
      expect(exercises.some((e) => e.kind === 'listen' || e.kind === 'speak')).toBe(false)
    }
  })

  it.each(['uz', 'ru', 'tr'] as const)('builds solvable exercises for %s', (baseLang) => {
    for (let lesson = 0; lesson < unit.lessons.length; lesson++) {
      for (const seed of [1, 2, 3]) {
        const { exercises } = buildLessonSession(unit, lesson, opts({ baseLang, seed }))
        exercises.forEach((ex) => assertSolvable(ex, baseLang))
      }
    }
  })
})

function assertSolvable(ex: Exercise, baseLang: BaseLang) {
  switch (ex.kind) {
    case 'select': {
      const ids = ex.options.map((o) => o.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toContain(ex.answerId)
      expect(ex.options.length).toBeGreaterThanOrEqual(3)
      expect(gradeSelect(ex, ex.answerId).correct).toBe(true)
      const wrong = ids.find((id) => id !== ex.answerId) as string
      expect(gradeSelect(ex, wrong).correct).toBe(false)
      break
    }
    case 'bank': {
      const lang = ex.direction === 'native-en' ? 'en' : baseLang
      const answer = ex.answers[0] as string
      expect(containsTiles(ex.tokens, answer, lang)).toBe(true)
      expect(ex.tokens.length).toBeGreaterThan(tokenize(answer, lang).length)
      expect(gradeBank(ex, tokenize(answer, lang), baseLang).correct).toBe(true)
      expect(gradeBank(ex, [], baseLang).correct).toBe(false)
      break
    }
    case 'match': {
      expect(ex.pairs.length).toBeGreaterThanOrEqual(3)
      expect(new Set(ex.pairs.map((p) => normalize(p.en, 'en'))).size).toBe(ex.pairs.length)
      expect(new Set(ex.pairs.map((p) => normalize(p.native, baseLang))).size).toBe(ex.pairs.length)
      break
    }
    case 'fill': {
      expect(ex.options).toContain(ex.answer)
      expect(new Set(ex.options.map((o) => normalize(o, 'en'))).size).toBe(ex.options.length)
      const rebuilt = `${ex.before ? `${ex.before} ` : ''}${ex.answer}${ex.after}`
      const source = unit.sentences.find((s) => s.id === ex.itemId)
      expect(rebuilt).toBe(source?.en)
      // no distractor may be a word that is already in the sentence
      const inSentence = tokenize(source?.en ?? '', 'en').map((t) => normalize(t, 'en'))
      ex.options.filter((o) => o !== ex.answer).forEach((o) => expect(inSentence).not.toContain(normalize(o, 'en')))
      expect(gradeFill(ex, ex.answer).correct).toBe(true)
      const wrong = ex.options.find((o) => o !== ex.answer) as string
      expect(gradeFill(ex, wrong).correct).toBe(false)
      break
    }
    case 'listen': {
      const answer = ex.answers[0] as string
      if (ex.mode === 'bank') {
        expect(containsTiles(ex.tokens, answer, 'en')).toBe(true)
        expect(gradeListen(ex, tokenize(answer, 'en')).correct).toBe(true)
      } else {
        expect(gradeListen(ex, answer).correct).toBe(true)
        expect(gradeListen(ex, 'completely different words here').correct).toBe(false)
      }
      break
    }
    case 'type': {
      expect(gradeType(ex, ex.answers[0] as string).correct).toBe(true)
      expect(gradeType(ex, 'zzz').correct).toBe(false)
      break
    }
    case 'speak': {
      expect(gradeSpeak(ex, ex.text).correct).toBe(true)
      expect(gradeSpeak(ex, '').correct).toBe(false)
      break
    }
    case 'say': {
      const answer = ex.answers[0] as string
      expect(gradeSay(ex, answer, false).correct).toBe(true)
      expect(gradeSay(ex, answer, true).correct).toBe(true)
      expect(gradeSay(ex, 'zzz', false).correct).toBe(false)
      expect(gradeSay(ex, '', true).correct).toBe(false)
      break
    }
  }
}

describe('grading details', () => {
  it('accepts contractions and listed alternatives when typing', () => {
    const { exercises } = buildLessonSession(unit, 2, opts({ seed: 7 }))
    const typed = exercises.find((e) => e.kind === 'type')
    if (typed && typed.kind === 'type' && normalize(typed.answers[0] as string, 'en').includes('i am')) {
      const contracted = (typed.answers[0] as string).replace(/I am/g, "I'm")
      expect(gradeType(typed, contracted).correct).toBe(true)
    }
  })

  it('reports the words a spoken answer missed, as they are written', () => {
    const ex = { kind: 'say' as const, id: 'x', itemId: 'u01.s.01', prompt: 'p', audio: "I'm happy, thanks a lot!", answers: ["I'm happy, thanks a lot!"] }
    const partial = gradeSay(ex, 'i am happy a lot', true)
    expect(partial.correct).toBe(true)
    expect(partial.missed).toEqual(['thanks'])
    expect(gradeSay(ex, "I'm happy thanks a lot", true).missed).toEqual([])
    const poor = gradeSay(ex, 'happy', true)
    expect(poor.correct).toBe(false)
    expect(poor.missed).toEqual(["I'm", 'thanks', 'a', 'lot!'])
    expect(gradeSay(ex, "I'm happy, thanks a lot!", false).missed).toBeUndefined()
  })

  it('accepts alternative native translations in tile exercises', () => {
    const sentence = unit.sentences.find((s) => s.id === 'u01.s.19')
    expect(sentence).toBeDefined()
    const ex = {
      kind: 'bank' as const,
      id: 'x',
      itemId: 'u01.s.19',
      direction: 'en-native' as const,
      prompt: 'I am happy.',
      audio: 'I am happy.',
      tokens: ['я', 'счастлива', 'счастлив'],
      answers: ['Я счастлив.', 'Я счастлива.'],
    }
    expect(gradeBank(ex, ['я', 'счастлива'], 'ru').correct).toBe(true)
    expect(gradeBank(ex, ['счастлив', 'я'], 'ru').correct).toBe(false)
  })
})

describe('buildReviewSession', () => {
  it('mixes matches and sentences from the whole unit', () => {
    const { exercises, lexicon } = buildReviewSession(unit, opts())
    expect(exercises.length).toBeGreaterThanOrEqual(10)
    expect(exercises.filter((e) => e.kind === 'match').length).toBeGreaterThanOrEqual(1)
    expect(lexicon).toContain('hello')
    exercises.forEach((ex) => assertSolvable(ex, 'uz'))
  })
})

describe('buildPracticeSession', () => {
  it('builds a short session from specific item ids', () => {
    const ids = ['u01.w.hello', 'u01.w.yes', 'u01.w.no', 'u01.s.03', 'u01.s.17', 'u01.s.19']
    const { exercises } = buildPracticeSession(course, ids, opts(), 8)
    expect(exercises.length).toBeGreaterThan(0)
    expect(exercises.length).toBeLessThanOrEqual(8)
    exercises.forEach((ex) => assertSolvable(ex, 'uz'))
  })

  it('returns nothing for unknown ids', () => {
    expect(buildPracticeSession(course, ['nope'], opts()).exercises).toEqual([])
  })
})
