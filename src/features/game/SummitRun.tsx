import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { COURSE } from '../../content/course'
import { WORD_ID_MARKER } from '../../core/progress'
import type { Word } from '../../core/types'
import { useT } from '../../i18n'
import { resultFeedback, tapFeedback } from '../../lib/haptics'
import { speak, stopSpeaking } from '../../lib/speech'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'

/**
 * Uchish (flight): an endless flight whose obstacle IS the vocabulary.
 *
 * The guide runs up a three-lane trail. A word in the learner's language is
 * shown at the top; a row of three English gates slides down; steer into the
 * gate that translates it. Right answers speed the run up and are spoken aloud,
 * wrong ones cost one of three ropes. Every answer feeds spaced repetition, so
 * ten minutes of play is ten minutes of review.
 */

const LANES = 3
const LIVES = 3
const GATE_HEIGHT = 64
const RUNNER_SIZE = 84
const START_SPEED = 150 // px per second
const SPEED_STEP = 12
const MAX_SPEED = 420
const MIN_POOL = 6
const MIN_ANSWERS_FOR_REWARD = 5

interface Row {
  word: Word
  options: Word[]
  y: number
  resolved: 'right' | 'wrong' | null
}

function pickRow(pool: readonly Word[], previous: Word | null, y: number): Row {
  const candidates = pool.filter((w) => w.id !== previous?.id)
  const word = candidates[Math.floor(Math.random() * candidates.length)] as Word
  const others = pool.filter((w) => w.id !== word.id && w.en.toLowerCase() !== word.en.toLowerCase())
  const distractors: Word[] = []
  while (distractors.length < LANES - 1 && others.length > 0) {
    distractors.push(others.splice(Math.floor(Math.random() * others.length), 1)[0] as Word)
  }
  const options = [word, ...distractors]
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = options[i] as Word
    options[i] = options[j] as Word
    options[j] = tmp
  }
  return { word, options, y, resolved: null }
}

type Phase = 'ready' | 'running' | 'over'

export function SummitRun() {
  // The frame loop keeps positions in a ref and re-renders every frame; React Compiler's
  // memoisation assumes render output depends on props and state only, so opt this component out.
  'use no memo'
  const router = useRouter()
  const t = useT()
  const lang = useApp((s) => s.user.profile.baseLang)
  const guide = useApp((s) => s.user.profile.guide)
  const sound = useApp((s) => s.user.profile.soundOn)
  const haptics = useApp((s) => s.user.profile.hapticsOn)
  const best = useApp((s) => s.user.profile.bestRun ?? 0)
  const srs = useApp((s) => s.user.srs)
  const setProfile = useApp((s) => s.setProfile)
  const completeSession = useApp((s) => s.completeSession)

  // play with the words the learner has met; a brand-new learner gets the first lesson's words
  const pool = useMemo(() => {
    const met = COURSE.units.flatMap((u) => u.words).filter((w) => w.id in srs && w.id.includes(WORD_ID_MARKER))
    if (met.length >= MIN_POOL) return met
    return COURSE.units[0]?.words ?? []
  }, [srs])

  const [phase, setPhase] = useState<Phase>('ready')
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [, setFrame] = useState(0)
  const [earned, setEarned] = useState<number | null>(null)

  const game = useRef({ lane: 1, row: null as Row | null, speed: START_SPEED, score: 0, lives: LIVES, combo: 0, maxCombo: 0, mistakes: 0, startedAt: 0, stripes: 0 })
  const answers = useRef(new Map<string, boolean>())
  const raf = useRef<number | null>(null)
  const last = useRef(0)

  const runnerY = size.height - RUNNER_SIZE - 28
  const laneWidth = size.width / LANES

  const finish = useCallback(() => {
    setPhase('over')
    stopSpeaking()
    const g = game.current
    if (g.score > best) setProfile({ bestRun: g.score })
    if (answers.current.size >= MIN_ANSWERS_FOR_REWARD) {
      const rewards = completeSession({
        sessionKind: 'practice',
        lessonId: null,
        items: [...answers.current].map(([itemId, correct]) => ({ itemId, correct })),
        total: answers.current.size,
        mistakes: g.mistakes,
        maxCombo: g.maxCombo,
        seconds: Math.max(1, Math.round((Date.now() - g.startedAt) / 1000)),
      })
      setEarned(rewards.xp)
    }
  }, [best, completeSession, setProfile])

  const tick = useCallback(
    (now: number) => {
      const g = game.current
      const dt = Math.min(0.05, (now - last.current) / 1000)
      last.current = now
      g.stripes = (g.stripes + g.speed * dt) % 80

      if (!g.row) g.row = pickRow(pool, null, -GATE_HEIGHT)
      const row = g.row
      row.y += g.speed * dt

      // the gate reaches the runner: the lane the runner is in is the answer
      // (decided just above the runner's head, so the chosen word stays readable)
      if (row.resolved === null && row.y + GATE_HEIGHT >= runnerY - 6) {
        const chosen = row.options[g.lane]
        const right = chosen?.id === row.word.id
        row.resolved = right ? 'right' : 'wrong'
        if (!answers.current.has(row.word.id)) answers.current.set(row.word.id, right)
        resultFeedback(haptics, right)
        if (right) {
          g.score += 10 + Math.min(g.combo, 10)
          g.combo += 1
          g.maxCombo = Math.max(g.maxCombo, g.combo)
          g.speed = Math.min(MAX_SPEED, g.speed + SPEED_STEP)
          if (sound) speak(row.word.en)
        } else {
          g.lives -= 1
          g.mistakes += 1
          g.combo = 0
          g.speed = Math.max(START_SPEED, g.speed - SPEED_STEP * 2)
        }
      }
      if (row.y > size.height) g.row = g.lives > 0 ? pickRow(pool, row.word, -GATE_HEIGHT) : null

      setFrame((f) => (f + 1) % 1_000_000)
      if (g.lives <= 0 && g.row === null) {
        finish()
        return
      }
      raf.current = requestAnimationFrame(tick)
    },
    [finish, haptics, pool, runnerY, size.height, sound]
  )

  const start = () => {
    game.current = { lane: 1, row: null, speed: START_SPEED, score: 0, lives: LIVES, combo: 0, maxCombo: 0, mistakes: 0, startedAt: Date.now(), stripes: 0 }
    answers.current = new Map()
    setEarned(null)
    setPhase('running')
  }

  useEffect(() => {
    if (phase !== 'running' || size.height === 0) return
    last.current = typeof performance !== 'undefined' ? performance.now() : Date.now()
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
    }
  }, [phase, size.height, tick])

  const move = useCallback(
    (delta: number) => {
      if (phase !== 'running') return
      const g = game.current
      const next = Math.max(0, Math.min(LANES - 1, g.lane + delta))
      if (next !== g.lane) {
        g.lane = next
        tapFeedback(haptics)
      }
    },
    [haptics, phase]
  )

  // arrow keys and A / D on the web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') move(-1)
      if (e.key === 'ArrowRight' || e.key === 'd') move(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [move])

  const onLayout = (e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
  const exit = () => {
    stopSpeaking()
    if (router.canGoBack()) router.back()
    else router.replace('/practice')
  }

  const g = game.current
  const row = g.row

  if (pool.length < LANES) {
    return (
      <Screen>
        <View style={styles.center}>
          <Mascot id="aero" size={140} />
          <Txt color={colors.textSoft} center>
            {t('games.run.needWords')}
          </Txt>
          <Button label={t('common.back')} onPress={exit} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} background={colors.navy}>
      {/* HUD */}
      <View style={styles.hud}>
        <Pressable onPress={exit} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('games.run.exit')}>
          <Ionicons name="close" size={28} color={colors.white} />
        </Pressable>
        <View style={styles.hudStat}>
          <Ionicons name="flash" size={18} color={colors.gold} />
          <Txt variant="label" color={colors.white}>
            {g.score}
          </Txt>
        </View>
        <View style={styles.hudStat}>
          {Array.from({ length: LIVES }, (_, i) => (
            <Ionicons key={i} name="ellipse" size={14} color={i < g.lives ? colors.success : 'rgba(255,255,255,0.25)'} />
          ))}
        </View>
      </View>

      {/* the word to find */}
      <View style={styles.prompt}>
        <Txt variant="caption" color="rgba(255,255,255,0.7)" style={styles.upper}>
          {t('games.run.find')}
        </Txt>
        <Txt variant="title" color={colors.white} center testID="run-prompt">
          {phase === 'running' && row ? row.word.native[lang] : '···'}
        </Txt>
        {/* once the gate is decided, show the pair so a miss still teaches the word */}
        <Txt variant="label" color={row?.resolved === 'wrong' ? colors.dangerSoft : colors.successSoft} center style={styles.answer}>
          {phase === 'running' && row?.resolved ? `= ${row.word.en}` : ' '}
        </Txt>
      </View>

      {/* the trail */}
      <View style={styles.field} onLayout={onLayout}>
        {size.width > 0 ? (
          <>
            {[1, 2].map((i) =>
              Array.from({ length: Math.ceil(size.height / 80) + 1 }, (_, k) => (
                <View key={`${i}-${k}`} style={[styles.stripe, { left: laneWidth * i - 2, top: k * 80 - 80 + g.stripes }]} />
              ))
            )}

            {row
              ? row.options.map((option, lane) => {
                  const isAnswer = option.id === row.word.id
                  const tone = row.resolved === null ? styles.gateIdle : isAnswer ? styles.gateRight : lane === g.lane ? styles.gateWrong : styles.gateIdle
                  return (
                    <View key={`${option.id}-${lane}`} style={[styles.gate, tone, { left: laneWidth * lane + 6, width: laneWidth - 12, top: row.y }]}>
                      <Txt variant="label" color={colors.navy} center numberOfLines={2} style={styles.gateText}>
                        {option.en}
                      </Txt>
                    </View>
                  )
                })
              : null}

            <View style={[styles.runner, { left: laneWidth * g.lane + (laneWidth - RUNNER_SIZE) / 2, top: runnerY }]}>
              <Mascot id={guide} size={RUNNER_SIZE} />
            </View>

            {/* steering: the left and right halves of the trail */}
            <Pressable style={[styles.half, styles.halfLeft]} onPress={() => move(-1)} accessibilityRole="button" accessibilityLabel="Left" testID="run-left" />
            <Pressable style={[styles.half, styles.halfRight]} onPress={() => move(1)} accessibilityRole="button" accessibilityLabel="Right" testID="run-right" />
          </>
        ) : null}

        {phase !== 'running' ? (
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <Mascot id={phase === 'over' ? guide : 'aero'} size={120} />
              <Txt variant="title" center>
                {phase === 'over' ? t('games.run.over') : t('games.run.title')}
              </Txt>
              {phase === 'over' ? (
                <View style={styles.scores}>
                  <Score label={t('games.run.score')} value={g.score} />
                  <Score label={t('games.run.best')} value={Math.max(best, g.score)} />
                  {earned !== null ? <Score label={t('common.xp')} value={`+${earned}`} /> : null}
                </View>
              ) : (
                <Txt color={colors.textSoft} center>
                  {t('games.run.how')}
                </Txt>
              )}
              <Button label={phase === 'over' ? t('games.run.again') : t('games.run.start')} variant="success" onPress={start} testID="run-start" />
              <Button label={t('games.run.exit')} variant="ghost" onPress={exit} />
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  )
}

function Score({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.score}>
      <Txt variant="heading">{value}</Txt>
      <Txt variant="caption" color={colors.textSoft}>
        {label}
      </Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  upper: { textTransform: 'uppercase', letterSpacing: 1 },
  answer: { minHeight: 22 },
  hud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.md },
  hudStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prompt: { alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md, gap: 2 },
  field: { flex: 1, overflow: 'hidden', backgroundColor: '#13203A', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  stripe: { position: 'absolute', width: 4, height: 40, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)' },
  gate: { position: 'absolute', height: GATE_HEIGHT, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderBottomWidth: 4 },
  gateIdle: { backgroundColor: colors.white, borderColor: colors.borderStrong },
  gateRight: { backgroundColor: colors.successSoft, borderColor: colors.success },
  gateWrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  gateText: { fontSize: 16, lineHeight: 20 },
  runner: { position: 'absolute', width: RUNNER_SIZE, height: RUNNER_SIZE },
  half: { position: 'absolute', top: 0, bottom: 0, width: '50%' },
  halfLeft: { left: 0 },
  halfRight: { right: 0 },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(11,18,32,0.72)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: colors.white, borderRadius: radius.xl, padding: space.xl, alignItems: 'center', gap: space.md },
  scores: { flexDirection: 'row', gap: space.lg },
  score: { alignItems: 'center' },
})
