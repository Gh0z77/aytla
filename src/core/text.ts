/**
 * Text utilities for grading: normalisation, tokenisation, typo tolerance.
 * Works for English and for the base languages (Uzbek Latin, Russian, Turkish).
 */

const APOSTROPHES = /[‘’ʻʼ`´′]/g
const PUNCTUATION = /[.,!?;:"“”«»()\[\]{}…—–]/g

/** English contractions → expanded form, so "I'm" and "I am" grade the same. */
const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "he's": 'he is',
  "she's": 'she is',
  "it's": 'it is',
  "we're": 'we are',
  "they're": 'they are',
  "that's": 'that is',
  "what's": 'what is',
  "where's": 'where is',
  "who's": 'who is',
  "how's": 'how is',
  "there's": 'there is',
  "here's": 'here is',
  "let's": 'let us',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'can not',
  cannot: 'can not',
  "couldn't": 'could not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "i'll": 'i will',
  "you'll": 'you will',
  "he'll": 'he will',
  "she'll": 'she will',
  "we'll": 'we will',
  "they'll": 'they will',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
}

export type TextLang = 'en' | 'uz' | 'ru' | 'tr'

/** Locale-aware lower-casing (Turkish dotted/dotless i). */
function lower(text: string, lang: TextLang): string {
  if (lang === 'tr') return text.replace(/I/g, 'ı').replace(/İ/g, 'i').toLowerCase()
  return text.toLowerCase()
}

/** Canonical comparable form of an answer. */
export function normalize(text: string, lang: TextLang): string {
  let out = lower(text.replace(APOSTROPHES, "'"), lang)
  out = out.replace(PUNCTUATION, ' ').replace(/-/g, ' ')
  if (lang === 'ru') out = out.replace(/ё/g, 'е')
  out = out.replace(/\s+/g, ' ').trim()
  if (lang === 'en') {
    out = out
      .split(' ')
      .map((w) => CONTRACTIONS[w] ?? w)
      .join(' ')
  }
  return out
}

/** Characters stripped from the edges of a tile (inner apostrophes and hyphens stay). */
const EDGE_PUNCT = /^[.,!?;:"“”«»()…]+|[.,!?;:"“”«»()…]+$/g

/**
 * Split a sentence into word tiles. Edge punctuation is dropped. The first
 * tile is lower-cased unless it must stay capitalised ("I", "I'm", a proper
 * noun listed in `keepCapitalised`).
 */
export function tokenize(sentence: string, lang: TextLang, keepCapitalised?: ReadonlySet<string>): string[] {
  const raw = sentence
    .replace(APOSTROPHES, "'")
    .split(/\s+/)
    .map((t) => t.replace(EDGE_PUNCT, ''))
    .filter((t) => t.length > 0 && t !== '-' && t !== '—' && t !== '–')
  const first = raw[0]
  if (first !== undefined) {
    const isPronounI = lang === 'en' && (first === 'I' || first.startsWith("I'"))
    const isProper = keepCapitalised?.has(first) ?? false
    if (!isPronounI && !isProper) raw[0] = lower(first.charAt(0), lang) + first.slice(1)
  }
  return raw
}

/** Words that appear capitalised in a non-initial position: treated as proper nouns. */
export function collectProperNouns(sentences: readonly string[]): Set<string> {
  const out = new Set<string>()
  for (const s of sentences) {
    const rawParts = s.replace(APOSTROPHES, "'").split(/\s+/).filter(Boolean)
    rawParts.forEach((rawToken, i) => {
      if (i === 0) return
      // the first word after ".", "!" or "?" is capitalised by grammar, not because it is a name
      if (/[.!?]$/.test(rawParts[i - 1] ?? '')) return
      const t = rawToken.replace(EDGE_PUNCT, '')
      if (!t) return
      const c = t.charAt(0)
      if (c !== c.toLowerCase() && c === c.toUpperCase() && t !== 'I' && !t.startsWith("I'")) out.add(t)
    })
  }
  return out
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min((prev[j] as number) + 1, (curr[j - 1] as number) + 1, (prev[j - 1] as number) + cost)
    }
    const tmp = prev
    prev = curr
    curr = tmp
  }
  return prev[b.length] as number
}

function allowedTypos(word: string): number {
  if (word.length >= 9) return 2
  if (word.length >= 5) return 1
  return 0
}

export interface TextMatch {
  correct: boolean
  typo: boolean
}

/**
 * Compare a typed answer with one accepted answer.
 * A word may differ by a small edit distance, unless the typed word is itself
 * a different known word (then it is a real mistake, not a typo).
 */
export function matchText(input: string, expected: string, lang: TextLang, lexicon?: ReadonlySet<string>): TextMatch {
  const a = normalize(input, lang)
  const b = normalize(expected, lang)
  if (a === b) return { correct: true, typo: false }
  if (a.length === 0) return { correct: false, typo: false }
  // spacing-only differences ("icecream" vs "ice cream")
  if (a.replace(/ /g, '') === b.replace(/ /g, '')) return { correct: true, typo: true }
  const aw = a.split(' ')
  const bw = b.split(' ')
  if (aw.length !== bw.length) return { correct: false, typo: false }
  let typos = 0
  for (let i = 0; i < aw.length; i++) {
    const x = aw[i] as string
    const y = bw[i] as string
    if (x === y) continue
    if (lexicon?.has(x)) return { correct: false, typo: false }
    const d = levenshtein(x, y)
    if (d > allowedTypos(y)) return { correct: false, typo: false }
    typos += 1
  }
  // at most one slipped word per three words of answer
  if (typos > Math.max(1, Math.floor(bw.length / 3))) return { correct: false, typo: false }
  return { correct: true, typo: true }
}
