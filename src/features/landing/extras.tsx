import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
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

const STRIP: Array<{ icon: keyof typeof Ionicons.glyphMap; title: StringKey; body: StringKey }> = [
  { icon: 'time-outline', title: 'landing.strip.1t', body: 'landing.strip.1b' },
  { icon: 'mic-outline', title: 'landing.strip.2t', body: 'landing.strip.2b' },
  { icon: 'stats-chart-outline', title: 'landing.strip.3t', body: 'landing.strip.3b' },
]

/** three short promises under the hero */
export function Strip({ wide }: { wide: boolean }) {
  const t = useT()
  return (
    <View style={[styles.strip, wide ? styles.stripWide : null]}>
      {STRIP.map((s, i) => (
        <View key={s.title} style={[styles.stripItem, wide && i > 0 ? styles.stripDivider : null]}>
          <View style={styles.stripIcon}>
            <Ionicons name={s.icon} size={26} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Txt variant="heading">{t(s.title)}</Txt>
            <Txt color={colors.textSoft}>{t(s.body)}</Txt>
          </View>
        </View>
      ))}
    </View>
  )
}

/** how a week looks: an illustration of the streak, not anyone's data */
export function ProgressSection({ wide }: { wide: boolean }) {
  const t = useT()
  const days = [1, 2, 3, 4, 5, 6, 7]
  return (
    <View style={[styles.progress, wide ? styles.progressWide : null]}>
      <View style={[styles.progressText, wide ? styles.progressTextWide : null]}>
        <Badge icon="sparkles" label={t('landing.progress.badge')} />
        <Txt variant="title">{t('landing.progress.title')}</Txt>
        <Txt color={colors.textSoft}>{t('landing.progress.body')}</Txt>
      </View>
      <View style={[styles.weekCard, wide ? styles.flex : null]}>
        <View style={styles.weekHead}>
          <Txt variant="heading">{t('landing.progress.week')}</Txt>
          <View style={styles.streak}>
            <Txt variant="label">{t('landing.progress.streak')} 🔥</Txt>
          </View>
        </View>
        <View style={styles.track}>
          {days.map((d, i) => {
            const done = d < 3
            const today = d === 3
            return (
              <View key={d} style={styles.dayWrap}>
                {i > 0 ? <View style={[styles.dash, done || today ? styles.dashOn : null]} /> : null}
                <View style={styles.day}>
                  <View style={[styles.dot, done ? styles.dotDone : null, today ? styles.dotToday : null]}>
                    {done ? <Ionicons name="checkmark" size={16} color={colors.white} /> : today ? <Ionicons name="star" size={14} color={colors.white} /> : null}
                  </View>
                  <Txt variant="caption" color={today ? colors.primary : colors.textMuted}>
                    {t('landing.progress.day', { n: d })}
                  </Txt>
                </View>
              </View>
            )
          })}
        </View>
        <View style={styles.hint}>
          <View style={styles.hintIcon}>
            <Ionicons name="ribbon" size={22} color={colors.primary} />
          </View>
          <Txt variant="caption" color={colors.textSoft} style={styles.flex}>
            {t('landing.progress.hint')}
          </Txt>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: colors.primaryTint, borderWidth: 1.5, borderColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  badgeText: { letterSpacing: 1.2 },
  strip: { gap: space.lg, paddingVertical: space.xl },
  stripWide: { flexDirection: 'row', gap: 0 },
  stripItem: { flex: 1, flexDirection: 'row', gap: space.md, alignItems: 'center', paddingHorizontal: space.lg },
  stripDivider: { borderLeftWidth: 1.5, borderColor: colors.border },
  stripIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  progress: { gap: space.lg, paddingVertical: 56 },
  progressWide: { flexDirection: 'row', alignItems: 'center', gap: 48 },
  progressText: { gap: space.md },
  progressTextWide: { flex: 0.8, minWidth: 0 },
  weekCard: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.border, padding: space.lg, gap: space.lg },
  weekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  streak: { backgroundColor: colors.goldSoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  track: { flexDirection: 'row', alignItems: 'flex-start' },
  dayWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dash: { flex: 1, height: 2, borderRadius: 1, backgroundColor: colors.border, marginBottom: 20 },
  dashOn: { backgroundColor: colors.success },
  day: { alignItems: 'center', gap: 6 },
  dot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: colors.success, borderColor: colors.success },
  dotToday: { backgroundColor: colors.primary, borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.primaryTint, borderRadius: radius.lg, padding: space.md },
  hintIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
})
