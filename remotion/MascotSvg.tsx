import { useId, type CSSProperties } from 'react'
import { drawMascot, type CharacterId, type Mood } from '../src/ui/mascot/draw'

/**
 * The crew for the DOM: the same drawing as the app (`src/ui/mascot/draw.ts`)
 * rendered as a plain <svg>, so Remotion compositions and the landing page's
 * animated hero show exactly the characters learners meet in the lessons.
 */
export function MascotSvg({ id, mood = 'happy', blink = false, size = 200, style }: { id: CharacterId; mood?: Mood; blink?: boolean; size?: number; style?: CSSProperties }) {
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, '') + '-'
  const { defs, shapes } = drawMascot(id, mood, blink, prefix)
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', ...style }} aria-hidden>
      <defs>
        {defs.map((g) =>
          g.kind === 'linear' ? (
            <linearGradient key={g.id} id={g.id} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
              {g.stops.map((st, i) => (
                <stop key={i} offset={st.offset} stopColor={st.color} stopOpacity={st.opacity ?? 1} />
              ))}
            </linearGradient>
          ) : (
            <radialGradient key={g.id} id={g.id} cx={g.cx} cy={g.cy} r={g.r}>
              {g.stops.map((st, i) => (
                <stop key={i} offset={st.offset} stopColor={st.color} stopOpacity={st.opacity ?? 1} />
              ))}
            </radialGradient>
          )
        )}
      </defs>
      {shapes.map((s, i) => {
        switch (s.t) {
          case 'circle':
            return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} opacity={s.opacity ?? 1} />
          case 'ellipse':
            return <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={s.fill} opacity={s.opacity ?? 1} transform={s.rotate ? `rotate(${s.rotate} ${s.cx} ${s.cy})` : undefined} />
          case 'rect':
            return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.fill} opacity={s.opacity ?? 1} />
          case 'path':
            return <path key={i} d={s.d} fill={s.fill} opacity={s.opacity ?? 1} stroke={s.stroke} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />
          case 'line':
            return <path key={i} d={s.d} fill="none" stroke={s.stroke} strokeWidth={s.width} opacity={s.opacity ?? 1} strokeLinecap="round" strokeLinejoin="round" />
        }
      })}
    </svg>
  )
}
