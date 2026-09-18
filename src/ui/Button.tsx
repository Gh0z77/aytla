import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { EDGE, colors, radius } from '../theme/tokens'
import { Txt } from './Txt'

export type ButtonVariant = 'primary' | 'success' | 'danger' | 'gold' | 'secondary' | 'ghost'

const PALETTE: Record<ButtonVariant, { face: string; edge: string; text: string; border?: string }> = {
  primary: { face: colors.primary, edge: colors.primaryEdge, text: colors.white },
  success: { face: colors.success, edge: colors.successEdge, text: colors.white },
  danger: { face: colors.danger, edge: colors.dangerEdge, text: colors.white },
  gold: { face: colors.gold, edge: colors.goldEdge, text: colors.navy },
  secondary: { face: colors.white, edge: colors.borderStrong, text: colors.primary, border: colors.border },
  ghost: { face: 'transparent', edge: 'transparent', text: colors.primary },
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
 * Chunky "3D" button: a face sitting on a darker edge. Pressing pushes the
 * face down onto the edge. Disabled buttons go flat grey.
 */
export function Button({ label, onPress, variant = 'primary', disabled, icon, style, testID, small }: Props) {
  const [pressed, setPressed] = useState(false)
  const p = disabled ? { face: colors.locked, edge: colors.lockedEdge, text: colors.lockedText, border: undefined } : PALETTE[variant]
  const flat = variant === 'ghost'
  const down = pressed && !disabled && !flat
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
      <View style={[styles.edge, { backgroundColor: p.edge, paddingBottom: flat ? 0 : down ? 0 : EDGE, marginTop: down ? EDGE : 0 }]}>
        <View
          style={[
            styles.face,
            small ? styles.faceSmall : null,
            { backgroundColor: p.face, borderColor: p.border ?? p.face, borderWidth: p.border ? 2 : 0, opacity: flat && pressed ? 0.6 : 1 },
          ]}
        >
          {icon}
          <Txt variant="label" color={p.text} style={styles.label}>
            {label}
          </Txt>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  edge: { borderRadius: radius.lg },
  face: { minHeight: 52, borderRadius: radius.lg, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  faceSmall: { minHeight: 40, paddingHorizontal: 14 },
  label: { textTransform: 'uppercase', fontSize: 15 },
})
