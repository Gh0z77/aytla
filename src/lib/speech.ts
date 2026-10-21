import { Platform } from 'react-native'
import * as Speech from 'expo-speech'
import type { TargetLang } from '../core/types'
import { useApp } from '../state/store'
import { api } from './api'
import { capabilities } from './capabilities'
import { canRecord, startRecording } from './recorder'

const LOCALES: Record<TargetLang, string> = { en: 'en-US', ru: 'ru-RU', tr: 'tr-TR', uz: 'uz-UZ' }
/** the BCP 47 tag of the language being learned */
export const targetLocale = (): string => LOCALES[useApp.getState().user.profile.target ?? 'en']

/**
 * Text-to-speech and (web only) speech recognition.
 * expo-speech wraps the platform voices on iOS / Android and speechSynthesis
 * on the web, so one call works everywhere.
 */

export function canListen(): boolean {
  if (Platform.OS !== 'web') return true
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(text: string, opts: { slow?: boolean } = {}): void {
  try {
    Speech.stop()
    Speech.speak(text, { language: targetLocale(), rate: opts.slow ? 0.6 : 0.95, pitch: 1 })
  } catch {
    // no voice available: exercises stay usable through their text
  }
}

export function stopSpeaking(): void {
  try {
    Speech.stop()
  } catch {
    // ignore
  }
}

// -- speech recognition (Chrome, Edge, Safari on the web) ---------------------

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}
interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: RecognitionResultEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** the device's own recogniser, or the server's when the API offers one (see lib/capabilities) */
export function canSpeak(): boolean {
  return recognitionCtor() !== null || (capabilities().speech && canRecord())
}

/** the longest a server-recognised recording runs before it is sent on its own */
export const SERVER_LISTEN_MS = 10_000
export const usesServerSpeech = (): boolean => recognitionCtor() === null && capabilities().speech && canRecord()

type Rec = Awaited<ReturnType<typeof startRecording>>

/** a few seconds of microphone, recognised by the server; `stop` ends the recording early and still delivers the words */
function listenThroughServer(onDone: (transcript: string) => void, maxMs: number): () => void {
  let recording: Rec | null = null
  let finished = false
  const finish = async (rec: Rec | null) => {
    if (finished) return
    finished = true
    try {
      const clip = await rec?.stop()
      if (!clip) return onDone('')
      const lang = useApp.getState().user.profile.target ?? 'en'
      const res = await api<{ text: string }>('/speech/transcribe', { method: 'POST', body: { audio: clip.base64, mime: clip.mime, lang }, timeoutMs: 30_000 })
      onDone(res.text)
    } catch {
      onDone('')
    }
  }
  void startRecording(maxMs)
    .then((rec) => {
      recording = rec
      // the recorder stops itself at maxMs; collect the result then too
      setTimeout(() => void finish(rec), maxMs + 50)
    })
    .catch(() => finish(null))
  return () => void finish(recording)
}

/** Listen once; resolves with the best transcript ('' when nothing was heard). Returns a stop function. */
export function listenOnce(onDone: (transcript: string) => void): () => void {
  const Ctor = recognitionCtor()
  if (!Ctor) {
    if (capabilities().speech && canRecord()) return listenThroughServer(onDone, SERVER_LISTEN_MS)
    onDone('')
    return () => undefined
  }
  const rec = new Ctor()
  let finished = false
  const finish = (text: string) => {
    if (finished) return
    finished = true
    onDone(text)
  }
  rec.lang = targetLocale()
  rec.interimResults = false
  rec.maxAlternatives = 3
  rec.onresult = (e) => {
    const alternatives = e.results[0]
    const texts: string[] = []
    if (alternatives) for (let i = 0; i < alternatives.length; i++) texts.push(alternatives[i]?.transcript ?? '')
    finish(texts.join(' '))
  }
  rec.onerror = () => finish('')
  rec.onend = () => finish('')
  try {
    rec.start()
  } catch {
    finish('')
  }
  return () => {
    try {
      rec.stop()
    } catch {
      // ignore
    }
  }
}
