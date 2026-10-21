import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Image, Pressable, StyleSheet, View } from 'react-native'
import { useT, type StringKey } from '../../i18n'
import { colors, radius, space } from '../../theme/tokens'
import { Txt } from '../../ui/Txt'

/**
 * The lower half of the landing page: real screens of the product, the
 * honest comparison with word-drilling apps, the price, and the questions
 * people ask before they start.
 */

const SHOTS: Array<{ image: number; caption: StringKey }> = [
  { image: require('../../../assets/images/shots/learn.jpg'), caption: 'landing.screens.1' },
  { image: require('../../../assets/images/shots/lesson.jpg'), caption: 'landing.screens.2' },
  { image: require('../../../assets/images/shots/lesson-correct.jpg'), caption: 'landing.screens.3' },
]

/** a phone body around a screenshot; the screenshots are 375×812 */
export function PhoneFrame({ image, width }: { image: number; width: number }) {
  const height = (width * 812) / 375
  return (
    <View style={[styles.phone, { width: width + 20, borderRadius: width * 0.14 }]}>
      <View style={[styles.phoneScreen, { width, height, borderRadius: width * 0.11 }]}>
        <Image source={image} style={{ width, height }} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
    </View>
  )
}

export function ScreensSection({ wide }: { wide: boolean }) {
  const t = useT()
  const width = wide ? 236 : 200
  return (
    <View style={styles.section}>
      <Txt variant="title" center>
        {t('landing.screens.title')}
      </Txt>
      <View style={[styles.shots, wide ? styles.shotsWide : null]}>
        {SHOTS.map((s, i) => (
          <View key={s.caption} style={[styles.shot, wide && i === 1 ? styles.shotRaised : null]}>
            <PhoneFrame image={s.image} width={width} />
            <Txt center color={colors.textSoft} style={styles.caption}>
              {t(s.caption)}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  )
}

const WHY: Array<[StringKey, StringKey]> = [
  ['landing.why.1a', 'landing.why.1b'],
  ['landing.why.2a', 'landing.why.2b'],
  ['landing.why.3a', 'landing.why.3b'],
  ['landing.why.4a', 'landing.why.4b'],
]

export function WhySection({ wide }: { wide: boolean }) {
  const t = useT()
  return (
    <View style={styles.section}>
      <Txt variant="title" center>
        {t('landing.why.title')}
      </Txt>
      <View style={[styles.table, wide ? styles.tableWide : null]}>
        <View style={[styles.col, wide ? styles.colWide : null, styles.colOthers]}>
          <Txt variant="label" color={colors.textMuted} style={styles.colTitle}>
            {t('landing.why.others')}
          </Txt>
          {WHY.map(([a]) => (
            <View key={a} style={styles.row}>
              <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              <Txt color={colors.textSoft} style={styles.rowText}>
                {t(a)}
              </Txt>
            </View>
          ))}
        </View>
        <View style={[styles.col, wide ? styles.colWide : null, styles.colAytla]}>
          <Txt variant="label" color={colors.primary} style={styles.colTitle}>
            {t('landing.why.aytla')}
          </Txt>
          {WHY.map(([, b]) => (
            <View key={b} style={styles.row}>
              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              <Txt style={styles.rowText}>{t(b)}</Txt>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

export function PricingSection({ wide, onStart, startLabel }: { wide: boolean; onStart: () => void; startLabel: string }) {
  const t = useT()
  const free: StringKey[] = ['landing.pricing.free1', 'landing.pricing.free2', 'landing.pricing.free3', 'landing.pricing.free4']
  const pro: StringKey[] = ['landing.pricing.pro1', 'landing.pricing.pro2', 'landing.pricing.pro3']
  return (
    <View style={styles.section}>
      <Txt variant="title" center>
        {t('landing.pricing.title')}
      </Txt>
      <View style={[styles.plans, wide ? styles.plansWide : null]}>
        <View style={[styles.plan, wide ? styles.planWide : null, styles.planFree]}>
          <Txt variant="title" color={colors.white}>
            {t('landing.pricing.free')}
          </Txt>
          <Txt color={colors.primarySoft}>{t('landing.pricing.freeSub')}</Txt>
          <View style={styles.planList}>
            {free.map((k) => (
              <View key={k} style={styles.row}>
                <Ionicons name="checkmark" size={20} color={colors.lime} />
                <Txt color={colors.white} style={styles.rowText}>
                  {t(k)}
                </Txt>
              </View>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={onStart} style={styles.planButton}>
            <Txt variant="label" color={colors.text}>
              {startLabel}
            </Txt>
          </Pressable>
        </View>
        <View style={[styles.plan, wide ? styles.planWide : null, styles.planPro]}>
          <View style={styles.planHead}>
            <Txt variant="title">{t('landing.pricing.pro')}</Txt>
            <View style={styles.soon}>
              <Txt variant="caption" color={colors.primaryEdge}>
                {t('landing.pricing.proSub')}
              </Txt>
            </View>
          </View>
          <View style={styles.planList}>
            {pro.map((k) => (
              <View key={k} style={styles.row}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
                <Txt style={styles.rowText}>{t(k)}</Txt>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}

const FAQ: Array<[StringKey, StringKey]> = [
  ['landing.faq.1q', 'landing.faq.1a'],
  ['landing.faq.2q', 'landing.faq.2a'],
  ['landing.faq.3q', 'landing.faq.3a'],
  ['landing.faq.4q', 'landing.faq.4a'],
]

export function FaqSection() {
  const t = useT()
  const [open, setOpen] = useState<number>(0)
  return (
    <View style={styles.section}>
      <Txt variant="title" center>
        {t('landing.faq.title')}
      </Txt>
      <View style={styles.faq}>
        {FAQ.map(([q, a], i) => {
          const on = open === i
          return (
            <Pressable key={q} accessibilityRole="button" accessibilityState={{ expanded: on }} onPress={() => setOpen(on ? -1 : i)} style={[styles.faqItem, on ? styles.faqOpen : null]}>
              <View style={styles.faqHead}>
                <Txt variant="heading" style={styles.flex}>
                  {t(q)}
                </Txt>
                <Ionicons name={on ? 'remove' : 'add'} size={24} color={colors.primary} />
              </View>
              {on ? (
                <Txt color={colors.textSoft} style={styles.faqBody}>
                  {t(a)}
                </Txt>
              ) : null}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { paddingVertical: 56, gap: space.md, alignItems: 'center', width: '100%' },
  phone: { backgroundColor: colors.navy, padding: 10, shadowColor: colors.navy, shadowOpacity: 0.25, shadowRadius: 30, shadowOffset: { width: 0, height: 18 } },
  phoneScreen: { overflow: 'hidden', backgroundColor: colors.bg },
  shots: { gap: space.xl, marginTop: space.lg, alignItems: 'center' },
  shotsWide: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  shot: { alignItems: 'center', gap: space.md, maxWidth: 280 },
  shotRaised: { marginTop: -24 },
  caption: { fontSize: 16, lineHeight: 23 },
  table: { alignSelf: 'stretch', gap: space.md, marginTop: space.lg },
  tableWide: { flexDirection: 'row' },
  col: { borderRadius: radius.xl, padding: space.lg, gap: space.md },
  colWide: { flex: 1 },
  colOthers: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border },
  colAytla: { backgroundColor: colors.primaryTint, borderWidth: 2, borderColor: colors.primarySoft },
  colTitle: { textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  rowText: { flex: 1, fontSize: 17, lineHeight: 25 },
  plans: { alignSelf: 'stretch', gap: space.lg, marginTop: space.lg },
  plansWide: { flexDirection: 'row', alignItems: 'stretch' },
  plan: { borderRadius: radius.xl, padding: space.xl, gap: space.sm },
  planWide: { flex: 1 },
  planFree: { backgroundColor: colors.primary },
  planPro: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  soon: { backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  planList: { gap: space.sm, marginVertical: space.md },
  planButton: { alignSelf: 'flex-start', backgroundColor: colors.lime, borderRadius: radius.pill, paddingHorizontal: 28, paddingVertical: 14, marginTop: space.sm },
  faq: { maxWidth: 760, width: '100%', gap: space.sm, marginTop: space.lg, alignSelf: 'center' },
  faqItem: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, backgroundColor: colors.white, gap: space.sm },
  faqOpen: { borderColor: colors.primarySoft, backgroundColor: colors.primaryTint },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  faqBody: { fontSize: 17, lineHeight: 26 },
})
