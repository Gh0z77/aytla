import type { CharacterId } from './types'

export const CHARACTER_IDS: readonly CharacterId[] = ['everest', 'lumi', 'pix', 'nubi', 'rocky', 'aero']

/** Narrow untrusted data (API responses, stored state) to a known guide. */
export function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === 'string' && (CHARACTER_IDS as readonly string[]).includes(value)
}
