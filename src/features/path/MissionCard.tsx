import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { COURSE } from '../../content/course'
import { comeback, todayMission, type MissionStep } from '../../core/mission'
import { useT, type StringKey } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { AnimatedMascot } from '../../ui/Mascot'
import { ProgressBar } from '../../ui/ProgressBar'
import { Txt } from '../../ui/Txt'
import { PRACTICE_ID } from '../lesson/LessonPlayer'

/**
 * Today's mission: the one card that answers "what should I do today?" (the
 * EVEREST daily loop). Three steps at most, a tap on any of them starts it,
 * a no-guilt line after a pause, and the guide celebrates when all are done.
 */
export function MissionCard({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const t = useT()
  const user = useApp((s) => s.user)
  const lang = user.profile.baseLang
  const now = Date.now()
  const mission = useMemo(() => todayMission(COURSE, user, now), [user, now])
  const back = useMemo(() => comeback(user, now), [user, now])
  const allDone = mission.steps.length > 0 && mission.done === mission.steps.length
  const hour = new Date(now).getHours()

  const open = (step: MissionStep) => {
    if (step.kind === 'lesson') router.push(`/lesson/${step.node.id}`)
    else if (step.kind === 'challenge') router.push('/challenge')
    else router.push(`/lesson/${PRACTICE_ID}`)
  }
  const label = (step: MissionStep) =>
    step.kind === 'lesson'
      ? t('mission.lesson', { title: step.node.kind === 'review' ? t('learn.review') : (step.unit.lessons[step.node.lessonIndex ?? 0]?.title[lang] ?? step.unit.title[lang]) })
      : step.kind === 'challenge'
        ? t('mission.challenge')
        : t('mission.review', { n: step.count })

  return (
    <View style={[styles.card, compact ? styles.cardCompact : null]} testID="mission-card">
      <View style={styles.top}>
        <View style={styles.flex}>
          {!compact ? (
            <Txt variant="caption" color={colors.textSoft}>
              {user.profile.name ? t('mission.hello', { name: user.profile.name }) : t('mission.helloAnon')} {hour < 12 ? '☀️' : hour < 18 ? '🌤️' : '🌙'}
            </Txt>
          ) : null}
          <Txt variant="heading">{allDone ? t('mission.done') : t('mission.title')}</Txt>
          {back && !allDone ? (
            <Txt color={colors.primaryEdge} style={styles.back}>
              {t(`streak.${back}` as StringKey)}
            </Txt>
          ) : null}
        </View>
        <AnimatedMascot id={user.profile.guide} size={compact ? 56 : 72} mood={allDone ? 'cheer' : 'talk'} react={allDone ? 'celebrate' : null} />
      </View>

      {allDone ? (
        <Txt color={colors.textSoft} style={styles.body}>
          {t('mission.doneBody')}
        </Txt>
      ) : (
        <View style={styles.steps}>
          {mission.steps.map((step, i) => (
            <Pressable key={`${step.kind}-${i}`} accessibilityRole="button" accessibilityLabel={label(step)} onPress={() => open(step)} style={({ pressed }) => [styles.step, step.done ? styles.stepDone : null, { opacity: pressed ? 0.8 : 1 }]} testID={`mission-${step.kind}`}>
              <View style={[styles.check, step.done ? styles.checkDone : null]}>
                <Ionicons name={step.done ? 'checkmark' : step.kind === 'lesson' ? 'footsteps' : step.kind === 'challenge' ? 'mic' : 'repeat'} size={16} color={step.done ? colors.text : colors.primary} />
              </View>
              <Txt style={[styles.flex, styles.stepText, step.done ? styles.stepTextDone : null]} numberOfLines={2}>
                {label(step)}
              </Txt>
              {!step.done ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.flex}>
          <ProgressBar value={mission.steps.length === 0 ? 0 : mission.done / mission.steps.length} color={colors.lime} track={colors.surface} height={10} />
        </View>
        <Txt variant="caption" color={colors.textSoft}>
          {t('mission.progress', { done: mission.done, total: mission.steps.length })}
        </Txt>
      </View>
      {!allDone && mission.next && !compact ? <Button label={t('mission.start')} variant="success" onPress={() => open(mission.next as MissionStep)} testID="mission-start" /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { margin: space.lg, marginBottom: space.sm, padding: space.lg, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border, gap: space.md },
  cardCompact: { margin: 0, padding: space.md, gap: space.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  body: { fontSize: 15, lineHeight: 22 },
  steps: { gap: space.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, paddingRight: space.md, borderRadius: radius.md, backgroundColor: colors.primaryTint },
  stepDone: { backgroundColor: colors.limeSoft },
  check: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.primarySoft },
  checkDone: { backgroundColor: colors.lime, borderColor: colors.lime },
  stepText: { fontSize: 15, lineHeight: 20 },
  stepTextDone: { color: colors.textSoft, textDecorationLine: 'line-through' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
