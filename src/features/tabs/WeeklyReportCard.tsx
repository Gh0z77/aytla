import { Ionicons } from '@expo/vector-icons'
import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { COURSE } from '../../content/course'
import { weeklyReport } from '../../core/progress'
import { useT } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Mascot } from '../../ui/Mascot'
import { Txt } from '../../ui/Txt'

const SHOWN = 4

/** English text of a word or sentence id. */
function useItemText(): (id: string) => string | undefined {
  return useMemo(() => {
    const map = new Map<string, string>()
    COURSE.units.forEach((u) => {
      u.words.forEach((w) => map.set(w.id, w.en))
      u.sentences.forEach((s) => map.set(s.id, s.en))
    })
    return (id: string) => map.get(id)
  }, [])
}

/**
 * The week in terms a learner cares about: how much they SAID, and which of
 * their own mistakes they have stopped making. No XP here on purpose.
 */
export function WeeklyReportCard() {
  const t = useT()
  const user = useApp((s) => s.user)
  const textOf = useItemText()
  const report = weeklyReport(user, Date.now())
  const fixed = report.fixed.map(textOf).filter((x): x is string => Boolean(x)).slice(0, SHOWN)
  const hard = report.stillHard.map(textOf).filter((x): x is string => Boolean(x)).slice(0, SHOWN)
  const notes = (user.coachNotes ?? []).slice(0, SHOWN)

  // a brand-new learner gets one sentence and a guide, not three zeros
  if (report.activeDays === 0 && fixed.length === 0 && hard.length === 0 && notes.length === 0) {
    return (
      <View style={[styles.card, styles.emptyCard]}>
        <Mascot id="lumi" size={72} />
        <View style={styles.flex}>
          <Txt variant="heading">{t('report.title')}</Txt>
          <Txt color={colors.textSoft} style={styles.small}>
            {t('report.empty')}
          </Txt>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Txt variant="heading">{t('report.title')}</Txt>
      <View style={styles.stats}>
        <Stat icon="mic" color={colors.success} value={report.spoken} label={t('report.spoken')} />
        <Stat icon="time" color={colors.primary} value={report.minutes} label={t('report.minutes')} />
        <Stat icon="calendar" color={colors.flame} value={`${report.activeDays}/7`} label={t('report.days')} />
      </View>

      <Txt variant="label" color={colors.successText}>
        {t('report.fixed')}
      </Txt>
      {fixed.length === 0 ? (
        <Txt color={colors.textSoft} style={styles.small}>
          {t('report.fixedNone')}
        </Txt>
      ) : (
        fixed.map((text) => <Line key={text} icon="checkmark-circle" color={colors.success} text={text} />)
      )}

      {hard.length > 0 ? (
        <>
          <Txt variant="label" color={colors.textSoft}>
            {t('report.hard')}
          </Txt>
          {hard.map((text) => (
            <Line key={text} icon="ellipse-outline" color={colors.textMuted} text={text} />
          ))}
        </>
      ) : null}

      {notes.length > 0 ? (
        <>
          <Txt variant="label" color={colors.primaryEdge}>
            {t('report.coachNotes')}
          </Txt>
          {notes.map((n) => (
            <View key={`${n.at}-${n.better}`} style={styles.note}>
              <Txt style={styles.noteBetter}>{n.better}</Txt>
              {n.note ? (
                <Txt color={colors.textSoft} style={styles.small}>
                  {n.note}
                </Txt>
              ) : null}
            </View>
          ))}
        </>
      ) : null}
    </View>
  )
}

function Stat({ icon, color, value, label }: { icon: keyof typeof Ionicons.glyphMap; color: string; value: number | string; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={22} color={color} />
      <Txt variant="heading">{value}</Txt>
      <Txt variant="caption" color={colors.textSoft} center>
        {label}
      </Txt>
    </View>
  )
}

function Line({ icon, color, text }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={18} color={color} />
      <Txt style={[styles.small, styles.flex]}>{text}</Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  small: { fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.sm, backgroundColor: colors.surface },
  emptyCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stats: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm },
  stat: { flex: 1, alignItems: 'center', gap: 2, backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, paddingVertical: space.md, paddingHorizontal: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  note: { backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: space.md, gap: 2 },
  noteBetter: { fontWeight: '700', fontSize: 15, lineHeight: 21 },
})
