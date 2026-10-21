import type { BaseLang, Course, Lesson, Section, Sentence, TargetLang, Unit, Word } from '../core/types'
import u01 from './units/u01.json'
import u02 from './units/u02.json'
import u03 from './units/u03.json'
import u04 from './units/u04.json'
import u05 from './units/u05.json'
import u06 from './units/u06.json'
import u07 from './units/u07.json'
import u08 from './units/u08.json'
import u09 from './units/u09.json'
import u10 from './units/u10.json'
import u11 from './units/u11.json'
import u12 from './units/u12.json'
import u13 from './units/u13.json'
import u14 from './units/u14.json'
import u15 from './units/u15.json'
import u16 from './units/u16.json'
import u17 from './units/u17.json'
import u18 from './units/u18.json'
import u19 from './units/u19.json'
import u20 from './units/u20.json'
import u21 from './units/u21.json'
import u22 from './units/u22.json'

/**
 * The English course. Units are plain JSON (words + sentences with uz / ru / tr
 * translations); every exercise is generated from them by `src/core`.
 *
 * To add a unit: drop `uNN.json` into ./units, import it here and list its id
 * in a section. `npm run content:check` validates the whole course.
 */
// u19–u22 are goal units: each learner sees only the one that serves their goal (core/goals.ts)
const UNITS = [u01, u02, u03, u04, u05, u06, u19, u20, u21, u22, u07, u08, u09, u10, u11, u12, u13, u14, u15, u16, u17, u18] as unknown as Unit[]

const SECTION_PLAN: Array<Omit<Section, 'unitIds'> & { unitIds: string[] }> = [
  {
    id: 's1',
    order: 1,
    cefr: 'A1',
    title: { en: 'First words', uz: "Birinchi so'zlar", ru: 'Первые слова', tr: 'İlk kelimeler' },
    unitIds: ['u01', 'u02', 'u03', 'u04', 'u05', 'u06'],
  },
  {
    id: 's2',
    order: 2,
    cefr: 'A1+',
    title: { en: 'Everyday talk', uz: 'Kundalik gaplar', ru: 'Повседневная речь', tr: 'Günlük konuşma' },
    unitIds: ['u19', 'u20', 'u21', 'u22', 'u07', 'u08', 'u09', 'u10', 'u11', 'u12'],
  },
  {
    id: 's3',
    order: 3,
    cefr: 'A2',
    title: { en: 'Real conversations', uz: 'Haqiqiy suhbatlar', ru: 'Настоящие разговоры', tr: 'Gerçek sohbetler' },
    unitIds: ['u13', 'u14', 'u15', 'u16', 'u17', 'u18'],
  },
]

const available = new Set(UNITS.map((u) => u.id))

export const COURSE: Course = {
  id: 'en-a1',
  title: 'English',
  // sections only list units that exist, so a partially authored course is still valid
  sections: SECTION_PLAN.map((s) => ({ ...s, unitIds: s.unitIds.filter((id) => available.has(id)) })).filter((s) => s.unitIds.length > 0),
  // `order` restarts in every section, so the course order is (section, order)
  units: UNITS.slice().sort((a, b) => a.section - b.section || a.order - b.order),
}

/**
 * The same course with another language as the target. Every word and
 * sentence is authored in all four languages, so a Russian course for Uzbek
 * speakers is the English course with the Russian text in the target slot
 * and English moved into the translations. Ids are prefixed ("ru-u01") so
 * progress, mistakes and spaced repetition stay separate per course; the
 * English course keeps its original ids. English grammar tips are dropped.
 */
const prefixed = (target: TargetLang, id: string) => (target === 'en' ? id : `${target}-${id}`)

/** the course a prefixed id belongs to ("ru-u01-l1" → "ru"), English for unprefixed ids */
export function targetOfId(id: string): TargetLang {
  const m = /^(ru|tr|uz)-/.exec(id)
  return (m?.[1] as TargetLang | undefined) ?? 'en'
}

function retarget<T extends { id: string; en: string; native: Record<BaseLang, string> }>(item: T, target: Exclude<TargetLang, 'en'>): T {
  // the translations keep every other language; the target's own slot now holds the English
  return { ...item, id: prefixed(target, item.id), en: item.native[target], native: { ...item.native, [target]: item.en } }
}

function retargetUnit(unit: Unit, target: Exclude<TargetLang, 'en'>): Unit {
  const words: Word[] = unit.words.map((w) => {
    const out = retarget(w, target)
    const alt = w.altNative?.[target]
    return { ...out, altNative: { ...w.altNative, [target]: undefined }, ...(alt ? {} : {}) } as Word
  })
  const sentences: Sentence[] = unit.sentences.map((s) => {
    const out = retarget(s, target)
    // accepted variants: the target language's own alternatives become the alternative answers
    const altEn = s.altNative?.[target]
    return { ...out, altEn: altEn && altEn.length > 0 ? altEn : undefined, altEnFor: undefined, altNative: { ...s.altNative, [target]: undefined } } as Sentence
  })
  const lessons: Lesson[] = unit.lessons.map((l) => ({ ...l, id: prefixed(target, l.id), words: l.words.map((id) => prefixed(target, id)), sentences: l.sentences.map((id) => prefixed(target, id)) }))
  const { tip: _tip, ...rest } = unit
  return { ...rest, id: prefixed(target, unit.id), words, sentences, lessons }
}

const COURSE_TITLES: Record<TargetLang, string> = { en: 'English', ru: 'Русский', tr: 'Türkçe', uz: "O'zbek" }
const courses = new Map<TargetLang, Course>([['en', COURSE]])

/** The course for a target language, built once and cached. */
export function courseFor(target: TargetLang): Course {
  const cached = courses.get(target)
  if (cached) return cached
  const t = target as Exclude<TargetLang, 'en'>
  const built: Course = {
    id: `${target}-a1`,
    title: COURSE_TITLES[target],
    sections: COURSE.sections.map((s) => ({ ...s, id: prefixed(target, s.id), unitIds: s.unitIds.map((id) => prefixed(target, id)) })),
    units: COURSE.units.map((u) => retargetUnit(u, t)),
  }
  courses.set(target, built)
  return built
}

export function findUnit(unitId: string): Unit | undefined {
  return courseFor(targetOfId(unitId)).units.find((u) => u.id === unitId)
}

/** Resolve any lesson or review id to its unit and lesson index (null = review). */
export function findLesson(lessonId: string): { unit: Unit; lessonIndex: number | null } | undefined {
  for (const unit of courseFor(targetOfId(lessonId)).units) {
    if (lessonId === `${unit.id}-review`) return { unit, lessonIndex: null }
    const lessonIndex = unit.lessons.findIndex((l) => l.id === lessonId)
    if (lessonIndex >= 0) return { unit, lessonIndex }
  }
  return undefined
}
