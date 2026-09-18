/**
 * AI conversation practice: provider-independent contract.
 * The HTTP layer validates and rate-limits; a CoachProvider turns a cleaned
 * request into one reply. The Anthropic implementation lives in
 * coach-anthropic.ts; tests use a fake provider.
 */

export type CoachLang = 'uz' | 'ru' | 'tr'

export interface CoachMessage {
  role: 'user' | 'assistant'
  text: string
}

export interface CoachRequest {
  scenarioId: string
  baseLang: CoachLang
  messages: CoachMessage[]
}

export interface CoachReply {
  /** the guide's next line, in simple English */
  text: string
  /** the same line in the learner's language */
  translation: string
  /** a short, kind correction of the learner's last message in their language, or '' if it was fine */
  correction: string
  /** a better version of the learner's last message in English, or '' */
  better: string
}

export interface CoachProvider {
  reply(request: CoachRequest): Promise<CoachReply>
}

export interface Scenario {
  id: string
  guide: 'everest' | 'lumi' | 'pix' | 'nubi' | 'rocky' | 'aero'
  level: 'A1' | 'A2'
  /** who the guide plays and where the conversation happens */
  setting: string
}

export const SCENARIOS: readonly Scenario[] = [
  { id: 'meet', guide: 'lumi', level: 'A1', setting: 'You have just met the learner at a language club. Get to know them: name, where they are from, what they do.' },
  { id: 'cafe', guide: 'rocky', level: 'A1', setting: 'You are a friendly waiter in a small cafe. Take the learner’s order: drinks, food, the bill.' },
  { id: 'family', guide: 'nubi', level: 'A1', setting: 'You are a curious friend looking at the learner’s family photos. Ask about their family members.' },
  { id: 'shopping', guide: 'pix', level: 'A2', setting: 'You are a shop assistant in a clothes shop. Help the learner find something, talk about size, colour and price.' },
  { id: 'directions', guide: 'aero', level: 'A2', setting: 'The learner is a tourist in your city. They ask you for directions; you also ask where they want to go and why.' },
  { id: 'free', guide: 'everest', level: 'A1', setting: 'Free conversation. Talk about the learner’s day, plans and interests.' },
]

export const COACH_DAILY_LIMIT = 40
export const MAX_TURNS = 30
export const MAX_MESSAGE_CHARS = 400

const LANGS = new Set<string>(['uz', 'ru', 'tr'])

/** Validate and trim untrusted input. Returns null when the request is malformed. */
export function cleanCoachRequest(body: Record<string, unknown> | null): CoachRequest | null {
  if (!body) return null
  const scenarioId = body.scenarioId
  const baseLang = body.baseLang
  if (typeof scenarioId !== 'string' || !SCENARIOS.some((s) => s.id === scenarioId)) return null
  if (typeof baseLang !== 'string' || !LANGS.has(baseLang)) return null
  if (!Array.isArray(body.messages) || body.messages.length > MAX_TURNS) return null

  const messages: CoachMessage[] = []
  for (const item of body.messages as unknown[]) {
    if (typeof item !== 'object' || item === null) return null
    const { role, text } = item as Record<string, unknown>
    if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string') return null
    const trimmed = text.trim().slice(0, MAX_MESSAGE_CHARS)
    if (!trimmed) return null
    messages.push({ role, text: trimmed })
  }
  // an empty history means "start the conversation"; otherwise the learner speaks last
  const last = messages[messages.length - 1]
  if (last && last.role !== 'user') return null
  return { scenarioId, baseLang: baseLang as CoachLang, messages }
}

export const LANGUAGE_NAMES: Record<CoachLang, string> = { uz: 'Uzbek (Latin script)', ru: 'Russian', tr: 'Turkish' }

export const GUIDE_PERSONAS: Record<Scenario['guide'], string> = {
  everest: 'Everest, a calm and wise mountain guide',
  lumi: 'Lumi, an energetic and cheerful motivator',
  pix: 'Pix, a curious and clever little robot',
  nubi: 'Nubi, a warm and optimistic cloud',
  rocky: 'Rocky, a strong, steady and kind rock',
  aero: 'Aero, a fearless and adventurous eagle',
}
