import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import type { CharacterId } from '../core/types'
import { NATIVE_DRIVER, colors } from '../theme/tokens'

/**
 * The Aytla crew: six creatures drawn with plain views, so they render the
 * same on the web, Android and iOS and need no image files. They follow the
 * EVEREST character brief (guide, motivator, smart one, optimist, strong one,
 * explorer) with an original look: a mountain, a sprout, a robot, a cloud, a
 * rock and a spark. One shared face gives them moods; `AnimatedMascot` adds
 * breathing, blinking and the reactions to right and wrong answers.
 */
export type Mood = 'happy' | 'cheer' | 'sad' | 'think' | 'talk' | 'sleep'

export const GUIDES: Array<{ id: CharacterId; name: string; color: string; shade: string; light: string }> = [
  { id: 'everest', name: "Cho'qqi", color: '#5B3FD9', shade: '#4330B3', light: '#8E7BEA' },
  { id: 'lumi', name: 'Lumi', color: '#4CB84F', shade: '#2F8F33', light: '#A6E28A' },
  { id: 'pix', name: 'Pix', color: '#22B8CF', shade: '#178E9F', light: '#C8F4FA' },
  { id: 'nubi', name: 'Nubi', color: '#F5B021', shade: '#C98400', light: '#FFE39B' },
  { id: 'rocky', name: 'Rokki', color: '#8A8FA3', shade: '#5F6478', light: '#C3C7D4' },
  { id: 'aero', name: 'Uchqun', color: '#FF7A5A', shade: '#D4583B', light: '#FFC2B0' },
]
const BY_ID = Object.fromEntries(GUIDES.map((g) => [g.id, g])) as Record<CharacterId, (typeof GUIDES)[number]>

interface Props {
  id: CharacterId
  size?: number
  mood?: Mood
  /** eyes closed for a blink (driven by AnimatedMascot) */
  blink?: boolean
  style?: StyleProp<ViewStyle>
}

/** The face every creature shares: eyes, cheeks and a mouth that follows the mood. */
function Face({ s, cx, cy, mood, blink, dark }: { s: number; cx: number; cy: number; mood: Mood; blink: boolean; dark?: boolean }) {
  const eye = s * 0.15
  const pupil = eye * 0.52
  const closed = blink || mood === 'sleep'
  const squint = mood === 'think'
  const up = mood === 'cheer'
  const mouthW = s * (mood === 'cheer' || mood === 'talk' ? 0.16 : 0.12)
  return (
    <>
      {[-1, 1].map((side) => (
        <View key={side} style={[styles.abs, { left: cx + side * s * 0.13 - eye / 2, top: cy - eye / 2, width: eye, height: closed ? eye * 0.18 : squint ? eye * 0.5 : eye, borderRadius: eye / 2, backgroundColor: dark ? colors.lime : colors.white, overflow: 'hidden' }]}>
          {!closed ? (
            <>
              <View style={[styles.abs, { left: eye * 0.26 + (mood === 'sad' ? 0 : side * eye * 0.06), top: up ? eye * 0.08 : squint ? eye * 0.1 : eye * 0.26, width: pupil, height: pupil, borderRadius: pupil / 2, backgroundColor: dark ? colors.navy : colors.text }]} />
              <View style={[styles.abs, { left: eye * 0.52, top: up ? eye * 0.12 : eye * 0.3, width: pupil * 0.3, height: pupil * 0.3, borderRadius: pupil, backgroundColor: colors.white }]} />
            </>
          ) : null}
        </View>
      ))}
      {/* cheeks */}
      {[-1, 1].map((side) => (
        <View key={`c${side}`} style={[styles.abs, { left: cx + side * s * 0.22 - s * 0.045, top: cy + s * 0.08, width: s * 0.09, height: s * 0.06, borderRadius: s * 0.045, backgroundColor: '#FF8FA3', opacity: 0.55 }]} />
      ))}
      {/* mouth: a half ring, smiling or not */}
      {mood === 'sad' ? (
        <View style={[styles.abs, { left: cx - mouthW / 2, top: cy + s * 0.13, width: mouthW, height: mouthW / 2, borderTopLeftRadius: mouthW, borderTopRightRadius: mouthW, borderWidth: s * 0.022, borderBottomWidth: 0, borderColor: dark ? colors.lime : colors.text, backgroundColor: 'transparent' }]} />
      ) : mood === 'talk' || mood === 'cheer' ? (
        <View style={[styles.abs, { left: cx - mouthW / 2, top: cy + s * 0.11, width: mouthW, height: mouthW * 0.7, borderBottomLeftRadius: mouthW, borderBottomRightRadius: mouthW, borderTopLeftRadius: mouthW * 0.2, borderTopRightRadius: mouthW * 0.2, backgroundColor: dark ? colors.lime : colors.text }]}>
          <View style={[styles.abs, { left: mouthW * 0.2, bottom: 0, width: mouthW * 0.6, height: mouthW * 0.3, borderTopLeftRadius: mouthW, borderTopRightRadius: mouthW, backgroundColor: '#FF8FA3' }]} />
        </View>
      ) : (
        <View style={[styles.abs, { left: cx - mouthW / 2, top: cy + s * 0.09, width: mouthW, height: mouthW / 2, borderBottomLeftRadius: mouthW, borderBottomRightRadius: mouthW, borderWidth: s * 0.022, borderTopWidth: 0, borderColor: dark ? colors.lime : colors.text, backgroundColor: 'transparent' }]} />
      )}
    </>
  )
}

/** Little arms: down by default, up when cheering. */
function Arms({ s, cy, color, mood }: { s: number; cy: number; color: string; mood: Mood }) {
  const up = mood === 'cheer'
  return (
    <>
      {[-1, 1].map((side) => (
        <View key={side} style={[styles.abs, { left: s * 0.5 + side * s * 0.4 - s * 0.06, top: up ? cy - s * 0.02 : cy + s * 0.12, width: s * 0.12, height: s * 0.22, borderRadius: s * 0.06, backgroundColor: color, transform: [{ rotate: `${side * (up ? -35 : 25)}deg` }] }]} />
      ))}
    </>
  )
}

export function Mascot({ id, size = 96, mood = 'happy', blink = false, style }: Props) {
  const g = BY_ID[id] ?? GUIDES[0]!
  const s = size
  const face = { s, mood, blink }
  let body: React.ReactNode
  switch (g.id) {
    case 'everest': // a mountain with a snow cap: the guide
      body = (
        <>
          <View style={[styles.abs, styles.tri, { left: s * 0.08, top: s * 0.12, borderLeftWidth: s * 0.42, borderRightWidth: s * 0.42, borderBottomWidth: s * 0.8, borderBottomColor: g.color }]} />
          <View style={[styles.abs, styles.tri, { left: s * 0.3, top: s * 0.12, borderLeftWidth: s * 0.2, borderRightWidth: s * 0.2, borderBottomWidth: s * 0.34, borderBottomColor: colors.white }]} />
          <Arms s={s} cy={s * 0.52} color={g.shade} mood={mood} />
          <Face {...face} cx={s * 0.5} cy={s * 0.6} />
        </>
      )
      break
    case 'lumi': // a sprout: round body, leaf on top
      body = (
        <>
          <View style={[styles.abs, { left: s * 0.47, top: s * 0.1, width: s * 0.06, height: s * 0.16, borderRadius: s * 0.03, backgroundColor: g.shade }]} />
          <View style={[styles.abs, { left: s * 0.5, top: s * 0.02, width: s * 0.26, height: s * 0.14, borderRadius: s * 0.13, backgroundColor: g.light, transform: [{ rotate: '-30deg' }] }]} />
          <View style={[styles.abs, { left: s * 0.12, top: s * 0.22, width: s * 0.76, height: s * 0.72, borderRadius: s * 0.38, backgroundColor: g.color }]} />
          <View style={[styles.abs, { left: s * 0.28, top: s * 0.6, width: s * 0.44, height: s * 0.28, borderRadius: s * 0.22, backgroundColor: g.light, opacity: 0.8 }]} />
          <Arms s={s} cy={s * 0.5} color={g.shade} mood={mood} />
          <Face {...face} cx={s * 0.5} cy={s * 0.5} />
        </>
      )
      break
    case 'pix': // a robot: square head, antenna, screen face
      body = (
        <>
          <View style={[styles.abs, { left: s * 0.48, top: s * 0.04, width: s * 0.04, height: s * 0.14, backgroundColor: g.shade }]} />
          <View style={[styles.abs, { left: s * 0.43, top: s * 0, width: s * 0.14, height: s * 0.14, borderRadius: s * 0.07, backgroundColor: colors.lime }]} />
          <View style={[styles.abs, { left: s * 0.12, top: s * 0.16, width: s * 0.76, height: s * 0.6, borderRadius: s * 0.2, backgroundColor: g.light, borderWidth: s * 0.03, borderColor: g.color }]} />
          <View style={[styles.abs, { left: s * 0.2, top: s * 0.26, width: s * 0.6, height: s * 0.4, borderRadius: s * 0.12, backgroundColor: colors.navy }]} />
          <View style={[styles.abs, { left: s * 0.28, top: s * 0.78, width: s * 0.44, height: s * 0.18, borderRadius: s * 0.08, backgroundColor: g.color }]} />
          <Arms s={s} cy={s * 0.46} color={g.color} mood={mood} />
          <Face {...face} cx={s * 0.5} cy={s * 0.44} dark />
        </>
      )
      break
    case 'nubi': // a cloud: overlapping puffs
      body = (
        <>
          {[
            [0.08, 0.42, 0.42],
            [0.5, 0.42, 0.42],
            [0.25, 0.18, 0.5],
            [0.14, 0.55, 0.72],
          ].map(([x, y, w], i) => (
            <View key={i} style={[styles.abs, { left: s * (x as number), top: s * (y as number), width: s * (w as number), height: s * (i === 3 ? 0.34 : (w as number)), borderRadius: s * 0.5, backgroundColor: g.color }]} />
          ))}
          <Arms s={s} cy={s * 0.5} color={g.shade} mood={mood} />
          <Face {...face} cx={s * 0.5} cy={s * 0.55} />
        </>
      )
      break
    case 'rocky': // a rock with a bandana
      body = (
        <>
          <View style={[styles.abs, { left: s * 0.1, top: s * 0.16, width: s * 0.8, height: s * 0.76, borderTopLeftRadius: s * 0.3, borderTopRightRadius: s * 0.42, borderBottomLeftRadius: s * 0.4, borderBottomRightRadius: s * 0.28, backgroundColor: g.color }]} />
          <View style={[styles.abs, { left: s * 0.18, top: s * 0.26, width: s * 0.2, height: s * 0.14, borderRadius: s * 0.1, backgroundColor: g.light, opacity: 0.6 }]} />
          <View style={[styles.abs, { left: s * 0.1, top: s * 0.3, width: s * 0.8, height: s * 0.1, backgroundColor: colors.primary }]} />
          <View style={[styles.abs, { left: s * 0.78, top: s * 0.26, width: s * 0.16, height: s * 0.08, borderRadius: s * 0.04, backgroundColor: colors.primary, transform: [{ rotate: '25deg' }] }]} />
          <Arms s={s} cy={s * 0.52} color={g.shade} mood={mood} />
          <Face {...face} cx={s * 0.5} cy={s * 0.58} />
        </>
      )
      break
    default: // a spark: a round body with a trail of sparks
      body = (
        <>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.abs, { left: s * (0.02 + i * 0.08), top: s * (0.72 - i * 0.14), width: s * (0.08 + i * 0.05), height: s * (0.08 + i * 0.05), borderRadius: s, backgroundColor: colors.gold, opacity: 0.5 + i * 0.2 }]} />
          ))}
          {[0, 45, 90, 135].map((deg) => (
            <View key={deg} style={[styles.abs, { left: s * 0.44, top: s * 0.06, width: s * 0.12, height: s * 0.96, borderRadius: s * 0.06, backgroundColor: g.light, transform: [{ rotate: `${deg}deg` }] }]} />
          ))}
          <View style={[styles.abs, { left: s * 0.17, top: s * 0.21, width: s * 0.66, height: s * 0.66, borderRadius: s * 0.33, backgroundColor: g.color }]} />
          <Arms s={s} cy={s * 0.5} color={g.shade} mood={mood} />
          <Face {...face} cx={s * 0.5} cy={s * 0.52} />
        </>
      )
  }
  return (
    <View style={[{ width: s, height: s }, style]} accessibilityLabel={g.name} accessibilityRole="image">
      {body}
      {mood === 'talk' ? [0, 1, 2].map((i) => <View key={i} style={[styles.abs, { left: s * (0.86 + i * 0.05), top: s * (0.3 - i * 0.09), width: s * (0.05 + i * 0.015), height: s * (0.05 + i * 0.015), borderRadius: s, backgroundColor: colors.lime }]} />) : null}
      {mood === 'sleep' ? <View style={[styles.abs, { left: s * 0.8, top: s * 0.06, width: s * 0.12, height: s * 0.12, borderRadius: s * 0.06, backgroundColor: colors.primarySoft }]} /> : null}
    </View>
  )
}

export type Reaction = 'correct' | 'wrong' | 'celebrate' | null

interface AnimatedProps extends Omit<Props, 'blink'> {
  /** a one-shot reaction; change the value (or a `key`) to replay it */
  react?: Reaction
  /** breathing and blinking while nothing else happens */
  idle?: boolean
}

/**
 * The living version: breathes and blinks on its own, jumps for a right
 * answer, shakes (and looks sad) for a wrong one, bounces for a celebration.
 */
export function AnimatedMascot({ react = null, idle = true, mood = 'happy', ...rest }: AnimatedProps) {
  const y = useRef(new Animated.Value(0)).current
  const x = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(1)).current
  const tilt = useRef(new Animated.Value(0)).current
  const [blink, setBlink] = useState(false)
  const [reactMood, setReactMood] = useState<Mood | null>(null)

  // breathing
  useEffect(() => {
    if (!idle) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.035, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(scale, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [idle, scale])

  // blinking, at irregular intervals
  useEffect(() => {
    if (!idle) return
    let timer: ReturnType<typeof setTimeout>
    let alive = true
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return
        setBlink(true)
        setTimeout(() => alive && setBlink(false), 130)
        schedule()
      }, 2200 + Math.random() * 2600)
    }
    schedule()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [idle])

  // reactions
  useEffect(() => {
    if (!react) return
    x.setValue(0)
    y.setValue(0)
    tilt.setValue(0)
    if (react === 'wrong') {
      setReactMood('sad')
      Animated.sequence([
        Animated.timing(x, { toValue: -8, duration: 60, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(x, { toValue: 8, duration: 60, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(x, { toValue: -6, duration: 60, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(x, { toValue: 6, duration: 60, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(x, { toValue: 0, duration: 60, useNativeDriver: NATIVE_DRIVER }),
      ]).start(() => setTimeout(() => setReactMood(null), 1200))
      return
    }
    setReactMood('cheer')
    const hop = (height: number) =>
      Animated.sequence([
        Animated.timing(y, { toValue: -height, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(y, { toValue: 0, duration: 220, easing: Easing.bounce, useNativeDriver: NATIVE_DRIVER }),
      ])
    Animated.parallel([
      Animated.sequence([hop(react === 'celebrate' ? 22 : 14), hop(react === 'celebrate' ? 16 : 8)]),
      Animated.sequence([
        Animated.timing(tilt, { toValue: 1, duration: 200, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(tilt, { toValue: -1, duration: 200, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(tilt, { toValue: 0, duration: 200, useNativeDriver: NATIVE_DRIVER }),
      ]),
    ]).start(() => setTimeout(() => setReactMood(null), react === 'celebrate' ? 2500 : 900))
  }, [react, x, y, tilt])

  const rotate = tilt.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] })
  return (
    <Animated.View style={{ transform: [{ translateX: x }, { translateY: y }, { scale }, { rotate }] }}>
      <Mascot {...rest} mood={reactMood ?? mood} blink={blink} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  tri: { width: 0, height: 0, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderStyle: 'solid' },
})
