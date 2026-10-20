import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { dueItems, weakItems } from '../../core/progress'
import type { CharacterId } from '../../core/types'
import { useT } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { PRACTICE_ID } from '../lesson/LessonPlayer'
import { TopBar } from '../path/TopBar'

/** Three ways to practise: talk with a guide, play, or review what is about to be forgotten. */
export function PracticeScreen() {
  const router = useRouter()
  const t = useT()
  const user = useApp((s) => s.user)
  const now = Date.now()

  const due = dueItems(user, now, 99).length
  const weak = weakItems(user, 99).length
  const seen = Object.keys(user.srs).length

  return (
    <Screen scroll>
      <TopBar />
      <View style={styles.body}>
        <Entry guide="lumi" tint={colors.primaryTint} border={colors.primarySoft} title={t('coach.title')} body={t('coach.body')} onPress={() => router.push('/coach')} testID="open-coach" />
        <Entry guide="aero" tint={colors.goldSoft} border={colors.gold} title={t('games.run.title')} body={t('games.run.body')} onPress={() => router.push('/game/run')} testID="open-game" />
        <Entry guide="rocky" tint={colors.successSoft} border={colors.success} title={t('games.fall.title')} body={t('games.fall.body')} onPress={() => router.push('/game/avalanche')} testID="open-avalanche" />

        <View style={styles.card}>
          <View style={styles.hero}>
            <Mascot id="pix" size={84} />
            <View style={styles.flex}>
              <Txt style={styles.title}>{t('practice.title')}</Txt>
              <Txt color={colors.textSoft} style={styles.small}>
                {t('practice.body')}
              </Txt>
            </View>
          </View>
          {seen === 0 ? (
            // nothing to review yet: send the learner to the first lesson instead of a dead button
            <>
              <Row icon="footsteps" color={colors.primary} text={t('practice.none')} />
              <Button label={t('practice.firstLesson')} onPress={() => router.push('/learn')} testID="start-practice" />
            </>
          ) : (
            <>
              <Row icon="time" color={colors.primary} text={t('practice.due', { n: due })} />
              {weak > 0 ? <Row icon="barbell" color={colors.purple} text={t('practice.weak', { n: weak })} /> : null}
              <Button label={t('practice.start')} onPress={() => router.push(`/lesson/${PRACTICE_ID}`)} testID="start-practice" />
            </>
          )}
        </View>
      </View>
    </Screen>
  )
}

function Entry({ guide, tint, border, title, body, onPress, testID }: { guide: CharacterId; tint: string; border: string; title: string; body: string; onPress: () => void; testID: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} testID={testID} style={({ pressed }) => [styles.card, styles.entry, { backgroundColor: tint, borderColor: border, opacity: pressed ? 0.85 : 1 }]}>
      <Mascot id={guide} size={76} />
      <View style={styles.flex}>
        <Txt style={styles.title}>{title}</Txt>
        <Txt color={colors.textSoft} style={styles.small}>
          {body}
        </Txt>
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
    </Pressable>
  )
}

function Row({ icon, color, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={color} />
      <Txt style={styles.flex}>{text}</Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.lg },
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  entry: { flexDirection: 'row', alignItems: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  title: { fontWeight: '800', fontSize: 18 },
  small: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
