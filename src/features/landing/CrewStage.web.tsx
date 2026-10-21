import { Player } from '@remotion/player'
import { CREW_STAGE, CrewWave } from '../../../remotion/crew'

/** The crew section on the web: the Remotion composition, looping, transparent over the page. */
export function CrewStage() {
  return <Player component={CrewWave} durationInFrames={CREW_STAGE.durationInFrames} compositionWidth={CREW_STAGE.width} compositionHeight={CREW_STAGE.height} fps={CREW_STAGE.fps} autoPlay loop controls={false} style={{ width: '100%', aspectRatio: `${CREW_STAGE.width} / ${CREW_STAGE.height}` }} />
}
