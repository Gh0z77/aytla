import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { isCharacterId } from '../../core/characters'
import { useT, type StringKey } from '../../i18n'
import { uz } from '../../i18n/uz'
import { api, type CoachScenariosResponse } from '../../lib/api'
import { GOAL_SCENARIOS } from '../../core/goals'
import { useAccount } from '../../state/account'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { errorText } from '../account/errors'

export function scenarioTitle(t: ReturnType<typeof useT>, id: string): string {
  const key = `coach.s.${id}`
  return key in uz ? t(key as StringKey) : id
}

/** Pick a role-play. Needs an account (usage is limited per learner) and a server with AI enabled. */
export function CoachListScreen() {
  const router = useRouter()
  const t = useT()
  const token = useAccount((s) => s.token)
  const goal = useApp((s) => s.user.profile.goal)
  const [data, setData] = useState<CoachScenariosResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      setData(await api<CoachScenariosResponse>('/coach/scenarios', { token }))
    } catch (err) {
      setError(errorText(t, err))
    } finally {
      setLoading(false)
    }
  }, [token, t])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  const back = () => (router.canGoBack() ? router.back() : router.replace('/practice'))

  // the role-plays that serve the learner's goal come first
  const rank = (id: string) => {
    const i = GOAL_SCENARIOS[goal ?? 'everyday'].indexOf(id)
    return i < 0 ? 99 : i
  }

  return (
    <Screen scroll edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.body}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
          <Ionicons name="arrow-back" size={28} color={colors.textMuted} />
        </Pressable>
        <View style={styles.hero}>
          <Mascot id="pix" size={110} />
          <View style={styles.flex}>
            <Txt variant="title">{t('coach.title')}</Txt>
            <Txt color={colors.textSoft}>{t('coach.body')}</Txt>
          </View>
        </View>

        {!token ? (
          <View style={styles.card}>
            <Txt color={colors.textSoft}>{t('coach.needAccount')}</Txt>
            <Button label={t('account.create')} onPress={() => router.push('/account')} />
          </View>
        ) : null}

        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? (
          <View style={styles.card}>
            <Txt color={colors.dangerText}>{error}</Txt>
            <Button label={t('league.retry')} variant="secondary" small onPress={() => void load()} />
          </View>
        ) : null}
        {data && !data.available ? (
          <View style={styles.card}>
            <Txt color={colors.textSoft}>{t('err.coach_unavailable')}</Txt>
          </View>
        ) : null}

        {data?.available
          ? [...data.scenarios].sort((a, b) => rank(a.id) - rank(b.id)).map((s) => (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={scenarioTitle(t, s.id)}
                onPress={() => router.push(`/coach/${s.id}`)}
                style={({ pressed }) => [styles.scenario, { opacity: pressed ? 0.8 : 1 }]}
                testID={`scenario-${s.id}`}
              >
                <Mascot id={isCharacterId(s.guide) ? s.guide : 'everest'} size={64} />
                <View style={styles.flex}>
                  <Txt style={styles.bold}>{scenarioTitle(t, s.id)}</Txt>
                  <Txt variant="caption" color={colors.textMuted}>
                    {s.level}
                  </Txt>
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
              </Pressable>
            ))
          : null}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700', fontSize: 17 },
  body: { padding: space.lg, gap: space.md },
  back: { width: 44, height: 44, justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  scenario: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.md, backgroundColor: colors.white },
})
