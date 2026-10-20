import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useT } from '../../i18n'
import { ApiError, api, type ProvidersResponse } from '../../lib/api'
import { clerkEnabled } from '../../lib/clerk'
import { useAccount } from '../../state/account'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { errorText } from './errors'
import { GoogleButton } from './GoogleButton'

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

  // Telegram sign-in is offered only when the server runs a bot; Google only when both the app and the server know Clerk
  const loginWithTelegram = useAccount((s) => s.loginWithTelegram)
  const [telegram, setTelegram] = useState(false)
  const [google, setGoogle] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const cancel = useRef<AbortController | null>(null)
  useEffect(() => {
    let alive = true
    api<ProvidersResponse>('/auth/providers')
      .then((p) => {
        if (!alive) return
        setTelegram(p.telegram)
        setGoogle(p.google && clerkEnabled)
      })
      .catch(() => undefined)
    return () => {
      alive = false
      cancel.current?.abort()
    }
  }, [])

  const viaTelegram = async () => {
    if (busy || waiting) return
    setError(null)
    setWaiting(true)
    // a browser only lets a tap open a window, so open it now and point it at Telegram once the link is known
    const popup = Platform.OS === 'web' && typeof window !== 'undefined' ? window.open('', '_blank') : null
    const controller = new AbortController()
    cancel.current = controller
    try {
      await loginWithTelegram((url) => {
        if (popup) popup.location.href = url
        else return Linking.openURL(url)
      }, controller.signal)
      back()
    } catch (err) {
      popup?.close()
      if (!(err instanceof ApiError && err.code === 'cancelled')) setError(errorText(t, err))
    } finally {
      setWaiting(false)
    }
  }

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

        {google ? <GoogleButton disabled={busy || waiting} onBusy={setBusy} onDone={back} onError={(code) => setError(errorText(t, new ApiError(code, 0)))} /> : null}

        {telegram ? (
          <>
            {waiting ? (
              <View style={styles.waiting}>
                <ActivityIndicator color={colors.primary} />
                <Txt color={colors.textSoft} style={styles.errorText}>
                  {t('account.telegramWaiting')}
                </Txt>
                <Button label={t('common.cancel')} variant="ghost" small onPress={() => cancel.current?.abort()} />
              </View>
            ) : (
              <Button label={t('account.telegram')} variant="secondary" icon={<Ionicons name="paper-plane" size={18} color={colors.primary} />} onPress={viaTelegram} disabled={busy} testID="account-telegram" />
            )}
          </>
        ) : null}
        {telegram || google ? (
          <Txt variant="caption" color={colors.textMuted} center>
            {t('account.or')}
          </Txt>
        ) : null}

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
        <Txt variant="caption" color={colors.textMuted} center>
          {t('account.agree')}
        </Txt>
        <View style={styles.legal}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/terms')} hitSlop={8}>
            <Txt variant="caption" color={colors.primary} style={styles.link}>
              {t('legal.terms')}
            </Txt>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} hitSlop={8}>
            <Txt variant="caption" color={colors.primary} style={styles.link}>
              {t('legal.privacy')}
            </Txt>
          </Pressable>
        </View>
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
  legal: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
  link: { textDecorationLine: 'underline' },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 2, borderColor: colors.primarySoft, backgroundColor: colors.primaryTint, borderRadius: radius.lg, padding: space.md },
})
