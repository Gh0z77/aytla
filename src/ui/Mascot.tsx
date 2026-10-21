import { useEffect, useId, useRef, useState } from 'react'
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import type { CharacterId } from '../core/types'
import { NATIVE_DRIVER } from '../theme/tokens'
import { CREW, CREW_BY_ID, drawMascot, type Gradient, type Mood, type Shape } from './mascot/draw'

/**
 * The Aytla crew in the app. The drawing itself lives in `mascot/draw.ts`
 * (shared with the Remotion videos); this file renders it with
 * react-native-svg and adds life: `AnimatedMascot` breathes, blinks and
 * reacts to right and wrong answers.
 */
export type { Mood } from './mascot/draw'
export const GUIDES = CREW

interface Props {
  id: CharacterId
  size?: number
  mood?: Mood
  /** eyes closed for a blink (driven by AnimatedMascot) */
  blink?: boolean
  style?: StyleProp<ViewStyle>
}

function GradientDef({ g }: { g: Gradient }) {
  const stops = g.stops.map((st, i) => <Stop key={i} offset={st.offset} stopColor={st.color} stopOpacity={st.opacity ?? 1} />)
  if (g.kind === 'linear') {
    return (
      <LinearGradient id={g.id} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
        {stops}
      </LinearGradient>
    )
  }
  return (
    <RadialGradient id={g.id} cx={g.cx} cy={g.cy} r={g.r}>
      {stops}
    </RadialGradient>
  )
}

function ShapeView({ s }: { s: Shape }) {
  switch (s.t) {
    case 'circle':
      return <Circle cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} opacity={s.opacity ?? 1} />
    case 'ellipse':
      return <Ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.fill} opacity={s.opacity ?? 1} transform={s.rotate ? `rotate(${s.rotate} ${s.cx} ${s.cy})` : undefined} />
    case 'rect':
      return <Rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.fill} opacity={s.opacity ?? 1} />
    case 'path':
      return <Path d={s.d} fill={s.fill} opacity={s.opacity ?? 1} stroke={s.stroke} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />
    case 'line':
      return <Path d={s.d} fill="none" stroke={s.stroke} strokeWidth={s.width} opacity={s.opacity ?? 1} strokeLinecap="round" strokeLinejoin="round" />
  }
}

export function Mascot({ id, size = 96, mood = 'happy', blink = false, style }: Props) {
  // ids must be unique per instance on the web (see drawMascot); useId gives ":r1:", not valid in url(#)
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, '') + '-'
  const { defs, shapes } = drawMascot(id, mood, blink, prefix)
  const name = (CREW_BY_ID[id] ?? CREW[0]!).name
  return (
    <View style={[{ width: size, height: size }, style]} accessibilityLabel={name} accessibilityRole="image">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          {defs.map((g) => (
            <GradientDef key={g.id} g={g} />
          ))}
        </Defs>
        {shapes.map((s, i) => (
          <ShapeView key={i} s={s} />
        ))}
      </Svg>
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

