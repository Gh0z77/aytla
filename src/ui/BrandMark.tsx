import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'

/**
 * The brand mark: a speech bubble on violet. "Aytla" is "say it"; the bubble
 * is the promise. (The app icon stays Cho'qqi, the guide.)
 */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="brand-bg" x1={0} y1={0} x2={1} y2={1}>
          <Stop offset={0} stopColor="#7A5CF0" />
          <Stop offset={1} stopColor="#4330B3" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={100} height={100} rx={26} fill="url(#brand-bg)" />
      <Path d="M30 26 H70 C78 26 84 32 84 40 V56 C84 64 78 70 70 70 H46 L32 80 L34 70 C26 69 20 63 20 55 V40 C20 32 24 26 30 26 Z" fill="#FFFFFF" />
      <Path d="M38 52 Q52 64 66 52" fill="none" stroke="#5B3FD9" strokeWidth={5} strokeLinecap="round" />
      <Circle cx={40} cy={43} r={4} fill="#5B3FD9" />
      <Circle cx={64} cy={43} r={4} fill="#5B3FD9" />
      <Circle cx={80} cy={22} r={7} fill="#C8F060" />
    </Svg>
  )
}
