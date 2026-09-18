import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, View } from 'react-native'
import { LANGUAGE_NAMES } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, space } from '../../theme/tokens'
import { Txt } from '../../ui/Txt'

/** Streak, gems and hearts: always visible at the top of the learning tabs. */
export function TopBar() {
  const lang = useApp((s) => s.user.profile.baseLang)
  const streak = useApp((s) => s.user.streak.current)
  const gems = useApp((s) => s.user.gems)
  const hearts = useApp((s) => s.user.hearts.count)
  return (
    <View style={styles.bar}>
      <View style={styles.stat}>
        <Txt style={styles.flag}>{LANGUAGE_NAMES[lang].flag}</Txt>
        <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
        <Txt style={styles.flag}>🇬🇧</Txt>
      </View>
      <Stat icon="flame" color={streak > 0 ? colors.flame : colors.textMuted} value={streak} label="streak" />
      <Stat icon="diamond" color={colors.gem} value={gems} label="gems" />
      <Stat icon="heart" color={colors.heart} value={hearts} label="hearts" />
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
