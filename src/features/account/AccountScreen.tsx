import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useT } from '../../i18n'
import { useAccount } from '../../state/account'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { errorText } from './errors'

/** Create an account or log in. Guests keep everything they have done: their progress is uploaded on sign-up. */
export function AccountScreen() {
  const router = useRouter()
  const t = useT()
  const register = useAccount((s) => s.register)
  const login = useAccount((s) => s.login)

  const [mode, setMode] = useState<'create' | 'login'>('create')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'))

  const submit = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await (mode === 'create' ? register(email.trim(), password) : login(email.trim(), password))
      back()
    } catch (err) {
      setError(errorText(t, err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.body}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
          <Ionicons name="arrow-back" size={28} color={colors.textMuted} />
        </Pressable>

        <View style={styles.hero}>
          <Mascot id="aero" size={120} />
          <Txt variant="title" center>
            {t(mode === 'create' ? 'account.create' : 'account.login')}
          </Txt>
          <Txt color={colors.textSoft} center>
            {t('account.benefits')}
          </Txt>
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t('account.email')}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          style={styles.input}
          accessibilityLabel={t('account.email')}
          testID="account-email"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={`${t('account.password')} (${t('account.passwordHint')})`}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
          style={styles.input}
          accessibilityLabel={t('account.password')}
          onSubmitEditing={submit}
          testID="account-password"
        />

        {error ? (
          <View style={styles.error} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={20} color={colors.dangerText} />
            <Txt color={colors.dangerText} style={styles.errorText}>
              {error}
            </Txt>
          </View>
        ) : null}

        <Button label={t(mode === 'create' ? 'account.create' : 'account.login')} onPress={submit} disabled={busy || email.trim().length === 0 || password.length === 0} testID="account-submit" />
        <Button
          label={t(mode === 'create' ? 'account.switchToLogin' : 'account.switchToCreate')}
          variant="ghost"
          onPress={() => {
            setError(null)
            setMode(mode === 'create' ? 'login' : 'create')
          }}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.md },
  back: { width: 44, height: 44, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: space.sm, marginBottom: space.md },
  input: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: space.lg, fontSize: 17, color: colors.text },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: space.md },
  errorText: { flex: 1, fontSize: 15, lineHeight: 21 },
})
