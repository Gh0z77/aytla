import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { findUnit } from '../../content/course'
import { useT } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Mascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { SpeakerButton } from '../lesson/parts'

/** Guidebook: the unit's grammar tip, examples and vocabulary, all with audio. */
export function UnitScreen({ unitId }: { unitId: string }) {
  const router = useRouter()
  const t = useT()
  const lang = useApp((s) => s.user.profile.baseLang)
  const unit = findUnit(unitId)

  const back = () => (router.canGoBack() ? router.back() : router.replace('/learn'))

  if (!unit) {
    return (
      <Screen>
        <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={26} color={colors.textSoft} />
        </Pressable>
      </Screen>
    )
  }

  return (
    <Screen scroll>
      <View style={[styles.hero, { backgroundColor: unit.color }]}>
        <Pressable onPress={back} style={styles.back} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={26} color={colors.white} />
        </Pressable>
        <View style={styles.heroRow}>
          <View style={styles.flex}>
            <Txt variant="title" color={colors.white}>
              {unit.title[lang]}
            </Txt>
            <Txt color="rgba(255,255,255,0.9)">{unit.goal[lang]}</Txt>
          </View>
          <Mascot id={unit.guide} size={110} />
        </View>
      </View>

      <View style={styles.body}>
        {unit.tip ? (
          <View style={styles.card}>
            <Txt variant="caption" color={colors.primary} style={styles.upper}>
              {t('unit.tip')}
            </Txt>
            <Txt variant="heading">{unit.tip.title[lang]}</Txt>
            <Txt color={colors.textSoft}>{unit.tip.body[lang]}</Txt>
            <Txt variant="caption" color={colors.textMuted} style={[styles.upper, styles.gapTop]}>
              {t('unit.examples')}
            </Txt>
            {unit.tip.examples.map((e) => (
              <View key={e.en} style={styles.row}>
                <SpeakerButton text={e.en} size={38} />
                <View style={styles.flex}>
                  <Txt style={styles.bold}>{e.en}</Txt>
                  <Txt color={colors.textSoft} style={styles.small}>
                    {e.native[lang]}
                  </Txt>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <Txt variant="heading" style={styles.gapTop}>
          {t('unit.words')}
        </Txt>
        <View style={styles.card}>
          {unit.words.map((w) => (
            <View key={w.id} style={styles.row}>
              <SpeakerButton text={w.en} size={38} />
              <Txt style={styles.wordEmoji}>{w.emoji ?? ''}</Txt>
              <View style={styles.flex}>
                <Txt style={styles.bold}>{w.en}</Txt>
                <Txt color={colors.textSoft} style={styles.small}>
                  {w.native[lang]}
                </Txt>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  small: { fontSize: 14, lineHeight: 20 },
  upper: { textTransform: 'uppercase', letterSpacing: 1 },
  gapTop: { marginTop: space.md },
  hero: { padding: space.lg, paddingBottom: space.xl, gap: space.md },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  back: { width: 44, height: 44, justifyContent: 'center' },
  body: { padding: space.lg, gap: space.md },
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  wordEmoji: { fontSize: 24, lineHeight: 30, width: 32, textAlign: 'center' },
})
