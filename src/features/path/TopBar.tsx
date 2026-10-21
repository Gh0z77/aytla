import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, View } from 'react-native'
import { dayKey } from '../../core/time'
import { LANGUAGE_NAMES, TARGET_NAMES } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, space } from '../../theme/tokens'
import { Txt } from '../../ui/Txt'

/** Streak, gems and hearts: always visible at the top of the learning tabs. */
export function TopBar() {
  const router = useRouter()
  const lang = useApp((s) => s.user.profile.baseLang)
  const target = useApp((s) => s.user.profile.target ?? 'en')
  const streak = useApp((s) => s.user.streak.current)
  const gems = useApp((s) => s.user.gems)
  // what the learner actually said today replaces hearts: progress you can hear, not lives you can lose
  const spoken = useApp((s) => s.user.days[dayKey(Date.now())]?.spoken ?? 0)
  return (
    <View style={styles.bar}>
      <View style={styles.stat}>
        <Txt style={styles.flag}>{LANGUAGE_NAMES[lang].flag}</Txt>
        <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
        <Txt style={styles.flag}>{TARGET_NAMES[target].flag}</Txt>
      </View>
      <Stat icon="flame" color={streak > 0 ? colors.flame : colors.textMuted} value={streak} label="streak" />
      <Pressable accessibilityRole="button" accessibilityLabel="shop" onPress={() => router.push('/shop')} hitSlop={8} testID="open-shop">
        <Stat icon="diamond" color={colors.gem} value={gems} label="gems" />
      </Pressable>
      <Stat icon="mic" color={spoken > 0 ? colors.success : colors.textMuted} value={spoken} label="sentences spoken today" />
    </View>
  )
}

function Stat({ icon, color, value, label }: { icon: keyof typeof Ionicons.glyphMap; color: string; value: number; label: string }) {
  return (
    <View style={styles.stat} accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={24} color={color} />
      <Txt variant="label" color={color} style={styles.value}>
        {value}
      </Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  flag: { fontSize: 22, lineHeight: 28 },
  value: { fontSize: 16 },
})
