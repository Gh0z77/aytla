import { Composition } from 'remotion'
import { CrewIntro, FEEDBACK, HERO, HeroLoop, Reactions, SQUARE, STORY, SentenceOfDay } from './compositions'

/**
 * Remotion entry: the videos for social media and the website hero.
 *
 *   npx remotion studio                       preview and tweak
 *   npx remotion render CrewIntro out/intro.mp4
 *   npx remotion render SentenceOfDay out/sentence.mp4 --props='{"sentence":"...","translation":"...","label":"..."}'
 *
 * Every composition draws the same crew as the app (src/ui/mascot/draw.ts).
 */
export const HERO_SENTENCES = [
  { sentence: 'Hello! How are you?', translation: "Salom! Qalaysiz? — birinchi darsning birinchi gapi" },
  { sentence: "I'd like a coffee, please.", translation: "Menga kofe bering, iltimos. — 2-bosqich" },
  { sentence: 'Could you say that again?', translation: "Yana bir marta aytib bera olasizmi? — haqiqiy suhbat" },
]

export const RemotionRoot = () => (
  <>
    <Composition id="HeroLoop" component={HeroLoop} {...HERO} defaultProps={{ sentences: HERO_SENTENCES }} />
    <Composition id="CrewIntro" component={CrewIntro} {...STORY} defaultProps={{ title: 'Ingliz tilida birinchi kundan gapiring.', subtitle: "Har dars gapirish bilan tugaydi. Yo'l sizning maqsadingizga qarab quriladi. O'zbek tilida tushuntiriladi.", handle: '@aytla_app' }} />
    <Composition id="SentenceOfDay" component={SentenceOfDay} {...SQUARE} defaultProps={{ sentence: 'Hello! How are you?', translation: 'Salom! Qalaysiz?', label: 'Bugungi gap' }} />
    <Composition id="Reactions" component={Reactions} {...FEEDBACK} defaultProps={{ right: "Zo'r!", wrong: "Bo'ladi, yana bir bor" }} />
  </>
)
