import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { CREW, type CharacterId, type Mood } from '../src/ui/mascot/draw'
import { Fonts } from './fonts'
import { MascotSvg } from './MascotSvg'
import { V } from './theme'

/**
 * Building blocks shared by the compositions: a character that enters with a
 * spring, breathes and blinks on a frame clock, a speech bubble that types
 * itself, and a sprinkle of lime sparks for a right answer.
 */

/** eyes closed for 4 frames every ~3 seconds, offset per character so they do not blink together */
export const blinking = (frame: number, offset: number) => (frame + offset) % 92 < 4

export function Character({ id, mood = 'happy', enterAt = 0, size = 260, x, y, offset = 0, bob = 6 }: { id: CharacterId; mood?: Mood; enterAt?: number; size?: number; x: number; y: number; offset?: number; bob?: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame: frame - enterAt, fps, config: { damping: 11, stiffness: 120, mass: 0.8 } })
  const breathe = 1 + 0.02 * Math.sin((frame + offset) / 14)
  const float = bob * Math.sin((frame + offset) / 18)
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: size, height: size, transform: `translateY(${(1 - enter) * 60 + float}px) scale(${enter * breathe})`, transformOrigin: '50% 90%', opacity: Math.min(1, enter * 1.4) }}>
      <MascotSvg id={id} mood={mood} blink={blinking(frame, offset)} size={size} />
    </div>
  )
}

/** a white speech bubble whose text types in, starting at `startAt`, with a smaller second line */
export function Bubble({ text, sub, startAt = 0, x, y, width = 520, scale = 1 }: { text: string; sub?: string; startAt?: number; x: number; y: number; width?: number; scale?: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pop = spring({ frame: frame - startAt, fps, config: { damping: 12, stiffness: 160 } })
  const shown = Math.max(0, Math.floor((frame - startAt - 6) / 1.6))
  const typed = text.slice(0, shown)
  const caret = shown < text.length && Math.floor(frame / 8) % 2 === 0
  return (
    <div style={{ position: 'absolute', left: x, top: y, width, transform: `scale(${pop * scale})`, transformOrigin: '10% 100%', opacity: pop }}>
      <div style={{ background: V.white, borderRadius: 28, borderBottomLeftRadius: 6, padding: '22px 30px', boxShadow: '0 18px 40px rgba(31,24,56,0.18)' }}>
        <div style={{ fontFamily: V.font, fontSize: 40, lineHeight: 1.2, color: V.ink, minHeight: 48 }}>
          {typed}
          {caret ? <span style={{ color: V.violet }}>|</span> : null}
        </div>
        {sub ? <div style={{ fontFamily: V.fontBody, fontSize: 24, color: V.inkSoft, marginTop: 6, opacity: interpolate(frame - startAt, [text.length * 1.6 + 8, text.length * 1.6 + 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{sub}</div> : null}
      </div>
    </div>
  )
}

/** lime sparks bursting from a point: the "you said it" moment */
export function Sparks({ at, x, y, count = 14, radius = 220 }: { at: number; x: number; y: number; count?: number; radius?: number }) {
  const frame = useCurrentFrame()
  const t = frame - at
  if (t < 0 || t > 40) return null
  const p = t / 40
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + (i % 2) * 0.3
        const d = radius * Math.sin((p * Math.PI) / 2)
        const s = 10 + (i % 3) * 5
        return <div key={i} style={{ position: 'absolute', left: x + Math.cos(a) * d - s / 2, top: y + Math.sin(a) * d - s / 2, width: s, height: s, borderRadius: '50%', background: i % 3 === 0 ? V.white : V.lime, opacity: (1 - p) * 0.9, transform: `scale(${1 - p * 0.5})` }} />
      })}
    </>
  )
}

export function Wordmark({ size = 56, color = V.ink, style }: { size?: number; color?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.2, ...style }}>
      <MascotSvg id="everest" mood="talk" size={size * 1.25} />
      <span style={{ fontFamily: V.font, fontSize: size, letterSpacing: -1.5, color }}>aytla</span>
    </div>
  )
}

/** the crew spread along the bottom of a frame, the guide largest and in front */
export function CrewLine({ width, baseline, enterAt = 0, scale = 1, moods }: { width: number; baseline: number; enterAt?: number; scale?: number; moods?: Partial<Record<CharacterId, Mood>> }) {
  const order: CharacterId[] = ['lumi', 'pix', 'everest', 'nubi', 'rocky', 'aero']
  const sizes: Record<CharacterId, number> = { everest: 300, lumi: 200, pix: 200, nubi: 200, rocky: 200, aero: 190 }
  const gap = width / order.length
  return (
    <>
      {order.map((id, i) => {
        const size = sizes[id] * scale
        return <Character key={id} id={id} mood={moods?.[id] ?? (i % 2 ? 'happy' : 'cheer')} enterAt={enterAt + Math.abs(i - 2) * 5} size={size} x={gap * i + gap / 2 - size / 2} y={baseline - size} offset={i * 17} bob={id === 'everest' ? 4 : 7} />
      })}
    </>
  )
}

export const Backdrop = ({ children, color = V.violet }: { children: React.ReactNode; color?: string }) => (
  <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 20% 0%, ${V.violetSoft} 0%, ${color} 55%, ${V.violetDeep} 100%)`, overflow: 'hidden' }}>
    <Fonts />
    {/* soft ground */}
    <div style={{ position: 'absolute', left: '-10%', right: '-10%', bottom: -40, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
    {children}
  </AbsoluteFill>
)

export const crewName = (id: CharacterId) => CREW.find((c) => c.id === id)?.name ?? id
