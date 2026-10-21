import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native'
import { BASE_LANGS } from '../../core/types'
import { LANGUAGE_NAMES, useT, type StringKey } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, layout, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { AnimatedMascot, GUIDES, Mascot } from '../../ui/Mascot'
import { Float, Reveal } from '../../ui/Reveal'
import { Txt } from '../../ui/Txt'
import { HeroStage } from './HeroStage'
import { LandingDemo } from './LandingDemo'
import { FaqSection, PricingSection, ScreensSection, WhySection } from './sections'

const FEATURES: Array<{ icon: keyof typeof Ionicons.glyphMap; color: string; title: StringKey; body: StringKey }> = [
  { icon: 'mic', color: colors.primary, title: 'landing.f1.title', body: 'landing.f1.body' },
  { icon: 'flag', color: colors.success, title: 'landing.f2.title', body: 'landing.f2.body' },
  { icon: 'repeat', color: colors.purple, title: 'landing.f3.title', body: 'landing.f3.body' },
  { icon: 'game-controller', color: colors.flame, title: 'landing.f4.title', body: 'landing.f4.body' },
]

const STEPS: StringKey[] = ['landing.how.1', 'landing.how.2', 'landing.how.3']

/** Reveals its children once the page has scrolled far enough for them to be in view. */
function OnScroll({ seen, delay = 0, style, children }: { seen: number; delay?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const [top, setTop] = useState<number | null>(null)
  return (
    <View style={style} onLayout={(e) => setTop((prev) => prev ?? e.nativeEvent.layout.y)}>
      <Reveal when={top !== null && seen > top + 40} delay={delay} distance={24}>
        {children}
      </Reveal>
    </View>
  )
}

/** Public landing page (web). Native builds skip it and open the app directly. */
export function LandingScreen() {
  const router = useRouter()
  const t = useT()
  const { width } = useWindowDimensions()
  const wide = width >= 900
  const lang = useApp((s) => s.user.profile.baseLang)
  const onboarded = useApp((s) => s.user.profile.onboarded)
  const setProfile = useApp((s) => s.setProfile)

  const start = () => router.push(onboarded ? '/learn' : '/welcome')

  // sections reveal as they scroll into view: the bottom of the viewport in content coordinates
  const { height } = useWindowDimensions()
  const [seen, setSeen] = useState(height)
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setSeen(e.nativeEvent.contentOffset.y + height)

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} onScroll={onScroll} scrollEventThrottle={80}>
      {/* nav */}
      <View style={styles.nav}>
        <View style={[styles.container, styles.navInner]}>
          <View style={styles.brand}>
            <Mascot id="everest" size={40} mood="talk" />
            <Txt variant="heading" color={colors.text} style={styles.brandText}>
              aytla
            </Txt>
          </View>
          <View style={styles.langs}>
            {BASE_LANGS.map((l) => (
              <Pressable key={l} accessibilityRole="button" accessibilityLabel={LANGUAGE_NAMES[l].name} onPress={() => setProfile({ baseLang: l })} style={[styles.lang, lang === l ? styles.langOn : null]}>
                <Txt style={styles.flag}>{LANGUAGE_NAMES[l].flag}</Txt>
                {wide ? (
                  <Txt variant="caption" color={lang === l ? colors.primaryEdge : colors.textSoft}>
                    {LANGUAGE_NAMES[l].name}
                  </Txt>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      {/* hero */}
      <View style={[styles.container, styles.hero, wide ? styles.heroWide : null]}>
        <View style={[styles.heroMedia, wide ? styles.heroMediaWide : null]}>
          <HeroStage />
        </View>
        <View style={[styles.heroText, wide ? styles.heroTextWide : null]}>
          <Txt variant={wide ? 'hero' : 'title'} center={!wide}>
            {t('landing.hero.title')}
          </Txt>
          <Txt color={colors.textSoft} center={!wide} style={styles.heroSub}>
            {t('landing.hero.sub')}
          </Txt>
          <View style={[styles.cta, wide ? styles.ctaWide : null]}>
            <Button label={onboarded ? t('landing.have') : t('landing.cta')} variant="success" onPress={start} testID="landing-start" />
          </View>
        </View>
      </View>

      {/* the product itself: a real exercise, before any sign-up */}
      <View style={[styles.band, styles.demoBand]}>
        <View style={[styles.container, styles.section, wide ? styles.demoWide : null]}>
          <View style={[styles.demoText, wide ? styles.demoTextWide : null]}>
            <Txt variant="title" center={!wide}>
              {t('landing.demo.title')}
            </Txt>
            <Txt color={colors.textSoft} center={!wide} style={styles.heroSub}>
              {t('landing.demo.body')}
            </Txt>
          </View>
          <View style={[styles.demoCard, wide ? styles.demoCardWide : null]}>
            <LandingDemo onStart={start} />
          </View>
        </View>
      </View>

      {/* features */}
      <View style={styles.band}>
        <View style={[styles.container, styles.grid]}>
          {FEATURES.map((f, i) => (
            <OnScroll key={f.title} seen={seen} delay={i * 90} style={{ width: wide ? '48%' : '100%' }}>
              {/* the row lives inside the reveal wrapper, so it gets the column's full width and the text wraps */}
              <View style={styles.feature}>
                <View style={[styles.featureIcon, { backgroundColor: f.color }]}>
                  <Ionicons name={f.icon} size={28} color={colors.white} />
                </View>
                <View style={styles.flex}>
                  <Txt variant="heading">{t(f.title)}</Txt>
                  <Txt color={colors.textSoft}>{t(f.body)}</Txt>
                </View>
              </View>
            </OnScroll>
          ))}
        </View>
      </View>

      {/* real screens */}
      <OnScroll seen={seen} style={styles.container}>
        <ScreensSection wide={wide} />
      </OnScroll>

      {/* how it works */}
      <OnScroll seen={seen} style={[styles.container, styles.section]}>
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
      <View style={styles.band}>
        <OnScroll seen={seen} style={[styles.container, styles.section]}>
          <Txt variant="title" center>
            {t('landing.guides.title')}
          </Txt>
          <Txt color={colors.textSoft} center>
            {t('landing.guides.body')}
          </Txt>
          <View style={styles.guides}>
            {GUIDES.map((g, i) => (
              <View key={g.id} style={styles.guide}>
                <Float amplitude={4} duration={2000 + i * 180} delay={i * 120}>
                  <AnimatedMascot id={g.id} size={wide ? 120 : 88} mood={i % 3 === 0 ? 'talk' : i % 3 === 1 ? 'happy' : 'cheer'} />
                </Float>
                <Txt variant="label">{g.name}</Txt>
              </View>
            ))}
          </View>
        </OnScroll>
      </View>

      {/* price */}
      <OnScroll seen={seen} style={styles.container}>
        <PricingSection wide={wide} onStart={start} startLabel={onboarded ? t('landing.have') : t('landing.cta')} />
      </OnScroll>

      {/* questions */}
      <View style={styles.band}>
        <OnScroll seen={seen} style={styles.container}>
          <FaqSection />
        </OnScroll>
      </View>

      {/* apps + final CTA */}
      <OnScroll seen={seen} style={[styles.container, styles.section]}>
        <View style={styles.devices}>
          <Ionicons name="desktop-outline" size={40} color={colors.primary} />
          <Ionicons name="logo-android" size={40} color={colors.success} />
          <Ionicons name="logo-apple" size={40} color={colors.text} />
        </View>
        <Txt variant="title" center>
          {t('landing.apps.title')}
        </Txt>
        <Txt color={colors.textSoft} center>
          {t('landing.apps.body')}
        </Txt>
        <View style={styles.cta}>
          <Button label={onboarded ? t('landing.have') : t('landing.cta')} onPress={start} />
        </View>
      </OnScroll>

      <View style={styles.footer}>
        <Txt variant="caption" color={colors.textMuted} center>
          © {new Date().getFullYear()} {t('landing.footer')}
        </Txt>
        <View style={styles.footerLinks}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} hitSlop={8}>
            <Txt variant="caption" color={colors.textMuted} style={styles.footerLink}>
              {t('legal.privacy')}
            </Txt>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push('/terms')} hitSlop={8}>
            <Txt variant="caption" color={colors.textMuted} style={styles.footerLink}>
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
  page: { flex: 1, backgroundColor: colors.bg },
  pageContent: { flexGrow: 1 },
  container: { width: '100%', maxWidth: layout.wide, alignSelf: 'center', paddingHorizontal: space.lg },
  nav: { borderBottomWidth: 2, borderColor: colors.border, backgroundColor: colors.bg },
  navInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  brandText: { letterSpacing: -0.5, fontSize: 26 },
  langs: { flexDirection: 'row', gap: 6 },
  lang: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  langOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  flag: { fontSize: 18, lineHeight: 24 },
  hero: { paddingVertical: space.xl, gap: space.xl, alignItems: 'center' },
  heroWide: { flexDirection: 'row-reverse', paddingVertical: 64, gap: 48 },
  // the image lives in a sized box: in a row, a bare `width: 100%` image would take the whole row
  heroMedia: { alignSelf: 'stretch', aspectRatio: 4 / 3, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.primary },
  heroMediaWide: { flex: 1.1, minWidth: 0, alignSelf: 'center' },
  demoBand: { backgroundColor: colors.sky },
  demoWide: { flexDirection: 'row', alignItems: 'center', gap: 48 },
  demoText: { alignSelf: 'stretch', gap: space.md },
  demoTextWide: { flex: 1, minWidth: 0 },
  demoCard: { alignSelf: 'stretch' },
  demoCardWide: { flex: 1.2, minWidth: 0 },
  heroText: { alignSelf: 'stretch', gap: space.md },
  heroTextWide: { flex: 1, minWidth: 0, alignSelf: 'center' },
  heroSub: { fontSize: 18, lineHeight: 28 },
  cta: { alignSelf: 'center', width: '100%', maxWidth: 360, marginTop: space.md },
  ctaWide: { alignSelf: 'flex-start' },
  band: { backgroundColor: colors.surface, borderTopWidth: 2, borderBottomWidth: 2, borderColor: colors.border },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingVertical: space.xl, rowGap: space.xl },
  feature: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  featureIcon: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  section: { paddingVertical: 48, gap: space.md, alignItems: 'center' },
  steps: { alignSelf: 'stretch', gap: space.lg, marginTop: space.lg },
  stepsWide: { flexDirection: 'row' },
  step: { alignItems: 'center', gap: space.sm },
  stepNumber: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  guides: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg, marginTop: space.lg },
  guide: { alignItems: 'center', gap: 4 },
  devices: { flexDirection: 'row', gap: space.xl, marginBottom: space.sm },
  footer: { padding: space.xl, borderTopWidth: 2, borderColor: colors.border, gap: space.sm },
  footerLinks: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
  footerLink: { textDecorationLine: 'underline' },
})
