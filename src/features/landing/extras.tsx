import { Ionicons } from '@expo/vector-icons'
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import { useT, type StringKey } from '../../i18n'
import { colors, radius, space } from '../../theme/tokens'
import { Txt } from '../../ui/Txt'

/** small uppercase pill with an icon, above a section title */
export function Badge({ icon, label, style }: { icon: keyof typeof Ionicons.glyphMap; label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.badge, style]}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Txt variant="caption" color={colors.primary} style={styles.badgeText}>
        {label.toUpperCase()}
      </Txt>
    </View>
  )
}

/** a glossy ball for decoration */
export function Orb({ size, color, dark, style }: { size: number; color: string; dark: string; style?: StyleProp<ViewStyle> }) {
  const id = `orb-${color.replace('#', '')}`
  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={id} cx={0.32} cy={0.28} r={0.75}>
            <Stop offset={0} stopColor="#FFFFFF" />
            <Stop offset={0.25} stopColor={color} />
            <Stop offset={1} stopColor={dark} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={48} fill={`url(#${id})`} />
      </Svg>
    </View>
  )
}

/** a "handwritten" note card, slightly tilted, with a little arrow */
export function Note({ text, tilt = -4, arrow = 'left', style }: { text: string; tilt?: number; arrow?: 'left' | 'right' | 'none'; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.noteWrap, style]} pointerEvents="none">
      {arrow === 'left' ? <Ionicons name="return-down-back-outline" size={26} color={colors.primary} style={styles.noteArrow} /> : null}
      <View style={[styles.note, { transform: [{ rotate: `${tilt}deg` }] }]}>
        <Txt variant="label" color={colors.primaryEdge} style={styles.noteText}>
          {text}
        </Txt>
      </View>
      {arrow === 'right' ? <Ionicons name="return-down-forward-outline" size={26} color={colors.primary} style={styles.noteArrow} /> : null}
    </View>
  )
}

/** a phone body around a screenshot; the screenshots are 375×812 */
export function PhoneFrame({ image, width }: { image: number; width: number }) {
  const height = (width * 812) / 375
  return (
    <View style={[styles.phone, { width: width + 20, borderRadius: width * 0.14 }]}>
      <View style={[styles.phoneScreen, { width, height, borderRadius: width * 0.11 }]}>
        <Image source={image} style={{ width, height }} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
    </View>
  )
}

const STRIP: Array<{ icon: keyof typeof Ionicons.glyphMap; title: StringKey; body: StringKey }> = [
  { icon: 'time-outline', title: 'landing.strip.1t', body: 'landing.strip.1b' },
  { icon: 'mic-outline', title: 'landing.strip.2t', body: 'landing.strip.2b' },
  { icon: 'stats-chart-outline', title: 'landing.strip.3t', body: 'landing.strip.3b' },
  { icon: 'compass-outline', title: 'landing.strip.4t', body: 'landing.strip.4b' },
]

/** four short promises under the hero */
export function Strip({ wide }: { wide: boolean }) {
  const t = useT()
  return (
    <View style={[styles.strip, wide ? styles.stripWide : null]}>
      {STRIP.map((s, i) => (
        <View key={s.title} style={[styles.stripItem, wide ? styles.flex : null, wide && i > 0 ? styles.stripDivider : null]}>
          <View style={styles.stripIcon}>
            <Ionicons name={s.icon} size={24} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Txt variant="label" style={styles.stripTitle}>
              {t(s.title)}
            </Txt>
            <Txt variant="caption" color={colors.textSoft} style={styles.stripBody}>
              {t(s.body)}
            </Txt>
          </View>
        </View>
      ))}
    </View>
  )
}

const WHY: Array<{ icon: keyof typeof Ionicons.glyphMap; title: StringKey; body: StringKey }> = [
  { icon: 'chatbubble-ellipses', title: 'landing.why.c1t', body: 'landing.why.c1b' },
  { icon: 'rocket', title: 'landing.why.c2t', body: 'landing.why.c2b' },
  { icon: 'repeat', title: 'landing.why.c3t', body: 'landing.why.c3b' },
  { icon: 'stats-chart', title: 'landing.why.c4t', body: 'landing.why.c4b' },
]

/** the four reasons, as cards */
export function WhyCards({ wide }: { wide: boolean }) {
  const t = useT()
  return (
    <View style={[styles.cards, wide ? styles.cardsWide : null]}>
      {WHY.map((c) => (
        <View key={c.title} style={[styles.card, wide ? styles.flex : null]}>
          <View style={styles.cardIcon}>
            <Ionicons name={c.icon} size={22} color={colors.white} />
          </View>
          <Txt variant="heading">{t(c.title)}</Txt>
          <Txt color={colors.textSoft}>{t(c.body)}</Txt>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.primaryTint, borderWidth: 1.5, borderColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { letterSpacing: 1.2 },
  noteWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteArrow: { transform: [{ rotate: '-20deg' }] },
  note: { backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 12, shadowColor: colors.navy, shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, maxWidth: 220 },
  noteText: { fontStyle: 'italic' },
  phone: { backgroundColor: colors.navy, padding: 10, shadowColor: colors.navy, shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 18 } },
  phoneScreen: { overflow: 'hidden', backgroundColor: colors.bg },
  strip: { gap: space.lg, paddingVertical: space.lg },
  stripWide: { flexDirection: 'row', gap: 0 },
  stripItem: { flexDirection: 'row', gap: space.md, alignItems: 'center', paddingHorizontal: space.lg },
  stripDivider: { borderLeftWidth: 1.5, borderColor: colors.border },
  stripIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  stripTitle: { fontSize: 16 },
  stripBody: { fontSize: 13, lineHeight: 18 },
  cards: { alignSelf: 'stretch', gap: space.md, marginTop: space.lg },
  cardsWide: { flexDirection: 'row' },
  card: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.border, padding: space.lg, gap: space.sm },
  cardIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
})
