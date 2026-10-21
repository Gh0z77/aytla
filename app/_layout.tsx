import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, useFonts } from '@expo-google-fonts/manrope'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, type ReactNode } from 'react'
import { AppState, Platform } from 'react-native'
import { startAnalytics } from '../src/lib/analytics'
import { loadCapabilities } from '../src/lib/capabilities'
import { CLERK_PUBLISHABLE_KEY, clerkEnabled } from '../src/lib/clerk'
import { startAutoSync, useAccount } from '../src/state/account'
import { useApp } from '../src/state/store'
import { colors, markFontsReady } from '../src/theme/tokens'

/**
 * Root navigator. Whenever the app comes back to the foreground it rolls the
 * day over, refills hearts and, for signed-in learners, syncs with the cloud.
 */
export default function RootLayout() {
  const tick = useApp((s) => s.tick)

  // the brand font; if it cannot load (offline first run) the app still starts, with the system font
  const [fontsLoaded, fontError] = useFonts({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold })
  if (fontsLoaded) markFontsReady()

  useEffect(() => {
    void loadCapabilities()
    const stopAnalytics = startAnalytics(() => useAccount.getState().token)
    const stopAutoSync = startAutoSync()
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      tick()
      void useAccount.getState().syncNow()
    })
    return () => {
      sub.remove()
      stopAutoSync()
      stopAnalytics()
    }
  }, [tick])

  // the web needs the page language for correct casing: Turkish "i" is "İ" in capitals, not "I"
  const baseLang = useApp((s) => s.user.profile.baseLang)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = baseLang
  }, [baseLang])

  if (!fontsLoaded && !fontError) return null

  return (
    <Auth>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="placement" options={{ gestureEnabled: false }} />
        <Stack.Screen name="privacy" />
        <Stack.Screen name="terms" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="account" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sso-callback" options={{ animation: 'none' }} />
        <Stack.Screen name="shop" />
        <Stack.Screen name="challenge" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="unit/[id]" />
        <Stack.Screen name="coach/index" />
        <Stack.Screen name="coach/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="game/run" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="game/avalanche" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="lesson/[id]" options={{ gestureEnabled: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="result" options={{ gestureEnabled: false, animation: 'fade' }} />
      </Stack>
    </Auth>
  )
}

/** Google sign-in needs Clerk mounted above the navigator; without a key the app runs exactly as before. */
function Auth({ children }: { children: ReactNode }) {
  if (!clerkEnabled) return <>{children}</>
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      {children}
    </ClerkProvider>
  )
}
