import { Composition } from 'remotion'
import { CrewIntro, FEEDBACK, Reactions, SQUARE, STORY, SentenceOfDay } from './compositions'
import { HERO, HeroLoop, type HeroSentence } from './hero'

/**
 * Remotion entry: the videos for social media and the website hero.
 *
 *   npx remotion studio                       preview and tweak
 *   npx remotion render CrewIntro out/intro.mp4
 *   npx remotion render SentenceOfDay out/sentence.mp4 --props='{"sentence":"...","translation":"...","label":"..."}'
 *
 * Every composition draws the same crew as the app (src/ui/mascot/draw.ts).
 */
export const HERO_SENTENCES: HeroSentence[] = [
  { sentence: 'Hello! How are you?', translation: 'Salom! Qalaysiz?', options: ["I'm good, thanks!", "I'm great!", 'Not bad, and you?'], answer: 0 },
  { sentence: "I'd like a coffee, please.", translation: 'Menga kofe bering, iltimos.', options: ['Sure, small or large?', 'Here you are.', 'Anything else?'], answer: 0 },
  { sentence: 'Could you say that again?', translation: 'Yana bir marta aytib bera olasizmi?', options: ['Of course!', 'Sorry, no.', 'Maybe later.'], answer: 0 },
]

export const RemotionRoot = () => (
  <>
    <Composition id="HeroLoop" component={HeroLoop} {...HERO} defaultProps={{ sentences: HERO_SENTENCES }} />
    <Composition id="CrewIntro" component={CrewIntro} {...STORY} defaultProps={{ title: 'Ingliz tilida birinchi kundan gapiring.', subtitle: "Har dars gapirish bilan tugaydi. Yo'l sizning maqsadingizga qarab quriladi. O'zbek tilida tushuntiriladi.", handle: '@aytla_app' }} />
    <Composition id="SentenceOfDay" component={SentenceOfDay} {...SQUARE} defaultProps={{ sentence: 'Hello! How are you?', translation: 'Salom! Qalaysiz?', label: 'Bugungi gap' }} />
    <Composition id="Reactions" component={Reactions} {...FEEDBACK} defaultProps={{ right: "Zo'r!", wrong: "Bo'ladi, yana bir bor" }} />
  </>
)
