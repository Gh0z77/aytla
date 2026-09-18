import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

/** Haptic feedback on phones; silently does nothing on the web. */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android'

export function tapFeedback(on: boolean): void {
  if (!enabled || !on) return
  Haptics.selectionAsync().catch(() => undefined)
}

export function resultFeedback(on: boolean, correct: boolean): void {
  if (!enabled || !on) return
  Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => undefined)
}
