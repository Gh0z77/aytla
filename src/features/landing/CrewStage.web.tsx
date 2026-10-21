import { Suspense, lazy } from 'react'
import { CrewStage as Still } from './CrewStage'

const Player = lazy(() => import('./CrewPlayer.web'))

/** The crew section on the web: the Remotion composition, the static row until it has loaded. */
export function CrewStage() {
  return (
    <Suspense fallback={<Still />}>
      <Player />
    </Suspense>
  )
}
