import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { findUnit } from '../../content/course'
import { buildPlacementCheck } from '../../core/exercises'
import { courseForGoal } from '../../core/goals'
import { gradeBank, gradeSelect } from '../../core/grading'
import { checkVerdict, placementCheckpoints, placementFor, type Placement } from '../../core/placement'
import type { Exercise } from '../../core/types'
import { useT } from '../../i18n'
import { useCourse } from '../../state/course'
import { useApp } from '../../state/store'
import { colors, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { ProgressBar } from '../../ui/ProgressBar'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { BankView, SelectView, isDraftReady, type Draft } from '../lesson/views'

interface Check {
  index: number
  questions: Exercise[]
  asked: number
  right: number
}

/**
 * The placement test (rules in core/placement.ts). It is a test, not a lesson:
 * answers are not revealed, and "I don't know" is always one tap away so nobody
 * has to guess their way into units that are too hard.
 */
export function PlacementScreen() {
  const router = useRouter()
  const t = useT()
  const profile = useApp((s) => s.user.profile)
  const base = useCourse()
  const markLessonsDone = useApp((s) => s.markLessonsDone)

  const course = useMemo(() => courseForGoal(base, profile.goal), [base, profile.goal])
  const checkpoints = useMemo(() => placementCheckpoints(course), [course])
  const [seed] = useState(() => Math.floor(Math.random() * 2147483647))

  const buildCheck = (index: number): Check | null => {
    const unit = findUnit(checkpoints[index] ?? '')
    if (!unit) return null
    return { index, questions: buildPlacementCheck(unit, { baseLang: profile.baseLang, seed: seed + index, canListen: false, canSpeak: false }), asked: 0, right: 0 }
  }

  const [check, setCheck] = useState<Check | null>(() => buildCheck(0))
  const [draft, setDraft] = useState<Draft | null>(null)
  const [placement, setPlacement] = useState<Placement | null>(null)

  const conclude = (passed: number) => {
    setCheck(null)
    setPlacement(placementFor(course, passed))
  }

  const record = (correct: boolean) => {
    if (!check) return
    setDraft(null)
    const asked = check.asked + 1
    const right = check.right + (correct ? 1 : 0)
    // a check that runs out of questions is decided on what was answered
    const verdict = asked >= check.questions.length && checkVerdict(asked, right) === 'more' ? 'fail' : checkVerdict(asked, right)
    if (verdict === 'more') return setCheck({ ...check, asked, right })
    if (verdict === 'fail') return conclude(check.index)
    const next = buildCheck(check.index + 1)
    if (next) setCheck(next)
    else conclude(check.index + 1)
  }

  const exercise = check?.questions[check.asked]

  const submit = () => {
    if (!exercise || !draft) return
    if (exercise.kind === 'select' && draft.kind === 'option') record(gradeSelect(exercise, draft.value).correct)
    else if (exercise.kind === 'bank' && draft.kind === 'tiles') record(gradeBank(exercise, draft.value.map((i) => exercise.tokens[i] ?? ''), profile.baseLang).correct)
  }

  const leave = () => router.replace('/learn')

  if (placement || !check || !exercise) {
    const unit = placement ? findUnit(placement.unitId) : undefined
    const start = () => {
      if (placement && placement.lessonIds.length > 0) markLessonsDone(placement.lessonIds)
      leave()
    }
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.done}>
          <Mascot id={profile.guide} size={150} />
          <Txt variant="title" center>
            {placement && placement.skippedUnits > 0 ? t('placement.doneSkipped', { n: placement.skippedUnits }) : t('placement.doneStart')}
          </Txt>
          {unit ? (
            <Txt color={colors.textSoft} center testID="placement-unit">
              {t('placement.startAt', { unit: unit.title[profile.baseLang] })}
            </Txt>
          ) : null}
          <Txt color={colors.textSoft} center style={styles.note}>
            {t('placement.note')}
          </Txt>
        </View>
        <View style={styles.footer}>
          <Button label={t('placement.go')} variant="success" onPress={start} testID="placement-go" />
        </View>
      </Screen>
    )
  }

  const common = { draft, setDraft, locked: false, result: null, guide: profile.guide, sound: false, haptics: profile.hapticsOn }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('placement.skip')} onPress={leave} hitSlop={12}>
          <Ionicons name="close" size={30} color={colors.textMuted} />
        </Pressable>
        <ProgressBar value={(check.index + check.asked / 3) / Math.max(1, checkpoints.length)} color={colors.primary} />
      </View>
      <Txt variant="caption" color={colors.textMuted} center style={styles.upper}>
        {t('placement.title')}
      </Txt>

      <ScrollView style={styles.flex} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View key={exercise.id}>
          {exercise.kind === 'select' ? <SelectView exercise={exercise} {...common} /> : null}
          {exercise.kind === 'bank' ? <BankView exercise={exercise} {...common} /> : null}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t('lesson.check')} variant="success" disabled={!isDraftReady(draft)} onPress={submit} testID="placement-check" />
        <Button label={t('placement.dontKnow')} variant="ghost" onPress={() => record(false)} testID="placement-dont-know" />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  upper: { textTransform: 'uppercase', letterSpacing: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  body: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xl },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.lg, borderTopWidth: 2, borderColor: colors.border, gap: space.sm },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  note: { fontSize: 14, lineHeight: 20 },
})
