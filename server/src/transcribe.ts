/**
 * Server-side speech recognition, for phones and browsers that have none of
 * their own (Uzbek is missing from every browser): the app records a few
 * seconds, sends the audio here, and gets the words back. Gemini listens;
 * the request carries the language so the model does not guess it.
 */
export type SpeechLang = 'en' | 'ru' | 'tr' | 'uz'
const LANG_NAMES: Record<SpeechLang, string> = { en: 'English', ru: 'Russian', tr: 'Turkish', uz: 'Uzbek (Latin script)' }
export const SPEECH_LANGS = new Set<string>(['en', 'ru', 'tr', 'uz'])

/** audio types the recorder produces and the model accepts */
export const AUDIO_TYPES = new Set(['audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/m4a', 'audio/x-m4a', 'audio/mpeg', 'audio/flac'])
/** ten seconds of 16 kHz mono 16-bit WAV is 320 KB; this leaves room for compressed phone formats too */
export const MAX_AUDIO_BYTES = 1_500_000

export interface Transcriber {
  transcribe(audio: Buffer, mime: string, lang: SpeechLang): Promise<string>
}

const DEFAULT_MODEL = 'gemini-3.8-flash'
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const TIMEOUT_MS = 25_000

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  error?: { message?: string }
}

export class GeminiTranscriber implements Transcriber {
  private readonly key: string
  private readonly model: string

  constructor(key: string, model: string = DEFAULT_MODEL) {
    this.key = key
    this.model = model
  }

  async transcribe(audio: Buffer, mime: string, lang: SpeechLang): Promise<string> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(`${ENDPOINT}/${encodeURIComponent(this.model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inline_data: { mime_type: mime, data: audio.toString('base64') } },
                { text: `Transcribe exactly what the speaker says in this recording. The speaker is a learner of ${LANG_NAMES[lang]} reading a short sentence aloud; write the words in ${LANG_NAMES[lang]} with normal spelling and punctuation. Output only the transcript, with no quotes or commentary. If there is no speech, output nothing.` },
              ],
            },
          ],
          generationConfig: { temperature: 0, maxOutputTokens: 120 },
        }),
        signal: controller.signal,
      })
      const data = (await response.json()) as GeminiResponse
      if (!response.ok) throw new Error(`gemini ${response.status}: ${data.error?.message ?? ''}`)
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      return text.replace(/\s+/g, ' ').trim().slice(0, 300)
    } finally {
      clearTimeout(timer)
    }
  }
}

export function createGeminiTranscriberFromEnv(): Transcriber | null {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) return null
  return new GeminiTranscriber(key, process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL)
}
