import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import type {
  BankExercise,
  CharacterId,
  FillExercise,
  GradeResult,
  ListenExercise,
  MatchExercise,
  SayExercise,
  SelectExercise,
  SpeakExercise,
  TypeExercise,
} from '../../core/types'
import { useT } from '../../i18n'
import { resultFeedback, tapFeedback } from '../../lib/haptics'
import { listenOnce, speak, usesServerSpeech } from '../../lib/speech'
import { colors, radius, space } from '../../theme/tokens'
import { Txt } from '../../ui/Txt'
import { Instruction, PromptBubble, SpeakerButton, Tile, type TileState } from './parts'
import { WordBank } from './WordBank'

/** What the learner has entered so far for the current exercise. */
export type Draft = { kind: 'option'; value: string } | { kind: 'tiles'; value: number[] } | { kind: 'text'; value: string; spoken?: boolean }

export function isDraftReady(draft: Draft | null): boolean {
  if (!draft) return false
  if (draft.kind === 'tiles') return draft.value.length > 0
  return draft.value.trim().length > 0
}

interface Common {
  draft: Draft | null
  setDraft: (draft: Draft | null) => void
  /** true once the answer has been checked */
  locked: boolean
  result: GradeResult | null
  guide: CharacterId
  sound: boolean
  haptics: boolean
}

// ---------------------------------------------------------------------------

export function SelectView({ exercise, draft, setDraft, locked, result, sound, haptics }: Common & { exercise: SelectExercise }) {
  const t = useT()
  const selected = draft?.kind === 'option' ? draft.value : null
  const stateOf = (id: string): TileState => {
    if (locked && result) {
      if (id === exercise.answerId) return 'correct'
      if (id === selected) return 'wrong'
      return 'idle'
    }
    return id === selected ? 'selected' : 'idle'
  }
  return (
    <View>
      <Instruction>{t('lesson.select')}</Instruction>
      <Txt variant="title" color={colors.primary} style={styles.selectPrompt} testID="select-prompt">
        {exercise.prompt}
      </Txt>
      <View style={styles.grid}>
        {exercise.options.map((o) => (
          <Tile
            key={o.id}
            big
            label={o.label}
            state={stateOf(o.id)}
            disabled={locked}
            style={styles.gridItem}
            onPress={() => {
              tapFeedback(haptics)
              if (sound) speak(o.label)
              setDraft({ kind: 'option', value: o.id })
            }}
          >
            {o.emoji ? <Txt style={styles.emoji}>{o.emoji}</Txt> : null}
          </Tile>
        ))}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------

export function BankView({ exercise, draft, setDraft, locked, guide, sound, haptics }: Common & { exercise: BankExercise }) {
  const t = useT()
  const promptIsEnglish = exercise.direction === 'en-native'
  useEffect(() => {
    if (promptIsEnglish && sound) speak(exercise.audio)
  }, [exercise.id, exercise.audio, promptIsEnglish, sound])
  return (
    <View>
      <Instruction>{t('lesson.translate')}</Instruction>
      <PromptBubble guide={guide} text={exercise.prompt} audio={promptIsEnglish && sound ? exercise.audio : undefined} />
      <WordBank tokens={exercise.tokens} chosen={draft?.kind === 'tiles' ? draft.value : []} onChange={(value) => setDraft({ kind: 'tiles', value })} disabled={locked} haptics={haptics} />
    </View>
  )
}

// ---------------------------------------------------------------------------

export function FillView({ exercise, draft, setDraft, locked, result, haptics }: Common & { exercise: FillExercise }) {
  const t = useT()
  const selected = draft?.kind === 'option' ? draft.value : null
  const stateOf = (option: string): TileState => {
    if (locked && result) {
      if (option === exercise.answer) return 'correct'
      if (option === selected) return 'wrong'
      return 'idle'
    }
    return option === selected ? 'selected' : 'idle'
  }
  return (
    <View>
      <Instruction>{t('lesson.fill')}</Instruction>
      <View style={styles.fillCard}>
        <Txt style={styles.fillSentence}>
          {exercise.before ? `${exercise.before} ` : ''}
          <Txt style={[styles.fillSentence, styles.blank]}>{selected ?? '______'}</Txt>
          {exercise.after}
        </Txt>
        <Txt variant="body" color={colors.textSoft} style={styles.fillTranslation}>
          {exercise.translation}
        </Txt>
      </View>
      <View style={styles.options}>
        {exercise.options.map((o) => (
          <Tile
            key={o}
            label={o}
            state={stateOf(o)}
            disabled={locked}
            style={styles.option}
            onPress={() => {
              tapFeedback(haptics)
              setDraft({ kind: 'option', value: o })
            }}
          />
        ))}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------

export function ListenView({ exercise, draft, setDraft, locked, haptics, onCannot }: Common & { exercise: ListenExercise; onCannot: () => void }) {
  const t = useT()
  useEffect(() => {
    speak(exercise.audio)
  }, [exercise.id, exercise.audio])
  return (
    <View>
      <Instruction>{t(exercise.mode === 'bank' ? 'lesson.listen' : 'lesson.listenType')}</Instruction>
      <View style={styles.listenRow}>
        <SpeakerButton text={exercise.audio} size={96} />
        <SpeakerButton text={exercise.audio} slow size={60} />
      </View>
      {exercise.mode === 'bank' ? (
        <WordBank tokens={exercise.tokens} chosen={draft?.kind === 'tiles' ? draft.value : []} onChange={(value) => setDraft({ kind: 'tiles', value })} disabled={locked} haptics={haptics} />
      ) : (
        <AnswerInput value={draft?.kind === 'text' ? draft.value : ''} onChange={(value) => setDraft({ kind: 'text', value })} locked={locked} placeholder={t('lesson.typeHere')} />
      )}
      {!locked ? <SkipLink label={t('lesson.cantListen')} onPress={onCannot} /> : null}
    </View>
  )
}

// ---------------------------------------------------------------------------

export function TypeView({ exercise, draft, setDraft, locked, guide }: Common & { exercise: TypeExercise }) {
  const t = useT()
  return (
    <View>
      <Instruction>{t('lesson.type')}</Instruction>
      <PromptBubble guide={guide} text={exercise.prompt} />
      <AnswerInput value={draft?.kind === 'text' ? draft.value : ''} onChange={(value) => setDraft({ kind: 'text', value })} locked={locked} placeholder={t('lesson.typeHere')} />
    </View>
  )
}

function AnswerInput({ value, onChange, locked, placeholder }: { value: string; onChange: (v: string) => void; locked: boolean; placeholder: string }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      editable={!locked}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      multiline
      autoCapitalize="sentences"
      autoCorrect={false}
      spellCheck={false}
      style={styles.input}
      accessibilityLabel={placeholder}
    />
  )
}

// ---------------------------------------------------------------------------

export function SpeakView({ exercise, draft, setDraft, locked, guide, onCannot }: Common & { exercise: SpeakExercise; onCannot: () => void }) {
  const t = useT()
  const [listening, setListening] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)
  useEffect(() => () => stopRef.current?.(), [])
  const heard = draft?.kind === 'text' ? draft.value : ''

  const start = () => {
    if (listening || locked) return
    setListening(true)
    stopRef.current = listenOnce((transcript) => {
      setListening(false)
      stopRef.current = null
      if (transcript.trim()) setDraft({ kind: 'text', value: transcript })
    })
  }

  return (
    <View>
      <Instruction>{t('lesson.speak')}</Instruction>
      <PromptBubble guide={guide} text={exercise.text} audio={exercise.text} />
      <Txt variant="body" color={colors.textSoft} center style={styles.speakTranslation}>
        {exercise.translation}
      </Txt>
      <Pressable accessibilityRole="button" accessibilityLabel={t('lesson.tapToSpeak')} onPress={start} disabled={locked} style={[styles.mic, listening ? styles.micLive : null]}>
        <Ionicons name="mic" size={34} color={listening ? colors.white : colors.primary} />
        <Txt variant="label" color={listening ? colors.white : colors.primary}>
          {listening ? t('lesson.listening') : t('lesson.tapToSpeak')}
        </Txt>
      </Pressable>
      {heard ? (
        <Txt variant="body" color={colors.textSoft} center style={styles.heard}>
          “{heard}”
        </Txt>
      ) : null}
      {!locked ? <SkipLink label={t('lesson.cantSpeak')} onPress={onCannot} /> : null}
    </View>
  )
}

// ---------------------------------------------------------------------------

/**
 * The lesson finale: the learner says the sentence in English. The microphone
 * is offered wherever speech recognition exists; typing always works, so the
 * round never blocks a learner on a phone or browser without it.
 */
export function SayView({ exercise, draft, setDraft, locked, guide, canUseMic }: Common & { exercise: SayExercise; canUseMic: boolean }) {
  const t = useT()
  const [listening, setListening] = useState(false)
  const stopRef = useRef<(() => void) | null>(null)
  useEffect(() => () => stopRef.current?.(), [])
  const text = draft?.kind === 'text' ? draft.value : ''
  const spoken = draft?.kind === 'text' && draft.spoken === true

  const [thinking, setThinking] = useState(false)
  const server = usesServerSpeech()
  const start = () => {
    if (locked) return
    if (listening) {
      // server recognition: the second tap ends the recording and sends it
      if (server && stopRef.current) {
        setThinking(true)
        stopRef.current()
      }
      return
    }
    setListening(true)
    stopRef.current = listenOnce((transcript) => {
      setListening(false)
      setThinking(false)
      stopRef.current = null
      if (transcript.trim()) setDraft({ kind: 'text', value: transcript, spoken: true })
    })
  }

  return (
    <View>
      <Instruction>{t('lesson.say')}</Instruction>
      <PromptBubble guide={guide} text={exercise.prompt} />
      {canUseMic ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel={t('lesson.tapToSpeak')} onPress={start} disabled={locked || thinking} style={[styles.mic, listening ? styles.micLive : null]}>
            <Ionicons name={listening && server && !thinking ? 'stop' : 'mic'} size={34} color={listening ? colors.white : colors.primary} />
            <Txt variant="label" color={listening ? colors.white : colors.primary}>
              {thinking ? t('lesson.recognising') : listening ? (server ? t('lesson.tapToStop') : t('lesson.listening')) : t('lesson.tapToSpeak')}
            </Txt>
          </Pressable>
          {spoken ? (
            <Txt variant="body" color={colors.textSoft} center style={styles.heard}>
              {t('lesson.sayHeard')} “{text}”
            </Txt>
          ) : null}
          <Txt variant="caption" color={colors.textMuted} center style={styles.orType}>
            {t('lesson.sayOrType')}
          </Txt>
        </>
      ) : null}
      <AnswerInput value={spoken ? '' : text} onChange={(value) => setDraft({ kind: 'text', value })} locked={locked} placeholder={t('lesson.typeHere')} />
    </View>
  )
}

function SkipLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.skip}>
      <Txt variant="label" color={colors.textMuted} center>
        {label}
      </Txt>
    </Pressable>
  )
}

// ---------------------------------------------------------------------------

function shuffled<T>(items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = out[i] as T
    out[i] = out[j] as T
    out[j] = a
  }
  return out
}

interface MatchProps {
  exercise: MatchExercise
  sound: boolean
  haptics: boolean
  /** called once every pair is matched, with the ids that were missed at least once */
  onDone: (wrongIds: string[]) => void
}

export function MatchView({ exercise, sound, haptics, onDone }: MatchProps) {
  const t = useT()
  const [left] = useState(() => shuffled(exercise.pairs))
  const [right] = useState(() => shuffled(exercise.pairs))
  const [pickedLeft, setPickedLeft] = useState<string | null>(null)
  const [pickedRight, setPickedRight] = useState<string | null>(null)
  const [matched, setMatched] = useState<string[]>([])
  const [flash, setFlash] = useState<{ left: string; right: string } | null>(null)
  const wrong = useRef(new Set<string>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const tryPair = (l: string | null, r: string | null) => {
    if (!l || !r) return
    if (l === r) {
      resultFeedback(haptics, true)
      const next = [...matched, l]
      setMatched(next)
      setPickedLeft(null)
      setPickedRight(null)
      if (next.length === exercise.pairs.length) onDone([...wrong.current])
      return
    }
    resultFeedback(haptics, false)
    wrong.current.add(l)
    setFlash({ left: l, right: r })
    timer.current = setTimeout(() => {
      setFlash(null)
      setPickedLeft(null)
      setPickedRight(null)
    }, 450)
  }

  const stateOf = (id: string, side: 'left' | 'right'): TileState => {
    if (matched.includes(id)) return 'ghost'
    if (flash && flash[side] === id) return 'wrong'
    if ((side === 'left' ? pickedLeft : pickedRight) === id) return 'selected'
    return 'idle'
  }

  return (
    <View>
      <Instruction>{t('lesson.match')}</Instruction>
      <View style={styles.matchRow}>
        <View style={styles.matchCol}>
          {left.map((p) => (
            <Tile
              key={`l-${p.id}`}
              label={p.en}
              state={stateOf(p.id, 'left')}
              disabled={flash !== null}
              style={styles.matchTile}
              onPress={() => {
                tapFeedback(haptics)
                if (sound) speak(p.en)
                setPickedLeft(p.id)
                tryPair(p.id, pickedRight)
              }}
            />
          ))}
        </View>
        <View style={styles.matchCol}>
          {right.map((p) => (
            <Tile
              key={`r-${p.id}`}
              label={p.native}
              state={stateOf(p.id, 'right')}
              disabled={flash !== null}
              style={styles.matchTile}
              onPress={() => {
                tapFeedback(haptics)
                setPickedRight(p.id)
                tryPair(pickedLeft, p.id)
              }}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  selectPrompt: { marginBottom: space.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  gridItem: { width: '50%', padding: 6 },
  emoji: { fontSize: 44, lineHeight: 54 },
  fillCard: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, marginBottom: space.xl, backgroundColor: colors.surface },
  fillSentence: { fontSize: 22, lineHeight: 32, fontWeight: '700', color: colors.text },
  blank: { color: colors.primary, textDecorationLine: 'underline' },
  fillTranslation: { marginTop: space.sm },
  options: { gap: space.sm },
  option: { alignSelf: 'stretch' },
  listenRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: space.lg, marginBottom: space.xl },
  input: {
    minHeight: 120,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: space.lg,
    fontSize: 18,
    lineHeight: 26,
    color: colors.text,
    textAlignVertical: 'top',
  },
  speakTranslation: { marginBottom: space.xl },
  mic: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: 190,
    height: 120,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  micLive: { backgroundColor: colors.primary },
  heard: { marginTop: space.lg, fontStyle: 'italic' },
  orType: { marginTop: space.lg, marginBottom: space.sm, textTransform: 'uppercase' },
  skip: { marginTop: space.xl, padding: space.sm },
  matchRow: { flexDirection: 'row', gap: space.md },
  matchCol: { flex: 1, gap: space.md },
  matchTile: { alignSelf: 'stretch' },
})
