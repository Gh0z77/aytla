import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'

/**
 * Daily practice reminder as a LOCAL notification: scheduled on the phone, so
 * it works offline and needs no push server. Not available in the browser.
 */
export const REMINDER_HOURS = [8, 12, 18, 20, 21] as const
export const remindersSupported = Platform.OS === 'ios' || Platform.OS === 'android'

const CHANNEL = 'daily-reminder'

export type ReminderOutcome = 'scheduled' | 'cleared' | 'denied' | 'unsupported'

export async function setDailyReminder(hour: number | null, title: string, body: string): Promise<ReminderOutcome> {
  if (!remindersSupported) return 'unsupported'
  await Notifications.cancelAllScheduledNotificationsAsync()
  if (hour === null) return 'cleared'

  const current = await Notifications.getPermissionsAsync()
  const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted
  if (!granted) return 'denied'

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Daily reminder', importance: Notifications.AndroidImportance.DEFAULT })
  }
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: CHANNEL },
  })
  return 'scheduled'
}
