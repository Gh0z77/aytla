import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, Share, StyleSheet, TextInput, View } from 'react-native'
import { useT } from '../../i18n'
import { track } from '../../lib/analytics'
import { ApiError, api } from '../../lib/api'
import { inviteLink } from '../../lib/referral'
import { useAccount } from '../../state/account'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { Txt } from '../../ui/Txt'
import { errorText } from '../account/errors'

interface Friend {
  id: number
  name: string
  guide: string
  weeklyXp: number
  addedYou: boolean
}

/**
 * Friends: a private league of the people you added by code, plus the invite
 * link that gives both of you a week of Pro. Signed-in learners only.
 */
export function FriendsCard() {
  const t = useT()
  const router = useRouter()
  const token = useAccount((s) => s.token)
  const account = useAccount((s) => s.account)
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const res = await api<{ code: string; friends: Friend[] }>('/friends', { token })
      setFriends(res.friends)
    } catch {
      setFriends((prev) => prev ?? [])
    }
  }, [token])
  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
    if (!token || busy || code.trim().length < 4) return
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ status: string; friends: Friend[] }>('/friends', { method: 'POST', token, body: { code: code.trim() } })
      setFriends(res.friends)
      setCode('')
      track('friend_add', { status: res.status })
    } catch (err) {
      setError(errorText(t, err instanceof ApiError ? err : null))
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    const mine = account?.code
    if (!mine) return
    const link = inviteLink(mine)
    track('invite_share')
    try {
      if (typeof navigator !== 'undefined' && navigator.share) await navigator.share({ title: 'Aytla', text: t('friends.inviteText'), url: link })
      else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else await Share.share({ message: `${t('friends.inviteText')} ${link}` })
    } catch {
      // the share sheet was closed
    }
  }

  if (!token) {
    return (
      <View style={styles.card}>
        <Txt variant="heading">{t('friends.title')}</Txt>
        <Txt color={colors.textSoft}>{t('friends.needAccount')}</Txt>
        <Button label={t('account.create')} variant="secondary" small onPress={() => router.push('/account')} />
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Txt variant="heading" style={styles.flex}>
          {t('friends.title')}
        </Txt>
        {account?.code ? (
          <Txt variant="caption" color={colors.textMuted}>
            {t('friends.yourCode')} <Txt variant="label">{account.code}</Txt>
          </Txt>
        ) : null}
      </View>

      {friends === null ? (
        <Txt color={colors.textSoft}>…</Txt>
      ) : friends.length === 0 ? (
        <Txt color={colors.textSoft}>{t('friends.empty')}</Txt>
      ) : (
        <View style={styles.list}>
          {friends.map((f, i) => (
            <View key={f.id} style={styles.row}>
              <Txt variant="label" color={colors.textMuted} style={styles.rank}>
                {i + 1}
              </Txt>
              <Mascot id={f.guide as never} size={36} />
              <View style={styles.flex}>
                <Txt variant="label">{f.name || t('league.learner')}</Txt>
                {f.addedYou ? (
                  <Txt variant="caption" color={colors.textMuted}>
                    {t('friends.addedYou')}
                  </Txt>
                ) : null}
              </View>
              <Txt variant="label" color={colors.primary}>
                {f.weeklyXp} XP
              </Txt>
            </View>
          ))}
        </View>
      )}

      <View style={styles.addRow}>
        <TextInput value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder={t('friends.codePlaceholder')} placeholderTextColor={colors.textMuted} autoCapitalize="characters" autoCorrect={false} maxLength={12} style={styles.input} accessibilityLabel={t('friends.codePlaceholder')} onSubmitEditing={add} testID="friend-code" />
        <Pressable accessibilityRole="button" onPress={add} disabled={busy || code.trim().length < 4} style={[styles.addButton, busy || code.trim().length < 4 ? styles.dim : null]} testID="friend-add">
          <Ionicons name="person-add" size={18} color={colors.white} />
        </Pressable>
      </View>
      {error ? (
        <Txt variant="caption" color={colors.dangerText}>
          {error}
        </Txt>
      ) : null}

      <View style={styles.invite}>
        <Ionicons name="gift" size={22} color={colors.primary} />
        <Txt variant="caption" color={colors.textSoft} style={styles.flex}>
          {t('friends.inviteBody')}
        </Txt>
        <Button label={copied ? t('friends.copied') : t('friends.invite')} variant="secondary" small onPress={share} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { backgroundColor: colors.white, borderRadius: radius.xl, borderWidth: 2, borderColor: colors.border, padding: space.lg, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  list: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rank: { width: 20, textAlign: 'center' },
  addRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  input: { flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: space.md, paddingVertical: 10, fontSize: 16, color: colors.text, letterSpacing: 1 },
  addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.5 },
  invite: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.primaryTint, borderRadius: radius.lg, padding: space.md, flexWrap: 'wrap' },
})
