import { Ionicons } from '@expo/vector-icons'
import { useClerk, useSSO } from '@clerk/clerk-expo'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useT } from '../../i18n'
import { ApiError } from '../../lib/api'
import { useAccount } from '../../state/account'
import { colors } from '../../theme/tokens'
import { Button } from '../../ui/Button'

/**
 * "Continue with Google". Clerk runs the OAuth dance (a system browser sheet on
 * phones, a popup on the web); once it has a session we hand its token to our
 * API, which answers with the app's own bearer token. Clerk's session is then
 * dropped: the app has exactly one notion of "signed in".
 *
 * Only mounted inside ClerkProvider (see app/_layout.tsx).
 */
interface Props {
  disabled?: boolean
  onDone: () => void
  onError: (message: string) => void
  onBusy: (busy: boolean) => void
}

// a popup opened for OAuth on the web must be closed by the page it lands on (app/sso-callback.tsx)
if (Platform.OS === 'web') WebBrowser.maybeCompleteAuthSession()

export function GoogleButton({ disabled, onDone, onError, onBusy }: Props) {
  const t = useT()
  const { startSSOFlow } = useSSO()
  const clerk = useClerk()
  const loginWithGoogle = useAccount((s) => s.loginWithGoogle)
  const [busy, setBusy] = useState(false)

  // Android: pre-warm the custom tab so the Google page opens without a blank pause
  useEffect(() => {
    if (Platform.OS !== 'android') return
    void WebBrowser.warmUpAsync()
    return () => {
      void WebBrowser.coolDownAsync()
    }
  }, [])

  const press = async () => {
    if (busy || disabled) return
    setBusy(true)
    onBusy(true)
    try {
      const redirectUrl = AuthSession.makeRedirectUri({ path: 'sso-callback' })
      const { createdSessionId, setActive, authSessionResult } = await startSSOFlow({ strategy: 'oauth_google', redirectUrl })
      if (!createdSessionId || !setActive) {
        // the learner closed the Google window: not an error worth a message
        if (authSessionResult && authSessionResult.type !== 'success') return
        throw new ApiError('google_failed', 0)
      }
      await setActive({ session: createdSessionId })
      const token = await clerk.session?.getToken()
      if (!token) throw new ApiError('google_failed', 0)
      const user = clerk.user
      const email = user?.primaryEmailAddress?.emailAddress ?? ''
      const name = user?.fullName ?? user?.firstName ?? ''
      await loginWithGoogle(token, email, name)
      await clerk.signOut().catch(() => undefined)
      onDone()
    } catch (err) {
      await clerk.signOut().catch(() => undefined)
      onError(err instanceof ApiError ? err.code : 'google_failed')
    } finally {
      setBusy(false)
      onBusy(false)
    }
  }

  return <Button label={t('account.google')} variant="secondary" icon={<Ionicons name="logo-google" size={18} color={colors.primary} />} onPress={press} disabled={disabled || busy} testID="account-google" />
}
