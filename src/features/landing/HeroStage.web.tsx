import { Player } from '@remotion/player'
import { HERO, HeroLoop } from '../../../remotion/hero'
import { HERO_SENTENCES } from '../../../remotion/Root'

/**
 * The website hero: the same Remotion composition that renders the social
 * videos, played live in the page. Loops silently, no controls.
 */
export function HeroStage() {
  return (
    <Player component={HeroLoop} inputProps={{ sentences: HERO_SENTENCES }} durationInFrames={HERO.durationInFrames} compositionWidth={HERO.width} compositionHeight={HERO.height} fps={HERO.fps} autoPlay loop controls={false} style={{ width: '100%', height: '100%' }} />
  )
}
