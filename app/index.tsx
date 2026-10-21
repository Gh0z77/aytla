import { Redirect, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { track } from '../src/lib/analytics'
import { rememberReferral } from '../src/lib/referral'
import { LandingScreen } from '../src/features/landing/LandingScreen'
import { useApp } from '../src/state/store'

/** Web: public landing page (returning learners go straight to the path). Phones: straight into the app. */
export default function Index() {
  const hydrated = useApp((s) => s.hydrated)
  const onboarded = useApp((s) => s.user.profile.onboarded)
  // an invite link (?ref=CODE) is remembered until the visitor signs up
  const { ref } = useLocalSearchParams<{ ref?: string }>()
  useEffect(() => {
    if (typeof ref === 'string' && ref) {
      void rememberReferral(ref)
      track('invite_open')
    }
  }, [ref])

  if (Platform.OS !== 'web') return hydrated ? <Redirect href={onboarded ? '/learn' : '/welcome'} /> : null
  if (hydrated && onboarded) return <Redirect href="/learn" />
  return <LandingScreen />
}
