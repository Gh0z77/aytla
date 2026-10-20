import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, View } from 'react-native'
import { ACHIEVEMENTS, achievementCounters, achievementLevel, achievementThresholds, questValue } from '../../core/progress'
import { dayKey, lastDays } from '../../core/time'
import { useT } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { ProgressBar } from '../../ui/ProgressBar'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { TopBar } from '../path/TopBar'
import { achievementLabel, questLabel } from '../result/ResultScreen'
import { WeeklyReportCard } from './WeeklyReportCard'

export function QuestsScreen() {
  return (
    <Screen scroll>
      <TopBar />
      <QuestsBody />
    </Screen>
  )
}

export function QuestsBody() {
  const t = useT()
  const user = useApp((s) => s.user)
  const now = Date.now()
  const today = dayKey(now)
  const stats = user.days[today]
  const week = lastDays(now, 7)
  const counters = achievementCounters(user)

  return (
    <View style={styles.body}>
        {/* streak */}
        <View style={[styles.card, styles.streakCard]}>
          <View style={styles.streakTop}>
            <Ionicons name="flame" size={54} color={user.streak.current > 0 ? colors.flame : colors.lockedText} />
            <View style={styles.flex}>
              <Txt variant="title" color={colors.flame}>
                {t('quests.days', { n: user.streak.current })}
              </Txt>
              <Txt variant="caption" color={colors.textSoft}>
                {t('quests.longest', { n: user.streak.longest })} · {t('quests.freezes', { n: user.streak.freezes })}
              </Txt>
            </View>
          </View>
          <View style={styles.week}>
            {week.map((day) => {
              const reached = (user.days[day]?.xp ?? 0) >= user.profile.dailyGoalXp
              const frozen = user.streak.frozenDays.includes(day)
              return (
                <View key={day} style={styles.dayCol}>
                  <View style={[styles.dot, reached ? styles.dotOn : frozen ? styles.dotFrozen : null, day === today ? styles.dotToday : null]}>
                    {reached ? <Ionicons name="checkmark" size={16} color={colors.white} /> : frozen ? <Ionicons name="snow" size={14} color={colors.white} /> : null}
                  </View>
                  <Txt variant="caption" color={colors.textMuted}>
                    {day.slice(8)}
                  </Txt>
                </View>
              )
            })}
          </View>
        </View>

        <WeeklyReportCard />

        {/* daily quests */}
        <Txt variant="heading">{t('quests.title')}</Txt>
        {user.quests.items.map((q) => {
          const value = Math.min(q.target, questValue(q, stats))
          return (
            <View key={q.id} style={styles.card}>
              <View style={styles.questTop}>
                <Txt style={styles.flex}>{questLabel(t, q)}</Txt>
                <View style={styles.reward}>
                  <Ionicons name={q.claimed ? 'checkmark-circle' : 'diamond'} size={18} color={q.claimed ? colors.success : colors.gem} />
                  <Txt variant="caption" color={q.claimed ? colors.success : colors.textSoft}>
                    {q.claimed ? t('quests.done') : t('quests.reward', { n: q.rewardGems })}
                  </Txt>
                </View>
              </View>
              <View style={styles.barRow}>
                <ProgressBar value={value / q.target} color={q.claimed ? colors.success : colors.gold} />
                <Txt variant="caption" color={colors.textSoft}>
                  {value} / {q.target}
                </Txt>
              </View>
            </View>
          )
        })}

        {/* achievements */}
        <Txt variant="heading" style={styles.sectionTitle}>
          {t('quests.achievements')}
        </Txt>
        {ACHIEVEMENTS.map((a) => {
          const value = counters[a.id]
          const level = achievementLevel(a.id, value)
          const thresholds = achievementThresholds(a.id)
          const next: number | undefined = thresholds[level]
          const previous = level > 0 ? (thresholds[level - 1] ?? 0) : 0
          const ratio = next === undefined ? 1 : (value - previous) / (next - previous)
          return (
            <View key={a.id} style={styles.card}>
              <View style={styles.questTop}>
                <View style={[styles.badge, level > 0 ? styles.badgeOn : null]}>
                  <Ionicons name="trophy" size={22} color={level > 0 ? colors.white : colors.lockedText} />
                </View>
                <View style={styles.flex}>
                  <Txt style={styles.bold}>{achievementLabel(t, a.id)}</Txt>
                  <Txt variant="caption" color={colors.textSoft}>
                    {t('ach.level', { n: level })} · {next === undefined ? t('ach.max') : t('ach.progress', { value, next })}
                  </Txt>
                </View>
              </View>
              <View style={styles.barRow}>
                <ProgressBar value={ratio} color={colors.gold} height={12} />
              </View>
            </View>
          )
        })}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  body: { padding: space.lg, gap: space.md },
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  streakCard: { backgroundColor: colors.goldSoft, borderColor: colors.gold, marginBottom: space.sm },
  streakTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 4 },
  dot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.flame, borderColor: colors.flame },
  dotFrozen: { backgroundColor: colors.gem, borderColor: colors.gem },
  dotToday: { borderColor: colors.goldEdge },
  questTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sectionTitle: { marginTop: space.md },
  badge: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.locked, alignItems: 'center', justifyContent: 'center' },
  badgeOn: { backgroundColor: colors.gold },
})
