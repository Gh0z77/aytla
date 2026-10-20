/**
 * Core domain types. Pure data: no React, no platform APIs, no dependencies.
 * Shared by the universal app (iOS / Android / web) and the API server.
 */

// ---------------------------------------------------------------------------
// Languages & characters
// ---------------------------------------------------------------------------

/** Languages a learner can learn English FROM (their native language). */
export type BaseLang = 'uz' | 'ru' | 'tr'
export const BASE_LANGS: readonly BaseLang[] = ['uz', 'ru', 'tr']

export type CharacterId = 'everest' | 'lumi' | 'pix' | 'nubi' | 'rocky' | 'aero'

export type L10n = Record<BaseLang, string>
export type L10nEn = L10n & { en: string }

// ---------------------------------------------------------------------------
// Course content
// ---------------------------------------------------------------------------

export type PartOfSpeech = 'noun' | 'verb' | 'adj' | 'adv' | 'pron' | 'prep' | 'num' | 'phrase' | 'other'

export interface Word {
  id: string
  en: string
  native: L10n
  emoji?: string
  pos?: PartOfSpeech
  /** extra accepted translations per language */
  altNative?: Partial<Record<BaseLang, string[]>>
}

export interface Sentence {
  id: string
  en: string
  native: L10n
  /** extra accepted English answers (e.g. contractions are handled automatically, word-order variants are not) */
  altEn?: string[]
  /**
   * Extra accepted English answers only when translating FROM the given language.
   * Uzbek "u" and Turkish "o" mean both "he" and "she", so "U talaba." accepts
   * "He is a student." and "She is a student." — but Russian "Он студент." does not.
   */
  altEnFor?: Partial<Record<BaseLang, string[]>>
  altNative?: Partial<Record<BaseLang, string[]>>
}

export interface Lesson {
  id: string
  title: L10nEn
  /** ids of the words introduced in this lesson */
  words: string[]
  /** ids of the sentences practised in this lesson */
  sentences: string[]
}

export interface GrammarTip {
  title: L10nEn
  body: L10nEn
  examples: Array<{ en: string; native: L10n }>
}

export interface Unit {
  id: string
  section: number
  order: number
  title: L10nEn
  goal: L10nEn
  guide: CharacterId
  color: string
  tip?: GrammarTip
  words: Word[]
  sentences: Sentence[]
  lessons: Lesson[]
}

export interface Section {
  id: string
  order: number
  title: L10nEn
  cefr: string
  unitIds: string[]
}

export interface Course {
  id: string
  title: string
  sections: Section[]
  units: Unit[]
}

// ---------------------------------------------------------------------------
// Exercises (generated from content, never authored by hand)
// ---------------------------------------------------------------------------

export interface SelectOption {
  id: string
  label: string
  emoji?: string
}

/** "Which one is «olma»?" → pick the English word. */
export interface SelectExercise {
  kind: 'select'
  id: string
  itemId: string
  prompt: string
  audio: string
  options: SelectOption[]
  answerId: string
}

/** Build the translation from a bank of word tiles. */
export interface BankExercise {
  kind: 'bank'
  id: string
  itemId: string
  direction: 'en-native' | 'native-en'
  prompt: string
  /** English text to speak aloud (prompt when en→native, answer when native→en) */
  audio: string
  tokens: string[]
  answers: string[]
}

/** Tap matching pairs. Graded pair by pair inside the UI; mistakes are reported on completion. */
export interface MatchExercise {
  kind: 'match'
  id: string
  pairs: Array<{ id: string; en: string; native: string }>
}

/** Sentence with one blank. */
export interface FillExercise {
  kind: 'fill'
  id: string
  itemId: string
  before: string
  after: string
  options: string[]
  answer: string
  translation: string
  audio: string
}

/** Hear English; rebuild it from tiles or type it. */
export interface ListenExercise {
  kind: 'listen'
  id: string
  itemId: string
  mode: 'bank' | 'type'
  audio: string
  tokens: string[]
  answers: string[]
  translation: string
}

/** Type the English translation. */
export interface TypeExercise {
  kind: 'type'
  id: string
  itemId: string
  prompt: string
  answers: string[]
  audio: string
}

/** Say the English sentence aloud. */
export interface SpeakExercise {
  kind: 'speak'
  id: string
  itemId: string
  text: string
  translation: string
}

/**
 * The lesson finale: the guide gives the meaning, the learner SAYS it in English
 * (microphone where available, keyboard otherwise). This is what makes every
 * lesson end in speaking rather than in tapping.
 */
export interface SayExercise {
  kind: 'say'
  id: string
  itemId: string
  prompt: string
  answers: string[]
  audio: string
}

export type Exercise = SelectExercise | BankExercise | MatchExercise | FillExercise | ListenExercise | TypeExercise | SpeakExercise | SayExercise

export type ExerciseKind = Exercise['kind']

export interface GradeResult {
  correct: boolean
  /** accepted despite a small typo */
  typo?: boolean
  /** the canonical answer to show the learner */
  expected: string
  /** spoken answers only: the words of `expected` that were not heard, as written there */
  missed?: string[]
}

export type SessionKind = 'lesson' | 'review' | 'practice'

// ---------------------------------------------------------------------------
// Learner state
// ---------------------------------------------------------------------------

export type DailyGoal = 10 | 20 | 30 | 50

export interface Profile {
  name: string
  baseLang: BaseLang
  dailyGoalXp: DailyGoal
  guide: CharacterId
  soundOn: boolean
  hapticsOn: boolean
  onboarded: boolean
  createdAt: number
  /** local hour (0-23) of the daily practice reminder; null or missing = off */
  reminderHour?: number | null
  /** who delivers the reminder: the phone's own notification, or the Telegram bot (browsers cannot notify) */
  reminderVia?: 'device' | 'telegram'
  /** minutes east of UTC on the learner's device, so the server knows when `reminderHour` is */
  tzOffsetMin?: number
  /** why the learner is learning; decides the order of the path and the suggested conversations */
  goal?: GoalId
  /** best Uchish (flight game) score */
  bestRun?: number
  bestFall?: number
}

export type GoalId = 'everyday' | 'travel' | 'work' | 'study'

/** One correction the AI guide made, remembered so later practice can target it. */
export interface CoachNote {
  at: number
  better: string
  note: string
}

export interface HeartsState {
  count: number
  /** ms timestamp from which the next refill interval is measured */
  lastRefillAt: number
}

export interface StreakState {
  current: number
  longest: number
  /** last local day (YYYY-MM-DD) on which the daily goal was reached */
  lastGoalDay: string | null
  freezes: number
  /** days that were saved by a freeze */
  frozenDays: string[]
}

export interface LessonProgress {
  completed: number
  bestAccuracy: number
  lastAt: number
}

export interface DayStats {
  xp: number
  lessons: number
  perfect: number
  practice: number
  maxCombo: number
  seconds: number
  /** sentences said aloud (or typed in a speaking round); missing in states saved before this existed */
  spoken?: number
  /** the sentence of the day was said */
  challenge?: boolean
}

export type QuestKind = 'xp' | 'lessons' | 'perfect' | 'combo' | 'practice'

export interface Quest {
  id: string
  kind: QuestKind
  target: number
  rewardGems: number
  claimed: boolean
}

export interface QuestsState {
  day: string
  items: Quest[]
}

export interface SrsEntry {
  box: number
  /** local day (YYYY-MM-DD) when the item is due again */
  due: string
  lapses: number
}

export interface LeagueState {
  weekId: string
  weeklyXp: number
  tier: number
}

export interface UserState {
  version: 1
  profile: Profile
  xp: number
  gems: number
  hearts: HeartsState
  streak: StreakState
  lessons: Record<string, LessonProgress>
  /** chest node ids already opened */
  chests: string[]
  days: Record<string, DayStats>
  quests: QuestsState
  srs: Record<string, SrsEntry>
  achievements: Record<string, { level: number; at: number }>
  league: LeagueState
  xpBoostUntil: number
  updatedAt: number
  /** the most recent AI corrections, newest first (capped) */
  coachNotes?: CoachNote[]
}

export interface LessonResult {
  sessionKind: SessionKind
  lessonId: string | null
  /** ids of words/sentences answered, with whether the first attempt was right */
  items: Array<{ itemId: string; correct: boolean }>
  total: number
  mistakes: number
  maxCombo: number
  seconds: number
  /** speaking-round sentences completed in this session */
  spoken?: number
}

export interface Rewards {
  xp: number
  gems: number
  accuracy: number
  perfect: boolean
  goalReachedToday: boolean
  streakExtended: boolean
  newStreak: number
  questsCompleted: Quest[]
  achievements: Array<{ id: string; level: number }>
  heartsRestored: number
  /** sentences the learner said in this session */
  spoken: number
}
