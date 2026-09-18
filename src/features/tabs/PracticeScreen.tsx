import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { MAX_HEARTS, dueItems, msUntilNextHeart, weakItems } from '../../core/progress'
import { useT } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { PRACTICE_ID } from '../lesson/LessonPlayer'
import { TopBar } from '../path/TopBar'

function clock(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60_000)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}:${m < 10 ? '0' : ''}${m}`
}

export function PracticeScreen() {
  const router = useRouter()
  const t = useT()
  const user = useApp((s) => s.user)
  const tick = useApp((s) => s.tick)
  const [now, setNow] = useState(() => Date.now())

  // keep the heart countdown honest while the tab is open
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
      tick()
    }, 30_000)
    return () => clearInterval(id)
  }, [tick])

  const due = dueItems(user, now, 99).length
  const weak = weakItems(user, 99).length
  const seen = Object.keys(user.srs).length
  const wait = msUntilNextHeart(user, now)

  return (
    <Screen scroll>
      <TopBar />
      <View style={styles.body}>
        <View style={styles.hero}>
          <Mascot id="pix" size={130} />
          <View style={styles.heroText}>
            <Txt variant="title">{t('practice.title')}</Txt>
            <Txt color={colors.textSoft}>{t('practice.body')}</Txt>
          </View>
        </View>

        <View style={styles.card}>
          <Row icon="time" color={colors.primary} text={seen === 0 ? t('practice.none') : t('practice.due', { n: due })} />
          {weak > 0 ? <Row icon="barbell" color={colors.purple} text={t('practice.weak', { n: weak })} /> : null}
          <Button label={t('practice.start')} disabled={seen === 0} onPress={() => router.push(`/lesson/${PRACTICE_ID}`)} testID="start-practice" />
        </View>

        <View style={styles.card}>
          <View style={styles.hearts}>
            {Array.from({ length: MAX_HEARTS }, (_, i) => (
              <Ionicons key={i} name={i < user.hearts.count ? 'heart' : 'heart-outline'} size={30} color={colors.heart} />
            ))}
          </View>
          <Txt color={colors.textSoft} center>
            {wait === null ? t('practice.heartsFull') : t('practice.nextHeart', { time: clock(wait) })}
          </Txt>
          <Txt variant="caption" color={colors.textMuted} center>
            {t('practice.heartInfo')}
          </Txt>
        </View>
      </View>
    </Screen>
  )
}

function Row({ icon, color, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={color} />
      <Txt style={styles.rowText}>{text}</Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroText: { flex: 1, gap: 4 },
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rowText: { flex: 1 },
  hearts: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
})
