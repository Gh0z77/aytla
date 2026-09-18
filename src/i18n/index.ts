import { useCallback } from 'react'
import type { BaseLang } from '../core/types'
import { useApp } from '../state/store'
import { ru } from './ru'
import { tr } from './tr'
import { uz, type StringKey } from './uz'

/**
 * The interface speaks the learner's own language (uz / ru / tr): the language
 * they learn English FROM. uz.ts is the source of truth for the key set.
 */
const DICTIONARIES: Record<BaseLang, Record<StringKey, string>> = { uz, ru, tr }

export const LANGUAGE_NAMES: Record<BaseLang, { name: string; flag: string }> = {
  uz: { name: "O'zbekcha", flag: '🇺🇿' },
  ru: { name: 'Русский', flag: '🇷🇺' },
  tr: { name: 'Türkçe', flag: '🇹🇷' },
}

export type Vars = Record<string, string | number>
export type Translate = (key: StringKey, vars?: Vars) => string

export function translate(lang: BaseLang, key: StringKey, vars?: Vars): string {
  const template = DICTIONARIES[lang][key] ?? uz[key] ?? key
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
}

export function useT(): Translate {
  const lang = useApp((s) => s.user.profile.baseLang)
  return useCallback((key, vars) => translate(lang, key, vars), [lang])
}

export type { StringKey }
