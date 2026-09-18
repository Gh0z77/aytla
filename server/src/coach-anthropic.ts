import { GUIDE_PERSONAS, LANGUAGE_NAMES, SCENARIOS, type CoachProvider, type CoachReply, type CoachRequest } from './coach.ts'

/**
 * Claude-backed conversation partner, called through the Messages API with a
 * forced tool call so the reply always arrives as structured data (guide line,
 * translation, correction, better version) instead of free text to parse.
 */

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const DEFAULT_MODEL = 'claude-sonnet-5'
const TIMEOUT_MS = 30_000
const TOOL_NAME = 'coach_reply'

const REPLY_TOOL = {
  name: TOOL_NAME,
  description: 'Deliver the guide’s next line of the role-play together with feedback on the learner’s last message.',
  input_schema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The guide’s next line, in simple English, 1-2 short sentences, ending with a simple question.' },
      translation: { type: 'string', description: 'A natural translation of `text` into the learner’s native language.' },
      correction: {
        type: 'string',
        description:
          'Feedback on the learner’s LAST message, written in the learner’s native language: one or two sentences about the most important mistake, kind and specific. Empty string if the message was fine or there is no learner message yet.',
      },
      better: { type: 'string', description: 'A corrected, natural English version of the learner’s last message. Empty string if no correction was needed.' },
    },
    required: ['text', 'translation', 'correction', 'better'],
  },
} as const

function systemPrompt(request: CoachRequest): string {
  const scenario = SCENARIOS.find((s) => s.id === request.scenarioId) ?? SCENARIOS[0]
  if (!scenario) throw new Error('no scenarios configured')
  const language = LANGUAGE_NAMES[request.baseLang]
  return [
    `You are ${GUIDE_PERSONAS[scenario.guide]}, one of the guides in EVEREST AI, an English-learning app.`,
    `You are doing a friendly role-play with a learner whose native language is ${language} and whose English level is ${scenario.level} (CEFR).`,
    `Setting: ${scenario.setting}`,
    'Rules:',
    `- Speak only English in your line, using vocabulary and grammar a ${scenario.level} learner knows. One or two short sentences.`,
    '- Always end your line with one simple question so the learner has something to answer.',
    '- Stay in the role-play and stay warm and encouraging. Never mock mistakes.',
    `- If the learner writes in ${language} or mixes languages, help them: show how to say it in English in the "better" field.`,
    '- Keep everything suitable for a general audience of all ages. Politely steer back to the role-play if asked for anything else.',
    `- Always answer by calling the ${TOOL_NAME} tool. Write "translation" and "correction" in ${language}.`,
  ].join('\n')
}

interface ContentBlock {
  type: string
  name?: string
  input?: unknown
  text?: string
}

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

class AnthropicCoach implements CoachProvider {
  private readonly apiKey: string
  private readonly model: string

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey
    this.model = model
  }

  async reply(request: CoachRequest): Promise<CoachReply> {
    const messages =
      request.messages.length > 0
        ? request.messages.map((m) => ({ role: m.role, content: m.text }))
        : [{ role: 'user' as const, content: '(The learner has just arrived. Greet them and start the role-play.)' }]

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': API_VERSION },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 600,
        system: systemPrompt(request),
        messages,
        tools: [REPLY_TOOL],
        tool_choice: { type: 'tool', name: TOOL_NAME },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`Anthropic API ${response.status}: ${(await response.text()).slice(0, 300)}`)

    const data = (await response.json()) as { content?: ContentBlock[] }
    const blocks = data.content ?? []
    const tool = blocks.find((b) => b.type === 'tool_use' && b.name === TOOL_NAME)
    const input = (typeof tool?.input === 'object' && tool.input !== null ? tool.input : {}) as Record<string, unknown>
    const text = asText(input.text) || asText(blocks.find((b) => b.type === 'text')?.text)
    if (!text) throw new Error('Anthropic API returned no reply text')
    return { text, translation: asText(input.translation), correction: asText(input.correction), better: asText(input.better) }
  }
}

/** AI practice is optional: without ANTHROPIC_API_KEY the API reports it as unavailable. */
export function createCoachFromEnv(): CoachProvider | null {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null
  return new AnthropicCoach(key, process.env.COACH_MODEL ?? DEFAULT_MODEL)
}
