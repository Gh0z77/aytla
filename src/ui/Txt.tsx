import { Text, type TextProps, type TextStyle } from 'react-native'
import { colors, font } from '../theme/tokens'

type Variant = 'hero' | 'title' | 'heading' | 'body' | 'label' | 'caption'

const VARIANTS: Record<Variant, TextStyle> = {
  hero: { fontSize: font.size.hero, fontWeight: '800', lineHeight: 46, letterSpacing: -0.5 },
  title: { fontSize: font.size.xxl, fontWeight: '800', lineHeight: 34 },
  heading: { fontSize: font.size.xl, fontWeight: '700', lineHeight: 28 },
  body: { fontSize: font.size.md, fontWeight: '500', lineHeight: 24 },
  label: { fontSize: font.size.sm, fontWeight: '700', lineHeight: 20, letterSpacing: 0.4 },
  caption: { fontSize: font.size.xs, fontWeight: '600', lineHeight: 16 },
}

interface Props extends TextProps {
  variant?: Variant
  color?: string
  center?: boolean
}

/** The one text component: consistent type scale and the system font stack on the web. */
export function Txt({ variant = 'body', color = colors.text, center, style, ...rest }: Props) {
  return <Text {...rest} style={[{ fontFamily: font.regular, color }, VARIANTS[variant], center ? { textAlign: 'center' } : null, style]} />
}
