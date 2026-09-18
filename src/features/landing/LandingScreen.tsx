import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { BASE_LANGS } from '../../core/types'
import { LANGUAGE_NAMES, useT, type StringKey } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, layout, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { GUIDES, Mascot } from '../../ui/Mascot'
import { Txt } from '../../ui/Txt'

const FEATURES: Array<{ icon: keyof typeof Ionicons.glyphMap; color: string; title: StringKey; body: StringKey }> = [
  { icon: 'game-controller', color: colors.primary, title: 'landing.f1.title', body: 'landing.f1.body' },
  { icon: 'mic', color: colors.success, title: 'landing.f2.title', body: 'landing.f2.body' },
  { icon: 'flame', color: colors.flame, title: 'landing.f3.title', body: 'landing.f3.body' },
  { icon: 'repeat', color: colors.purple, title: 'landing.f4.title', body: 'landing.f4.body' },
]

const STEPS: StringKey[] = ['landing.how.1', 'landing.how.2', 'landing.how.3']

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

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      {/* nav */}
      <View style={styles.nav}>
        <View style={[styles.container, styles.navInner]}>
          <View style={styles.brand}>
            <Image source={require('../../../assets/images/logo-blue.png')} style={styles.logo} resizeMode="contain" />
            <Txt variant="heading" color={colors.primary} style={styles.brandText}>
              EVEREST<Txt variant="heading" color={colors.text}>AI</Txt>
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
          <Image source={require('../../../assets/images/hero-scene.jpg')} style={styles.heroImage} resizeMode="cover" accessibilityLabel="The six EVEREST guides on a mountain summit" />
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

      {/* features */}
      <View style={styles.band}>
        <View style={[styles.container, styles.grid]}>
          {FEATURES.map((f) => (
            <View key={f.title} style={[styles.feature, { width: wide ? '48%' : '100%' }]}>
              <View style={[styles.featureIcon, { backgroundColor: f.color }]}>
                <Ionicons name={f.icon} size={28} color={colors.white} />
              </View>
              <View style={styles.flex}>
                <Txt variant="heading">{t(f.title)}</Txt>
                <Txt color={colors.textSoft}>{t(f.body)}</Txt>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* how it works */}
      <View style={[styles.container, styles.section]}>
        <Txt variant="title" center>
          {t('landing.how.title')}
        </Txt>
        <View style={[styles.steps, wide ? styles.stepsWide : null]}>
          {STEPS.map((key, i) => (
            <View key={key} style={[styles.step, wide ? styles.flex : null]}>
              <View style={styles.stepNumber}>
                <Txt variant="heading" color={colors.white}>
                  {i + 1}
                </Txt>
              </View>
              <Txt center style={styles.stepText}>
                {t(key)}
              </Txt>
            </View>
          ))}
        </View>
      </View>

      {/* guides */}
      <View style={styles.band}>
        <View style={[styles.container, styles.section]}>
          <Txt variant="title" center>
            {t('landing.guides.title')}
          </Txt>
          <Txt color={colors.textSoft} center>
            {t('landing.guides.body')}
          </Txt>
          <View style={styles.guides}>
            {GUIDES.map((g) => (
              <View key={g.id} style={styles.guide}>
                <Mascot id={g.id} size={wide ? 120 : 88} />
                <Txt variant="label">{g.name}</Txt>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* apps + final CTA */}
      <View style={[styles.container, styles.section]}>
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
      </View>

      <View style={styles.footer}>
        <Txt variant="caption" color={colors.textMuted} center>
          © {new Date().getFullYear()} {t('landing.footer')}
        </Txt>
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
  logo: { width: 36, height: 36 },
  brandText: { letterSpacing: 2 },
  langs: { flexDirection: 'row', gap: 6 },
  lang: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 6 },
  langOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  flag: { fontSize: 18, lineHeight: 24 },
  hero: { paddingVertical: space.xl, gap: space.xl, alignItems: 'center' },
  heroWide: { flexDirection: 'row-reverse', paddingVertical: 64, gap: 48 },
  // the image lives in a sized box: in a row, a bare `width: 100%` image would take the whole row
  heroMedia: { alignSelf: 'stretch', height: 230, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.primarySoft },
  // 16:9 like the artwork, so no guide is cropped out of the frame
  heroMediaWide: { flex: 1.35, minWidth: 0, height: undefined, aspectRatio: 16 / 9, alignSelf: 'center' },
  heroImage: { width: '100%', height: '100%' },
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
  stepNumber: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  guides: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg, marginTop: space.lg },
  guide: { alignItems: 'center', gap: 4 },
  devices: { flexDirection: 'row', gap: space.xl, marginBottom: space.sm },
  footer: { padding: space.xl, borderTopWidth: 2, borderColor: colors.border },
})
