import { AudioModule, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio'
import { File } from 'expo-file-system'

/**
 * Microphone recording on phones (expo-audio), for server-side recognition.
 * The browser has its own implementation in recorder.web.ts.
 */
export interface Recording {
  stop(): Promise<{ base64: string; mime: string } | null>
  cancel(): void
}

export function canRecord(): boolean {
  return true
}

export async function startRecording(maxMs: number): Promise<Recording> {
  const permission = await requestRecordingPermissionsAsync()
  if (!permission.granted) throw new Error('microphone permission denied')
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
  const recorder = new AudioModule.AudioRecorder(RecordingPresets.LOW_QUALITY)
  await recorder.prepareToRecordAsync()
  recorder.record()
  let stopped = false
  const finish = async () => {
    if (stopped) return
    stopped = true
    await recorder.stop()
    await setAudioModeAsync({ allowsRecording: false })
  }
  const timer = setTimeout(() => void finish(), maxMs)
  return {
    async stop() {
      clearTimeout(timer)
      await finish()
      const uri = recorder.uri
      if (!uri) return null
      const file = new File(uri)
      const base64 = await file.base64()
      recorder.release()
      // the low-quality preset records AAC in an .m4a / .3gp container
      return base64.length > 1000 ? { base64, mime: uri.endsWith('.3gp') ? 'audio/mp4' : 'audio/mp4' } : null
    },
    cancel() {
      clearTimeout(timer)
      void finish().then(() => recorder.release())
    },
  }
}
