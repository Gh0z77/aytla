import { matchText, normalize, type TextLang } from './text'
import type { BankExercise, BaseLang, FillExercise, GradeResult, ListenExercise, SelectExercise, SpeakExercise, TypeExercise } from './types'

/** Grading is pure: (exercise, learner input) → result. The UI never decides correctness itself. */

export function gradeSelect(ex: SelectExercise, optionId: string): GradeResult {
  const expected = ex.options.find((o) => o.id === ex.answerId)?.label ?? ''
  return { correct: optionId === ex.answerId, expected }
}

function gradeTiles(chosen: readonly string[], answers: readonly string[], lang: TextLang): GradeResult {
  const given = normalize(chosen.join(' '), lang)
  const correct = answers.some((a) => normalize(a, lang) === given)
  return { correct, expected: answers[0] ?? '' }
}

export function gradeBank(ex: BankExercise, chosen: readonly string[], baseLang: BaseLang): GradeResult {
  return gradeTiles(chosen, ex.answers, ex.direction === 'native-en' ? 'en' : baseLang)
}

export function gradeFill(ex: FillExercise, option: string): GradeResult {
  return { correct: normalize(option, 'en') === normalize(ex.answer, 'en'), expected: ex.answer }
}

function gradeTyped(input: string, answers: readonly string[], lexicon?: ReadonlySet<string>): GradeResult {
  const expected = answers[0] ?? ''
  let typo = false
  for (const a of answers) {
    const m = matchText(input, a, 'en', lexicon)
    if (m.correct && !m.typo) return { correct: true, expected }
    if (m.correct) typo = true
  }
  return typo ? { correct: true, typo: true, expected } : { correct: false, expected }
}

export function gradeListen(ex: ListenExercise, input: readonly string[] | string, lexicon?: ReadonlySet<string>): GradeResult {
  if (typeof input === 'string') return gradeTyped(input, ex.answers, lexicon)
  return gradeTiles(input, ex.answers, 'en')
}

export function gradeType(ex: TypeExercise, input: string, lexicon?: ReadonlySet<string>): GradeResult {
  return gradeTyped(input, ex.answers, lexicon)
}

/**
 * Speech recognition is noisy, so speaking is graded leniently: at least 75%
 * of the expected words must be heard, in any order.
 */
export function gradeSpeak(ex: SpeakExercise, transcript: string): GradeResult {
  const want = normalize(ex.text, 'en').split(' ').filter(Boolean)
  const heard = new Set(normalize(transcript, 'en').split(' ').filter(Boolean))
  if (want.length === 0) return { correct: false, expected: ex.text }
  const hits = want.filter((w) => heard.has(w)).length
  return { correct: hits / want.length >= 0.75, expected: ex.text }
}
