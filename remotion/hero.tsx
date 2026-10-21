import { Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Fonts } from './fonts'
import { Backdrop, Bubble, Character, Sparks } from './scenes'
import { V } from './theme'

/**
 * The website hero, 1200×900, 10 s loop: the guide says a sentence, the
 * learner picks the answer, the waveform listens, the lesson counter ticks.
 * Everything floats a little so the frame never looks like a screenshot.
 */
export type HeroSentence = {
  sentence: string
  translation: string
  options: string[]
  /** index of the option that gets the check mark */
  answer: number
}

export const HERO = { width: 1200, height: 900, fps: 30, durationInFrames: 300 }

const CHECK_AT = 72

export function HeroLoop({ sentences }: { sentences: HeroSentence[] }) {
  const frame = useCurrentFrame()
  const per = Math.floor(HERO.durationInFrames / sentences.length)
  const i = Math.min(sentences.length - 1, Math.floor(frame / per))
  const local = frame - i * per
  const current = sentences[i]!
  const checked = local >= CHECK_AT
  return (
    <Backdrop>
      <Fonts />
      <Orb x={120} y={560} size={110} color="#D6F77A" dark="#9CCB2E" offset={0} />
      <Orb x={620} y={520} size={64} color="#9C86FF" dark="#5B3FD9" offset={40} />
      <Orb x={1000} y={620} size={88} color="#FFD36A" dark="#E59A00" offset={80} />
      <Orb x={560} y={140} size={38} color="#C8F060" dark="#86B130" offset={120} />
      {/* the stage */}
      <div style={{ position: 'absolute', left: 170, top: 690, width: 540, height: 150, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,255,255,0.28), rgba(255,255,255,0.06) 70%, rgba(255,255,255,0) 100%)' }} />
      <Character id="everest" mood={checked && local < CHECK_AT + 40 ? 'cheer' : 'talk'} enterAt={0} size={400} x={230} y={320} bob={5} />

      <Sequence from={i * per} durationInFrames={per} layout="none">
        <Bubble text={current.sentence} sub={current.translation} startAt={0} x={70} y={70} width={520} />
        <Options options={current.options} answer={current.answer} x={760} y={190} />
      </Sequence>

      <Waveform x={70} y={735} active={local < CHECK_AT} />
      <LessonCard x={880} y={720} index={i} total={sentences.length} checked={checked} />
      {checked && local < CHECK_AT + 30 ? <Sparks at={i * per + CHECK_AT} x={1000} y={300} count={12} radius={150} /> : null}
    </Backdrop>
  )
}

/** a glossy ball that drifts up and down */
function Orb({ x, y, size, color, dark, offset }: { x: number; y: number; size: number; color: string; dark: string; offset: number }) {
  const frame = useCurrentFrame()
  const dy = Math.sin((frame + offset) / 22) * 10
  return <div style={{ position: 'absolute', left: x, top: y + dy, width: size, height: size, borderRadius: '50%', background: `radial-gradient(circle at 32% 28%, #ffffff 0%, ${color} 28%, ${dark} 100%)`, boxShadow: '0 24px 40px rgba(20,12,60,0.35)' }} />
}

/** three answers; the right one gets its check after CHECK_AT frames */
function Options({ options, answer, x, y }: { options: string[]; answer: number; x: number; y: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 370, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {options.map((text, k) => {
        const enter = spring({ frame: frame - 10 - k * 6, fps, config: { damping: 14, stiffness: 140 } })
        const on = k === answer && frame >= CHECK_AT
        const pop = spring({ frame: frame - CHECK_AT, fps, config: { damping: 9, stiffness: 220 } })
        return (
          <div key={text} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '18px 22px', borderRadius: 22, background: on ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.14)', border: `2px solid ${on ? V.lime : 'rgba(255,255,255,0.28)'}`, color: on ? V.ink : V.white, fontFamily: V.fontBody, fontSize: 26, opacity: enter, transform: `translateX(${(1 - enter) * 40}px)`, boxShadow: on ? '0 16px 30px rgba(20,12,60,0.25)' : 'none' }}>
            <span>{text}</span>
            <span style={{ width: 30, height: 30, borderRadius: '50%', border: `2px solid ${on ? V.lime : 'rgba(255,255,255,0.5)'}`, background: on ? V.lime : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: on ? `scale(${0.6 + pop * 0.4})` : 'none', flexShrink: 0 }}>
              {on ? (
                <svg width="16" height="16" viewBox="0 0 16 16">
                  <path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke={V.ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** the listening bars */
function Waveform({ x, y, active }: { x: number; y: number; active: boolean }) {
  const frame = useCurrentFrame()
  const bars = 30
  return (
    <div style={{ position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'center', gap: 16, padding: '18px 26px', borderRadius: 26, background: V.white, boxShadow: '0 18px 36px rgba(20,12,60,0.22)' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#EDE8FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-6 9a6 6 0 0 0 12 0M12 18v3" fill="none" stroke={V.violet} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 44 }}>
        {Array.from({ length: bars }, (_, k) => {
          const h = active ? 8 + 32 * Math.abs(Math.sin(frame / 3.2 + k * 0.65) * Math.sin(frame / 11 + k * 0.2)) : 8
          return <div key={k} style={{ width: 5, height: h, borderRadius: 3, background: V.violet, opacity: 0.55 + 0.45 * (h / 40) }} />
        })}
      </div>
    </div>
  )
}

/** "today's lesson 1/3" */
function LessonCard({ x, y, index, total, checked }: { x: number; y: number; index: number; total: number; checked: boolean }) {
  const frame = useCurrentFrame()
  const fade = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 250, padding: '18px 22px', borderRadius: 22, background: V.white, boxShadow: '0 18px 36px rgba(20,12,60,0.22)', opacity: fade, fontFamily: V.fontBody }}>
      <div style={{ fontSize: 20, color: V.inkSoft }}>Bugungi dars</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <div style={{ fontFamily: V.font, fontSize: 30, color: V.ink }}>
          {index + 1}/{total}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: total }, (_, k) => (
            <div key={k} style={{ width: 16, height: 16, borderRadius: '50%', background: k < index || (k === index && checked) ? V.lime : '#E4DEFB' }} />
          ))}
        </div>
      </div>
    </div>
  )
}
