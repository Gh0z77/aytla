import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { OPENING_TURN, REPLY_FIELDS, cleanReply, systemPrompt, type CoachProvider, type CoachReply, type CoachRequest } from './coach.ts'

/**
 * Claude-backed conversation partner (official Anthropic SDK).
 *
 * - Structured output: the reply arrives as validated JSON (guide line,
 *   translation, correction, better version), never as free text to parse.
 * - `effort: "low"`: a chat turn is short and latency-sensitive; thinking stays
 *   adaptive (the model default), so it still reasons when a correction is subtle.
 * - Server-side refusal fallback: if the model's safety layer declines a turn,
 *   the API re-runs it on Anthropic's recommended fallback inside the same call.
 * - The model is `claude-opus-5` unless COACH_MODEL names another one; choosing
 *   a cheaper tier is a cost decision for the operator, not for the code.
 */

const DEFAULT_MODEL = 'claude-opus-5'
const MAX_TOKENS = 16_000
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

const ReplySchema = z.object({
  text: z.string().describe(REPLY_FIELDS.text),
  translation: z.string().describe(REPLY_FIELDS.translation),
  correction: z.string().describe(REPLY_FIELDS.correction),
  better: z.string().describe(REPLY_FIELDS.better),
})

class AnthropicCoach implements CoachProvider {
  private readonly client: Anthropic
  private readonly model: string

  constructor(client: Anthropic, model: string) {
    this.client = client
    this.model = model
  }

  async reply(request: CoachRequest): Promise<CoachReply> {
    const messages: Anthropic.Beta.BetaMessageParam[] =
      request.messages.length > 0
        ? request.messages.map((m) => ({ role: m.role, content: m.text }))
        : [{ role: 'user', content: OPENING_TURN }]

    try {
      const response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: MAX_TOKENS,
        betas: [FALLBACK_BETA],
        fallbacks: 'default',
        system: systemPrompt(request),
        messages,
        output_config: { effort: 'low', format: betaZodOutputFormat(ReplySchema) },
      })

      // a refusal is a normal HTTP 200: check it before trusting the content
      if (response.stop_reason === 'refusal') throw new Error(`coach refused the turn (${response.stop_details?.category ?? 'uncategorised'})`)
      if (!response.parsed_output) throw new Error(`coach returned no usable reply (stop_reason: ${response.stop_reason})`)
      return cleanReply(response.parsed_output)
    } catch (err) {
      // most specific first, so logs tell retryable failures from configuration problems
      if (err instanceof Anthropic.AuthenticationError) console.error('coach: the Anthropic credentials were rejected')
      else if (err instanceof Anthropic.RateLimitError) console.error('coach: rate limited by the Anthropic API')
      else if (err instanceof Anthropic.BadRequestError) console.error('coach: bad request:', err.message)
      else if (err instanceof Anthropic.APIConnectionError) console.error('coach: could not reach the Anthropic API')
      else if (err instanceof Anthropic.APIError) console.error(`coach: Anthropic API error ${err.status}:`, err.message)
      throw err
    }
  }
}

/**
 * AI practice is optional. The SDK resolves credentials from the environment
 * (ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile);
 * COACH_ENABLED=1 turns the feature on, so a machine without credentials simply
 * reports the coach as unavailable instead of failing on the first message.
 */
export function createCoachFromEnv(): CoachProvider | null {
  const enabled = process.env.COACH_ENABLED === '1' || Boolean(process.env.ANTHROPIC_API_KEY) || Boolean(process.env.ANTHROPIC_AUTH_TOKEN)
  if (!enabled) return null
  return new AnthropicCoach(new Anthropic(), process.env.COACH_MODEL ?? DEFAULT_MODEL)
}
