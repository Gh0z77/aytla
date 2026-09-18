import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { COURSE } from '../../content/course'
import { lessonIdsBefore } from '../../core/path'
import { BASE_LANGS, type CharacterId, type DailyGoal } from '../../core/types'
import { LANGUAGE_NAMES, useT, type StringKey } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { GUIDES, Mascot } from '../../ui/Mascot'
import { ProgressBar } from '../../ui/ProgressBar'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'

const GOALS: DailyGoal[] = [10, 20, 30, 50]
const STEPS = 5

/** First run: language → name → daily goal → level → guide. Everything can be changed later in Profile. */
export function WelcomeScreen() {
  const router = useRouter()
  const t = useT()
  const profile = useApp((s) => s.user.profile)
  const setProfile = useApp((s) => s.setProfile)
  const markLessonsDone = useApp((s) => s.markLessonsDone)

  const [step, setStep] = useState(0)
  const [name, setName] = useState(profile.name)
  const [goal, setGoal] = useState<DailyGoal>(profile.dailyGoalXp)
  const [knowsSome, setKnowsSome] = useState(false)
  const [guide, setGuide] = useState<CharacterId>(profile.guide)

  const finish = () => {
    setProfile({ name: name.trim(), dailyGoalXp: goal, guide, onboarded: true })
    const second = COURSE.units[1]
    if (knowsSome && second) markLessonsDone(lessonIdsBefore(COURSE, second.id))
    router.replace('/learn')
  }

  const next = () => (step === STEPS - 1 ? finish() : setStep(step + 1))
  const back = () => (step === 0 ? (router.canGoBack() ? router.back() : undefined) : setStep(step - 1))

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={28} color={colors.textMuted} />
        </Pressable>
        <ProgressBar value={(step + 1) / STEPS} color={colors.primary} />
      </View>

      <View style={styles.body}>
        {step === 0 ? (
          <>
            <Hello guide="everest" text={t('welcome.lang.title')} />
            {BASE_LANGS.map((lang) => (
              <Option key={lang} title={`${LANGUAGE_NAMES[lang].flag}  ${LANGUAGE_NAMES[lang].name}`} active={profile.baseLang === lang} onPress={() => setProfile({ baseLang: lang })} />
            ))}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Hello guide="everest" text={t('welcome.hello')} />
            <Txt variant="heading">{t('welcome.name.title')}</Txt>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('welcome.name.placeholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              maxLength={24}
              autoCapitalize="words"
              accessibilityLabel={t('welcome.name.placeholder')}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Hello guide="lumi" text={t('welcome.goal.title')} />
            {GOALS.map((g) => (
              <Option key={g} title={t(`welcome.goal.${g}` as StringKey)} sub={t('welcome.goal.xp', { n: g })} active={goal === g} onPress={() => setGoal(g)} />
            ))}
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Hello guide="pix" text={t('welcome.level.title')} />
            <Option title={t('welcome.level.new')} sub={t('welcome.level.newBody')} active={!knowsSome} onPress={() => setKnowsSome(false)} />
            <Option title={t('welcome.level.some')} sub={t('welcome.level.someBody')} active={knowsSome} onPress={() => setKnowsSome(true)} />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Hello guide={guide} text={t('welcome.guide.title')} />
            <View style={styles.guides}>
              {GUIDES.map((g) => (
                <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={g.name} onPress={() => setGuide(g.id)} style={[styles.guide, guide === g.id ? styles.guideOn : null]}>
                  <Mascot id={g.id} size={72} />
                  <Txt variant="label">{g.name}</Txt>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button label={step === STEPS - 1 ? t('welcome.finish') : t('common.continue')} onPress={next} testID="welcome-next" />
      </View>
    </Screen>
  )
}

function Hello({ guide, text }: { guide: CharacterId; text: string }) {
  return (
    <View style={styles.hello}>
      <Mascot id={guide} size={110} />
      <View style={styles.bubble}>
        <Txt style={styles.bubbleText}>{text}</Txt>
      </View>
    </View>
  )
}

function Option({ title, sub, active, onPress }: { title: string; sub?: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.option, active ? styles.optionOn : null]}>
      <View style={styles.flex}>
        <Txt style={styles.optionTitle} color={active ? colors.primaryEdge : colors.text}>
          {title}
        </Txt>
        {sub ? (
          <Txt color={colors.textSoft} style={styles.optionSub}>
            {sub}
          </Txt>
        ) : null}
      </View>
      {active ? <Ionicons name="checkmark-circle" size={26} color={colors.primary} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  body: { flex: 1, padding: space.lg, gap: space.md },
  footer: { padding: space.lg, borderTopWidth: 2, borderColor: colors.border },
  hello: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  bubble: { flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.md },
  bubbleText: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  input: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, padding: space.lg, fontSize: 18, color: colors.text },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, backgroundColor: colors.white },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  optionTitle: { fontSize: 17, fontWeight: '700' },
  optionSub: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  guides: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' },
  guide: { width: 104, alignItems: 'center', gap: 4, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: space.md },
  guideOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
})
