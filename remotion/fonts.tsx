import { useEffect, useState } from 'react'
import { continueRender, delayRender, staticFile } from 'remotion'

/**
 * Manrope for the renders. The website already has the font (expo-font
 * registers the same family names), so the Player on the landing page needs
 * nothing; the CLI render runs in a bare browser and loads the files from
 * public/fonts. The frame is held until the fonts are ready.
 */
const FACES = [
  { family: 'Manrope_800ExtraBold', file: 'fonts/Manrope_800ExtraBold.ttf' },
  { family: 'Manrope_600SemiBold', file: 'fonts/Manrope_600SemiBold.ttf' },
]

export function Fonts() {
  const [handle] = useState(() => delayRender('loading Manrope'))
  useEffect(() => {
    let alive = true
    Promise.all(
      FACES.map(async (f) => {
        // (document.fonts.check is no test: it also answers true when the family is unknown)
        if ([...document.fonts].some((face) => face.family === f.family)) return
        const face = new FontFace(f.family, `url(${staticFile(f.file)})`)
        await face.load()
        document.fonts.add(face)
      })
    )
      .catch(() => undefined)
      .finally(() => alive && continueRender(handle))
    return () => {
      alive = false
    }
  }, [handle])
  return null
}
