import * as WebBrowser from 'expo-web-browser'
import { useEffect } from 'react'
import { ActivityIndicator, Platform, View } from 'react-native'
import { colors } from '../src/theme/tokens'

/**
 * Where Google sends the browser back after sign-in. On the web this page
 * opens inside the OAuth popup: it hands its URL to the window that opened it
 * and closes itself. On phones the OS routes aytla://sso-callback straight to
 * the waiting sign-in flow and this screen is never shown for long.
 */
export default function SsoCallback() {
  useEffect(() => {
    if (Platform.OS === 'web') WebBrowser.maybeCompleteAuthSession()
  }, [])
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  )
}
