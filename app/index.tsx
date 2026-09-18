import { Redirect } from 'expo-router'
import { Platform } from 'react-native'
import { LandingScreen } from '../src/features/landing/LandingScreen'
import { useApp } from '../src/state/store'

/** Web: public landing page (returning learners go straight to the path). Phones: straight into the app. */
export default function Index() {
  const hydrated = useApp((s) => s.hydrated)
  const onboarded = useApp((s) => s.user.profile.onboarded)

  if (Platform.OS !== 'web') return hydrated ? <Redirect href={onboarded ? '/learn' : '/welcome'} /> : null
  if (hydrated && onboarded) return <Redirect href="/learn" />
  return <LandingScreen />
}
