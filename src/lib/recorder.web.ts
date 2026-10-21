/**
 * Microphone recording in the browser, for server-side recognition. The
 * recording is decoded and re-encoded as 16 kHz mono WAV, so the server sees
 * one format whatever the browser recorded (webm/opus in Chrome, ogg in
 * Firefox, mp4 in Safari).
 */
export interface Recording {
  /** base64 audio and its type, or null when nothing usable was recorded */
  stop(): Promise<{ base64: string; mime: string } | null>
  cancel(): void
}

export function canRecord(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function' && typeof MediaRecorder !== 'undefined'
}

export async function startRecording(maxMs: number): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  let done: Promise<Blob> | null = null
  const finish = (): Promise<Blob> => {
    if (!done) {
      done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop())
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        }
        if (recorder.state !== 'inactive') recorder.stop()
        else recorder.onstop?.(new Event('stop'))
      })
    }
    return done
  }
  recorder.start()
  const timer = setTimeout(() => void finish(), maxMs)
  return {
    async stop() {
      clearTimeout(timer)
      const blob = await finish()
      if (blob.size < 1000) return null
      try {
        return { base64: await toWav16k(blob), mime: 'audio/wav' }
      } catch {
        // decoding failed (rare): send what the browser recorded
        return { base64: await toBase64(blob), mime: blob.type.split(';')[0] || 'audio/webm' }
      }
    },
    cancel() {
      clearTimeout(timer)
      void finish()
    },
  }
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** decode with the browser, resample to 16 kHz mono, write a 16-bit PCM WAV */
async function toWav16k(blob: Blob): Promise<string> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const probe = new Ctx()
  const decoded = await probe.decodeAudioData(await blob.arrayBuffer())
  await probe.close()
  const rate = 16000
  const length = Math.ceil(decoded.duration * rate)
  const offline = new OfflineAudioContext(1, length, rate)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  const samples = rendered.getChannelData(0)
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const str = (at: number, s: string) => [...s].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)))
  str(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  str(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return toBase64(new Blob([buffer], { type: 'audio/wav' }))
}
