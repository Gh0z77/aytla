import { WORD_ID_MARKER } from './progress'
import { normalize, tokenize } from './text'
import { BASE_LANGS, type Course } from './types'

/**
 * Structural checks for course content. Run by the test-suite and by
 * `npm run content:check`, so broken content never reaches a learner.
 */

export const SENTENCE_ID_MARKER = '.s.'
const MAX_TILES = 10
const MIN_SENTENCES_PER_LESSON = 5
const MIN_WORDS_PER_UNIT = 8

export interface ValidationReport {
  errors: string[]
  warnings: string[]
  stats: { units: number; lessons: number; words: number; sentences: number }
}

export function validateCourse(course: Course): ValidationReport {
  const errors: string[] = []
  const warnings: string[] = []
  const seen = new Set<string>()
  const claim = (id: string, what: string) => {
    if (seen.has(id)) errors.push(`duplicate id "${id}" (${what})`)
    seen.add(id)
  }
  const stats = { units: course.units.length, lessons: 0, words: 0, sentences: 0 }

  // sections ↔ units
  const unitIds = new Set(course.units.map((u) => u.id))
  const placed = new Map<string, number>()
  course.sections.forEach((s) => {
    claim(s.id, 'section')
    s.unitIds.forEach((id) => {
      if (!unitIds.has(id)) errors.push(`section ${s.id} references unknown unit "${id}"`)
      placed.set(id, (placed.get(id) ?? 0) + 1)
    })
  })
  course.units.forEach((u) => {
    const n = placed.get(u.id) ?? 0
    if (n !== 1) errors.push(`unit ${u.id} must be placed in exactly one section (found ${n})`)
  })

  for (const unit of course.units) {
    claim(unit.id, 'unit')
    const where = `unit ${unit.id}`
    const needL10n = (value: Record<string, string> | undefined, label: string, withEn: boolean): void => {
      if (!value) {
        errors.push(`${where}: missing ${label}`)
        return
      }
      const langs: string[] = withEn ? ['en', ...BASE_LANGS] : [...BASE_LANGS]
      langs.forEach((l) => {
        const text = value[l]
        if (text === undefined || text.trim().length === 0) errors.push(`${where}: ${label} is missing "${l}"`)
      })
    }
    needL10n(unit.title, 'title', true)
    needL10n(unit.goal, 'goal', true)
    if (unit.tip) {
      needL10n(unit.tip.title, 'tip.title', true)
      needL10n(unit.tip.body, 'tip.body', true)
      unit.tip.examples.forEach((e, i) => {
        if (!e.en.trim()) errors.push(`${where}: tip example ${i} has no English`)
        needL10n(e.native, `tip example ${i}`, false)
      })
    }

    // words
    if (unit.words.length < MIN_WORDS_PER_UNIT) warnings.push(`${where}: only ${unit.words.length} words`)
    const wordIds = new Set<string>()
    const englishSeen = new Map<string, string>()
    unit.words.forEach((w) => {
      claim(w.id, 'word')
      wordIds.add(w.id)
      stats.words += 1
      if (!w.id.startsWith(`${unit.id}${WORD_ID_MARKER}`)) errors.push(`${where}: word id "${w.id}" must start with "${unit.id}${WORD_ID_MARKER}"`)
      if (!w.en.trim()) errors.push(`${where}: word ${w.id} has no English`)
      needL10n(w.native, `word ${w.id}`, false)
      const key = normalize(w.en, 'en')
      const dup = englishSeen.get(key)
      if (dup) errors.push(`${where}: words ${dup} and ${w.id} have the same English "${w.en}"`)
      englishSeen.set(key, w.id)
    })

    // sentences
    const sentenceIds = new Set<string>()
    unit.sentences.forEach((s) => {
      claim(s.id, 'sentence')
      sentenceIds.add(s.id)
      stats.sentences += 1
      if (!s.id.startsWith(`${unit.id}${SENTENCE_ID_MARKER}`)) errors.push(`${where}: sentence id "${s.id}" must start with "${unit.id}${SENTENCE_ID_MARKER}"`)
      if (!s.en.trim()) errors.push(`${where}: sentence ${s.id} has no English`)
      needL10n(s.native, `sentence ${s.id}`, false)
      const tiles = tokenize(s.en, 'en').length
      if (tiles === 0) errors.push(`${where}: sentence ${s.id} has no tiles`)
      if (tiles > MAX_TILES) warnings.push(`${where}: sentence ${s.id} has ${tiles} tiles (max ${MAX_TILES} recommended)`)
      BASE_LANGS.forEach((l) => {
        const n = tokenize(s.native[l] ?? '', l).length
        if (n > MAX_TILES + 2) warnings.push(`${where}: sentence ${s.id} (${l}) has ${n} tiles`)
      })
    })

    // lessons
    if (unit.lessons.length === 0) errors.push(`${where}: no lessons`)
    const introduced = new Map<string, string>()
    const practised = new Set<string>()
    unit.lessons.forEach((lesson) => {
      claim(lesson.id, 'lesson')
      stats.lessons += 1
      if (!lesson.id.startsWith(`${unit.id}-l`)) errors.push(`${where}: lesson id "${lesson.id}" must start with "${unit.id}-l"`)
      needL10n(lesson.title, `lesson ${lesson.id} title`, true)
      lesson.words.forEach((id) => {
        if (!wordIds.has(id)) errors.push(`${where}: lesson ${lesson.id} references unknown word "${id}"`)
        const prior = introduced.get(id)
        if (prior) errors.push(`${where}: word ${id} is introduced twice (${prior}, ${lesson.id})`)
        introduced.set(id, lesson.id)
      })
      lesson.sentences.forEach((id) => {
        if (!sentenceIds.has(id)) errors.push(`${where}: lesson ${lesson.id} references unknown sentence "${id}"`)
        practised.add(id)
      })
      if (lesson.sentences.length < MIN_SENTENCES_PER_LESSON) warnings.push(`${where}: lesson ${lesson.id} has only ${lesson.sentences.length} sentences`)
      if (lesson.words.length === 0) warnings.push(`${where}: lesson ${lesson.id} introduces no words`)
    })
    unit.words.forEach((w) => !introduced.has(w.id) && warnings.push(`${where}: word ${w.id} is never introduced in a lesson`))
    unit.sentences.forEach((s) => !practised.has(s.id) && warnings.push(`${where}: sentence ${s.id} is not used in any lesson`))
  }

  return { errors, warnings, stats }
}
