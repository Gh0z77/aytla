import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { Fonts } from './fonts'
import { Backdrop, Bubble, Character, CrewLine, Sparks, Wordmark } from './scenes'
import { V } from './theme'

/**
 * The social-media compositions, rendered to MP4 with
 * `npx remotion render <id> out/<file>.mp4` (see remotion/Root.tsx). The
 * website hero lives in hero.tsx.
 */

export type SentenceProps = {
  sentence: string
  translation: string
}

export const STORY = { width: 1080, height: 1920, fps: 30, durationInFrames: 240 }

/** 8 s vertical story: wordmark, the crew arrives, the promise, the handle */
export function CrewIntro({ title, subtitle, handle }: { title: string; subtitle: string; handle: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const titleIn = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 110 } })
  const subIn = spring({ frame: frame - 40, fps, config: { damping: 14, stiffness: 110 } })
  const handleIn = interpolate(frame, [150, 170], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <Backdrop>
      <Wordmark size={64} color={V.white} style={{ position: 'absolute', left: 80, top: 90, opacity: titleIn }} />
      <div style={{ position: 'absolute', left: 80, right: 80, top: 320, transform: `translateY(${(1 - titleIn) * 40}px)`, opacity: titleIn }}>
        <div style={{ fontFamily: V.font, fontSize: 92, lineHeight: 1.05, letterSpacing: -2, color: V.white }}>{title}</div>
      </div>
      <div style={{ position: 'absolute', left: 80, right: 80, top: 640, transform: `translateY(${(1 - subIn) * 30}px)`, opacity: subIn }}>
        <div style={{ fontFamily: V.fontBody, fontSize: 40, lineHeight: 1.35, color: 'rgba(255,255,255,0.85)' }}>{subtitle}</div>
      </div>
      <CrewLine width={STORY.width} baseline={STORY.height - 420} enterAt={55} scale={1.15} />
      <Sparks at={95} x={STORY.width / 2} y={STORY.height - 650} count={18} radius={320} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 170, textAlign: 'center', opacity: handleIn }}>
        <span style={{ fontFamily: V.font, fontSize: 44, color: V.ink, background: V.lime, borderRadius: 999, padding: '18px 44px' }}>{handle}</span>
      </div>
    </Backdrop>
  )
}

export const SQUARE = { width: 1080, height: 1080, fps: 30, durationInFrames: 210 }

/** 7 s square post: the sentence of the day, said by the guide, with its translation */
export type SentenceOfDayProps = SentenceProps & { label: string }

export function SentenceOfDay({ sentence, translation, label }: SentenceOfDayProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const labelIn = spring({ frame, fps, config: { damping: 14 } })
  const done = sentence.length * 1.6 + 30
  return (
    <AbsoluteFill style={{ background: V.cream, overflow: 'hidden' }}>
      <Fonts />
      <Wordmark size={44} style={{ position: 'absolute', left: 64, top: 60 }} />
      <div style={{ position: 'absolute', right: 64, top: 64, fontFamily: V.font, fontSize: 28, color: V.violet, background: '#EDE8FF', borderRadius: 999, padding: '12px 26px', opacity: labelIn }}>{label}</div>
      <Bubble text={sentence} sub={translation} startAt={20} x={360} y={300} width={640} scale={1.1} />
      <Character id="everest" mood={frame > done ? 'cheer' : 'talk'} enterAt={4} size={420} x={-10} y={SQUARE.height - 470} />
      <Sparks at={done} x={240} y={SQUARE.height - 320} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, textAlign: 'center', fontFamily: V.fontBody, fontSize: 28, color: V.inkSoft, opacity: interpolate(frame, [done, done + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>aytla.app</div>
    </AbsoluteFill>
  )
}

export const FEEDBACK = { width: 1080, height: 1080, fps: 30, durationInFrames: 150 }

/** 5 s clip: right answer vs wrong answer, the two reactions side by side (for the "no punishment" message) */
export function Reactions({ right, wrong }: { right: string; wrong: string }) {
  const frame = useCurrentFrame()
  const phase = frame < 75 ? 'right' : 'wrong'
  const local = frame % 75
  const shake = phase === 'wrong' && local > 12 && local < 30 ? Math.sin(local * 2.2) * 14 : 0
  const hop = phase === 'right' && local > 12 && local < 36 ? -Math.abs(Math.sin(((local - 12) / 24) * Math.PI)) * 70 : 0
  const color = phase === 'right' ? '#EAF8C7' : '#FDE2DD'
  const text = phase === 'right' ? right : wrong
  return (
    <AbsoluteFill style={{ background: color, overflow: 'hidden' }}>
      <Fonts />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center', fontFamily: V.font, fontSize: 72, color: phase === 'right' ? '#2F8F33' : '#B3261E' }}>{text}</div>
      <div style={{ position: 'absolute', left: 290, top: 340, transform: `translate(${shake}px, ${hop}px)` }}>
        <MascotLarge mood={phase === 'right' ? (local > 12 ? 'cheer' : 'happy') : local > 12 ? 'sad' : 'happy'} />
      </div>
      {phase === 'right' ? <Sparks at={14} x={540} y={520} count={18} radius={300} /> : null}
    </AbsoluteFill>
  )
}

const MascotLarge = ({ mood }: { mood: 'happy' | 'cheer' | 'sad' }) => <Character id="everest" mood={mood} size={500} x={0} y={0} bob={0} />
