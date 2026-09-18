import { Platform } from 'react-native'
import * as Speech from 'expo-speech'

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
    Speech.speak(text, { language: 'en-US', rate: opts.slow ? 0.6 : 0.95, pitch: 1 })
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

export function canSpeak(): boolean {
  return recognitionCtor() !== null
}

/** Listen once; resolves with the best transcript ('' when nothing was heard). Returns a stop function. */
export function listenOnce(onDone: (transcript: string) => void): () => void {
  const Ctor = recognitionCtor()
  if (!Ctor) {
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
  rec.lang = 'en-US'
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
