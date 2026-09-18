import { Ionicons } from '@expo/vector-icons'
import { Redirect, useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import type { AchievementId } from '../../core/progress'
import type { Quest } from '../../core/types'
import { useT, type StringKey, type Translate } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'

export function questLabel(t: Translate, quest: Pick<Quest, 'kind' | 'target'>): string {
  return t(`quests.${quest.kind}` as StringKey, { n: quest.target })
}

export function achievementLabel(t: Translate, id: string): string {
  return t(`ach.${id as AchievementId}` as StringKey)
}

export function ResultScreen() {
  const router = useRouter()
  const t = useT()
  const rewards = useApp((s) => s.lastRewards)
  const guide = useApp((s) => s.user.profile.guide)

  const pop = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(pop, { toValue: 1, duration: 450, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }).start()
  }, [pop])

  if (!rewards) return <Redirect href="/learn" />

  const lines: Array<{ icon: keyof typeof Ionicons.glyphMap; color: string; text: string }> = []
  if (rewards.streakExtended) lines.push({ icon: 'flame', color: colors.flame, text: `${t('result.streakExtended')} ${t('result.streak', { n: rewards.newStreak })}` })
  else if (rewards.goalReachedToday) lines.push({ icon: 'flag', color: colors.primary, text: t('result.goal') })
  rewards.questsCompleted.forEach((q) => lines.push({ icon: 'ribbon', color: colors.purple, text: `${t('result.quest')}: ${questLabel(t, q)}` }))
  rewards.achievements.forEach((a) => lines.push({ icon: 'trophy', color: colors.goldEdge, text: `${t('result.achievement')}: ${achievementLabel(t, a.id)} · ${t('ach.level', { n: a.level })}` }))
  if (rewards.heartsRestored > 0) lines.push({ icon: 'heart', color: colors.heart, text: t('result.heart') })

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.body}>
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Mascot id={guide} size={190} />
        </Animated.View>
        <Txt variant="title" color={colors.goldEdge} center>
          {rewards.perfect ? t('result.perfect') : t('result.title')}
        </Txt>

        <View style={styles.stats}>
          <StatCard label={t('result.xp')} value={`+${rewards.xp}`} color={colors.gold} icon="flash" />
          <StatCard label={t('result.accuracy')} value={`${rewards.accuracy}%`} color={colors.success} icon="checkmark-done" />
          <StatCard label={t('result.gems')} value={`+${rewards.gems}`} color={colors.gem} icon="diamond" />
        </View>

        <View style={styles.lines}>
          {lines.map((l, i) => (
            <View key={i} style={styles.line}>
              <Ionicons name={l.icon} size={22} color={l.color} />
              <Txt style={styles.lineText}>{l.text}</Txt>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.footer}>
        {/* dismissTo pops back to the existing tabs instead of stacking a second copy of the path on top */}
        <Button label={t('common.continue')} onPress={() => router.dismissTo('/learn')} testID="result-continue" />
      </View>
    </Screen>
  )
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={[styles.stat, { borderColor: color, backgroundColor: color }]}>
      <Txt variant="caption" color={colors.white} center style={styles.statLabel}>
        {label}
      </Txt>
      <View style={styles.statInner}>
        <Ionicons name={icon} size={20} color={color} />
        <Txt variant="heading" color={color}>
          {value}
        </Txt>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
  stats: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' },
  stat: { flex: 1, borderRadius: radius.lg, borderWidth: 2, overflow: 'hidden' },
  statLabel: { paddingVertical: 5, textTransform: 'uppercase' },
  statInner: { backgroundColor: colors.white, borderRadius: radius.md, margin: 0, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  lines: { alignSelf: 'stretch', gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md },
  lineText: { flex: 1, fontSize: 15, lineHeight: 21 },
  footer: { padding: space.lg },
})
