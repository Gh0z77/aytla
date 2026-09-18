import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { colors, radius } from '../theme/tokens'

interface Props {
  /** 0..1 */
  value: number
  color?: string
  track?: string
  height?: number
}

/** Animated progress bar with the glossy highlight learners expect from a lesson header. */
export function ProgressBar({ value, color = colors.success, track = colors.border, height = 16 }: Props) {
  const clamped = Math.max(0, Math.min(1, value))
  const anim = useRef(new Animated.Value(clamped)).current

  useEffect(() => {
    Animated.timing(anim, { toValue: clamped, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [anim, clamped])

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
  return (
    <View style={[styles.track, { backgroundColor: track, height, borderRadius: radius.pill }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}>
      <Animated.View style={[styles.fill, { width, backgroundColor: color, borderRadius: radius.pill }]}>
        <View style={[styles.shine, { borderRadius: radius.pill }]} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  track: { flex: 1, overflow: 'hidden' },
  fill: { height: '100%', minWidth: 0 },
  shine: { position: 'absolute', left: 8, right: 8, top: 3, height: 4, backgroundColor: 'rgba(255,255,255,0.35)' },
})
