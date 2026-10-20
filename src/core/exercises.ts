import { createRng, sample, shuffle, type Rng } from './rng'
import { collectProperNouns, normalize, tokenize } from './text'
import type {
  BankExercise,
  BaseLang,
  Course,
  Exercise,
  FillExercise,
  ListenExercise,
  MatchExercise,
  SayExercise,
  SelectExercise,
  Sentence,
  SpeakExercise,
  TypeExercise,
  Unit,
  Word,
} from './types'

/**
 * Exercise generation. Content authors only write words and sentences with
 * translations; every exercise (options, tiles, distractors, blanks) is derived
 * here, deterministically for a given seed.
 */

export interface SessionOptions {
  baseLang: BaseLang
  seed: number
  /** text-to-speech available */
  canListen: boolean
  /** speech recognition available */
  canSpeak: boolean
}

export interface BuiltSession {
  exercises: Exercise[]
  /** normalised English vocabulary, used to tell typos from real mistakes */
  lexicon: string[]
}

export const reviewLessonId = (unit: Pick<Unit, 'id'>) => `${unit.id}-review`

type SentencePlan = 'bank-en' | 'bank-native' | 'fill' | 'listen-bank' | 'listen-type' | 'type' | 'speak'

const PLANS: readonly SentencePlan[][] = [
  ['bank-en', 'bank-native', 'fill', 'listen-bank', 'bank-native', 'bank-en', 'listen-bank', 'bank-native'],
  ['bank-en', 'bank-native', 'fill', 'listen-bank', 'bank-native', 'type', 'bank-native', 'speak'],
  ['bank-native', 'fill', 'listen-bank', 'type', 'bank-native', 'listen-type', 'speak', 'type'],
]

const MAX_SELECTS_UP_FRONT = 4
const MATCH_PAIRS = 5
const BANK_DISTRACTORS = 4
export const FINALE_SENTENCES = 3

class UnitContext {
  readonly words = new Map<string, Word>()
  readonly sentences = new Map<string, Sentence>()
  readonly properNouns: Set<string>
  private counter = 0

  constructor(
    readonly unit: Unit,
    readonly opts: SessionOptions,
    readonly rng: Rng,
    private readonly prefix: string
  ) {
    unit.words.forEach((w) => this.words.set(w.id, w))
    unit.sentences.forEach((s) => this.sentences.set(s.id, s))
    this.properNouns = collectProperNouns(unit.sentences.map((s) => s.en))
  }

  nextId(kind: string): string {
    this.counter += 1
    return `${this.prefix}-${this.counter}-${kind}`
  }

  get lang(): BaseLang {
    return this.opts.baseLang
  }

  // -- word exercises --------------------------------------------------------

  select(word: Word): SelectExercise {
    const others = this.unit.words.filter((w) => w.id !== word.id && normalize(w.en, 'en') !== normalize(word.en, 'en'))
    const preferred = word.emoji ? others.filter((w) => w.emoji) : others
    const pool = preferred.length >= 2 ? preferred : others
    const distractors = sample(this.rng, pool, 3)
    const options = shuffle(this.rng, [word, ...distractors]).map((w) => ({ id: w.id, label: w.en, emoji: w.emoji }))
    return {
      kind: 'select',
      id: this.nextId('select'),
      itemId: word.id,
      prompt: word.native[this.lang],
      audio: word.en,
      options,
      answerId: word.id,
    }
  }

  match(words: readonly Word[]): MatchExercise | null {
    const seenEn = new Set<string>()
    const seenNative = new Set<string>()
    const pairs: MatchExercise['pairs'] = []
    for (const w of words) {
      const en = normalize(w.en, 'en')
      const native = normalize(w.native[this.lang], this.lang)
      if (seenEn.has(en) || seenNative.has(native)) continue
      seenEn.add(en)
      seenNative.add(native)
      pairs.push({ id: w.id, en: w.en, native: w.native[this.lang] })
      if (pairs.length === MATCH_PAIRS) break
    }
    if (pairs.length < 3) return null
    return { kind: 'match', id: this.nextId('match'), pairs }
  }

  // -- sentence exercises ----------------------------------------------------

  private englishTiles(sentence: Sentence): string[] {
    return tokenize(sentence.en, 'en', this.properNouns)
  }

  /** Every English answer accepted for this learner's language. */
  private englishAnswers(sentence: Sentence): string[] {
    return [sentence.en, ...(sentence.altEn ?? []), ...(sentence.altEnFor?.[this.lang] ?? [])]
  }

  /** True when the native prompt maps to more than one English sentence (he / she in Uzbek and Turkish). */
  private isAmbiguousFromNative(sentence: Sentence): boolean {
    return (sentence.altEnFor?.[this.lang]?.length ?? 0) > 0
  }

  private distractorTiles(answerTiles: readonly string[], side: 'en' | 'native', excludeSentenceId: string): string[] {
    const lang = side === 'en' ? 'en' : this.lang
    const taken = new Set(answerTiles.map((t) => normalize(t, lang)))
    const candidates: string[] = []
    const push = (tile: string) => {
      const key = normalize(tile, lang)
      if (key.length === 0 || taken.has(key)) return
      taken.add(key)
      candidates.push(tile)
    }
    for (const s of this.unit.sentences) {
      if (s.id === excludeSentenceId) continue
      const tiles = side === 'en' ? tokenize(s.en, 'en', this.properNouns) : tokenize(s.native[this.lang], this.lang)
      tiles.forEach(push)
    }
    if (side === 'en') this.unit.words.forEach((w) => !w.en.includes(' ') && push(w.en))
    return sample(this.rng, candidates, BANK_DISTRACTORS)
  }

  bank(sentence: Sentence, direction: BankExercise['direction']): BankExercise {
    const toEnglish = direction === 'native-en'
    const answerTiles = toEnglish ? this.englishTiles(sentence) : tokenize(sentence.native[this.lang], this.lang)
    const distractors = this.distractorTiles(answerTiles, toEnglish ? 'en' : 'native', sentence.id)
    const answers = toEnglish ? this.englishAnswers(sentence) : [sentence.native[this.lang], ...(sentence.altNative?.[this.lang] ?? [])]
    if (toEnglish) {
      // an ambiguous prompt ("U talaba.") must let the learner build either reading ("he" and "she" tiles)
      const present = new Set([...answerTiles, ...distractors].map((t) => normalize(t, 'en')))
      for (const alt of sentence.altEnFor?.[this.lang] ?? []) {
        for (const tile of tokenize(alt, 'en', this.properNouns)) {
          const key = normalize(tile, 'en')
          if (!present.has(key)) {
            present.add(key)
            distractors.push(tile)
          }
        }
      }
    }
    return {
      kind: 'bank',
      id: this.nextId('bank'),
      itemId: sentence.id,
      direction,
      prompt: toEnglish ? sentence.native[this.lang] : sentence.en,
      audio: sentence.en,
      tokens: shuffle(this.rng, [...answerTiles, ...distractors]),
      answers,
    }
  }

  fill(sentence: Sentence, preferWordIds: ReadonlySet<string>): FillExercise | null {
    // the translation is the learner's only clue; if it fits two English sentences, a blank is unfair
    if (this.isAmbiguousFromNative(sentence)) return null
    const raw = sentence.en.split(/\s+/).filter(Boolean)
    const singles = this.unit.words.filter((w) => !w.en.includes(' '))
    const byKey = new Map(singles.map((w) => [normalize(w.en, 'en'), w] as const))
    const hits: Array<{ index: number; word: Word }> = []
    raw.forEach((token, index) => {
      const word = byKey.get(normalize(token, 'en'))
      if (word) hits.push({ index, word })
    })
    if (hits.length === 0) return null
    const preferred = hits.filter((h) => preferWordIds.has(h.word.id))
    const pickFrom = preferred.length > 0 ? preferred : hits
    const hit = pickFrom[Math.floor(this.rng() * pickFrom.length)]
    if (!hit) return null

    const token = raw[hit.index] as string
    // English tokens only; plain ASCII classes keep this safe on every JS engine (Hermes included).
    const core = token.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '')
    const lead = token.slice(0, token.indexOf(core))
    const trail = token.slice(token.indexOf(core) + core.length)
    // The tile is capitalised by position ("How are you?") but the dictionary word is not:
    // capitalise the distractors too, so casing never gives the answer away.
    const isUpper = (s: string) => s.charAt(0) !== s.charAt(0).toLowerCase()
    const capitalised = isUpper(core) && !isUpper(hit.word.en)
    const shape = (w: string) => (capitalised ? w.charAt(0).toUpperCase() + w.slice(1) : w)

    // a distractor that already appears in the sentence ("____, please." → "Please") is confusing, not challenging
    const inSentence = new Set(raw.map((t) => normalize(t, 'en')))
    const anyOther = singles.filter((w) => w.id !== hit.word.id && !inSentence.has(normalize(w.en, 'en')))
    const samePos = anyOther.filter((w) => w.pos !== undefined && w.pos === hit.word.pos)
    const pool = samePos.length >= 2 ? samePos : anyOther
    const distractors = sample(this.rng, pool, 2).map((w) => shape(w.en))
    if (distractors.length < 2) return null

    const before = [...raw.slice(0, hit.index), lead].filter(Boolean).join(' ')
    const rest = raw.slice(hit.index + 1).join(' ')
    const after = `${trail}${rest ? ` ${rest}` : ''}`
    return {
      kind: 'fill',
      id: this.nextId('fill'),
      itemId: sentence.id,
      before,
      after,
      options: shuffle(this.rng, [core, ...distractors]),
      answer: core,
      translation: sentence.native[this.lang],
      audio: sentence.en,
    }
  }

  listen(sentence: Sentence, mode: ListenExercise['mode']): ListenExercise {
    const answerTiles = this.englishTiles(sentence)
    const tokens = mode === 'bank' ? shuffle(this.rng, [...answerTiles, ...this.distractorTiles(answerTiles, 'en', sentence.id)]) : []
    return {
      kind: 'listen',
      id: this.nextId('listen'),
      itemId: sentence.id,
      mode,
      audio: sentence.en,
      tokens,
      answers: [sentence.en, ...(sentence.altEn ?? [])],
      translation: sentence.native[this.lang],
    }
  }

  type(sentence: Sentence): TypeExercise {
    return {
      kind: 'type',
      id: this.nextId('type'),
      itemId: sentence.id,
      prompt: sentence.native[this.lang],
      answers: this.englishAnswers(sentence),
      audio: sentence.en,
    }
  }

  say(sentence: Sentence): SayExercise {
    return {
      kind: 'say',
      id: this.nextId('say'),
      itemId: sentence.id,
      prompt: sentence.native[this.lang],
      answers: this.englishAnswers(sentence),
      audio: sentence.en,
    }
  }

  /** The speaking finale: up to `count` of the given sentences, longest first (they are the most worth saying). */
  finale(sentences: readonly Sentence[], count: number): SayExercise[] {
    return [...sentences]
      .sort((a, b) => b.en.length - a.en.length)
      .slice(0, count)
      .reverse()
      .map((s) => this.say(s))
  }

  speak(sentence: Sentence): SpeakExercise {
    return { kind: 'speak', id: this.nextId('speak'), itemId: sentence.id, text: sentence.en, translation: sentence.native[this.lang] }
  }

  /** Resolve a plan to a concrete exercise, degrading gracefully when a capability or a blank is unavailable. */
  forSentence(sentence: Sentence, plan: SentencePlan, preferWordIds: ReadonlySet<string>): Exercise {
    switch (plan) {
      case 'bank-en':
        return this.bank(sentence, 'en-native')
      case 'bank-native':
        return this.bank(sentence, 'native-en')
      case 'fill':
        return this.fill(sentence, preferWordIds) ?? this.bank(sentence, 'en-native')
      case 'listen-bank':
        return this.opts.canListen ? this.listen(sentence, 'bank') : this.bank(sentence, 'native-en')
      case 'listen-type':
        return this.opts.canListen ? this.listen(sentence, 'type') : this.type(sentence)
      case 'type':
        return this.type(sentence)
      case 'speak':
        return this.opts.canSpeak ? this.speak(sentence) : this.bank(sentence, 'native-en')
    }
  }

  lexicon(): string[] {
    const out = new Set<string>()
    this.unit.words.forEach((w) => normalize(w.en, 'en').split(' ').forEach((p) => p && out.add(p)))
    this.unit.sentences.forEach((s) => normalize(s.en, 'en').split(' ').forEach((p) => p && out.add(p)))
    return [...out]
  }
}

function resolve<T>(ids: readonly string[], map: ReadonlyMap<string, T>): T[] {
  const out: T[] = []
  ids.forEach((id) => {
    const item = map.get(id)
    if (item) out.push(item)
  })
  return out
}

/** A normal lesson: teach the new words, then practise the lesson's sentences with rising difficulty. */
export function buildLessonSession(unit: Unit, lessonIndex: number, opts: SessionOptions): BuiltSession {
  const lesson = unit.lessons[lessonIndex]
  if (!lesson) throw new Error(`Unit ${unit.id} has no lesson at index ${lessonIndex}`)
  const ctx = new UnitContext(unit, opts, createRng(opts.seed), lesson.id)

  const newWords = resolve(lesson.words, ctx.words)
  const newWordIds = new Set(newWords.map((w) => w.id))
  const earlierWords = resolve(
    unit.lessons.slice(0, lessonIndex).flatMap((l) => l.words),
    ctx.words
  )
  const sentences = resolve(lesson.sentences, ctx.sentences)
  const plan = PLANS[Math.min(lessonIndex, PLANS.length - 1)] as readonly SentencePlan[]

  const exercises: Exercise[] = []
  newWords.slice(0, MAX_SELECTS_UP_FRONT).forEach((w) => exercises.push(ctx.select(w)))

  const firstMatch = ctx.match([...newWords, ...shuffle(ctx.rng, earlierWords)])
  if (firstMatch) exercises.push(firstMatch)

  const lateSelects = newWords.slice(MAX_SELECTS_UP_FRONT)
  sentences.forEach((s, i) => {
    exercises.push(ctx.forSentence(s, plan[i % plan.length] as SentencePlan, newWordIds))
    const late = lateSelects[i]
    if (late && i < 3) exercises.push(ctx.select(late))
  })

  const closingPool = shuffle(ctx.rng, [...earlierWords, ...newWords])
  if (closingPool.length >= 4 && sentences.length >= 4) {
    const closing = ctx.match(closingPool)
    if (closing) exercises.push(closing)
  }

  // every lesson ends with the learner saying what they have just learned
  exercises.push(...ctx.finale(sentences, FINALE_SENTENCES))

  return { exercises, lexicon: ctx.lexicon() }
}

/** Unit review (checkpoint): harder mix across the whole unit. */
export function buildReviewSession(unit: Unit, opts: SessionOptions): BuiltSession {
  const ctx = new UnitContext(unit, opts, createRng(opts.seed), reviewLessonId(unit))
  const plan = PLANS[PLANS.length - 1] as readonly SentencePlan[]
  const exercises: Exercise[] = []

  const opening = ctx.match(shuffle(ctx.rng, unit.words))
  if (opening) exercises.push(opening)
  sample(ctx.rng, unit.sentences, 10).forEach((s, i) => exercises.push(ctx.forSentence(s, plan[i % plan.length] as SentencePlan, new Set())))
  const closing = ctx.match(shuffle(ctx.rng, unit.words))
  if (closing) exercises.push(closing)
  exercises.push(...ctx.finale(sample(ctx.rng, unit.sentences, FINALE_SENTENCES), FINALE_SENTENCES))

  return { exercises, lexicon: ctx.lexicon() }
}

/** Practice: a short session built from specific word / sentence ids (spaced repetition, mistakes, heart refill). */
export function buildPracticeSession(course: Course, itemIds: readonly string[], opts: SessionOptions, limit = 10): BuiltSession {
  const rng = createRng(opts.seed)
  const wanted = new Set(itemIds)
  const exercises: Exercise[] = []
  const lexicon = new Set<string>()
  const plans: SentencePlan[] = ['bank-native', 'listen-bank', 'type', 'bank-en', 'fill']

  for (const unit of course.units) {
    if (exercises.length >= limit) break
    const words = unit.words.filter((w) => wanted.has(w.id))
    const sentences = unit.sentences.filter((s) => wanted.has(s.id))
    if (words.length === 0 && sentences.length === 0) continue
    const ctx = new UnitContext(unit, opts, rng, `practice-${unit.id}`)
    ctx.lexicon().forEach((w) => lexicon.add(w))

    if (words.length >= 3) {
      const m = ctx.match(shuffle(rng, words))
      if (m) exercises.push(m)
    }
    words.slice(0, 3).forEach((w) => exercises.push(ctx.select(w)))
    sentences.forEach((s, i) => exercises.push(ctx.forSentence(s, plans[i % plans.length] as SentencePlan, new Set())))
  }

  return { exercises: shuffle(rng, exercises).slice(0, limit), lexicon: [...lexicon] }
}

/**
 * Placement: one check of a unit. A word to recognise, a sentence to build in
 * English, and a second sentence kept as the tie-break (see core/placement.ts).
 * Everything comes from the unit's later lessons, and nothing needs sound.
 */
export function buildPlacementCheck(unit: Unit, opts: SessionOptions): Exercise[] {
  const ctx = new UnitContext(unit, { ...opts, canListen: false, canSpeak: false }, createRng(opts.seed), `placement-${unit.id}`)
  const late = unit.lessons.slice(Math.floor(unit.lessons.length / 2))
  const words = late.flatMap((l) => l.words).map((id) => ctx.words.get(id)).filter((w): w is Word => w !== undefined)
  const sentences = late.flatMap((l) => l.sentences).map((id) => ctx.sentences.get(id)).filter((s): s is Sentence => s !== undefined)
  const word = sample(ctx.rng, words.length > 0 ? words : unit.words, 1)[0]
  const picked = sample(ctx.rng, sentences.length >= 2 ? sentences : unit.sentences, 2)
  const out: Exercise[] = []
  if (word) out.push(ctx.select(word))
  picked.forEach((s) => out.push(ctx.bank(s, 'native-en')))
  return out
}
