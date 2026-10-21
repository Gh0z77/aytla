import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useMemo, useState, useEffect } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { gradeSay } from '../../core/grading'
import { challengeSentence } from '../../core/mission'
import type { GradeResult, Rewards, SayExercise } from '../../core/types'
import { useT } from '../../i18n'
import { loadCapabilities } from '../../lib/capabilities'
import { canSpeak } from '../../lib/speech'
import { useCourse } from '../../state/course'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Confetti } from '../../ui/Confetti'
import { AnimatedMascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { SayView, isDraftReady, type Draft } from '../lesson/views'

/** The sentence of the day: one speaking round, one reward, done in a minute. */
export function ChallengeScreen() {
  const router = useRouter()
  const t = useT()
  const user = useApp((s) => s.user)
  const course = useCourse()
  const completeChallenge = useApp((s) => s.completeChallenge)
  const [micAvailable, setMicAvailable] = useState(() => canSpeak())
  // the server's recogniser is known only once /health has answered
  useEffect(() => {
    let alive = true
    void loadCapabilities().then(() => alive && setMicAvailable(canSpeak()))
    return () => {
      alive = false
    }
  }, [])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [result, setResult] = useState<GradeResult | null>(null)
  const [rewards, setRewards] = useState<Rewards | null>(null)

  const pick = useMemo(() => challengeSentence(course, user, Date.now()), [course, user])
  const sentence = pick ? pick.unit.sentences.find((s) => s.id === pick.sentenceId) : undefined
  const exercise: SayExercise | null = sentence ? { kind: 'say', id: `challenge-${sentence.id}`, itemId: sentence.id, prompt: sentence.native[user.profile.baseLang], audio: sentence.en, answers: [sentence.en, ...(sentence.altEn ?? [])] } : null
  const doneToday = user.days[new Date().toISOString().slice(0, 10)]?.challenge === true

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/learn'))
  const check = () => {
    if (!exercise || !draft || draft.kind !== 'text') return
    const graded = gradeSay(exercise, draft.value, draft.spoken === true)
    setResult(graded)
    setRewards(completeChallenge(exercise.itemId, graded.correct))
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={leave} hitSlop={12}>
          <Ionicons name="close" size={30} color={colors.textMuted} />
        </Pressable>
        <Txt variant="label" color={colors.textSoft}>
          {t('challenge.title')}
        </Txt>
      </View>

      {!exercise ? (
        <View style={styles.center}>
          <Txt color={colors.textSoft} center>
            {t('practice.none')}
          </Txt>
          <Button label={t('common.back')} onPress={leave} />
        </View>
      ) : result ? (
        <View style={styles.center}>
          {result.correct ? <Confetti /> : null}
          <AnimatedMascot id={user.profile.guide} size={150} react={result.correct ? 'celebrate' : 'wrong'} />
          <Txt variant="title" center color={result.correct ? colors.successText : colors.dangerText}>
            {result.correct ? t('challenge.done') : t('challenge.tryAgain')}
          </Txt>
          <Txt variant="heading" center>
            {result.expected}
          </Txt>
          {rewards && rewards.xp > 0 ? (
            <Txt variant="label" color={colors.primaryEdge} center>
              {t('challenge.reward', { xp: rewards.xp, gems: rewards.gems })}
            </Txt>
          ) : (
            <Txt color={colors.textSoft} center>
              {t('challenge.alreadyDone')}
            </Txt>
          )}
          <Button label={t('common.continue')} variant="success" onPress={leave} testID="challenge-continue" />
        </View>
      ) : (
        <>
          <View style={styles.body}>
            <View style={styles.intro}>
              <AnimatedMascot id={user.profile.guide} size={64} mood="talk" />
              <Txt color={colors.textSoft} style={styles.flex}>
                {doneToday ? t('challenge.alreadyDone') : t('challenge.body')}
              </Txt>
            </View>
            <SayView exercise={exercise} draft={draft} setDraft={setDraft} locked={false} result={null} guide={user.profile.guide} sound={user.profile.soundOn} haptics={user.profile.hapticsOn} canUseMic={micAvailable} />
          </View>
          <View style={styles.footer}>
            <Button label={t('lesson.check')} variant="success" disabled={!isDraftReady(draft)} onPress={check} testID="challenge-check" />
          </View>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  body: { flex: 1, paddingHorizontal: space.lg, gap: space.md },
  intro: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.primaryTint, marginBottom: space.sm },
  footer: { padding: space.lg, borderTopWidth: 2, borderColor: colors.border },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
})
