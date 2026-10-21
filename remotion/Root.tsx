import { Composition } from 'remotion'
import { CrewIntro, FEEDBACK, Reactions, SQUARE, STORY, SentenceOfDay } from './compositions'
import { CREW_STAGE, CrewWave } from './crew'
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
const HERO_EN = [
  { sentence: 'Hello! How are you?', options: ["I'm good, thanks!", "I'm great!", 'Not bad, and you?'], answer: 0 },
  { sentence: "I'd like a coffee, please.", options: ['Sure, small or large?', 'Here you are.', 'Anything else?'], answer: 0 },
  { sentence: 'Could you say that again?', options: ['Of course!', 'Sorry, no.', 'Maybe later.'], answer: 0 },
]
const HERO_TRANSLATIONS: Record<'uz' | 'ru' | 'tr', string[]> = {
  uz: ['Salom! Qalaysiz?', 'Menga kofe bering, iltimos.', 'Yana bir marta aytib bera olasizmi?'],
  ru: ['Привет! Как дела?', 'Мне кофе, пожалуйста.', 'Не могли бы вы повторить?'],
  tr: ['Merhaba! Nasılsın?', 'Bir kahve alabilir miyim, lütfen?', 'Tekrar söyleyebilir misiniz?'],
}
/** the three hero sentences with their translation in the visitor's language */
export const heroSentences = (lang: 'uz' | 'ru' | 'tr'): HeroSentence[] => HERO_EN.map((s, i) => ({ ...s, translation: HERO_TRANSLATIONS[lang][i] ?? '' }))
export const HERO_SENTENCES = heroSentences('uz')

export const RemotionRoot = () => (
  <>
    <Composition id="HeroLoop" component={HeroLoop} {...HERO} defaultProps={{ sentences: HERO_SENTENCES }} />
    <Composition id="CrewWave" component={CrewWave} {...CREW_STAGE} />
    <Composition id="CrewIntro" component={CrewIntro} {...STORY} defaultProps={{ title: 'Ingliz tilida birinchi kundan gapiring.', subtitle: "Har dars gapirish bilan tugaydi. Yo'l sizning maqsadingizga qarab quriladi. O'zbek tilida tushuntiriladi.", handle: '@aytla_app' }} />
    <Composition id="SentenceOfDay" component={SentenceOfDay} {...SQUARE} defaultProps={{ sentence: 'Hello! How are you?', translation: 'Salom! Qalaysiz?', label: 'Bugungi gap', site: '@aytla_app' }} />
    <Composition id="Reactions" component={Reactions} {...FEEDBACK} defaultProps={{ right: "Zo'r!", wrong: "Bo'ladi, yana bir bor" }} />
  </>
)
