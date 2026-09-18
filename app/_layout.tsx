import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useApp } from '../src/state/store'
import { colors } from '../src/theme/tokens'

/** Root navigator. Rolls the day over and refills hearts whenever the app comes back to the foreground. */
export default function RootLayout() {
  const tick = useApp((s) => s.tick)

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick()
    })
    return () => sub.remove()
  }, [tick])

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="unit/[id]" />
        <Stack.Screen name="lesson/[id]" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="result" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </>
  )
}
