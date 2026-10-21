import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useRef, useState, type ReactNode } from 'react'
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native'
import { BASE_LANGS, TARGET_LANGS, type BaseLang, type TargetLang } from '../../core/types'
import { COURSE } from '../../content/course'
import { LANGUAGE_NAMES, TARGET_NAMES, useT, type StringKey } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, layout, radius, space } from '../../theme/tokens'
import { BrandMark } from '../../ui/BrandMark'
import { Button } from '../../ui/Button'
import { AnimatedMascot } from '../../ui/Mascot'
import { Float, Reveal } from '../../ui/Reveal'
import { Txt } from '../../ui/Txt'
import { CrewStage } from './CrewStage'
import { Badge, Note, Orb, PhoneFrame, Strip, WhyCards } from './extras'
import { HeroStage } from './HeroStage'
import { LandingDemo } from './LandingDemo'
import { FaqSection, PricingSection } from './sections'

/**
 * The website. A sticky navigation with section links, a hero that plays the
 * product (the Remotion loop on the web), four promises, the real first
 * exercise next to the app itself, the reasons, the crew, the price, the
 * questions and a full footer.
 */
type Anchor = 'top' | 'how' | 'price' | 'faq'
const NAV: Array<{ key: Anchor; label: StringKey }> = [
  { key: 'top', label: 'landing.nav.home' },
  { key: 'how', label: 'landing.nav.how' },
  { key: 'price', label: 'landing.nav.price' },
  { key: 'faq', label: 'landing.nav.faq' },
]
// social links come from the environment, so nothing points at an account that does not exist yet
type Social = { icon: keyof typeof Ionicons.glyphMap; url: string; label: string }
const SOCIAL: Social[] = (
  [
    { icon: 'paper-plane', url: process.env.EXPO_PUBLIC_SOCIAL_TELEGRAM ?? '', label: 'Telegram' },
    { icon: 'logo-instagram', url: process.env.EXPO_PUBLIC_SOCIAL_INSTAGRAM ?? '', label: 'Instagram' },
    { icon: 'logo-youtube', url: process.env.EXPO_PUBLIC_SOCIAL_YOUTUBE ?? '', label: 'YouTube' },
  ] satisfies Social[]
).filter((s) => s.url.startsWith('https://'))
const PHONE_SHOT = require('../../../assets/images/shots/learn.jpg') as number

/** Reveals its children once the page has scrolled far enough for them to be in view. */
function OnScroll({ seen, delay = 0, style, onLayout, children }: { seen: number; delay?: number; style?: StyleProp<ViewStyle>; onLayout?: (e: LayoutChangeEvent) => void; children: ReactNode }) {
  const [top, setTop] = useState<number | null>(null)
  return (
    <View
      style={style}
      onLayout={(e) => {
        setTop((prev) => prev ?? e.nativeEvent.layout.y)
        onLayout?.(e)
      }}
    >
      <Reveal when={top !== null && seen > top + 40} delay={delay} distance={24}>
        {children}
      </Reveal>
    </View>
  )
}

/** the interface language: a small dropdown (the menu is a modal, so it floats above the sticky bar) */
function LangDropdown({ lang, onPick, names, up }: { lang: BaseLang; onPick: (l: BaseLang) => void; names: boolean; up?: boolean }) {
  const [open, setOpen] = useState(false)
  const button = useRef<View>(null)
  const [at, setAt] = useState({ x: 0, y: 0, w: 0, h: 0 })
  const show = () => {
    button.current?.measureInWindow((x, y, w, h) => {
      setAt({ x, y, w, h })
      setOpen(true)
    })
  }
  return (
    <>
      <Pressable ref={button} accessibilityRole="button" accessibilityLabel={LANGUAGE_NAMES[lang].name} accessibilityState={{ expanded: open }} onPress={show} style={[styles.lang, styles.langOn]} testID="lang-menu">
        <Txt style={styles.flag}>{LANGUAGE_NAMES[lang].flag}</Txt>
        <Txt variant="caption" color={colors.primaryEdge}>
          {names ? LANGUAGE_NAMES[lang].name : lang.toUpperCase()}
        </Txt>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primaryEdge} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="close" />
        <View style={[styles.menu, up ? { left: at.x, bottom: Math.max(8, (typeof window !== 'undefined' ? window.innerHeight : 800) - at.y + 6) } : { left: at.x, top: at.y + at.h + 6 }]}>
          {BASE_LANGS.map((l) => (
            <Pressable
              key={l}
              accessibilityRole="menuitem"
              onPress={() => {
                onPick(l)
                setOpen(false)
              }}
              style={({ pressed }) => [styles.menuItem, lang === l ? styles.menuItemOn : null, pressed ? styles.menuItemOn : null]}
              testID={`lang-${l}`}
            >
              <Txt style={styles.flag}>{LANGUAGE_NAMES[l].flag}</Txt>
              <Txt variant="label" color={lang === l ? colors.primaryEdge : colors.text}>
                {LANGUAGE_NAMES[l].name}
              </Txt>
              {lang === l ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  )
}

/** the courses: the same content in four target languages */
function CoursesSection({ wide, lang, onPick }: { wide: boolean; lang: BaseLang; onPick: (target: TargetLang) => void }) {
  const t = useT()
  const target = useApp((s) => s.user.profile.target ?? 'en')
  const units = COURSE.units.length
  const sentences = COURSE.units.reduce((n, u) => n + u.sentences.length, 0)
  return (
    <View style={styles.section}>
      <Txt variant="title" center style={styles.sectionTitle}>
        {t('landing.langs.title')}
      </Txt>
      <Txt color={colors.textSoft} center style={styles.lead}>
        {t('landing.langs.body')}
      </Txt>
      <View style={[styles.courses, wide ? styles.coursesWide : null]}>
        {TARGET_LANGS.map((l) => {
          const mine = l === lang
          const on = !mine && l === target
          return (
            <Pressable key={l} accessibilityRole="button" disabled={mine} onPress={() => onPick(l)} style={[styles.course, wide ? styles.flex : null, on ? styles.courseOn : null, mine ? styles.courseOff : null]} testID={`course-${l}`}>
              <Txt style={styles.courseFlag}>{TARGET_NAMES[l].flag}</Txt>
              <Txt variant="heading">{TARGET_NAMES[l].name}</Txt>
              <Txt variant="caption" color={colors.textSoft}>
                {mine ? LANGUAGE_NAMES[lang].name : t('landing.langs.units', { n: units, m: sentences })}
              </Txt>
              {!mine ? (
                <View style={[styles.coursePick, on ? styles.coursePickOn : null]}>
                  <Txt variant="caption" color={on ? colors.text : colors.primaryEdge}>
                    {t('landing.nav.start')}
                  </Txt>
                  <Ionicons name="arrow-forward" size={14} color={on ? colors.text : colors.primaryEdge} />
                </View>
              ) : null}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

export function LandingScreen() {
  const router = useRouter()
  const t = useT()
  const { width, height } = useWindowDimensions()
  const wide = width >= 960
  const lang = useApp((s) => s.user.profile.baseLang)
  const onboarded = useApp((s) => s.user.profile.onboarded)
  const setProfile = useApp((s) => s.setProfile)
  const target = useApp((s) => s.user.profile.target ?? 'en')
  // the interface language can never be the course language: switching onto it moves the course to English
  const pickLang = (l: BaseLang) => setProfile({ baseLang: l, ...(target === l ? { target: 'en' } : {}) })
  const pickCourse = (l: TargetLang) => {
    setProfile({ target: l })
    start()
  }

  const start = () => router.push(onboarded ? '/learn' : '/welcome')
  const startLabel = onboarded ? t('landing.have') : t('landing.cta')

  // section links scroll the page; the targets report where they landed, and the link of the section in view is underlined
  const scroller = useRef<ScrollView>(null)
  const anchors = useRef<Partial<Record<Anchor, number>>>({})
  const mark = (key: Anchor) => (e: LayoutChangeEvent) => {
    anchors.current[key] = e.nativeEvent.layout.y
  }
  const jump = (key: Anchor) => scroller.current?.scrollTo({ y: key === 'top' ? 0 : Math.max(0, (anchors.current[key] ?? 0) - 72), animated: true })
  const [active, setActive] = useState<Anchor>('top')
  const [seen, setSeen] = useState(height)
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    setSeen(y + height)
    let current: Anchor = 'top'
    for (const key of ['how', 'price', 'faq'] as Anchor[]) if ((anchors.current[key] ?? Infinity) - 120 <= y) current = key
    setActive(current)
  }

  return (
    <ScrollView ref={scroller} style={styles.page} contentContainerStyle={styles.pageContent} onScroll={onScroll} scrollEventThrottle={80} stickyHeaderIndices={[0]}>
      {/* nav */}
      <View style={styles.nav}>
        <View style={[styles.container, styles.navInner]}>
          <Pressable accessibilityRole="link" onPress={() => jump('top')} style={styles.brand}>
            <BrandMark size={34} />
            <Txt variant="heading" color={colors.text} style={styles.brandText}>
              aytla
            </Txt>
          </Pressable>
          {wide ? (
            <View style={styles.links}>
              {NAV.map((n) => (
                <Pressable key={n.key} accessibilityRole="link" onPress={() => jump(n.key)} hitSlop={6} style={[styles.link, active === n.key ? styles.linkOn : null]}>
                  <Txt variant="label" color={colors.text} style={styles.linkText}>
                    {t(n.label)}
                  </Txt>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.navRight}>
            <LangDropdown lang={lang} onPick={pickLang} names={wide} />
            {wide && !onboarded ? <Button label={t('landing.nav.login')} variant="secondary" small onPress={() => router.push('/account')} /> : null}
            <Button label={t('landing.nav.start')} variant="success" small onPress={start} testID="landing-start" />
          </View>
        </View>
      </View>

      {/* hero */}
      <View style={styles.heroBand}>
        <View style={[styles.blob, styles.blobA]} pointerEvents="none" />
        <View style={[styles.blob, styles.blobB]} pointerEvents="none" />
        <View style={[styles.container, styles.hero, wide ? styles.heroWide : null]}>
          <View style={[styles.heroText, wide ? styles.heroTextWide : null]}>
            <Badge icon="sparkles" label={t('landing.hero.badge')} style={wide ? null : styles.center} />
            <Txt variant="hero" center={!wide} style={[styles.heroTitle, wide ? styles.heroTitleWide : null]}>
              {t('landing.hero.t1')}
              {'\n'}
              <Txt variant="hero" color={colors.primary} style={[styles.heroTitle, wide ? styles.heroTitleWide : null]}>
                {t('landing.hero.t2')}
              </Txt>
              {'\n'}
              {t('landing.hero.t3')}
            </Txt>
            <Txt color={colors.textSoft} center={!wide} style={styles.heroSub}>
              {t('landing.hero.sub')}
            </Txt>
            <View style={[styles.cta, wide ? styles.ctaWide : null]}>
              <Button label={startLabel} variant="success" onPress={start} icon={<Ionicons name="arrow-forward" size={20} color={colors.text} />} />
              <Pressable accessibilityRole="link" onPress={() => jump('how')} style={styles.howLink}>
                <View style={styles.play}>
                  <Ionicons name="play" size={16} color={colors.primary} />
                </View>
                <Txt variant="label" color={colors.primary} style={styles.underline}>
                  {t('landing.hero.how')}
                </Txt>
              </Pressable>
            </View>
          </View>
          <View style={[styles.heroMedia, wide ? styles.heroMediaWide : null]}>
            <HeroStage />
          </View>
        </View>
      </View>

      {/* four promises */}
      <View style={styles.stripBand}>
        <View style={styles.container}>
          <Strip wide={wide} />
        </View>
      </View>

      {/* the app next to a real exercise, before any sign-up */}
      <View style={styles.demoBand}>
        <View style={[styles.container, styles.demo, wide ? styles.demoWide : null]}>
          {wide ? (
            <Float amplitude={5} duration={3000} style={styles.demoPhone}>
              <PhoneFrame image={PHONE_SHOT} width={290} />
            </Float>
          ) : null}
          <View style={[styles.demoMain, wide ? styles.flex : null]}>
            <Badge icon="mic" label={t('landing.demo.badge')} style={wide ? null : styles.center} />
            <Txt variant="title" center={!wide} style={styles.sectionTitle}>
              {t('landing.demo.title')}
            </Txt>
            <Txt color={colors.textSoft} center={!wide} style={styles.lead}>
              {t('landing.demo.body')}
            </Txt>
            <View style={styles.demoCard}>
              <LandingDemo onStart={start} />
            </View>
          </View>
          {wide ? (
            <View style={styles.demoSide}>
              <Note text={t('landing.demo.note')} tilt={-6} arrow="left" />
              <Orb size={46} color="#D6F77A" dark="#9CCB2E" style={styles.demoOrb} />
              <Float amplitude={7} duration={2600}>
                <AnimatedMascot id="pix" size={170} mood="cheer" />
              </Float>
            </View>
          ) : null}
        </View>
      </View>

      {/* why */}
      <View style={styles.band} onLayout={mark('how')}>
        <OnScroll seen={seen} style={[styles.container, styles.section]}>
          <Txt variant="title" center style={styles.sectionTitle}>
            {t('landing.why.title')}
          </Txt>
          <Txt color={colors.textSoft} center>
            {t('landing.why.sub')}
          </Txt>
          <WhyCards wide={wide} />
        </OnScroll>
      </View>

      {/* the courses */}
      <OnScroll seen={seen} style={styles.container}>
        <CoursesSection wide={wide} lang={lang} onPick={pickCourse} />
      </OnScroll>

      {/* the crew */}
      <OnScroll seen={seen} style={[styles.container, styles.section]}>
        <Txt variant="title" center style={styles.sectionTitle}>
          {t('landing.guides.title')}
        </Txt>
        <Txt color={colors.textSoft} center style={styles.lead}>
          {t('landing.guides.body')}
        </Txt>
        <View style={styles.crew}>
          <CrewStage />
          {wide ? <Note text={t('landing.guides.note')} tilt={5} arrow="left" style={styles.crewNote} /> : null}
        </View>
      </OnScroll>

      {/* price */}
      <View style={styles.band} onLayout={mark('price')}>
        <OnScroll seen={seen} style={styles.container}>
          <PricingSection wide={wide} onStart={start} startLabel={startLabel} />
        </OnScroll>
      </View>

      {/* questions */}
      <OnScroll seen={seen} style={styles.container} onLayout={mark('faq')}>
        <FaqSection wide={wide} />
      </OnScroll>

      {/* footer */}
      <View style={styles.footerBand}>
        <View style={[styles.container, styles.footer, wide ? styles.footerWide : null]}>
          <View style={styles.footerBrand}>
            <View style={styles.brand}>
              <BrandMark size={32} />
              <Txt variant="heading" style={styles.brandText}>
                aytla
              </Txt>
            </View>
            <Txt variant="caption" color={colors.textSoft}>
              {t('landing.footer.tagline')}
            </Txt>
          </View>
          <View style={styles.footerLinks}>
            {NAV.map((n) => (
              <Pressable key={n.key} accessibilityRole="link" onPress={() => jump(n.key)} hitSlop={6}>
                <Txt variant="caption" color={colors.textSoft}>
                  {t(n.label)}
                </Txt>
              </Pressable>
            ))}
          </View>
          <View style={styles.footerRight}>
            <LangDropdown lang={lang} onPick={pickLang} names={wide} up />
            {SOCIAL.length > 0 ? (
            <View style={styles.social}>
              {SOCIAL.map((s) => (
                <Pressable key={s.icon} accessibilityRole="link" accessibilityLabel={s.label} onPress={() => void Linking.openURL(s.url)} style={styles.socialItem}>
                  <Ionicons name={s.icon} size={16} color={colors.text} />
                </Pressable>
              ))}
            </View>
            ) : null}
          </View>
        </View>
        <View style={[styles.container, styles.footerBottom]}>
          <Txt variant="caption" color={colors.textMuted}>
            © {new Date().getFullYear()} Aytla. {t('landing.footer.rights')}
          </Txt>
          <View style={styles.legal}>
            <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} hitSlop={8}>
              <Txt variant="caption" color={colors.textMuted} style={styles.underline}>
                {t('legal.privacy')}
              </Txt>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => router.push('/terms')} hitSlop={8}>
              <Txt variant="caption" color={colors.textMuted} style={styles.underline}>
                {t('legal.terms')}
              </Txt>
            </Pressable>
          </View>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignSelf: 'center' },
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { flexGrow: 1 },
  container: { width: '100%', maxWidth: layout.wide + 80, alignSelf: 'center', paddingHorizontal: space.lg },
  nav: { backgroundColor: colors.bg, borderBottomWidth: 1.5, borderColor: colors.border },
  navInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm, gap: space.md },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { letterSpacing: -0.5, fontSize: 24 },
  links: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  link: { paddingVertical: 6, borderBottomWidth: 2, borderColor: 'transparent' },
  linkOn: { borderColor: colors.primary },
  linkText: { fontSize: 14 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lang: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  langOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  flag: { fontSize: 15, lineHeight: 18 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  menu: { position: 'absolute', minWidth: 190, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, padding: 6, shadowColor: colors.navy, shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md },
  menuItemOn: { backgroundColor: colors.primaryTint },
  courses: { alignSelf: 'stretch', gap: space.md, marginTop: space.lg },
  coursesWide: { flexDirection: 'row' },
  course: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.border, padding: space.lg, gap: 6, alignItems: 'flex-start' },
  courseOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  courseOff: { opacity: 0.55 },
  courseFlag: { fontSize: 32, lineHeight: 40 },
  coursePick: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm, backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  coursePickOn: { backgroundColor: colors.lime },
  heroBand: { overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: colors.primaryTint },
  blobA: { width: 520, height: 520, left: -200, top: -120, opacity: 0.9 },
  blobB: { width: 360, height: 360, right: -120, bottom: -160, backgroundColor: colors.limeSoft, opacity: 0.6 },
  hero: { paddingTop: space.xl, paddingBottom: space.xl, gap: space.xl, alignItems: 'center' },
  heroWide: { flexDirection: 'row', paddingVertical: 48, gap: 48 },
  heroText: { alignSelf: 'stretch', gap: space.md, alignItems: 'center' },
  heroTextWide: { flex: 1, minWidth: 0, alignSelf: 'center', alignItems: 'flex-start' },
  heroTitle: { fontSize: 44, lineHeight: 50, letterSpacing: -1 },
  heroTitleWide: { fontSize: 60, lineHeight: 64, letterSpacing: -1.5 },
  heroSub: { fontSize: 19, lineHeight: 29, maxWidth: 480 },
  lead: { fontSize: 17, lineHeight: 27, maxWidth: 640 },
  sectionTitle: { fontSize: 30, lineHeight: 36 },
  cta: { alignItems: 'center', gap: space.md, marginTop: space.sm, alignSelf: 'stretch' },
  ctaWide: { flexDirection: 'row', alignSelf: 'flex-start' },
  howLink: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  underline: { textDecorationLine: 'underline' },
  heroMedia: { alignSelf: 'stretch', aspectRatio: 4 / 3, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 40, shadowOffset: { width: 0, height: 20 } },
  heroMediaWide: { flex: 1.1, minWidth: 0, alignSelf: 'center' },
  stripBand: { backgroundColor: colors.white, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.border },
  band: { backgroundColor: colors.surface, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.border },
  demoBand: { backgroundColor: colors.bg },
  demo: { paddingVertical: 48, gap: space.xl, alignItems: 'center' },
  demoWide: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  demoPhone: { alignSelf: 'center' },
  demoMain: { alignSelf: 'stretch', gap: space.md, alignItems: 'center', minWidth: 0 },
  demoCard: { alignSelf: 'stretch', marginTop: space.sm },
  demoSide: { width: 230, alignItems: 'center', gap: space.lg },
  demoOrb: { position: 'absolute', left: 10, bottom: 10 },
  section: { paddingVertical: 56, gap: space.sm, alignItems: 'center' },
  crew: { alignSelf: 'stretch', marginTop: space.lg },
  crewNote: { position: 'absolute', right: 0, top: -10 },
  footerBand: { borderTopWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  footer: { paddingVertical: space.xl, gap: space.lg },
  footerWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerBrand: { gap: 6, maxWidth: 320 },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  social: { flexDirection: 'row', gap: 8 },
  socialItem: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  footerBottom: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space.sm, paddingBottom: space.xl },
  legal: { flexDirection: 'row', gap: space.lg },
})
