import { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { NATIVE_DRIVER, colors } from '../theme/tokens'

const PALETTE = [colors.primary, colors.lime, colors.gold, colors.heart, colors.gem, colors.flame]

/** A burst of falling paper for a finished lesson. Decorative only: it never catches taps. */
export function Confetti({ count = 26, width = 360, height = 420 }: { count?: number; width?: number; height?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (i / count) * width + (((i * 37) % 23) - 11),
        drift: ((i * 53) % 60) - 30,
        size: 6 + ((i * 7) % 6),
        color: PALETTE[i % PALETTE.length] as string,
        delay: (i * 41) % 400,
        spin: ((i * 29) % 2 === 0 ? 1 : -1) * (180 + ((i * 17) % 360)),
      })),
    [count, width]
  )
  const v = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE_DRIVER }).start()
  }, [v])
  return (
    <View style={[styles.layer, { width, height }]} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: -20,
            width: p.size,
            height: p.size * 1.6,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: v.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40 - p.delay / 4] }) },
              { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({ layer: { position: 'absolute', top: 0, alignSelf: 'center', overflow: 'hidden' } })
