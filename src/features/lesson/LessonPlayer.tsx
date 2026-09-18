import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { COURSE, findLesson } from '../../content/course'
import { buildLessonSession, buildPracticeSession, buildReviewSession, type BuiltSession } from '../../core/exercises'
import { gradeBank, gradeFill, gradeListen, gradeSelect, gradeSpeak, gradeType } from '../../core/grading'
import { SHOP, practiceItems } from '../../core/progress'
import { answer, currentExercise, dropKinds, isFinished, sessionProgress, skip, startSession, toResult, type SessionState } from '../../core/session'
import type { CharacterId, Exercise, GradeResult, SessionKind } from '../../core/types'
import { useT } from '../../i18n'
import { resultFeedback } from '../../lib/haptics'
import { canListen, canSpeak, stopSpeaking } from '../../lib/speech'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { ProgressBar } from '../../ui/ProgressBar'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { BankView, FillView, ListenView, MatchView, SelectView, SpeakView, TypeView, isDraftReady, type Draft } from './views'

export const PRACTICE_ID = 'practice'

interface Prepared {
  kind: SessionKind
  lessonId: string | null
  guide: CharacterId
  built: BuiltSession
}

function prepare(lessonId: string): Prepared | null {
  const { user } = useApp.getState()
  const opts = {
    baseLang: user.profile.baseLang,
    seed: Math.floor(Math.random() * 2147483647),
    canListen: user.profile.soundOn && canListen(),
    canSpeak: user.profile.soundOn && canSpeak(),
  }
  if (lessonId === PRACTICE_ID) {
    const built = buildPracticeSession(COURSE, practiceItems(user, Date.now()), opts)
    return { kind: 'practice', lessonId: null, guide: user.profile.guide, built }
  }
  const found = findLesson(lessonId)
  if (!found) return null
  const built = found.lessonIndex === null ? buildReviewSession(found.unit, opts) : buildLessonSession(found.unit, found.lessonIndex, opts)
  return { kind: found.lessonIndex === null ? 'review' : 'lesson', lessonId, guide: found.unit.guide, built }
}

export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const router = useRouter()
  const t = useT()
  const hearts = useApp((s) => s.user.hearts.count)
  const gems = useApp((s) => s.user.gems)
  const profile = useApp((s) => s.user.profile)
  const loseHeart = useApp((s) => s.loseHeart)
  const buy = useApp((s) => s.buy)
  const completeSession = useApp((s) => s.completeSession)

  const [prepared] = useState(() => prepare(lessonId))
  const [session, setSession] = useState<SessionState | null>(() => (prepared ? startSession(prepared.kind, prepared.lessonId, prepared.built.exercises, Date.now()) : null))
  const [lexicon] = useState(() => new Set(prepared?.built.lexicon ?? []))
  const [draft, setDraft] = useState<Draft | null>(null)
  const [result, setResult] = useState<GradeResult | null>(null)
  const [matchWrong, setMatchWrong] = useState<string[] | null>(null)
  const [quitOpen, setQuitOpen] = useState(false)
  const costsHearts = prepared !== null && prepared.kind !== 'practice'
  const [noHeartsOpen, setNoHeartsOpen] = useState(() => costsHearts && hearts <= 0)
  const done = useRef(false)

  const leave = () => {
    stopSpeaking()
    if (router.canGoBack()) router.back()
    else router.replace('/learn')
  }

  if (!prepared || !session || prepared.built.exercises.length === 0) {
    return (
      <Screen>
        <View style={styles.empty}>
          <Mascot id={profile.guide} size={140} />
          <Txt variant="heading" center>
            {t('lesson.empty')}
          </Txt>
          <Txt color={colors.textSoft} center>
            {t('lesson.emptyBody')}
          </Txt>
          <Button label={t('common.back')} onPress={leave} style={styles.emptyButton} />
        </View>
      </Screen>
    )
  }

  const exercise = currentExercise(session)
  const locked = result !== null

  const finish = (final: SessionState) => {
    if (done.current) return
    done.current = true
    stopSpeaking()
    completeSession(toResult(final, Date.now()))
    router.replace('/result')
  }

  const advance = (next: SessionState, wasWrong: boolean) => {
    setDraft(null)
    setResult(null)
    setMatchWrong(null)
    setSession(next)
    if (isFinished(next)) finish(next)
    else if (wasWrong && costsHearts && useApp.getState().user.hearts.count <= 0) setNoHeartsOpen(true)
  }

  const check = () => {
    if (!exercise || !draft || locked) return
    const graded = grade(exercise, draft, profile.baseLang, lexicon)
    if (!graded) return
    resultFeedback(profile.hapticsOn, graded.correct)
    if (!graded.correct && costsHearts) loseHeart()
    setResult(graded)
  }

  const onContinue = () => {
    if (!result) return
    advance(answer(session, result.correct, matchWrong ?? undefined), !result.correct)
  }

  const cannot = (kind: 'listen' | 'speak') => advance(skip(dropKinds(session, [kind])), false)

  const common = { draft, setDraft, locked, result, guide: prepared.guide, sound: profile.soundOn, haptics: profile.hapticsOn }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('lesson.quitLeave')} onPress={() => setQuitOpen(true)} hitSlop={12}>
          <Ionicons name="close" size={30} color={colors.textMuted} />
        </Pressable>
        <ProgressBar value={sessionProgress(session)} />
        {costsHearts ? (
          <View style={styles.hearts}>
            <Ionicons name="heart" size={24} color={colors.heart} />
            <Txt variant="label" color={colors.heart}>
              {hearts}
            </Txt>
          </View>
        ) : null}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {exercise ? (
            <View key={`${exercise.id}:${session.mistakes}:${session.cleared}`}>
              {exercise.kind === 'select' ? <SelectView exercise={exercise} {...common} /> : null}
              {exercise.kind === 'bank' ? <BankView exercise={exercise} {...common} /> : null}
              {exercise.kind === 'fill' ? <FillView exercise={exercise} {...common} /> : null}
              {exercise.kind === 'listen' ? <ListenView exercise={exercise} {...common} onCannot={() => cannot('listen')} /> : null}
              {exercise.kind === 'type' ? <TypeView exercise={exercise} {...common} /> : null}
              {exercise.kind === 'speak' ? <SpeakView exercise={exercise} {...common} onCannot={() => cannot('speak')} /> : null}
              {exercise.kind === 'match' ? (
                <MatchView
                  exercise={exercise}
                  sound={profile.soundOn}
                  haptics={profile.hapticsOn}
                  onDone={(wrongIds) => {
                    setMatchWrong(wrongIds)
                    setResult({ correct: true, expected: '' })
                  }}
                />
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {locked && result ? (
          <Feedback result={result} onContinue={onContinue} />
        ) : exercise && exercise.kind !== 'match' ? (
          <View style={styles.footer}>
            <Button label={t('lesson.check')} variant="success" disabled={!isDraftReady(draft)} onPress={check} testID="check" />
          </View>
        ) : (
          <View style={styles.footer} />
        )}
      </KeyboardAvoidingView>

      <Modal visible={quitOpen} transparent animationType="fade" onRequestClose={() => setQuitOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Mascot id={prepared.guide} size={110} />
            <Txt variant="heading" center>
              {t('lesson.quitTitle')}
            </Txt>
            <Txt color={colors.textSoft} center>
              {t('lesson.quitBody')}
            </Txt>
            <Button label={t('lesson.quitStay')} onPress={() => setQuitOpen(false)} />
            <Button label={t('lesson.quitLeave')} variant="ghost" onPress={leave} />
          </View>
        </View>
      </Modal>

      <Modal visible={noHeartsOpen} transparent animationType="fade" onRequestClose={leave}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Ionicons name="heart-dislike" size={64} color={colors.heart} />
            <Txt variant="heading" center>
              {t('hearts.outTitle')}
            </Txt>
            <Txt color={colors.textSoft} center>
              {t('hearts.outBody')}
            </Txt>
            <Button
              label={t('hearts.refill', { n: SHOP.heartRefill.cost })}
              variant="gold"
              disabled={gems < SHOP.heartRefill.cost}
              onPress={() => {
                if (buy('heartRefill').ok) setNoHeartsOpen(false)
              }}
            />
            <Button
              label={t('hearts.practice')}
              onPress={() => {
                stopSpeaking()
                router.replace(`/lesson/${PRACTICE_ID}`)
              }}
            />
            <Button label={t('hearts.end')} variant="ghost" onPress={leave} />
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

function grade(exercise: Exercise, draft: Draft, baseLang: 'uz' | 'ru' | 'tr', lexicon: ReadonlySet<string>): GradeResult | null {
  switch (exercise.kind) {
    case 'select':
      return draft.kind === 'option' ? gradeSelect(exercise, draft.value) : null
    case 'fill':
      return draft.kind === 'option' ? gradeFill(exercise, draft.value) : null
    case 'bank':
      return draft.kind === 'tiles' ? gradeBank(exercise, draft.value.map((i) => exercise.tokens[i] ?? ''), baseLang) : null
    case 'listen':
      if (draft.kind === 'tiles') return gradeListen(exercise, draft.value.map((i) => exercise.tokens[i] ?? ''))
      return draft.kind === 'text' ? gradeListen(exercise, draft.value, lexicon) : null
    case 'type':
      return draft.kind === 'text' ? gradeType(exercise, draft.value, lexicon) : null
    case 'speak':
      return draft.kind === 'text' ? gradeSpeak(exercise, draft.value) : null
    case 'match':
      return null
  }
}

function Feedback({ result, onContinue }: { result: GradeResult; onContinue: () => void }) {
  const t = useT()
  const good = result.correct
  const tone = good ? { bg: colors.successSoft, text: colors.successText } : { bg: colors.dangerSoft, text: colors.dangerText }
  return (
    <View style={[styles.feedback, { backgroundColor: tone.bg }]}>
      <View style={styles.feedbackRow}>
        <Ionicons name={good ? 'checkmark-circle' : 'close-circle'} size={30} color={tone.text} />
        <Txt variant="heading" color={tone.text}>
          {good ? (result.typo ? t('lesson.typo') : t('lesson.correct')) : t('lesson.wrong')}
        </Txt>
      </View>
      {(!good || result.typo) && result.expected ? (
        <Txt color={tone.text} style={styles.expected}>
          {result.expected}
        </Txt>
      ) : null}
      <Button label={t('lesson.continue')} variant={good ? 'success' : 'danger'} onPress={onContinue} testID="continue" />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  hearts: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  body: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xl },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, borderTopWidth: 2, borderColor: colors.border, minHeight: 88 },
  feedback: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.lg, gap: space.sm },
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  expected: { fontSize: 17, marginBottom: space.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: colors.white, borderRadius: radius.xl, padding: space.xl, alignItems: 'center', gap: space.md },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  emptyButton: { marginTop: space.lg },
})
