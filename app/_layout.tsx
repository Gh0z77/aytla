import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { startAutoSync, useAccount } from '../src/state/account'
import { useApp } from '../src/state/store'
import { colors } from '../src/theme/tokens'

/**
 * Root navigator. Whenever the app comes back to the foreground it rolls the
 * day over, refills hearts and, for signed-in learners, syncs with the cloud.
 */
export default function RootLayout() {
  const tick = useApp((s) => s.tick)

  useEffect(() => {
    const stopAutoSync = startAutoSync()
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      tick()
      void useAccount.getState().syncNow()
    })
    return () => {
      sub.remove()
      stopAutoSync()
    }
  }, [tick])

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="account" options={{ presentation: 'modal' }} />
        <Stack.Screen name="unit/[id]" />
        <Stack.Screen name="coach/index" />
        <Stack.Screen name="coach/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="lesson/[id]" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="result" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </>
  )
}
