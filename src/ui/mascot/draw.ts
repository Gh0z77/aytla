/**
 * The Aytla crew as vector drawings. This module knows nothing about React
 * Native or the DOM: it returns a list of gradients and shapes in a 100×100
 * box, and two small renderers turn that into SVG (`ui/Mascot.tsx` for the
 * app through react-native-svg, `remotion/MascotSvg.tsx` for the videos
 * through plain DOM SVG). One drawing, everywhere the same.
 *
 * Six characters after the EVEREST character brief, with an original look:
 * the mountain guide, a sprout, a robot, a cloud, a stone and a spark. Soft
 * gradients, a highlight and a ground shadow give them volume; the shared
 * face carries the moods.
 */
export type CharacterId = 'everest' | 'lumi' | 'pix' | 'nubi' | 'rocky' | 'aero'
export type Mood = 'happy' | 'cheer' | 'sad' | 'think' | 'talk' | 'sleep'

export interface Character {
  id: CharacterId
  name: string
  /** the colour the UI uses for this character (tints, borders) */
  color: string
  shade: string
  light: string
}

export const CREW: Character[] = [
  { id: 'everest', name: "Cho'qqi", color: '#5B3FD9', shade: '#4330B3', light: '#8E7BEA' },
  { id: 'lumi', name: 'Lumi', color: '#4CB84F', shade: '#2F8F33', light: '#A6E28A' },
  { id: 'pix', name: 'Pix', color: '#22B8CF', shade: '#178E9F', light: '#C8F4FA' },
  { id: 'nubi', name: 'Nubi', color: '#F5B021', shade: '#C98400', light: '#FFE39B' },
  { id: 'rocky', name: 'Rokki', color: '#8A8FA3', shade: '#5F6478', light: '#C3C7D4' },
  { id: 'aero', name: 'Uchqun', color: '#FF7A5A', shade: '#D4583B', light: '#FFC2B0' },
]
export const CREW_BY_ID = Object.fromEntries(CREW.map((c) => [c.id, c])) as Record<CharacterId, Character>

export interface Stop {
  offset: number
  color: string
  opacity?: number
}
export type Gradient = { id: string; kind: 'linear'; x1: number; y1: number; x2: number; y2: number; stops: Stop[] } | { id: string; kind: 'radial'; cx: number; cy: number; r: number; stops: Stop[] }

export type Shape =
  | { t: 'circle'; cx: number; cy: number; r: number; fill: string; opacity?: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; opacity?: number; rotate?: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx: number; fill: string; opacity?: number }
  | { t: 'path'; d: string; fill: string; opacity?: number; stroke?: string; width?: number }
  | { t: 'line'; d: string; stroke: string; width: number; opacity?: number }

export interface Drawing {
  defs: Gradient[]
  shapes: Shape[]
}

const INK = '#1F1838'
const WHITE = '#FFFFFF'
const LIME = '#C8F060'
const BLUSH = '#FF8FA3'

const linear = (id: string, from: string, mid: string, to: string): Gradient => ({ id, kind: 'linear', x1: 0.15, y1: 0, x2: 0.85, y2: 1, stops: [{ offset: 0, color: from }, { offset: 0.55, color: mid }, { offset: 1, color: to }] })
const radial = (id: string, color: string, edgeOpacity = 0): Gradient => ({ id, kind: 'radial', cx: 0.5, cy: 0.5, r: 0.5, stops: [{ offset: 0, color, opacity: 1 }, { offset: 1, color, opacity: edgeOpacity }] })

/** y of a point on a smile/frown arc; `curve` > 0 smiles */
const mouthPath = (cx: number, cy: number, w: number, curve: number) => `M${cx - w / 2} ${cy} Q${cx} ${cy + curve} ${cx + w / 2} ${cy}`

interface FaceOptions {
  cx: number
  cy: number
  /** 1 = the default face; smaller for small heads */
  scale?: number
  mood: Mood
  blink: boolean
  /** eyes on a dark screen (the robot) */
  screen?: boolean
  /** the colour behind the eyes, used for the eyelids */
  skin: string
}

function face({ cx, cy, scale = 1, mood, blink, screen, skin }: FaceOptions): Shape[] {
  const s = scale
  const shapes: Shape[] = []
  const eyeDx = 9.5 * s
  const eyeRx = 5.6 * s
  const eyeRy = 6.4 * s
  const closed = blink || mood === 'sleep'
  const arcs = mood === 'cheer' && !blink
  // where the pupils look
  const gaze = mood === 'think' ? { x: 1.6, y: -1.8 } : mood === 'sad' ? { x: 0, y: 1.2 } : { x: 0.6, y: 0.4 }

  // cheeks first, under everything
  for (const side of [-1, 1]) shapes.push({ t: 'ellipse', cx: cx + side * 15.5 * s, cy: cy + 6.5 * s, rx: 4.6 * s, ry: 3 * s, fill: 'url(#blush)', opacity: screen ? 0.5 : 0.75 })

  for (const side of [-1, 1]) {
    const ex = cx + side * eyeDx
    if (arcs) {
      // happy closed eyes: an upturned arc
      shapes.push({ t: 'line', d: `M${ex - 4.2 * s} ${cy + 1.2 * s} Q${ex} ${cy - 5.5 * s} ${ex + 4.2 * s} ${cy + 1.2 * s}`, stroke: screen ? LIME : INK, width: 2.4 * s })
      continue
    }
    if (closed) {
      shapes.push({ t: 'line', d: `M${ex - 4 * s} ${cy + 0.5 * s} Q${ex} ${cy + 3.2 * s} ${ex + 4 * s} ${cy + 0.5 * s}`, stroke: screen ? LIME : INK, width: 2.2 * s })
      continue
    }
    if (screen) {
      // glowing pixel eyes
      shapes.push({ t: 'circle', cx: ex, cy, r: 5.6 * s, fill: LIME, opacity: 0.25 })
      shapes.push({ t: 'circle', cx: ex, cy, r: 3.4 * s, fill: LIME })
      shapes.push({ t: 'circle', cx: ex - 1.1 * s, cy: cy - 1.2 * s, r: 1 * s, fill: WHITE, opacity: 0.9 })
      continue
    }
    const squint = mood === 'think'
    shapes.push({ t: 'ellipse', cx: ex, cy, rx: eyeRx, ry: squint ? eyeRy * 0.72 : eyeRy, fill: WHITE })
    const px = ex + gaze.x * s
    const py = cy + gaze.y * s
    shapes.push({ t: 'circle', cx: px, cy: py, r: 3.3 * s, fill: 'url(#iris)' })
    shapes.push({ t: 'circle', cx: px - 1.2 * s, cy: py - 1.3 * s, r: 1.15 * s, fill: WHITE })
    shapes.push({ t: 'circle', cx: px + 1.3 * s, cy: py + 1.4 * s, r: 0.55 * s, fill: WHITE, opacity: 0.8 })
    if (squint) shapes.push({ t: 'ellipse', cx: ex, cy: cy - eyeRy * 0.85, rx: eyeRx + 0.6, ry: eyeRy * 0.5, fill: skin })
    if (mood === 'sad') {
      // a glisten and a worried brow
      shapes.push({ t: 'ellipse', cx: ex + 1.4 * s, cy: cy + 2.6 * s, rx: 1.6 * s, ry: 1 * s, fill: WHITE, opacity: 0.85 })
      shapes.push({ t: 'line', d: `M${ex - side * 4.5 * s} ${cy - 9.5 * s} L${ex + side * 3.5 * s} ${cy - 7.6 * s}`, stroke: INK, width: 1.8 * s, opacity: 0.8 })
    }
  }

  // mouth
  const my = cy + 8.2 * s
  const ink = screen ? LIME : INK
  switch (mood) {
    case 'cheer':
      shapes.push({ t: 'path', d: `M${cx - 6.5 * s} ${my - 1 * s} Q${cx} ${my + 10 * s} ${cx + 6.5 * s} ${my - 1 * s} Z`, fill: screen ? LIME : INK })
      if (!screen) shapes.push({ t: 'ellipse', cx, cy: my + 4.6 * s, rx: 3.4 * s, ry: 2 * s, fill: BLUSH })
      break
    case 'talk':
      shapes.push({ t: 'ellipse', cx, cy: my + 1.5 * s, rx: 4 * s, ry: 3.6 * s, fill: ink })
      if (!screen) shapes.push({ t: 'ellipse', cx, cy: my + 3.2 * s, rx: 2.4 * s, ry: 1.4 * s, fill: BLUSH })
      break
    case 'sad':
      shapes.push({ t: 'line', d: mouthPath(cx, my + 2 * s, 8 * s, -3.6 * s), stroke: ink, width: 2.2 * s })
      break
    case 'think':
      shapes.push({ t: 'line', d: `M${cx - 3 * s} ${my + 1 * s} L${cx + 3.5 * s} ${my - 0.5 * s}`, stroke: ink, width: 2.2 * s })
      break
    case 'sleep':
      shapes.push({ t: 'line', d: mouthPath(cx, my, 5 * s, 2.2 * s), stroke: ink, width: 2 * s })
      break
    default:
      shapes.push({ t: 'line', d: mouthPath(cx, my, 10 * s, 5 * s), stroke: ink, width: 2.4 * s })
  }
  return shapes
}

/** two capsule arms; raised for a cheer, one reaching forward when sad or thinking */
function arms(cx: number, y: number, halfWidth: number, color: string, mood: Mood, scale = 1): Shape[] {
  const raised = mood === 'cheer'
  const out: Shape[] = []
  for (const side of [-1, 1]) {
    const reach = (mood === 'sad' || mood === 'think') && side === 1
    const rot = raised ? side * 40 : reach ? side * 95 : side * 18
    const ax = cx + side * (halfWidth + 1.5 * scale)
    const ay = raised ? y - 7 * scale : reach ? y - 2 * scale : y
    out.push({ t: 'ellipse', cx: ax, cy: ay, rx: 3.6 * scale, ry: 7.5 * scale, fill: color, rotate: rot })
  }
  return out
}

const shadow = (cx: number, y: number, rx: number): Shape => ({ t: 'ellipse', cx, cy: y, rx, ry: 3.4, fill: INK, opacity: 0.1 })

/** the little extras that speak or sleep */
function extras(mood: Mood): Shape[] {
  if (mood === 'talk') return [0, 1, 2].map((i) => ({ t: 'circle', cx: 84 + i * 5, cy: 26 - i * 8, r: 2 + i * 0.7, fill: LIME }))
  if (mood === 'sleep') return [{ t: 'line', d: 'M78 14 L88 14 L78 24 L88 24', stroke: '#8E7BEA', width: 2 }]
  return []
}

export function drawMascot(id: CharacterId, mood: Mood = 'happy', blink = false): Drawing {
  const c = CREW_BY_ID[id] ?? CREW[0]!
  // gradient ids are global on a web page, so each character gets its own
  const body = `url(#${c.id}-body)`
  const defs: Gradient[] = [
    radial('blush', BLUSH),
    { id: 'iris', kind: 'radial', cx: 0.4, cy: 0.35, r: 0.7, stops: [{ offset: 0, color: '#3B2E63' }, { offset: 1, color: INK }] },
    { id: 'shine', kind: 'radial', cx: 0.5, cy: 0.5, r: 0.5, stops: [{ offset: 0, color: WHITE, opacity: 0.45 }, { offset: 1, color: WHITE, opacity: 0 }] },
    linear(`${c.id}-body`, c.light, c.color, c.shade),
    linear('snow', WHITE, '#F6F4FF', '#DCD6F7'),
    linear('screen', '#2B2250', '#1A1430', '#120E22'),
  ]
  const shapes: Shape[] = []

  switch (c.id) {
    case 'everest': {
      shapes.push(shadow(50, 93, 30))
      // the mountain: rounded peak, soft base
      shapes.push({ t: 'path', d: 'M50 12 C55 12 58 17 60 21 L87 83 C89 87 87 91 83 91 L17 91 C13 91 11 87 13 83 L40 21 C42 17 45 12 50 12 Z', fill: body })
      shapes.push({ t: 'ellipse', cx: 38, cy: 60, rx: 16, ry: 22, fill: 'url(#shine)', rotate: 20 })
      // snow cap with a soft, lumpy edge
      shapes.push({ t: 'path', d: 'M50 12 C55 12 58 17 60 21 L69 41 C66 46 62 41 58 45 C54 49 50 42 46 47 C42 50 38 44 34 46 L31 41 L40 21 C42 17 45 12 50 12 Z', fill: 'url(#snow)' })
      // the summit flag: "you can say it"
      shapes.push({ t: 'line', d: 'M51 12 L51 3', stroke: c.shade, width: 1.6 })
      shapes.push({ t: 'path', d: 'M51.5 3 L62 6 L51.5 9.5 Z', fill: LIME })
      shapes.push(...arms(50, 66, 25, c.shade, mood))
      shapes.push(...face({ cx: 50, cy: 62, mood, blink, skin: c.color }))
      break
    }
    case 'lumi': {
      shapes.push(shadow(50, 92, 27))
      // stem and leaf
      shapes.push({ t: 'rect', x: 48.2, y: 20, w: 3.6, h: 12, rx: 1.8, fill: c.shade })
      shapes.push({ t: 'ellipse', cx: 59, cy: 18, rx: 11, ry: 5.5, fill: body, rotate: -28 })
      shapes.push({ t: 'line', d: 'M51 22 Q59 17 68 14', stroke: c.shade, width: 1, opacity: 0.6 })
      // the seed body
      shapes.push({ t: 'path', d: 'M50 28 C70 28 83 44 83 62 C83 79 69 90 50 90 C31 90 17 79 17 62 C17 44 30 28 50 28 Z', fill: body })
      shapes.push({ t: 'ellipse', cx: 38, cy: 48, rx: 13, ry: 15, fill: 'url(#shine)', rotate: 25 })
      shapes.push({ t: 'ellipse', cx: 50, cy: 76, rx: 17, ry: 9, fill: c.light, opacity: 0.55 })
      shapes.push(...arms(50, 66, 31, c.shade, mood))
      shapes.push(...face({ cx: 50, cy: 58, mood, blink, skin: c.color }))
      break
    }
    case 'pix': {
      shapes.push(shadow(50, 93, 26))
      // antenna
      shapes.push({ t: 'rect', x: 49, y: 10, w: 2.2, h: 12, rx: 1.1, fill: c.shade })
      shapes.push({ t: 'circle', cx: 50.1, cy: 9, r: 6, fill: LIME, opacity: 0.3 })
      shapes.push({ t: 'circle', cx: 50.1, cy: 9, r: 3.6, fill: LIME })
      // head and screen
      shapes.push({ t: 'rect', x: 16, y: 22, w: 68, h: 52, rx: 17, fill: body })
      shapes.push({ t: 'rect', x: 23, y: 29, w: 54, h: 38, rx: 11, fill: 'url(#screen)' })
      shapes.push({ t: 'path', d: 'M28 36 Q40 30 60 31 Q50 36 30 42 Z', fill: WHITE, opacity: 0.12 })
      // base
      shapes.push({ t: 'rect', x: 32, y: 74, w: 36, h: 15, rx: 7.5, fill: c.shade })
      shapes.push({ t: 'rect', x: 40, y: 78, w: 20, h: 3, rx: 1.5, fill: LIME, opacity: 0.8 })
      shapes.push(...arms(50, 60, 33, c.shade, mood))
      shapes.push(...face({ cx: 50, cy: 46, mood, blink, screen: true, skin: '#1A1430' }))
      break
    }
    case 'nubi': {
      shapes.push(shadow(50, 92, 30))
      shapes.push({ t: 'path', d: 'M22 72 C14 72 12 60 22 54 C20 40 34 32 44 40 C50 26 72 28 74 44 C86 42 92 56 84 64 C92 70 86 84 76 82 L26 82 C18 82 16 76 22 72 Z', fill: body })
      shapes.push({ t: 'ellipse', cx: 40, cy: 50, rx: 15, ry: 11, fill: 'url(#shine)', rotate: -15 })
      shapes.push(...arms(50, 70, 31, c.shade, mood))
      shapes.push(...face({ cx: 50, cy: 62, mood, blink, skin: c.color }))
      break
    }
    case 'rocky': {
      shapes.push(shadow(50, 93, 30))
      shapes.push({ t: 'path', d: 'M34 24 L64 19 C72 18 80 26 82 34 L87 68 C89 79 81 89 70 89 L30 89 C19 89 11 80 13 69 L19 36 C21 29 27 25 34 24 Z', fill: body })
      // facets
      shapes.push({ t: 'path', d: 'M34 24 L64 19 L58 34 L30 38 Z', fill: WHITE, opacity: 0.18 })
      shapes.push({ t: 'path', d: 'M82 34 L87 68 L74 60 Z', fill: INK, opacity: 0.08 })
      shapes.push({ t: 'ellipse', cx: 38, cy: 50, rx: 13, ry: 14, fill: 'url(#shine)', rotate: 15 })
      // moss
      shapes.push({ t: 'ellipse', cx: 44, cy: 21, rx: 9, ry: 3.6, fill: '#6FBF5A' })
      shapes.push({ t: 'ellipse', cx: 56, cy: 19, rx: 6, ry: 3, fill: '#8BD36F' })
      shapes.push(...arms(50, 66, 34, c.shade, mood))
      shapes.push(...face({ cx: 50, cy: 58, mood, blink, skin: c.color }))
      break
    }
    case 'aero': {
      shapes.push(shadow(50, 93, 24))
      shapes.push({ t: 'path', d: 'M50 6 C56 26 66 36 92 50 C66 64 56 74 50 94 C44 74 34 64 8 50 C34 36 44 26 50 6 Z', fill: body })
      shapes.push({ t: 'ellipse', cx: 42, cy: 40, rx: 12, ry: 13, fill: 'url(#shine)', rotate: 25 })
      // sparkle
      shapes.push({ t: 'path', d: 'M74 22 C75 26 76 27 80 28 C76 29 75 30 74 34 C73 30 72 29 68 28 C72 27 73 26 74 22 Z', fill: WHITE, opacity: 0.9 })
      shapes.push(...arms(50, 62, 20, c.shade, mood, 0.9))
      shapes.push(...face({ cx: 50, cy: 52, scale: 0.9, mood, blink, skin: c.color }))
      break
    }
  }
  shapes.push(...extras(mood))
  return { defs, shapes }
}
