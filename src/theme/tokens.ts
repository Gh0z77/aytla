import { Platform } from 'react-native'

/**
 * Design tokens. EVEREST brand blue leads; feedback colours (green / red /
 * gold) follow the conventions learners already know from language apps.
 * Every pressable surface has a darker "edge" colour for the chunky 3D look.
 */
export const colors = {
  primary: '#2563EB',
  primaryEdge: '#1E40AF',
  primarySoft: '#DBEAFE',
  primaryTint: '#EFF6FF',

  success: '#22C55E',
  successEdge: '#15803D',
  successSoft: '#DCFCE7',
  successText: '#166534',

  danger: '#EF4444',
  dangerEdge: '#B91C1C',
  dangerSoft: '#FEE2E2',
  dangerText: '#991B1B',

  gold: '#FBBF24',
  goldEdge: '#D97706',
  goldSoft: '#FEF3C7',

  flame: '#F97316',
  gem: '#38BDF8',
  heart: '#F43F5E',
  purple: '#8B5CF6',

  bg: '#FFFFFF',
  surface: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  locked: '#E2E8F0',
  lockedEdge: '#CBD5E1',
  lockedText: '#94A3B8',

  text: '#0F172A',
  textSoft: '#475569',
  textMuted: '#94A3B8',
  white: '#FFFFFF',
  navy: '#0B1220',
} as const

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const

export const font = {
  regular: Platform.select({ web: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', default: undefined }),
  size: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, hero: 40 },
} as const

/** Max content width so the app reads like a phone column on desktop web. */
export const layout = { column: 560, wide: 1120 } as const

export const EDGE = 4

/** The native animation driver does not exist on the web; asking for it there only logs a warning. */
export const NATIVE_DRIVER = Platform.OS !== 'web'
