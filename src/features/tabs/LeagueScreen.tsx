import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { isCharacterId } from '../../core/characters'
import { useT, type StringKey } from '../../i18n'
import { api, type LeagueResponse } from '../../lib/api'
import { useAccount } from '../../state/account'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { errorText } from '../account/errors'
import { TopBar } from '../path/TopBar'

/** Demotion only applies to cohorts big enough for "bottom N" to mean something (mirrors the server rule). */
const MIN_COHORT_FOR_DEMOTION = 12

export function LeagueScreen() {
  return (
    <Screen scroll>
      <TopBar />
      <LeagueBody />
    </Screen>
  )
}

export function LeagueBody() {
  const router = useRouter()
  const t = useT()
  const token = useAccount((s) => s.token)
  const syncNow = useAccount((s) => s.syncNow)
  const [league, setLeague] = useState<LeagueResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      await syncNow() // make sure this week's XP is on the board before reading it
      setLeague(await api<LeagueResponse>('/league', { token }))
    } catch (err) {
      setError(errorText(t, err))
    } finally {
      setLoading(false)
    }
  }, [token, syncNow, t])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  if (!token) {
    return (
      <View style={styles.center}>
        <Mascot id="rocky" size={150} />
        <Txt variant="title" center>
          {t('league.title')}
        </Txt>
        <Txt color={colors.textSoft} center>
          {t('league.signedOut')}
        </Txt>
        <Button label={t('league.cta')} onPress={() => router.push('/account')} style={styles.cta} testID="league-signup" />
      </View>
    )
  }

  const demotionFrom = league && league.entries.length >= MIN_COHORT_FOR_DEMOTION ? league.entries.length - league.demoteBottom : Number.POSITIVE_INFINITY

  return (
    <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.badge}>
            <Ionicons name="trophy" size={34} color={colors.white} />
          </View>
          <View style={styles.flex}>
            <Txt variant="caption" color={colors.textMuted} style={styles.upper}>
              {t('league.title')}
            </Txt>
            <Txt variant="title">{league ? t(`league.tier${Math.min(4, Math.max(0, league.tier))}` as StringKey) : '—'}</Txt>
          </View>
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
        </View>

        {error ? (
          <View style={styles.card}>
            <Txt color={colors.dangerText}>{error}</Txt>
            <Button label={t('league.retry')} variant="secondary" small onPress={() => void load()} />
          </View>
        ) : null}

        {league && !league.joined ? (
          <View style={styles.card}>
            <Txt color={colors.textSoft}>{t('league.notJoined')}</Txt>
          </View>
        ) : null}

        {league && league.joined ? (
          <>
            <Txt variant="caption" color={colors.successText}>
              ▲ {t('league.promote', { n: league.promoteTop })}
            </Txt>
            <View style={styles.list}>
              {league.entries.map((e) => {
                const promoted = e.rank <= league.promoteTop && e.xp > 0
                const demoted = e.rank > demotionFrom
                return (
                  <View key={e.userId} style={[styles.row, e.me ? styles.rowMe : null]}>
                    <Txt variant="label" color={promoted ? colors.successText : demoted ? colors.dangerText : colors.textSoft} style={styles.rank}>
                      {e.rank}
                    </Txt>
                    <View style={styles.avatar}>
                      <Mascot id={isCharacterId(e.guide) ? e.guide : 'everest'} size={40} />
                    </View>
                    <Txt style={[styles.flex, e.me ? styles.bold : null]} numberOfLines={1}>
                      {e.me ? `${e.name || t('league.learner')} (${t('league.you')})` : e.name || t('league.learner')}
                    </Txt>
                    <Txt variant="label" color={colors.textSoft}>
                      {e.xp} XP
                    </Txt>
                  </View>
                )
              })}
            </View>
            {Number.isFinite(demotionFrom) ? (
              <Txt variant="caption" color={colors.dangerText}>
                ▼ {t('league.demote', { n: league.demoteBottom })}
              </Txt>
            ) : null}
          </>
        ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  upper: { textTransform: 'uppercase', letterSpacing: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl, paddingTop: 48, gap: space.md },
  cta: { marginTop: space.md },
  body: { padding: space.lg, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  list: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderBottomWidth: 1, borderColor: colors.border },
  rowMe: { backgroundColor: colors.primaryTint },
  rank: { width: 26, textAlign: 'center', fontSize: 16 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
})
