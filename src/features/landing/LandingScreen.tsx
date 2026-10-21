import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native'
import { BASE_LANGS } from '../../core/types'
import { LANGUAGE_NAMES, useT, type StringKey } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, layout, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { AnimatedMascot, GUIDES, Mascot } from '../../ui/Mascot'
import { Float, Reveal } from '../../ui/Reveal'
import { Txt } from '../../ui/Txt'
import { Badge, Orb, ProgressSection, Strip } from './extras'
import { HeroStage } from './HeroStage'
import { LandingDemo } from './LandingDemo'
import { FaqSection, PricingSection, ScreensSection, WhySection } from './sections'

/**
 * The website. Sticky navigation with section links, a hero that plays the
 * product (the Remotion loop on the web), the real first exercise before any
 * sign-up, then the arguments: screens, the daily rhythm, the comparison, the
 * crew, the price and the questions.
 */
const STEPS: StringKey[] = ['landing.how.1', 'landing.how.2', 'landing.how.3']
type Anchor = 'top' | 'how' | 'price' | 'faq'

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

export function LandingScreen() {
  const router = useRouter()
  const t = useT()
  const { width, height } = useWindowDimensions()
  const wide = width >= 900
  const lang = useApp((s) => s.user.profile.baseLang)
  const onboarded = useApp((s) => s.user.profile.onboarded)
  const setProfile = useApp((s) => s.setProfile)

  const start = () => router.push(onboarded ? '/learn' : '/welcome')
  const startLabel = onboarded ? t('landing.have') : t('landing.cta')

  // section links scroll the page; the targets report where they landed
  const scroller = useRef<ScrollView>(null)
  const anchors = useRef<Partial<Record<Anchor, number>>>({})
  const mark = (key: Anchor) => (e: LayoutChangeEvent) => {
    anchors.current[key] = e.nativeEvent.layout.y
  }
  const jump = (key: Anchor) => scroller.current?.scrollTo({ y: key === 'top' ? 0 : Math.max(0, (anchors.current[key] ?? 0) - 72), animated: true })

  // sections reveal as they scroll into view: the bottom of the viewport in content coordinates
  const [seen, setSeen] = useState(height)
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setSeen(e.nativeEvent.contentOffset.y + height)

  const NAV: Array<{ key: Anchor; label: StringKey }> = [
    { key: 'top', label: 'landing.nav.home' },
    { key: 'how', label: 'landing.nav.how' },
    { key: 'price', label: 'landing.nav.price' },
    { key: 'faq', label: 'landing.nav.faq' },
  ]

  return (
    <ScrollView ref={scroller} style={styles.page} contentContainerStyle={styles.pageContent} onScroll={onScroll} scrollEventThrottle={80} stickyHeaderIndices={[0]}>
      {/* nav */}
      <View style={styles.nav}>
        <View style={[styles.container, styles.navInner]}>
          <Pressable accessibilityRole="link" onPress={() => jump('top')} style={styles.brand}>
            <Mascot id="everest" size={38} mood="talk" />
            <Txt variant="heading" color={colors.text} style={styles.brandText}>
              aytla
            </Txt>
          </Pressable>
          {wide ? (
            <View style={styles.links}>
              {NAV.map((n) => (
                <Pressable key={n.key} accessibilityRole="link" onPress={() => jump(n.key)} hitSlop={6} style={styles.link}>
                  <Txt variant="label" color={colors.text}>
                    {t(n.label)}
                  </Txt>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.navRight}>
            <View style={styles.langs}>
              {BASE_LANGS.map((l) => (
                <Pressable key={l} accessibilityRole="button" accessibilityLabel={LANGUAGE_NAMES[l].name} onPress={() => setProfile({ baseLang: l })} style={[styles.lang, lang === l ? styles.langOn : null]}>
                  <Txt variant="caption" color={lang === l ? colors.primaryEdge : colors.textSoft}>
                    {l.toUpperCase()}
                  </Txt>
                  {wide ? (
                    <Txt variant="caption" color={lang === l ? colors.primaryEdge : colors.textSoft}>
                      {LANGUAGE_NAMES[l].name}
                    </Txt>
                  ) : null}
                </Pressable>
              ))}
            </View>
            {wide && !onboarded ? <Button label={t('landing.nav.login')} variant="secondary" small onPress={() => router.push('/account')} /> : null}
            <Button label={t('landing.nav.start')} variant="success" small onPress={start} testID="landing-start" />
          </View>
        </View>
      </View>

      {/* hero */}
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

      {/* three promises */}
      <View style={styles.stripBand}>
        <View style={styles.container}>
          <Strip wide={wide} />
        </View>
      </View>

      {/* the product itself: a real exercise, before any sign-up */}
      <View style={[styles.band, styles.demoBand]}>
        <View style={[styles.container, styles.section, wide ? styles.demoWide : null]}>
          <View style={[styles.demoText, wide ? styles.demoTextWide : null]}>
            <Badge icon="mic" label={t('landing.demo.badge')} style={wide ? null : styles.center} />
            <Txt variant="title" center={!wide}>
              {t('landing.demo.title')}
            </Txt>
            <Txt color={colors.textSoft} center={!wide} style={styles.lead}>
              {t('landing.demo.body')}
            </Txt>
            {wide ? (
              <View style={styles.demoArt}>
                <Orb size={64} color="#D6F77A" dark="#9CCB2E" style={styles.orbA} />
                <Orb size={40} color="#9C86FF" dark="#5B3FD9" style={styles.orbB} />
                <Float amplitude={6} duration={2400}>
                  <AnimatedMascot id="lumi" size={150} mood="talk" />
                </Float>
              </View>
            ) : null}
          </View>
          <View style={[styles.demoCard, wide ? styles.demoCardWide : null]}>
            <LandingDemo onStart={start} />
          </View>
        </View>
      </View>

      {/* the daily rhythm */}
      <OnScroll seen={seen} style={styles.container}>
        <ProgressSection wide={wide} />
      </OnScroll>

      {/* real screens */}
      <View style={styles.band}>
        <OnScroll seen={seen} style={styles.container}>
          <ScreensSection wide={wide} />
        </OnScroll>
      </View>

      {/* how it works */}
      <OnScroll seen={seen} style={[styles.container, styles.section]} onLayout={mark('how')}>
        <Badge icon="footsteps" label={t('landing.nav.how')} />
        <Txt variant="title" center>
          {t('landing.how.title')}
        </Txt>
        <View style={[styles.steps, wide ? styles.stepsWide : null]}>
          {STEPS.map((key, i) => (
            <View key={key} style={[styles.step, wide ? styles.flex : null]}>
              <View style={styles.stepNumber}>
                <Txt variant="heading" color={colors.text}>
                  {i + 1}
                </Txt>
              </View>
              <Txt center style={styles.stepText}>
                {t(key)}
              </Txt>
            </View>
          ))}
        </View>
      </OnScroll>

      {/* why not the others */}
      <View style={styles.band}>
        <OnScroll seen={seen} style={styles.container}>
          <WhySection wide={wide} />
        </OnScroll>
      </View>

      {/* guides */}
      <OnScroll seen={seen} style={[styles.container, styles.section]}>
        <Txt variant="title" center>
          {t('landing.guides.title')}
        </Txt>
        <Txt color={colors.textSoft} center style={styles.lead}>
          {t('landing.guides.body')}
        </Txt>
        <View style={styles.guides}>
          {GUIDES.map((g, i) => (
            <View key={g.id} style={styles.guide}>
              <Float amplitude={4} duration={2000 + i * 180} delay={i * 120}>
                <AnimatedMascot id={g.id} size={wide ? 124 : 92} mood={i % 3 === 0 ? 'talk' : i % 3 === 1 ? 'happy' : 'cheer'} />
              </Float>
              <Txt variant="label">{g.name}</Txt>
            </View>
          ))}
        </View>
      </OnScroll>

      {/* price */}
      <View style={styles.band}>
        <OnScroll seen={seen} style={styles.container} onLayout={mark('price')}>
          <PricingSection wide={wide} onStart={start} startLabel={startLabel} />
        </OnScroll>
      </View>

      {/* questions */}
      <OnScroll seen={seen} style={styles.container} onLayout={mark('faq')}>
        <FaqSection />
      </OnScroll>

      {/* apps + final CTA */}
      <View style={styles.finale}>
        <OnScroll seen={seen} style={[styles.container, styles.section]}>
          <View style={styles.devices}>
            <Ionicons name="desktop-outline" size={36} color={colors.white} />
            <Ionicons name="logo-android" size={36} color={colors.lime} />
            <Ionicons name="logo-apple" size={36} color={colors.white} />
          </View>
          <Txt variant="title" center color={colors.white}>
            {t('landing.apps.title')}
          </Txt>
          <Txt color={colors.primarySoft} center>
            {t('landing.apps.body')}
          </Txt>
          <View style={styles.ctaCenter}>
            <Button label={startLabel} variant="success" onPress={start} />
          </View>
        </OnScroll>
      </View>

      <View style={styles.footer}>
        <Txt variant="caption" color={colors.textMuted} center>
          © {new Date().getFullYear()} {t('landing.footer')}
        </Txt>
        <View style={styles.footerLinks}>
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
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignSelf: 'center' },
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { flexGrow: 1 },
  container: { width: '100%', maxWidth: layout.wide, alignSelf: 'center', paddingHorizontal: space.lg },
  nav: { backgroundColor: colors.bg, borderBottomWidth: 1.5, borderColor: colors.border },
  navInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm, gap: space.md },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandText: { letterSpacing: -0.5, fontSize: 26 },
  links: { flexDirection: 'row', gap: space.lg, alignItems: 'center' },
  link: { paddingVertical: 6 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  langs: { flexDirection: 'row', gap: 4 },
  lang: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  langOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  hero: { paddingTop: space.xl, paddingBottom: space.xl, gap: space.xl, alignItems: 'center' },
  heroWide: { flexDirection: 'row', paddingVertical: 56, gap: 48 },
  heroText: { alignSelf: 'stretch', gap: space.md, alignItems: 'center' },
  heroTextWide: { flex: 1, minWidth: 0, alignSelf: 'center', alignItems: 'flex-start' },
  heroTitle: { fontSize: 44, lineHeight: 50, letterSpacing: -1 },
  heroTitleWide: { fontSize: 62, lineHeight: 66, letterSpacing: -1.5 },
  heroSub: { fontSize: 20, lineHeight: 30, maxWidth: 520 },
  lead: { fontSize: 18, lineHeight: 28, maxWidth: 640 },
  cta: { alignItems: 'center', gap: space.md, marginTop: space.sm, alignSelf: 'stretch' },
  ctaWide: { flexDirection: 'row', alignSelf: 'flex-start' },
  howLink: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryTint, borderWidth: 1.5, borderColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', paddingLeft: 3 },
  underline: { textDecorationLine: 'underline' },
  heroMedia: { alignSelf: 'stretch', aspectRatio: 4 / 3, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 40, shadowOffset: { width: 0, height: 20 } },
  heroMediaWide: { flex: 1.15, minWidth: 0, alignSelf: 'center' },
  stripBand: { backgroundColor: colors.white, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.border },
  band: { backgroundColor: colors.surface, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.border },
  demoBand: { backgroundColor: colors.sky },
  demoWide: { flexDirection: 'row', alignItems: 'center', gap: 48 },
  demoText: { alignSelf: 'stretch', gap: space.md, alignItems: 'center' },
  demoTextWide: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  demoArt: { marginTop: space.lg, height: 190, width: 260, justifyContent: 'flex-end' },
  orbA: { position: 'absolute', right: 10, top: 0 },
  orbB: { position: 'absolute', left: 150, bottom: 20 },
  demoCard: { alignSelf: 'stretch' },
  demoCardWide: { flex: 1.2, minWidth: 0 },
  section: { paddingVertical: 56, gap: space.md, alignItems: 'center' },
  steps: { alignSelf: 'stretch', gap: space.lg, marginTop: space.lg },
  stepsWide: { flexDirection: 'row' },
  step: { alignItems: 'center', gap: space.sm },
  stepNumber: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  guides: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg, marginTop: space.lg },
  guide: { alignItems: 'center', gap: 4 },
  finale: { backgroundColor: colors.primary },
  devices: { flexDirection: 'row', gap: space.xl, marginBottom: space.sm },
  ctaCenter: { alignSelf: 'center', width: '100%', maxWidth: 360, marginTop: space.md },
  footer: { padding: space.xl, gap: space.sm },
  footerLinks: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
})
