import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors, radius } from '../theme/tokens'
import { Txt } from './Txt'

export type ButtonVariant = 'primary' | 'success' | 'danger' | 'gold' | 'secondary' | 'ghost'

const PALETTE: Record<ButtonVariant, { face: string; text: string; border: string }> = {
  primary: { face: colors.primary, text: colors.white, border: colors.primary },
  success: { face: colors.lime, text: colors.text, border: colors.lime },
  danger: { face: colors.danger, text: colors.white, border: colors.danger },
  gold: { face: colors.gold, text: colors.text, border: colors.gold },
  secondary: { face: colors.white, text: colors.primary, border: colors.primarySoft },
  ghost: { face: 'transparent', text: colors.primary, border: 'transparent' },
}

interface Props {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  icon?: ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
  small?: boolean
}

/**
 * Flat pill button. Pressing it sinks it slightly (scale) instead of pushing a
 * 3D edge down; the "success" variant is the lime accent with dark text, so a
 * finished answer looks like the brand, not like a traffic light.
 */
export function Button({ label, onPress, variant = 'primary', disabled, icon, style, testID, small }: Props) {
  const [pressed, setPressed] = useState(false)
  const p = disabled ? { face: colors.locked, text: colors.lockedText, border: colors.locked } : PALETTE[variant]
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.wrap, style]}
    >
      <View style={[styles.face, small ? styles.faceSmall : null, { backgroundColor: p.face, borderColor: p.border, transform: [{ scale: pressed && !disabled ? 0.97 : 1 }], opacity: pressed && !disabled ? 0.9 : 1 }]}>
        {icon}
        <Txt variant="label" color={p.text} style={styles.label}>
          {label}
        </Txt>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  face: { minHeight: 54, borderRadius: radius.pill, borderWidth: 2, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  faceSmall: { minHeight: 40, paddingHorizontal: 16 },
  label: { fontSize: 15, letterSpacing: 0.2 },
})
