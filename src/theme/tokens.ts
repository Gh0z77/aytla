import { Platform, type TextStyle } from 'react-native'

/**
 * Aytla design tokens. Violet is the voice of the brand, lime is the
 * "you said it" accent, everything sits on warm cream instead of white.
 * Surfaces are flat with soft borders; nothing is extruded or glossy.
 */
export const colors = {
  primary: '#5B3FD9',
  primaryEdge: '#4330B3',
  primarySoft: '#E4DEFB',
  primaryTint: '#F3F0FD',

  /** the brand accent: spoken sentences, streak highlights, the mascot's beak */
  lime: '#C8F060',
  limeEdge: '#9AC83A',
  limeSoft: '#EEF9D4',

  success: '#22A559',
  successEdge: '#176B36',
  successSoft: '#DFF5E4',
  successText: '#176B36',

  danger: '#F0563D',
  dangerEdge: '#C23D27',
  dangerSoft: '#FDE4DF',
  dangerText: '#9A2E1D',

  gold: '#F5B021',
  goldEdge: '#C98400',
  goldSoft: '#FDF1CF',

  flame: '#FF7A3D',
  gem: '#22B8CF',
  heart: '#F2568C',
  purple: '#8B5CF6',

  bg: '#FBF8F2',
  /** the pale lavender behind the learning path */
  sky: '#F5F1FA',
  surface: '#F4F0EA',
  card: '#FFFFFF',
  border: '#E8E1D6',
  borderStrong: '#D5CCBE',
  locked: '#ECE7DF',
  lockedEdge: '#D5CCBE',
  lockedText: '#9B9388',

  text: '#1F1838',
  textSoft: '#5A5370',
  textMuted: '#9A94A8',
  white: '#FFFFFF',
  /** dark plum: the games and the camp badges */
  navy: '#1A1430',
} as const

export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const

/** Manrope, one file per weight (loaded in app/_layout.tsx). Until it is loaded the system font is used. */
const NUNITO: Record<string, string> = {
  '400': 'Manrope_500Medium',
  normal: 'Manrope_500Medium',
  '500': 'Manrope_500Medium',
  '600': 'Manrope_600SemiBold',
  '700': 'Manrope_700Bold',
  bold: 'Manrope_700Bold',
  '800': 'Manrope_800ExtraBold',
  '900': 'Manrope_800ExtraBold',
}
let fontsReady = false
export const markFontsReady = () => {
  fontsReady = true
}

export const font = {
  /** the font family for a weight, or undefined while the files are still loading (system font then) */
  family: (weight: TextStyle['fontWeight'] | undefined): string | undefined => (fontsReady ? NUNITO[String(weight ?? '500')] ?? NUNITO['500'] : undefined),
  size: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, hero: 40 },
} as const

/** Max content width so the app reads like a phone column on desktop web. */
export const layout = { column: 560, wide: 1120 } as const

export const EDGE = 4

/** The native animation driver does not exist on the web; asking for it there only logs a warning. */
export const NATIVE_DRIVER = Platform.OS !== 'web'
