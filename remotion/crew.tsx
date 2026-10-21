import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { CREW, type CharacterId } from '../src/ui/mascot/draw'
import { Character, Sparks } from './scenes'
import { V } from './theme'

/**
 * The crew on the website, 1200×380, transparent: the six characters line
 * up, breathe, and take turns waving (cheering) so the row is never still.
 */
export const CREW_STAGE = { width: 1200, height: 380, fps: 30, durationInFrames: 240 }

const ORDER: CharacterId[] = ['everest', 'lumi', 'pix', 'nubi', 'rocky', 'aero']
const TURN = 40

export function CrewWave() {
  const frame = useCurrentFrame()
  const active = Math.floor(frame / TURN) % ORDER.length
  const gap = CREW_STAGE.width / ORDER.length
  const size = 200
  return (
    <AbsoluteFill style={{ background: 'transparent', overflow: 'hidden' }}>
      {ORDER.map((id, i) => {
        const x = gap * i + gap / 2 - size / 2
        const on = i === active
        return (
          <div key={id}>
            <Character id={id} mood={on ? 'cheer' : i % 2 ? 'happy' : 'talk'} enterAt={i * 4} size={size} x={x} y={70} offset={i * 23} bob={on ? 2 : 6} />
            <div style={{ position: 'absolute', left: gap * i, top: 300, width: gap, textAlign: 'center', fontFamily: V.font, fontSize: 24, color: V.ink }}>{CREW.find((c) => c.id === id)?.name}</div>
            {on ? <Sparks at={active * TURN} x={x + size / 2} y={150} count={8} radius={110} /> : null}
          </div>
        )
      })}
    </AbsoluteFill>
  )
}
