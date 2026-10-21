import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useT } from '../../i18n'
import { api, type CoachChatResponse, type CoachReply } from '../../lib/api'
import { speak, stopSpeaking } from '../../lib/speech'
import { useAccount } from '../../state/account'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { errorText } from '../account/errors'
import type { CharacterId } from '../../core/types'
import { scenarioTitle } from './CoachListScreen'

const SCENARIO_GUIDES: Record<string, CharacterId> = { meet: 'lumi', cafe: 'rocky', family: 'nubi', shopping: 'pix', directions: 'aero', free: 'everest' }
/** learner turns after which finishing the chat counts as a practice session */
const TURNS_FOR_REWARD = 4

type Turn = { role: 'assistant'; reply: CoachReply } | { role: 'user'; text: string }

export function CoachChatScreen({ scenarioId }: { scenarioId: string }) {
  const router = useRouter()
  const t = useT()
  const token = useAccount((s) => s.token)
  const baseLang = useApp((s) => s.user.profile.baseLang)
  const target = useApp((s) => s.user.profile.target ?? 'en')
  const sound = useApp((s) => s.user.profile.soundOn)
  const completeSession = useApp((s) => s.completeSession)
  const rememberCorrection = useApp((s) => s.rememberCorrection)
  const guide = SCENARIO_GUIDES[scenarioId] ?? 'everest'

  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [shown, setShown] = useState<Record<number, boolean>>({})
  const startedAt = useRef(Date.now())
  const scroll = useRef<ScrollView>(null)

  const ask = useCallback(
    async (history: Turn[]) => {
      if (!token) return
      setBusy(true)
      setError(null)
      try {
        const messages = history.map((h) => (h.role === 'user' ? { role: 'user' as const, text: h.text } : { role: 'assistant' as const, text: h.reply.text }))
        // mistake memory: earlier corrections travel with the request, so the guide can bring those patterns back
        const focus = (useApp.getState().user.coachNotes ?? []).slice(0, 5).map((n) => n.better)
        const res = await api<CoachChatResponse>('/coach/chat', { method: 'POST', token, body: { scenarioId, baseLang, target, messages, focus }, timeoutMs: 40_000 })
        if (res.reply.better) rememberCorrection(res.reply.better, res.reply.correction)
        setTurns([...history, { role: 'assistant', reply: res.reply }])
        setRemaining(res.remaining)
        if (sound) speak(res.reply.text)
      } catch (err) {
        setError(errorText(t, err))
      } finally {
        setBusy(false)
      }
    },
    [token, scenarioId, baseLang, target, sound, t, rememberCorrection]
  )

  // the guide opens the conversation
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    void ask([])
    return () => stopSpeaking()
  }, [ask])

  const send = () => {
    const text = draft.trim()
    if (!text || busy) return
    setDraft('')
    const history: Turn[] = [...turns, { role: 'user', text }]
    setTurns(history)
    void ask(history)
  }

  const learnerTurns = turns.filter((x) => x.role === 'user').length

  const leave = () => {
    stopSpeaking()
    if (learnerTurns >= TURNS_FOR_REWARD) {
      completeSession({ sessionKind: 'practice', lessonId: null, items: [], total: learnerTurns, mistakes: 0, maxCombo: 0, seconds: Math.round((Date.now() - startedAt.current) / 1000), spoken: learnerTurns })
      router.replace('/result')
      return
    }
    if (router.canGoBack()) router.back()
    else router.replace('/practice')
  }

  // the correction for a learner message arrives with the guide's NEXT reply
  const feedbackFor = (index: number): CoachReply | null => {
    const next = turns[index + 1]
    return next && next.role === 'assistant' && (next.reply.correction || next.reply.better) ? next.reply : null
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={leave} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('coach.finish')}>
          <Ionicons name="close" size={30} color={colors.textMuted} />
        </Pressable>
        <Mascot id={guide} size={44} />
        <View style={styles.flex}>
          <Txt style={styles.bold}>{scenarioTitle(t, scenarioId)}</Txt>
          {remaining !== null ? (
            <Txt variant="caption" color={colors.textMuted}>
              {t('coach.remaining', { n: remaining })}
            </Txt>
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.chat} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
          {turns.map((turn, i) =>
            turn.role === 'assistant' ? (
              <View key={i} style={styles.assistantRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('coach.translation')}
                  onPress={() => setShown((s) => ({ ...s, [i]: !s[i] }))}
                  onLongPress={() => speak(turn.reply.text)}
                  style={styles.assistant}
                >
                  <Txt style={styles.message}>{turn.reply.text}</Txt>
                  {shown[i] && turn.reply.translation ? (
                    <Txt color={colors.textSoft} style={styles.translation}>
                      {turn.reply.translation}
                    </Txt>
                  ) : null}
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Play audio" onPress={() => speak(turn.reply.text)} hitSlop={8}>
                  <Ionicons name="volume-high" size={22} color={colors.primary} />
                </Pressable>
              </View>
            ) : (
              <View key={i} style={styles.userBlock}>
                <View style={styles.user}>
                  <Txt color={colors.white} style={styles.message}>
                    {turn.text}
                  </Txt>
                </View>
                {feedbackFor(i) ? (
                  <View style={styles.feedback}>
                    {feedbackFor(i)?.better ? (
                      <Txt color={colors.successText} style={styles.small}>
                        <Txt color={colors.successText} style={[styles.small, styles.bold]}>
                          {t('coach.better')}{' '}
                        </Txt>
                        {feedbackFor(i)?.better}
                      </Txt>
                    ) : null}
                    {feedbackFor(i)?.correction ? (
                      <Txt color={colors.textSoft} style={styles.small}>
                        {feedbackFor(i)?.correction}
                      </Txt>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )
          )}
          {busy ? (
            <Txt variant="caption" color={colors.textMuted} style={styles.thinking}>
              {t('coach.thinking')}
            </Txt>
          ) : null}
          {error ? (
            <View style={styles.error}>
              <Txt color={colors.dangerText} style={styles.small}>
                {error}
              </Txt>
              <Button label={t('league.retry')} variant="secondary" small onPress={() => void ask(turns)} />
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('coach.placeholder')}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            maxLength={400}
            multiline
            autoCorrect={false}
            onSubmitEditing={send}
            accessibilityLabel={t('coach.placeholder')}
            testID="coach-input"
          />
          <Pressable accessibilityRole="button" accessibilityLabel={t('coach.send')} onPress={send} disabled={busy || draft.trim().length === 0} style={[styles.send, busy || draft.trim().length === 0 ? styles.sendOff : null]} testID="coach-send">
            <Ionicons name="send" size={22} color={colors.white} />
          </Pressable>
        </View>
        {learnerTurns >= TURNS_FOR_REWARD ? (
          <View style={styles.finish}>
            <Button label={t('coach.finish')} variant="success" onPress={leave} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  small: { fontSize: 14, lineHeight: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: 2, borderColor: colors.border },
  chat: { padding: space.lg, gap: space.md },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, maxWidth: '88%' },
  assistant: { flexShrink: 1, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, borderBottomLeftRadius: 4, padding: space.md, backgroundColor: colors.white },
  message: { fontSize: 17, lineHeight: 24 },
  translation: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  userBlock: { alignSelf: 'flex-end', maxWidth: '88%', alignItems: 'flex-end', gap: 6 },
  user: { backgroundColor: colors.primary, borderRadius: radius.lg, borderBottomRightRadius: 4, padding: space.md },
  feedback: { backgroundColor: colors.successSoft, borderRadius: radius.md, padding: space.md, gap: 4 },
  thinking: { marginLeft: 4 },
  error: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: space.md, gap: space.sm },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md, borderTopWidth: 2, borderColor: colors.border },
  input: { flex: 1, maxHeight: 120, minHeight: 48, borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surface, paddingHorizontal: space.md, paddingVertical: 12, fontSize: 17, color: colors.text },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: colors.lockedText },
  finish: { paddingHorizontal: space.md, paddingBottom: space.md },
})
