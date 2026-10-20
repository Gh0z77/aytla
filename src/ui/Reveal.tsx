import { useEffect, useRef, type ReactNode } from 'react'
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native'
import { NATIVE_DRIVER } from '../theme/tokens'

/**
 * Fades and lifts its children in. With `when` it waits for a signal (used on
 * the landing page: a section reveals when it scrolls into view); without it,
 * it plays on mount after `delay` ms, so lists can stagger.
 */
export function Reveal({ children, delay = 0, when = true, distance = 18, style }: { children: ReactNode; delay?: number; when?: boolean; distance?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current
  const played = useRef(false)
  useEffect(() => {
    if (!when || played.current) return
    played.current = true
    Animated.timing(v, { toValue: 1, duration: 520, delay, easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE_DRIVER }).start()
  }, [when, delay, v])
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>{children}</Animated.View>
}

/** A gentle up-and-down float, for mascots that are just standing around. */
export function Float({ children, amplitude = 6, duration = 2200, delay = 0, style }: { children: ReactNode; amplitude?: number; duration?: number; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE_DRIVER }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [v, duration, delay])
  return <Animated.View style={[style, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitude] }) }] }]}>{children}</Animated.View>
}
