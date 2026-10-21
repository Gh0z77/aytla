import { useCallback } from 'react'
import type { BaseLang, TargetLang } from '../core/types'
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

export const TARGET_NAMES: Record<TargetLang, { name: string; flag: string }> = {
  en: { name: 'English', flag: '🇬🇧' },
  ru: LANGUAGE_NAMES.ru,
  tr: LANGUAGE_NAMES.tr,
  uz: LANGUAGE_NAMES.uz,
}

/**
 * How each interface language names the language being learned, in the
 * grammatical forms its strings need: strings say "{lang} tilida" / "{Lang}
 * tilini" (uz), "{lang}" as an adverb and "{Lang}" as a noun (ru), "{lang}"
 * and the accusative "{langAcc}" (tr). Filled in automatically by `translate`.
 */
const TARGET_WORDS: Record<BaseLang, Record<TargetLang, Record<string, string>>> = {
  uz: {
    en: { lang: 'ingliz', Lang: 'Ingliz' },
    ru: { lang: 'rus', Lang: 'Rus' },
    tr: { lang: 'turk', Lang: 'Turk' },
    uz: { lang: "o'zbek", Lang: "O'zbek" },
  },
  ru: {
    en: { lang: 'по-английски', Lang: 'английский' },
    ru: { lang: 'по-русски', Lang: 'русский' },
    tr: { lang: 'по-турецки', Lang: 'турецкий' },
    uz: { lang: 'по-узбекски', Lang: 'узбекский' },
  },
  tr: {
    en: { lang: 'İngilizce', Lang: 'İngilizce', langAcc: 'İngilizceyi' },
    ru: { lang: 'Rusça', Lang: 'Rusça', langAcc: 'Rusçayı' },
    tr: { lang: 'Türkçe', Lang: 'Türkçe', langAcc: 'Türkçeyi' },
    uz: { lang: 'Özbekçe', Lang: 'Özbekçe', langAcc: 'Özbekçeyi' },
  },
}

export type Vars = Record<string, string | number>
export type Translate = (key: StringKey, vars?: Vars) => string

export function translate(lang: BaseLang, key: StringKey, vars?: Vars, target: TargetLang = 'en'): string {
  const template = DICTIONARIES[lang][key] ?? uz[key] ?? key
  const all: Vars = { ...TARGET_WORDS[lang][target], ...vars }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in all ? String(all[name]) : match))
}

export function useT(): Translate {
  const lang = useApp((s) => s.user.profile.baseLang)
  const target = useApp((s) => s.user.profile.target ?? 'en')
  return useCallback((key, vars) => translate(lang, key, vars, target), [lang, target])
}

export type { StringKey }
