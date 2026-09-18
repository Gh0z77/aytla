import type { Course, Section, Unit } from '../core/types'
import u01 from './units/u01.json'
import u02 from './units/u02.json'
import u03 from './units/u03.json'

/**
 * The English course. Units are plain JSON (words + sentences with uz / ru / tr
 * translations); every exercise is generated from them by `src/core`.
 *
 * To add a unit: drop `uNN.json` into ./units, import it here and list its id
 * in a section. `npm run content:check` validates the whole course.
 */
const UNITS = [u01, u02, u03] as unknown as Unit[]

const SECTION_PLAN: Array<Omit<Section, 'unitIds'> & { unitIds: string[] }> = [
  {
    id: 's1',
    order: 1,
    cefr: 'A1',
    title: { en: 'Base Camp', uz: 'Base Camp', ru: 'Базовый лагерь', tr: 'Ana Kamp' },
    unitIds: ['u01', 'u02', 'u03', 'u04', 'u05', 'u06'],
  },
  {
    id: 's2',
    order: 2,
    cefr: 'A1+',
    title: { en: 'Camp 1', uz: 'Camp 1', ru: 'Лагерь 1', tr: 'Kamp 1' },
    unitIds: ['u07', 'u08', 'u09', 'u10', 'u11', 'u12'],
  },
  {
    id: 's3',
    order: 3,
    cefr: 'A2',
    title: { en: 'Camp 2', uz: 'Camp 2', ru: 'Лагерь 2', tr: 'Kamp 2' },
    unitIds: ['u13', 'u14', 'u15', 'u16', 'u17', 'u18'],
  },
]

const available = new Set(UNITS.map((u) => u.id))

export const COURSE: Course = {
  id: 'en-a1',
  title: 'English',
  // sections only list units that exist, so a partially authored course is still valid
  sections: SECTION_PLAN.map((s) => ({ ...s, unitIds: s.unitIds.filter((id) => available.has(id)) })).filter((s) => s.unitIds.length > 0),
  units: UNITS.slice().sort((a, b) => a.order - b.order),
}

export function findUnit(unitId: string): Unit | undefined {
  return COURSE.units.find((u) => u.id === unitId)
}

/** Resolve any lesson or review id to its unit and lesson index (null = review). */
export function findLesson(lessonId: string): { unit: Unit; lessonIndex: number | null } | undefined {
  for (const unit of COURSE.units) {
    if (lessonId === `${unit.id}-review`) return { unit, lessonIndex: null }
    const lessonIndex = unit.lessons.findIndex((l) => l.id === lessonId)
    if (lessonIndex >= 0) return { unit, lessonIndex }
  }
  return undefined
}
