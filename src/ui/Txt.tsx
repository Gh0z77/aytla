import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native'
import { colors, font } from '../theme/tokens'

type Variant = 'hero' | 'title' | 'heading' | 'body' | 'label' | 'caption'

const VARIANTS: Record<Variant, TextStyle> = {
  hero: { fontSize: font.size.hero, fontWeight: '900', lineHeight: 46, letterSpacing: -0.5 },
  title: { fontSize: font.size.xxl, fontWeight: '800', lineHeight: 34 },
  heading: { fontSize: font.size.xl, fontWeight: '800', lineHeight: 28 },
  body: { fontSize: font.size.md, fontWeight: '600', lineHeight: 24 },
  label: { fontSize: font.size.sm, fontWeight: '800', lineHeight: 20, letterSpacing: 0.4 },
  caption: { fontSize: font.size.xs, fontWeight: '700', lineHeight: 16 },
}

interface Props extends TextProps {
  variant?: Variant
  color?: string
  center?: boolean
}

/**
 * The one text component. Every weight is a separate Nunito file (custom fonts
 * have no synthetic bold on Android), so the family is picked from the final
 * fontWeight after all style overrides, and callers keep writing `fontWeight`.
 */
export function Txt({ variant = 'body', color = colors.text, center, style, ...rest }: Props) {
  const merged = StyleSheet.flatten([VARIANTS[variant], style]) ?? {}
  const family = font.family(merged.fontWeight)
  return <Text {...rest} style={[{ color }, VARIANTS[variant], center ? { textAlign: 'center' } : null, style, family ? { fontFamily: family } : null]} />
}
