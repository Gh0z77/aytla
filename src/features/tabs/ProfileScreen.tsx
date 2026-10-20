import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native'
import { WORD_ID_MARKER } from '../../core/progress'
import { BASE_LANGS, type DailyGoal } from '../../core/types'
import { GOAL_IDS } from '../../core/goals'
import { LANGUAGE_NAMES, useT, type StringKey } from '../../i18n'
import { REMINDER_HOURS, remindersSupported, setDailyReminder } from '../../lib/reminders'
import { useAccount } from '../../state/account'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { GUIDES, Mascot } from '../../ui/Mascot'
import { TabScreen } from '../shell/TabScreen'
import { Txt } from '../../ui/Txt'
import { errorText } from '../account/errors'

const GOALS: DailyGoal[] = [10, 20, 30, 50]

export function ProfileScreen() {
  const router = useRouter()
  const t = useT()
  const user = useApp((s) => s.user)
  const setProfile = useApp((s) => s.setProfile)
  const reset = useApp((s) => s.reset)
  const account = useAccount((s) => s.account)
  const syncStatus = useAccount((s) => s.status)
  const syncNow = useAccount((s) => s.syncNow)
  const logout = useAccount((s) => s.logout)
  const [confirmReset, setConfirmReset] = useState(false)
  const deleteAccount = useAccount((s) => s.deleteAccount)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [reminderNote, setReminderNote] = useState<string | null>(null)

  const lessonsDone = Object.values(user.lessons).filter((l) => l.completed > 0).length
  const words = Object.keys(user.srs).filter((id) => id.includes(WORD_ID_MARKER)).length
  const reminderHour = user.profile.reminderHour ?? null

  const chooseReminder = async (hour: number | null) => {
    setReminderNote(null)
    const outcome = await setDailyReminder(hour, t('reminder.notifTitle'), t('reminder.notifBody')).catch(() => 'denied' as const)
    if (outcome === 'denied') {
      setReminderNote(t('reminder.denied'))
      setProfile({ reminderHour: null })
      return
    }
    // a phone reminds by itself; anywhere else the Telegram bot does it (needs a Telegram account)
    setProfile({ reminderHour: hour, reminderVia: outcome === 'unsupported' ? 'telegram' : 'device', tzOffsetMin: -new Date().getTimezoneOffset() })
  }

  return (
    <TabScreen scroll>
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Mascot id={user.profile.guide} size={96} />
          </View>
          <View style={styles.flex}>
            <Txt variant="caption" color={colors.textMuted}>
              {t('profile.name')}
            </Txt>
            <TextInput
              value={user.profile.name}
              onChangeText={(name) => setProfile({ name })}
              placeholder={t('profile.guest')}
              placeholderTextColor={colors.textMuted}
              style={styles.name}
              maxLength={24}
              accessibilityLabel={t('profile.name')}
            />
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat label={t('profile.totalXp')} value={user.xp} />
          <Stat label={t('profile.streak')} value={user.streak.current} />
          <Stat label={t('profile.lessons')} value={lessonsDone} />
          <Stat label={t('profile.words')} value={words} />
        </View>

        {/* account */}
        <View style={styles.accountCard}>
          <View style={styles.accountTop}>
            <Ionicons name={account ? 'cloud-done' : 'cloud-offline-outline'} size={28} color={account ? colors.success : colors.textMuted} />
            <View style={styles.flex}>
              <Txt style={styles.accountTitle} numberOfLines={1} ellipsizeMode="middle">
                {account ? account.email || `Telegram · ${account.name}` : t('account.title')}
              </Txt>
              <Txt variant="caption" color={colors.textSoft}>
                {!account ? t('account.guest') : syncStatus === 'syncing' ? t('account.syncing') : syncStatus === 'offline' ? t('account.offline') : t('account.synced')}
              </Txt>
            </View>
          </View>
          {account ? (
            <View style={styles.accountButtons}>
              <Button small variant="secondary" label={t('account.syncNow')} onPress={() => void syncNow()} />
              <Button small variant="ghost" label={t('account.logout')} onPress={() => void logout()} />
            </View>
          ) : (
            <Button small label={t('account.create')} onPress={() => router.push('/account')} testID="profile-account" />
          )}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={t('tabs.shop')} onPress={() => router.push('/shop')} style={({ pressed }) => [styles.shopRow, { opacity: pressed ? 0.8 : 1 }]} testID="profile-shop">
          <Ionicons name="diamond" size={24} color={colors.gem} />
          <View style={styles.flex}>
            <Txt style={styles.accountTitle}>{t('tabs.shop')}</Txt>
            <Txt variant="caption" color={colors.textSoft}>
              {t('profile.shopBody', { n: user.gems })}
            </Txt>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
        </Pressable>

        <Txt variant="heading" style={styles.section}>
          {t('profile.settings')}
        </Txt>

        <Txt variant="label" color={colors.textSoft}>
          {t('profile.language')}
        </Txt>
        <View style={styles.chips}>
          {BASE_LANGS.map((lang) => (
            <Chip key={lang} label={`${LANGUAGE_NAMES[lang].flag} ${LANGUAGE_NAMES[lang].name}`} active={user.profile.baseLang === lang} onPress={() => setProfile({ baseLang: lang })} />
          ))}
        </View>

        <Txt variant="label" color={colors.textSoft}>
          {t('goal.label')}
        </Txt>
        <View style={styles.chips}>
          {GOAL_IDS.map((g) => (
            <Chip key={g} label={t(`goal.${g}` as StringKey)} active={(user.profile.goal ?? 'everyday') === g} onPress={() => setProfile({ goal: g })} />
          ))}
        </View>

        <Txt variant="label" color={colors.textSoft}>
          {t('profile.goal')}
        </Txt>
        <View style={styles.chips}>
          {GOALS.map((g) => (
            <Chip key={g} label={t('profile.goalXp', { n: g })} active={user.profile.dailyGoalXp === g} onPress={() => setProfile({ dailyGoalXp: g })} />
          ))}
        </View>

        <Txt variant="label" color={colors.textSoft}>
          {t('profile.guide')}
        </Txt>
        <View style={styles.guides}>
          {GUIDES.map((g) => (
            <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={g.name} onPress={() => setProfile({ guide: g.id })} style={[styles.guide, user.profile.guide === g.id ? styles.guideOn : null]}>
              <Mascot id={g.id} size={56} />
              <Txt variant="caption">{g.name}</Txt>
            </Pressable>
          ))}
        </View>

        {remindersSupported || account?.telegram ? (
          <>
            <Txt variant="label" color={colors.textSoft}>
              {t('reminder.title')}
            </Txt>
            {!remindersSupported ? (
              <Txt variant="caption" color={colors.textMuted}>
                {t('reminder.viaTelegram')}
              </Txt>
            ) : null}
            <View style={styles.chips}>
              <Chip label={t('reminder.off')} active={reminderHour === null} onPress={() => void chooseReminder(null)} />
              {REMINDER_HOURS.map((h) => (
                <Chip key={h} label={`${h < 10 ? '0' : ''}${h}:00`} active={reminderHour === h} onPress={() => void chooseReminder(h)} />
              ))}
            </View>
            {reminderNote ? (
              <Txt variant="caption" color={colors.dangerText}>
                {reminderNote}
              </Txt>
            ) : null}
          </>
        ) : null}

        <Toggle label={t('profile.sound')} value={user.profile.soundOn} onChange={(soundOn) => setProfile({ soundOn })} />
        <Toggle label={t('profile.haptics')} value={user.profile.hapticsOn} onChange={(hapticsOn) => setProfile({ hapticsOn })} />

        <Button label={t('profile.reset')} variant="ghost" onPress={() => setConfirmReset(true)} style={styles.reset} />
        {account ? <Button label={t('account.delete')} variant="ghost" onPress={() => setConfirmDelete(true)} testID="account-delete" /> : null}

        <View style={styles.legal}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')} hitSlop={8}>
            <Txt variant="caption" color={colors.textMuted} style={styles.link}>
              {t('legal.privacy')}
            </Txt>
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push('/terms')} hitSlop={8}>
            <Txt variant="caption" color={colors.textMuted} style={styles.link}>
              {t('legal.terms')}
            </Txt>
          </Pressable>
        </View>
      </View>

      <Modal visible={confirmDelete} transparent animationType="fade" onRequestClose={() => setConfirmDelete(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Txt variant="heading" center>
              {t('account.delete')}
            </Txt>
            <Txt color={colors.textSoft} center>
              {t('account.deleteConfirm')}
            </Txt>
            {deleteError ? (
              <Txt color={colors.dangerText} center>
                {deleteError}
              </Txt>
            ) : null}
            <Button
              label={t('account.deleteYes')}
              variant="danger"
              disabled={deleting}
              onPress={async () => {
                setDeleting(true)
                setDeleteError(null)
                try {
                  await deleteAccount()
                  setConfirmDelete(false)
                } catch (err) {
                  setDeleteError(errorText(t, err))
                } finally {
                  setDeleting(false)
                }
              }}
              testID="account-delete-yes"
            />
            <Button label={t('common.cancel')} variant="ghost" onPress={() => setConfirmDelete(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={confirmReset} transparent animationType="fade" onRequestClose={() => setConfirmReset(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Txt variant="heading" center>
              {t('profile.reset')}
            </Txt>
            <Txt color={colors.textSoft} center>
              {t('profile.resetConfirm')}
            </Txt>
            <Button
              label={t('profile.resetYes')}
              variant="danger"
              onPress={() => {
                setConfirmReset(false)
                reset()
              }}
            />
            <Button label={t('common.cancel')} variant="ghost" onPress={() => setConfirmReset(false)} />
          </View>
        </View>
      </Modal>
    </TabScreen>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Txt variant="heading">{value}</Txt>
      <Txt variant="caption" color={colors.textSoft} center>
        {label}
      </Txt>
    </View>
  )
}

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active ? styles.chipOn : null]}>
      <Txt variant="label" color={active ? colors.primaryEdge : colors.textSoft}>
        {label}
      </Txt>
    </Pressable>
  )
}

/** react-native-web's Switch takes its "on" colours from these extra props (its default thumb is teal). */
const WEB_SWITCH = Platform.OS === 'web' ? ({ activeThumbColor: colors.white, activeTrackColor: colors.primary } as object) : {}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Txt style={styles.flex}>{label}</Txt>
      <Switch value={value} onValueChange={onChange} thumbColor={colors.white} trackColor={{ true: colors.primary, false: colors.borderStrong }} accessibilityLabel={label} {...WEB_SWITCH} />
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  name: { fontSize: 24, fontWeight: '800', color: colors.text, paddingVertical: 4, borderBottomWidth: 2, borderColor: colors.border },
  statsRow: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, alignItems: 'center', borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: space.md, paddingHorizontal: 4, gap: 2 },
  section: { marginTop: space.md },
  accountCard: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.md, backgroundColor: colors.surface },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, backgroundColor: colors.white },
  accountTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  accountTitle: { fontWeight: '700' },
  accountButtons: { gap: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.white },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  guides: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  guide: { width: 86, alignItems: 'center', gap: 2, borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, paddingVertical: space.sm },
  guideOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg },
  reset: { marginTop: space.md },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, marginTop: space.sm, paddingBottom: space.md },
  link: { textDecorationLine: 'underline' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: colors.white, borderRadius: radius.xl, padding: space.xl, gap: space.md },
})
