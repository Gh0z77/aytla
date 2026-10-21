import { Player } from '@remotion/player'
import { HERO, HeroLoop } from '../../../remotion/hero'
import { heroSentences } from '../../../remotion/Root'
import { useT } from '../../i18n'
import { useApp } from '../../state/store'

export default function HeroPlayer() {
  const t = useT()
  const lang = useApp((st) => st.user.profile.baseLang)
  return <Player component={HeroLoop} inputProps={{ sentences: heroSentences(lang), lessonLabel: t('landing.hero.lesson') }} durationInFrames={HERO.durationInFrames} compositionWidth={HERO.width} compositionHeight={HERO.height} fps={HERO.fps} autoPlay loop controls={false} style={{ width: '100%', height: '100%' }} />
}
