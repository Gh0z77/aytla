import { Suspense, lazy } from 'react'
import { HeroStage as Still } from './HeroStage'

// Remotion and its player are a few hundred kilobytes: they arrive after the page has painted
const Player = lazy(() => import('./HeroPlayer.web'))

/** The website hero: the Remotion loop, with the static crew until it has loaded. */
export function HeroStage() {
  return (
    <Suspense fallback={<Still />}>
      <Player />
    </Suspense>
  )
}
