import { OPENING_TURN, REPLY_FIELDS, cleanReply, systemPrompt, type CoachProvider, type CoachReply, type CoachRequest } from './coach.ts'

/**
 * Gemini-backed conversation partner, through the Gemini REST API (no SDK to
 * install). Used when the operator has a Gemini key and no Anthropic
 * credentials; the prompt and the reply shape are the same as for Claude.
 *
 * The reply is requested as JSON with a response schema, so the model cannot
 * answer in free text that would then have to be parsed.
 */

const DEFAULT_MODEL = 'gemini-3.8-flash'
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT_MS = 30_000

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: Object.fromEntries(Object.entries(REPLY_FIELDS).map(([name, description]) => [name, { type: 'STRING', description }])),
  required: Object.keys(REPLY_FIELDS),
  propertyOrdering: Object.keys(REPLY_FIELDS),
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>
  promptFeedback?: { blockReason?: string }
  error?: { code?: number; message?: string; status?: string }
}

export class GeminiCoach implements CoachProvider {
  private readonly key: string
  private readonly model: string

  constructor(key: string, model: string = DEFAULT_MODEL) {
    this.key = key
    this.model = model
  }

  async reply(request: CoachRequest): Promise<CoachReply> {
    const contents =
      request.messages.length > 0
        ? request.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] }))
        : [{ role: 'user', parts: [{ text: OPENING_TURN }] }]

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(`${ENDPOINT}/${encodeURIComponent(this.model)}:generateContent`, {
        method: 'POST',
        // the key travels in a header, never in the URL, so it does not end up in access logs
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt(request) }] },
          contents,
          generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, temperature: 0.7, maxOutputTokens: 1024 },
        }),
        signal: controller.signal,
      })
    } catch (err) {
      console.error('coach: could not reach the Gemini API', err instanceof Error ? err.message : '')
      throw err
    } finally {
      clearTimeout(timer)
    }

    const data = (await response.json().catch(() => ({}))) as GeminiResponse
    if (!response.ok) {
      const detail = data.error?.message ?? response.statusText
      if (response.status === 400 || response.status === 403) console.error('coach: the Gemini key was rejected or the request was invalid:', detail)
      else if (response.status === 404) console.error(`coach: Gemini model "${this.model}" not found (set GEMINI_MODEL to one your key can use):`, detail)
      else if (response.status === 429) console.error('coach: rate limited by the Gemini API')
      else console.error(`coach: Gemini API error ${response.status}:`, detail)
      throw new Error(`gemini ${response.status}`)
    }
    if (data.promptFeedback?.blockReason) throw new Error(`coach refused the turn (${data.promptFeedback.blockReason})`)
    const candidate = data.candidates?.[0]
    const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text) throw new Error(`coach returned no usable reply (finishReason: ${candidate?.finishReason ?? 'none'})`)
    let parsed: Partial<Record<keyof CoachReply, unknown>>
    try {
      parsed = JSON.parse(text) as Partial<Record<keyof CoachReply, unknown>>
    } catch {
      throw new Error('coach returned malformed JSON')
    }
    return cleanReply(parsed)
  }
}

export function createGeminiCoachFromEnv(): CoachProvider | null {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) return null
  return new GeminiCoach(key, process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL)
}
