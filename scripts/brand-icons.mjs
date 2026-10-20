/**
 * Renders the Aytla app icons from code (no image tooling needed): Cho'qqi,
 * the mountain guide, on cream. Writes PNGs with Node's zlib only.
 *
 *   node scripts/brand-icons.mjs
 *
 * Outputs (assets/images): icon.png 1024 (iOS, square, opaque),
 * android-icon-foreground.png 1024 (light mountain on transparent, inside the safe zone),
 * android-icon-background.png 1024 (solid violet), android-icon-monochrome.png
 * 1024 (white mountain on transparent), splash-icon.png 512 (mountain on transparent),
 * favicon.png 64 (icon).
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images')

const VIOLET = [0x5b, 0x3f, 0xd9]
const SHADE = [0x43, 0x30, 0xb3]
const CREAM = [0xfb, 0xf8, 0xf2]
const LIME = [0xc8, 0xf0, 0x60]
const INK = [0x1f, 0x18, 0x38]
const GOLD = [0xf5, 0xb0, 0x21]
const WHITE = [0xff, 0xff, 0xff]

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
const crc32 = (buf) => {
  let c = -1
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

/** A canvas of shapes, painted in order with 4x supersampling for smooth edges. */
function render(size, shapes, background) {
  const ss = 4
  const px = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = (x + (sx + 0.5) / ss) / size
          const v = (y + (sy + 0.5) / ss) / size
          let c = background ? [...background, 1] : [0, 0, 0, 0]
          for (const s of shapes) if (s.hit(u, v)) c = [...s.color, 1]
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3]
        }
      }
      const n = ss * ss
      const i = (y * size + x) * 4
      if (a > 0) { px[i] = Math.round(r / a); px[i + 1] = Math.round(g / a); px[i + 2] = Math.round(b / a) }
      px[i + 3] = Math.round((a / n) * 255)
    }
  }
  return png(size, size, px)
}

const circle = (cx, cy, r, color) => ({ color, hit: (u, v) => (u - cx) ** 2 + (v - cy) ** 2 <= r * r })
const ellipse = (cx, cy, rx, ry, color, rot = 0) => ({
  color,
  hit: (u, v) => {
    const du = u - cx, dv = v - cy
    const c = Math.cos(rot), s = Math.sin(rot)
    const x = du * c + dv * s, y = -du * s + dv * c
    return (x / rx) ** 2 + (y / ry) ** 2 <= 1
  },
})
const diamond = (cx, cy, r, color) => ({ color, hit: (u, v) => Math.abs(u - cx) + Math.abs(v - cy) <= r })
const roundedSquare = (r, color) => ({ color, hit: (u, v) => { const x = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0), y = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0); return x * x + y * y <= r * r } })

const triangle = (ax, ay, bx, by, cx, cy, color) => ({
  color,
  hit: (u, v) => {
    const d1 = (u - bx) * (ay - by) - (ax - bx) * (v - by)
    const d2 = (u - cx) * (by - cy) - (bx - cx) * (v - cy)
    const d3 = (u - ax) * (cy - ay) - (cx - ax) * (v - ay)
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
  },
})

/**
 * Cho'qqi, the mountain guide (src/ui/Mascot.tsx), centred in a box from
 * (ox, oy) with side `s` (fractions of the canvas). `body` is the mountain
 * colour; `mono` paints everything white.
 */
function mountain(ox, oy, s, body = VIOLET, mono = false) {
  const P = (f) => ox + f * s, Q = (f) => oy + f * s
  const col = (c) => (mono ? WHITE : c)
  const shapes = [
    triangle(P(0.5), Q(0.06), P(0.04), Q(0.94), P(0.96), Q(0.94), col(body)),
    // snow cap with a soft, lumpy edge
    triangle(P(0.5), Q(0.06), P(0.29), Q(0.42), P(0.71), Q(0.42), col(mono ? body : WHITE)),
    circle(P(0.33), Q(0.41), 0.055 * s, col(mono ? body : WHITE)),
    circle(P(0.44), Q(0.44), 0.06 * s, col(mono ? body : WHITE)),
    circle(P(0.56), Q(0.44), 0.06 * s, col(mono ? body : WHITE)),
    circle(P(0.67), Q(0.41), 0.055 * s, col(mono ? body : WHITE)),
  ]
  if (!mono) {
    for (const ex of [0.37, 0.63]) {
      shapes.push(circle(P(ex), Q(0.62), 0.085 * s, WHITE))
      shapes.push(circle(P(ex + 0.012), Q(0.63), 0.044 * s, INK))
      shapes.push(circle(P(ex + 0.032), Q(0.605), 0.014 * s, WHITE))
    }
    shapes.push(ellipse(P(0.24), Q(0.74), 0.05 * s, 0.032 * s, [0xff, 0x8f, 0xa3]))
    shapes.push(ellipse(P(0.76), Q(0.74), 0.05 * s, 0.032 * s, [0xff, 0x8f, 0xa3]))
    // smile: a dark disc with the body colour laid back over its top half
    shapes.push(circle(P(0.5), Q(0.76), 0.062 * s, INK))
    shapes.push(circle(P(0.5), Q(0.725), 0.065 * s, body))
    // a lime flag on the summit: "you can say it"
    shapes.push(ellipse(P(0.5), Q(0.06), 0.012 * s, 0.07 * s, SHADE))
    shapes.push(triangle(P(0.505), Q(-0.01), P(0.505), Q(0.07), P(0.64), Q(0.03), LIME))
  }
  return shapes
}

const LIGHT = [0x8e, 0x7b, 0xea]
const files = {
  'icon.png': render(1024, mountain(0.12, 0.12, 0.76), CREAM),
  'android-icon-foreground.png': render(1024, mountain(0.25, 0.25, 0.5, LIGHT), null),
  'android-icon-background.png': render(64, [], VIOLET),
  'android-icon-monochrome.png': render(1024, mountain(0.25, 0.25, 0.5, WHITE, true), null),
  'splash-icon.png': render(512, mountain(0.05, 0.05, 0.9, LIGHT), null), // the splash background is violet
  'favicon.png': render(64, [roundedSquare(0.22, CREAM), ...mountain(0.1, 0.1, 0.8)], null),
}
for (const [name, buf] of Object.entries(files)) {
  writeFileSync(path.join(out, name), buf)
  console.log(`${name} ${buf.length} bytes`)
}
