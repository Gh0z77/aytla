import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useT, type StringKey } from '../../i18n'
import { track } from '../../lib/analytics'
import { ApiError, api } from '../../lib/api'
import { useApp } from '../../state/store'
import { errorText } from '../account/errors'
import { colors, radius, space } from '../../theme/tokens'
import { Txt } from '../../ui/Txt'
import { COURSE } from '../../content/course'
import { Note } from './extras'

/** The price (Free now, Pro soon) and the questions people ask before they start. */

export function PricingSection({ wide, onStart, startLabel }: { wide: boolean; onStart: () => void; startLabel: string }) {
  const t = useT()
  const free: StringKey[] = ['landing.pricing.free1', 'landing.pricing.free2', 'landing.pricing.free3', 'landing.pricing.free4']
  // the real size of the course, so the page never drifts from the content
  const size = { n: COURSE.units.length, m: COURSE.units.reduce((sum, u) => sum + u.sentences.length, 0) }
  const pro: StringKey[] = ['landing.pricing.pro1', 'landing.pricing.pro2', 'landing.pricing.pro3', 'landing.pricing.pro4']
  return (
    <View style={styles.section}>
      <Txt variant="title" center>
        {t('landing.pricing.title')}
      </Txt>
      <Txt color={colors.textSoft} center>
        {t('landing.pricing.sub')}
      </Txt>
      <View style={[styles.plans, wide ? styles.plansWide : null]}>
        <View style={[styles.plan, wide ? styles.flex : null, styles.planFree]}>
          <View style={styles.planHead}>
            <View style={styles.flex}>
              <Txt variant="title" color={colors.primaryEdge}>
                {t('landing.pricing.free')}
              </Txt>
              <Txt color={colors.textSoft}>{t('landing.pricing.freeSub')}</Txt>
            </View>
            <View style={styles.tagWhite}>
              <Txt variant="caption" color={colors.primaryEdge}>
                {t('landing.pricing.freeTag')}
              </Txt>
            </View>
          </View>
          <View style={styles.planList}>
            {free.map((k) => (
              <View key={k} style={styles.row}>
                <Ionicons name="checkmark" size={18} color={colors.successText} />
                <Txt style={styles.rowText}>{t(k, size)}</Txt>
              </View>
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={onStart} style={[styles.planButton, styles.planButtonFree]}>
            <Txt variant="label" color={colors.text}>
              {startLabel}
            </Txt>
          </Pressable>
        </View>
        <View style={[styles.plan, wide ? styles.flex : null, styles.planPro]}>
          <View style={styles.planHead}>
            <Txt variant="title" color={colors.white}>
              {t('landing.pricing.pro')}
            </Txt>
            <View style={styles.tagSoon}>
              <Txt variant="caption" color={colors.white}>
                {t('landing.pricing.proSub')}
              </Txt>
            </View>
          </View>
          <View style={styles.planList}>
            {pro.map((k, i) => (
              <View key={k} style={styles.row}>
                <Ionicons name={i === 2 ? 'sparkles' : 'checkmark'} size={18} color={colors.lime} />
                <Txt color={colors.white} style={styles.rowText}>
                  {t(k)}
                </Txt>
              </View>
            ))}
          </View>
          <ProInterest />
        </View>
        {wide ? (
          <View style={styles.proSide}>
            <Ionicons name="trophy" size={64} color={colors.gold} />
            <Note text={t('landing.pricing.proNote')} tilt={6} arrow="none" />
          </View>
        ) : null}
      </View>
    </View>
  )
}

/** "tell me when Pro ships": one email into the waiting list on the server */
function ProInterest() {
  const t = useT()
  const lang = useApp((st) => st.user.profile.baseLang)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (state !== 'idle' || email.trim().length === 0) return
    setState('busy')
    setError(null)
    try {
      await api('/pro/interest', { method: 'POST', body: { email: email.trim(), lang } })
      track('pro_interest')
      setState('done')
    } catch (err) {
      setError(errorText(t, err instanceof ApiError ? err : null))
      setState('idle')
    }
  }
  if (state === 'done') {
    return (
      <View style={styles.proDone}>
        <Ionicons name="checkmark-circle" size={20} color={colors.lime} />
        <Txt color={colors.white} style={styles.flex}>
          {t('landing.pricing.proDone')}
        </Txt>
      </View>
    )
  }
  return (
    <View style={styles.proForm}>
      <View style={styles.proRow}>
        <TextInput value={email} onChangeText={setEmail} placeholder={t('landing.pricing.proEmail')} placeholderTextColor="#9A93B8" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" inputMode="email" style={styles.proInput} accessibilityLabel={t('landing.pricing.proEmail')} onSubmitEditing={submit} testID="pro-email" />
        <Pressable accessibilityRole="button" onPress={submit} disabled={state === 'busy'} style={[styles.planButton, styles.planButtonPro, state === 'busy' ? styles.dim : null]} testID="pro-submit">
          {state === 'busy' ? <ActivityIndicator color={colors.white} /> : <Txt variant="label" color={colors.white}>{t('landing.pricing.proCta')}</Txt>}
        </Pressable>
      </View>
      {error ? (
        <Txt variant="caption" color="#FFB4A8">
          {error}
        </Txt>
      ) : null}
    </View>
  )
}

const FAQ: Array<[StringKey, StringKey]> = [
  ['landing.faq.1q', 'landing.faq.1a'],
  ['landing.faq.2q', 'landing.faq.2a'],
  ['landing.faq.3q', 'landing.faq.3a'],
  ['landing.faq.4q', 'landing.faq.4a'],
]

export function FaqSection({ wide }: { wide: boolean }) {
  const t = useT()
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  const columns = wide ? [FAQ.slice(0, 2), FAQ.slice(2)] : [FAQ]
  return (
    <View style={styles.faqSection}>
      <View style={styles.faqHead}>
        <Txt variant="title" style={styles.flex}>
          {t('landing.faq.title')}
        </Txt>
        <Pressable accessibilityRole="button" onPress={() => setOpen(open.size === FAQ.length ? new Set() : new Set(FAQ.map((_, i) => i)))} hitSlop={8} style={styles.faqAll}>
          <Txt variant="label" color={colors.primary}>
            {t('landing.faq.all')}
          </Txt>
          <Ionicons name="arrow-forward" size={16} color={colors.primary} />
        </Pressable>
      </View>
      <View style={[styles.faqColumns, wide ? styles.faqColumnsWide : null]}>
        {columns.map((col, c) => (
          <View key={c} style={[styles.faqColumn, wide ? styles.flex : null]}>
            {col.map(([q, a]) => {
              const i = FAQ.findIndex((item) => item[0] === q)
              const on = open.has(i)
              return (
                <Pressable key={q} accessibilityRole="button" accessibilityState={{ expanded: on }} onPress={() => toggle(i)} style={[styles.faqItem, on ? styles.faqOpen : null]}>
                  <View style={styles.faqRow}>
                    <Txt variant="label" style={[styles.flex, styles.faqQ]}>
                      {t(q)}
                    </Txt>
                    <Ionicons name={on ? 'remove' : 'add'} size={22} color={colors.primary} />
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
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { paddingVertical: 56, gap: space.sm, alignItems: 'center', width: '100%' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  rowText: { flex: 1, fontSize: 16, lineHeight: 24 },
  plans: { alignSelf: 'stretch', gap: space.lg, marginTop: space.lg, alignItems: 'stretch' },
  plansWide: { flexDirection: 'row', maxWidth: 1040, alignSelf: 'center', width: '100%' },
  plan: { borderRadius: radius.xl, padding: space.xl, gap: space.md },
  planFree: { backgroundColor: colors.primaryTint, borderWidth: 1.5, borderColor: colors.primarySoft },
  planPro: { backgroundColor: colors.navy },
  planHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  tagWhite: { backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  tagSoon: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  planList: { gap: space.sm, marginVertical: space.sm },
  planButton: { alignSelf: 'flex-end', borderRadius: radius.pill, paddingHorizontal: 24, paddingVertical: 12 },
  planButtonFree: { backgroundColor: colors.lime },
  planButtonPro: { backgroundColor: colors.primary, alignSelf: 'auto' },
  dim: { opacity: 0.6 },
  proForm: { gap: 6 },
  proRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  proInput: { flex: 1, minWidth: 0, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 11, color: colors.white, fontSize: 15 },
  proDone: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.lg, padding: space.md },
  proSide: { width: 180, alignItems: 'center', justifyContent: 'center', gap: space.md },
  faqSection: { paddingVertical: 56, gap: space.lg, width: '100%' },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  faqAll: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  faqColumns: { gap: space.sm },
  faqColumnsWide: { flexDirection: 'row', gap: space.lg },
  faqColumn: { gap: space.sm },
  faqItem: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: 14, backgroundColor: colors.white, gap: space.sm },
  faqOpen: { borderColor: colors.primarySoft, backgroundColor: colors.primaryTint },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  faqQ: { fontSize: 15 },
  faqBody: { fontSize: 15, lineHeight: 23 },
})
