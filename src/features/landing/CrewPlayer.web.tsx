import { Player } from '@remotion/player'
import { CREW_STAGE, CrewWave } from '../../../remotion/crew'

export default function CrewPlayer() {
  return <Player component={CrewWave} durationInFrames={CREW_STAGE.durationInFrames} compositionWidth={CREW_STAGE.width} compositionHeight={CREW_STAGE.height} fps={CREW_STAGE.fps} autoPlay loop controls={false} style={{ width: '100%', aspectRatio: `${CREW_STAGE.width} / ${CREW_STAGE.height}` }} />
}
