import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import type { CharacterId } from '../core/types'
import { colors } from '../theme/tokens'

/**
 * Ayti, the Aytla bird, drawn with plain views so it renders identically on
 * the web, Android and iOS with no image assets. Six colourways share one
 * character; the learner picks the colour, the units use the one that fits
 * their topic. "mood" changes the eyes and adds the talking dots.
 */
export type Mood = 'happy' | 'cheer' | 'think' | 'talk' | 'sleep'

export const GUIDES: Array<{ id: CharacterId; name: string; body: string; shade: string; belly: string }> = [
  { id: 'everest', name: 'Ayti', body: '#5B3FD9', shade: '#4330B3', belly: '#8E7BEA' },
  { id: 'lumi', name: 'Limon', body: '#8BC53F', shade: '#6A9E2B', belly: '#C8F060' },
  { id: 'pix', name: 'Dengiz', body: '#22B8CF', shade: '#178E9F', belly: '#7FE0EC' },
  { id: 'nubi', name: 'Osmon', body: '#4FA3F5', shade: '#2F7FD0', belly: '#A6D1FB' },
  { id: 'rocky', name: 'Shaftoli', body: '#FF7A5A', shade: '#D4583B', belly: '#FFB39E' },
  { id: 'aero', name: 'Zar', body: '#F5B021', shade: '#C98400', belly: '#FFD978' },
]

const BY_ID = Object.fromEntries(GUIDES.map((g) => [g.id, g])) as Record<CharacterId, (typeof GUIDES)[number]>

interface Props {
  id: CharacterId
  size?: number
  mood?: Mood
  style?: StyleProp<ViewStyle>
}

export function Mascot({ id, size = 96, mood = 'happy', style }: Props) {
  const g = BY_ID[id] ?? GUIDES[0]!
  const s = size
  const body = s * 0.78
  const eye = s * 0.19
  const pupil = s * 0.095
  const squint = mood === 'sleep' || mood === 'think'
  const lookUp = mood === 'cheer'
  return (
    <View style={[{ width: s, height: s }, style]} accessibilityLabel={g.name} accessibilityRole="image">
      {/* tuft */}
      <View style={[styles.abs, { left: s * 0.42, top: s * 0.04, width: s * 0.16, height: s * 0.16, backgroundColor: g.shade, transform: [{ rotate: '45deg' }], borderRadius: s * 0.03 }]} />
      {/* body */}
      <View style={[styles.abs, { left: (s - body) / 2, top: s * 0.14, width: body, height: body, borderRadius: body / 2, backgroundColor: g.body }]} />
      {/* belly */}
      <View style={[styles.abs, { left: s * 0.3, top: s * 0.5, width: s * 0.4, height: s * 0.36, borderRadius: s * 0.2, backgroundColor: g.belly, opacity: 0.9 }]} />
      {/* wing */}
      <View style={[styles.abs, { left: s * 0.08, top: s * 0.48, width: s * 0.22, height: s * 0.34, borderRadius: s * 0.12, backgroundColor: g.shade, transform: [{ rotate: '-18deg' }] }]} />
      {/* eyes */}
      {[0.27, 0.54].map((x, i) => (
        <View key={i} style={[styles.abs, { left: s * x, top: s * 0.3, width: eye, height: squint ? eye * 0.35 : eye, borderRadius: eye / 2, backgroundColor: colors.white, overflow: 'hidden' }]}>
          {!squint ? (
            <>
              <View style={[styles.abs, { left: eye * 0.3, top: lookUp ? eye * 0.1 : eye * 0.3, width: pupil, height: pupil, borderRadius: pupil / 2, backgroundColor: colors.text }]} />
              <View style={[styles.abs, { left: eye * 0.52, top: lookUp ? eye * 0.14 : eye * 0.34, width: pupil * 0.3, height: pupil * 0.3, borderRadius: pupil, backgroundColor: colors.white }]} />
            </>
          ) : (
            <View style={[styles.abs, { left: 0, right: 0, top: eye * 0.1, height: eye * 0.12, backgroundColor: colors.text }]} />
          )}
        </View>
      ))}
      {/* cheeks */}
      <View style={[styles.abs, { left: s * 0.2, top: s * 0.5, width: s * 0.1, height: s * 0.07, borderRadius: s * 0.05, backgroundColor: '#FF8FA3', opacity: 0.55 }]} />
      <View style={[styles.abs, { left: s * 0.7, top: s * 0.5, width: s * 0.1, height: s * 0.07, borderRadius: s * 0.05, backgroundColor: '#FF8FA3', opacity: 0.55 }]} />
      {/* beak: the lime accent, open a little when talking */}
      <View style={[styles.abs, { left: s * 0.43, top: s * 0.47, width: s * 0.14, height: s * 0.14, backgroundColor: colors.lime, transform: [{ rotate: '45deg' }], borderRadius: s * 0.02 }]} />
      {mood === 'talk' || mood === 'cheer' ? <View style={[styles.abs, { left: s * 0.46, top: s * 0.56, width: s * 0.08, height: s * 0.05, borderRadius: s * 0.03, backgroundColor: g.shade }]} /> : null}
      {/* feet */}
      <View style={[styles.abs, { left: s * 0.34, top: s * 0.89, width: s * 0.12, height: s * 0.07, borderRadius: s * 0.035, backgroundColor: colors.gold }]} />
      <View style={[styles.abs, { left: s * 0.54, top: s * 0.89, width: s * 0.12, height: s * 0.07, borderRadius: s * 0.035, backgroundColor: colors.gold }]} />
      {/* talking dots */}
      {mood === 'talk'
        ? [0, 1, 2].map((i) => <View key={i} style={[styles.abs, { left: s * (0.86 + i * 0.05), top: s * (0.34 - i * 0.09), width: s * (0.05 + i * 0.015), height: s * (0.05 + i * 0.015), borderRadius: s, backgroundColor: colors.lime }]} />)
        : null}
      {mood === 'sleep' ? <View style={[styles.abs, { left: s * 0.8, top: s * 0.12, width: s * 0.12, height: s * 0.12, borderRadius: s * 0.06, backgroundColor: colors.primarySoft }]} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({ abs: { position: 'absolute' } })
