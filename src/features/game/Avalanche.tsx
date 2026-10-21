import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import { WORD_ID_MARKER } from '../../core/progress'
import { normalize, tokenize } from '../../core/text'
import type { Sentence } from '../../core/types'
import { useT } from '../../i18n'
import { resultFeedback, tapFeedback } from '../../lib/haptics'
import { speak, stopSpeaking } from '../../lib/speech'
import { useCourse } from '../../state/course'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'

/**
 * Avalanche: word order under pressure.
 *
 * A sentence in the learner's language is shown at the top and its English words
 * come sliding down the slope in a scrambled stream. Tap them in the right order
 * to build the sentence before any of them reaches the bottom. A wrong tap or a
 * word that gets away costs one of three ropes. Finished sentences are spoken
 * aloud and every sentence feeds spaced repetition.
 */

const LIVES = 3
const TILE_HEIGHT = 48
const TILE_GAP = 16
const START_SPEED = 46 // px per second
const SPEED_STEP = 5
const MAX_SPEED = 150
const MIN_TOKENS = 2
const MAX_TOKENS = 6
const MIN_POOL = 5
const MIN_ANSWERS_FOR_REWARD = 3

interface Tile {
  key: string
  text: string
  norm: string
  x: number
  y: number
  width: number
  taken: boolean
  wrongUntil: number
}

interface Round {
  sentence: Sentence
  order: string[] // normalised tokens, in sentence order
  tiles: Tile[]
  next: number
  clean: boolean
  doneAt: number | null
}

const tileWidth = (text: string) => Math.max(56, text.length * 11 + 28)

function buildRound(pool: readonly Sentence[], previous: Sentence | null, fieldWidth: number): Round {
  const candidates = pool.filter((s) => s.id !== previous?.id)
  const sentence = candidates[Math.floor(Math.random() * candidates.length)] as Sentence
  const tokens = tokenize(sentence.en, 'en')
  const stream = tokens.map((text, i) => ({ text, i }))
  for (let i = stream.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = stream[i] as (typeof stream)[number]
    stream[i] = stream[j] as (typeof stream)[number]
    stream[j] = tmp
  }
  // one tile per row of the stream, so tiles never overlap however wide they are
  const tiles = stream.map(({ text, i }, k) => {
    const width = Math.min(tileWidth(text), fieldWidth - 16)
    return { key: `${sentence.id}-${i}`, text, norm: normalize(text, 'en'), x: 8 + Math.random() * Math.max(0, fieldWidth - 16 - width), y: -(k + 1) * (TILE_HEIGHT + TILE_GAP), width, taken: false, wrongUntil: 0 }
  })
  return { sentence, order: tokens.map((tok) => normalize(tok, 'en')), tiles, next: 0, clean: true, doneAt: null }
}

type Phase = 'ready' | 'running' | 'over'

export function Avalanche() {
  // frame-loop component: positions live in a ref and every frame re-renders (see SummitRun)
  'use no memo'
  const router = useRouter()
  const t = useT()
  const lang = useApp((s) => s.user.profile.baseLang)
  const course = useCourse()
  const guide = useApp((s) => s.user.profile.guide)
  const sound = useApp((s) => s.user.profile.soundOn)
  const haptics = useApp((s) => s.user.profile.hapticsOn)
  const best = useApp((s) => s.user.profile.bestFall ?? 0)
  const srs = useApp((s) => s.user.srs)
  const setProfile = useApp((s) => s.setProfile)
  const completeSession = useApp((s) => s.completeSession)

  // sentences the learner has met; a brand-new learner gets the first unit's short ones
  const pool = useMemo(() => {
    const fits = (s: Sentence) => {
      const n = tokenize(s.en, 'en').length
      return n >= MIN_TOKENS && n <= MAX_TOKENS
    }
    const met = course.units.flatMap((u) => u.sentences).filter((s) => s.id in srs && !s.id.includes(WORD_ID_MARKER) && fits(s))
    if (met.length >= MIN_POOL) return met
    return (course.units[0]?.sentences ?? []).filter(fits)
  }, [srs])

  const [phase, setPhase] = useState<Phase>('ready')
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [, setFrame] = useState(0)
  const [earned, setEarned] = useState<number | null>(null)

  const game = useRef({ round: null as Round | null, speed: START_SPEED, score: 0, lives: LIVES, combo: 0, maxCombo: 0, mistakes: 0, startedAt: 0 })
  const answers = useRef(new Map<string, boolean>())
  const raf = useRef<number | null>(null)
  const last = useRef(0)

  const finish = useCallback(() => {
    setPhase('over')
    stopSpeaking()
    const g = game.current
    if (g.score > best) setProfile({ bestFall: g.score })
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

  const record = (round: Round, correct: boolean) => {
    if (!answers.current.has(round.sentence.id)) answers.current.set(round.sentence.id, correct)
  }

  const tick = useCallback(
    (now: number) => {
      const g = game.current
      const dt = Math.min(0.05, (now - last.current) / 1000)
      last.current = now

      if (!g.round) g.round = buildRound(pool, null, size.width)
      const round = g.round

      if (round.doneAt === null) {
        for (const tile of round.tiles) if (!tile.taken) tile.y += g.speed * dt
        // a word got away: the sentence is lost
        if (round.tiles.some((tile) => !tile.taken && tile.y + TILE_HEIGHT >= size.height)) {
          round.doneAt = now
          round.clean = false
          record(round, false)
          resultFeedback(haptics, false)
          g.lives -= 1
          g.mistakes += 1
          g.combo = 0
          g.speed = Math.max(START_SPEED, g.speed - SPEED_STEP * 2)
        }
      } else if (now - round.doneAt > 900) {
        g.round = g.lives > 0 ? buildRound(pool, round.sentence, size.width) : null
      }

      setFrame((f) => (f + 1) % 1_000_000)
      if (g.lives <= 0 && g.round === null) {
        finish()
        return
      }
      raf.current = requestAnimationFrame(tick)
    },
    [finish, haptics, pool, size.height, size.width]
  )

  const start = () => {
    game.current = { round: null, speed: START_SPEED, score: 0, lives: LIVES, combo: 0, maxCombo: 0, mistakes: 0, startedAt: Date.now() }
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

  const onTile = (tile: Tile) => {
    const g = game.current
    const round = g.round
    if (phase !== 'running' || !round || round.doneAt !== null || tile.taken) return
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    // a repeated word may be taken from any of its tiles
    if (tile.norm === round.order[round.next]) {
      tile.taken = true
      round.next += 1
      tapFeedback(haptics)
      if (round.next === round.order.length) {
        round.doneAt = now
        record(round, round.clean)
        resultFeedback(haptics, true)
        g.score += 10 * round.order.length + Math.min(g.combo, 10)
        g.combo += 1
        g.maxCombo = Math.max(g.maxCombo, g.combo)
        g.speed = Math.min(MAX_SPEED, g.speed + SPEED_STEP)
        if (sound) speak(round.sentence.en)
      }
      return
    }
    tile.wrongUntil = now + 350
    round.clean = false
    resultFeedback(haptics, false)
    g.lives -= 1
    g.mistakes += 1
    g.combo = 0
    if (g.lives <= 0) {
      round.doneAt = now
      record(round, false)
    }
  }

  const onLayout = (e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
  const exit = () => {
    stopSpeaking()
    if (router.canGoBack()) router.back()
    else router.replace('/practice')
  }

  const g = game.current
  const round = g.round
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()

  if (pool.length < 2) {
    return (
      <Screen>
        <View style={styles.center}>
          <Mascot id="rocky" size={140} />
          <Txt color={colors.textSoft} center>
            {t('games.run.needWords')}
          </Txt>
          <Button label={t('common.back')} onPress={exit} />
        </View>
      </Screen>
    )
  }

  const lost = round !== null && round.doneAt !== null && round.next < round.order.length
  // once the round is decided, show the sentence as it is really written
  const built = round ? (round.doneAt !== null ? round.sentence.en :tokenize(round.sentence.en, 'en').slice(0, round.next).join(' ')) : ''

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} background={colors.navy}>
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

      {/* the sentence to build, and what is built so far */}
      <View style={styles.prompt}>
        <Txt variant="caption" color="rgba(255,255,255,0.7)" style={styles.upper}>
          {t('games.fall.build')}
        </Txt>
        <Txt variant="heading" color={colors.white} center testID="fall-prompt">
          {phase === 'running' && round ? round.sentence.native[lang] : '···'}
        </Txt>
        <View style={[styles.built, lost ? styles.builtLost : null]}>
          <Txt variant="label" color={lost ? colors.dangerSoft : colors.successSoft} center testID="fall-built">
            {phase === 'running' && built ? built : ' '}
          </Txt>
        </View>
      </View>

      {/* the slope */}
      <View style={styles.field} onLayout={onLayout}>
        {phase === 'running' && round
          ? round.tiles.map((tile) =>
              tile.taken || tile.y + TILE_HEIGHT < 0 ? null : (
                <Pressable
                  key={tile.key}
                  onPress={() => onTile(tile)}
                  accessibilityRole="button"
                  accessibilityLabel={tile.text}
                  testID="fall-tile"
                  style={[styles.tile, tile.wrongUntil > now || lost ? styles.tileWrong : styles.tileIdle, { left: tile.x, top: tile.y, width: tile.width }]}
                >
                  <Txt variant="label" color={colors.navy} numberOfLines={1}>
                    {tile.text}
                  </Txt>
                </Pressable>
              )
            )
          : null}
        <View style={[styles.ground, styles.untouchable]} />

        {phase !== 'running' ? (
          <View style={styles.overlay}>
            <View style={styles.sheet}>
              <Mascot id={phase === 'over' ? guide : 'rocky'} size={120} />
              <Txt variant="title" center>
                {phase === 'over' ? t('games.run.over') : t('games.fall.title')}
              </Txt>
              {phase === 'over' ? (
                <View style={styles.scores}>
                  <Score label={t('games.run.score')} value={g.score} />
                  <Score label={t('games.run.best')} value={Math.max(best, g.score)} />
                  {earned !== null ? <Score label={t('common.xp')} value={`+${earned}`} /> : null}
                </View>
              ) : (
                <Txt color={colors.textSoft} center>
                  {t('games.fall.how')}
                </Txt>
              )}
              <Button label={phase === 'over' ? t('games.run.again') : t('games.run.start')} variant="success" onPress={start} testID="fall-start" />
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
  untouchable: { pointerEvents: 'none' },
  hud: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.md },
  hudStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prompt: { alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md, gap: 6 },
  built: { alignSelf: 'stretch', minHeight: 40, justifyContent: 'center', borderRadius: radius.md, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: space.md, paddingVertical: 6 },
  builtLost: { borderColor: colors.danger },
  field: { flex: 1, overflow: 'hidden', backgroundColor: '#13203A', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  tile: { position: 'absolute', height: TILE_HEIGHT, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderBottomWidth: 4 },
  tileIdle: { backgroundColor: colors.white, borderColor: colors.borderStrong },
  tileWrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 6, backgroundColor: colors.danger, opacity: 0.55 },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(11,18,32,0.72)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  sheet: { width: '100%', maxWidth: 420, backgroundColor: colors.white, borderRadius: radius.xl, padding: space.xl, alignItems: 'center', gap: space.md },
  scores: { flexDirection: 'row', gap: space.lg },
  score: { alignItems: 'center' },
})
