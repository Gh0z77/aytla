import { Ionicons } from '@expo/vector-icons'
import { Redirect, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { COURSE } from '../../content/course'
import { courseForGoal, goalPlan, isGoalUnit } from '../../core/goals'
import { buildPath, currentNode, type PathNode, type PathUnit } from '../../core/path'
import { CHEST_GEMS, XP_RULES } from '../../core/progress'
import type { Section } from '../../core/types'
import { useT, type StringKey } from '../../i18n'
import { tapFeedback } from '../../lib/haptics'
import { useApp } from '../../state/store'
import { NATIVE_DRIVER, colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { ProgressBar } from '../../ui/ProgressBar'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { TopBar } from './TopBar'

/**
 * The path is measured in what the learner can SAY: every lesson adds its
 * sentences to the count at the top, stages group the units by level, the
 * nodes follow a winding trail, and every lesson node carries the microphone
 * that says how it ends.
 */

const UNIT_COLORS = [colors.primary, colors.gem, colors.flame, colors.success, colors.heart, colors.goldEdge] as const

/** Horizontal drift of consecutive nodes: the trail winds. */
const DRIFT = [0, 40, 64, 40, 0, -40, -64, -40]
const NODE = 72

export function PathScreen() {
  const router = useRouter()
  const t = useT()
  const hydrated = useApp((s) => s.hydrated)
  const onboarded = useApp((s) => s.user.profile.onboarded)
  const lessons = useApp((s) => s.user.lessons)
  const chests = useApp((s) => s.user.chests)
  const lang = useApp((s) => s.user.profile.baseLang)
  const haptics = useApp((s) => s.user.profile.hapticsOn)
  const guideId = useApp((s) => s.user.profile.guide)
  const openChest = useApp((s) => s.openChest)

  const goal = useApp((s) => s.user.profile.goal)
  const dailyGoalXp = useApp((s) => s.user.profile.dailyGoalXp)
  // the route is assembled for the learner's goal: their units come first from Camp 1 on
  const course = useMemo(() => courseForGoal(COURSE, goal), [goal])
  // units are painted from the brand cycle, not from the colour written in the content files
  const path = useMemo(() => buildPath(course, { lessons, chests }).map((pu, i) => ({ ...pu, unit: { ...pu.unit, color: UNIT_COLORS[i % UNIT_COLORS.length] as string } })), [course, lessons, chests])
  const plan = useMemo(() => goalPlan(COURSE, { lessons, profile: { ...useApp.getState().user.profile, goal, dailyGoalXp } }), [goal, dailyGoalXp, lessons])
  const goalName = t(`goal.${goal ?? 'everyday'}` as StringKey)
  const current = useMemo(() => currentNode(path), [path])
  const [selected, setSelected] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // camps: the section each unit belongs to, in path order
  const sectionOf = useMemo(() => {
    const map = new Map<string, Section>()
    course.sections.forEach((s) => s.unitIds.forEach((id) => map.set(id, s)))
    return map
  }, [course])

  // the sentences the learner can say: every finished lesson adds its sentences
  const climb = useMemo(() => {
    let said = 0
    let total = 0
    let stepsDone = 0
    let steps = 0
    for (const pu of path) {
      pu.nodes.forEach((n) => {
        if (n.kind === 'chest') return
        steps += 1
        if (n.status === 'completed') stepsDone += 1
        if (n.kind === 'lesson' && n.lessonIndex !== null) {
          const count = pu.unit.lessons[n.lessonIndex]?.sentences.length ?? 0
          total += count
          if (n.status === 'completed') said += count
        }
      })
    }
    return { said, total, done: stepsDone, steps, ratio: total === 0 ? 0 : said / total }
  }, [path])

  const scroll = useRef<ScrollView>(null)
  const unitY = useRef<Record<string, number>>({})
  const scrolledTo = useRef<string | null>(null)
  const jumpToCurrent = (unitId: string) => {
    if (!current || current.unitId !== unitId || scrolledTo.current === unitId) return
    const y = unitY.current[unitId]
    if (y === undefined) return
    scrolledTo.current = unitId
    // the first unit sits right under the climb banner: leave the banner in view
    if (path[0]?.unit.id === unitId) return
    scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: false })
  }

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 1800)
    return () => clearTimeout(id)
  }, [toast])

  if (!hydrated) return <Screen>{null}</Screen>
  if (!onboarded) return <Redirect href="/welcome" />

  const onNode = (node: PathNode) => {
    tapFeedback(haptics)
    if (node.kind === 'chest' && node.status === 'available') {
      const gems = openChest(node.id)
      if (gems > 0) setToast(t('learn.chestOpened', { n: gems }))
      return
    }
    setSelected((prev) => (prev === node.id ? null : node.id))
  }

  let lastSectionId: string | null = null

  return (
    <Screen background={colors.sky}>
      <TopBar />
      <ScrollView ref={scroll} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* the climb so far */}
        <View style={styles.climb}>
          <View style={styles.climbTop}>
            <Ionicons name="flag" size={18} color={colors.primary} />
            <Txt variant="label" color={colors.primaryEdge} style={styles.flex}>
              {plan.remaining === 0 ? t('goal.planDone', { goal: goalName }) : t('goal.plan', { goal: goalName, weeks: plan.weeks })}
            </Txt>
          </View>
          <View style={styles.altitudeRow}>
            <View style={styles.flex}>
              <Txt variant="caption" color={colors.textSoft}>
                {t('learn.canSay')}
              </Txt>
              <Txt variant="title" color={colors.text}>
                {climb.said}
                <Txt variant="heading" color={colors.textMuted}>
                  {' '}/ {climb.total}
                </Txt>
              </Txt>
            </View>
            <Mascot id={guideId} size={64} mood={climb.said > 0 ? 'talk' : 'happy'} />
          </View>
          <ProgressBar value={climb.ratio} color={colors.lime} track={colors.surface} />
          <Txt variant="caption" color={colors.textMuted}>
            {t('learn.climbed', { done: climb.done, total: climb.steps })}
          </Txt>
        </View>

        {path.map((pu, unitIndex) => {
          const section = sectionOf.get(pu.unit.id)
          const newCamp = section !== undefined && section.id !== lastSectionId
          if (section) lastSectionId = section.id
          const unitNumber = unitIndex + 1
          return (
            <View
              key={pu.unit.id}
              onLayout={(e) => {
                unitY.current[pu.unit.id] = e.nativeEvent.layout.y
                jumpToCurrent(pu.unit.id)
              }}
            >
              {newCamp && section ? <Camp section={section} title={section.title[lang]} stage={t('learn.stage', { n: section.order })} locked={pu.locked} /> : null}
              <UnitCard
                pu={pu}
                number={unitNumber}
                title={pu.unit.title[lang]}
                goal={pu.unit.goal[lang]}
                tag={isGoalUnit(goal, pu.unit.id) ? t('goal.unitTag') : null}
                guidebook={t('learn.guidebook')}
                onGuidebook={() => router.push(`/unit/${pu.unit.id}`)}
              />
              <View style={styles.nodes}>
                <View style={[styles.mascot, styles.untouchable, unitIndex % 2 === 0 ? styles.mascotRight : styles.mascotLeft]}>
                  <Mascot id={pu.unit.guide} size={104} style={pu.locked ? styles.dim : undefined} />
                </View>
                {pu.nodes.map((node, i) => {
                  const side = unitIndex % 2 === 0 ? -1 : 1
                  const drift = (DRIFT[i % DRIFT.length] ?? 0) * side
                  const prevDrift = i === 0 ? 0 : (DRIFT[(i - 1) % DRIFT.length] ?? 0) * side
                  const isCurrent = current?.id === node.id
                  return (
                    <View key={node.id} style={styles.nodeRow}>
                      {i > 0 ? <Trail from={prevDrift} to={drift} lit={node.status !== 'locked'} /> : null}
                      <View style={[styles.nodeStack, { transform: [{ translateX: drift }] }]}>
                        {isCurrent && selected !== node.id ? <StartBubble label={t('learn.start')} color={pu.unit.color} /> : null}
                        <NodeButton node={node} color={pu.unit.color} current={isCurrent} onPress={() => onNode(node)} />
                      </View>
                      {selected === node.id ? (
                        <NodeCard
                          node={node}
                          pu={pu}
                          lessonTitle={node.lessonIndex !== null ? (pu.unit.lessons[node.lessonIndex]?.title[lang] ?? '') : ''}
                          onStart={() => {
                            setSelected(null)
                            router.push(`/lesson/${node.id}`)
                          }}
                        />
                      ) : null}
                    </View>
                  )
                })}
              </View>
            </View>
          )
        })}

        {/* the summit */}
        <View style={styles.summit}>
          <Mascot id={guideId} size={130} mood="cheer" />
          <Txt variant="heading" center>
            {t('learn.summit')}
          </Txt>
          <Txt color={colors.textSoft} center style={styles.summitBody}>
            {t('learn.comingSoon')}
          </Txt>
        </View>
      </ScrollView>
      {toast ? (
        <View style={[styles.toast, styles.untouchable]}>
          <Ionicons name="diamond" size={22} color={colors.gem} />
          <Txt variant="label" color={colors.white}>
            {toast}
          </Txt>
        </View>
      ) : null}
    </Screen>
  )
}

/** A stage marker between sections: stage number, name and CEFR level on a dashed line. */
function Camp({ section, title, stage, locked }: { section: Section; title: string; stage: string; locked: boolean }) {
  return (
    <View style={styles.camp}>
      <View style={styles.rope} />
      <View style={[styles.campBadge, locked ? styles.campLocked : null]}>
        <Txt variant="caption" color={locked ? colors.lockedText : colors.lime}>
          {stage}
        </Txt>
        <Txt variant="label" color={locked ? colors.lockedText : colors.white}>
          {title} · {section.cefr}
        </Txt>
      </View>
      <View style={styles.rope} />
    </View>
  )
}

function UnitCard({ pu, number, title, goal, tag, guidebook, onGuidebook }: { pu: PathUnit; number: number; title: string; goal: string; tag: string | null; guidebook: string; onGuidebook: () => void }) {
  const color = pu.locked ? colors.lockedText : pu.unit.color
  return (
    <View style={[styles.unitCard, { borderLeftColor: color }]}>
      <View style={[styles.unitNumber, { backgroundColor: color }]}>
        <Txt variant="label" color={colors.white}>
          {number}
        </Txt>
      </View>
      <View style={styles.flex}>
        <View style={styles.unitTitleRow}>
          <Txt variant="heading" style={styles.flex} numberOfLines={2}>
            {title}
          </Txt>
          {tag ? (
            <View style={[styles.tag, { backgroundColor: color }]}>
              <Txt variant="caption" color={colors.white}>
                {tag}
              </Txt>
            </View>
          ) : null}
        </View>
        <Txt color={colors.textSoft} style={styles.unitGoal}>
          {goal}
        </Txt>
        <View style={styles.unitBar}>
          <ProgressBar value={pu.progress} color={color} height={8} />
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={guidebook} onPress={onGuidebook} style={({ pressed }) => [styles.guidebook, { opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name="book" size={22} color={color} />
      </Pressable>
    </View>
  )
}

/** Three stones of trail between two nodes, interpolating the drift so the line follows the bend. */
function Trail({ from, to, lit }: { from: number; to: number; lit: boolean }) {
  return (
    <View style={[styles.trail, styles.untouchable]}>
      {[0.25, 0.5, 0.75].map((k) => (
        <View key={k} style={[styles.stone, lit ? styles.stoneLit : null, { top: k * 28 - 4, transform: [{ translateX: from + (to - from) * k }] }]} />
      ))}
    </View>
  )
}

const ICONS: Record<PathNode['kind'], keyof typeof Ionicons.glyphMap> = { lesson: 'footsteps', chest: 'gift', review: 'flag' }

function NodeButton({ node, color, current, onPress }: { node: PathNode; color: string; current: boolean; onPress: () => void }) {
  const [pressed, setPressed] = useState(false)
  const locked = node.status === 'locked'
  const done = node.status === 'completed'
  const face = locked ? colors.locked : done ? colors.gold : color
  const icon = locked ? 'lock-closed' : done && node.kind !== 'chest' ? 'checkmark' : ICONS[node.kind]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${node.kind} ${node.status}`}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={`node-${node.id}`}
      style={[styles.nodeWrap, current ? { borderColor: `${color}55` } : null]}
    >
      <View style={[styles.nodeFace, { backgroundColor: face, transform: [{ scale: pressed && !locked ? 0.94 : 1 }] }]}>
        <Ionicons name={icon} size={32} color={locked ? colors.lockedText : done ? colors.text : colors.white} />
      </View>
      {/* every lesson ends in speaking: the microphone says so before the learner opens it */}
      {node.kind === 'lesson' && !locked ? (
        <View style={styles.micBadge}>
          <Ionicons name="mic" size={13} color={done ? colors.goldEdge : color} />
        </View>
      ) : null}
    </Pressable>
  )
}

function StartBubble({ label, color }: { label: string; color: string }) {
  const bob = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -6, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(bob, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [bob])
  return (
    <Animated.View style={[styles.startBubble, styles.untouchable, { transform: [{ translateY: bob }], borderColor: color }]}>
      <Txt variant="label" color={color}>
        {label}
      </Txt>
    </Animated.View>
  )
}

function NodeCard({ node, pu, lessonTitle, onStart }: { node: PathNode; pu: PathUnit; lessonTitle: string; onStart: () => void }) {
  const t = useT()
  const locked = node.status === 'locked'
  const done = node.status === 'completed'
  const bg = locked ? colors.surface : pu.unit.color
  const fg = locked ? colors.textSoft : colors.white
  const title = node.kind === 'review' ? t('learn.review') : node.kind === 'chest' ? t('learn.chest') : lessonTitle
  const sub =
    node.kind === 'lesson' && node.lessonIndex !== null
      ? t('learn.lesson', { n: node.lessonIndex + 1, total: pu.unit.lessons.length })
      : node.kind === 'review'
        ? t('learn.reviewBody')
        : t('learn.chestOpened', { n: CHEST_GEMS })
  const xp = node.kind === 'review' ? (done ? XP_RULES.reviewReplay : XP_RULES.review) : done ? XP_RULES.lessonReplay : XP_RULES.lesson
  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: locked ? colors.border : bg }]}>
      <Txt variant="heading" color={fg}>
        {title}
      </Txt>
      <Txt color={fg} style={styles.cardSub}>
        {locked ? t('learn.locked') : sub}
      </Txt>
      {!locked && node.kind === 'lesson' ? (
        <View style={styles.cardHint}>
          <Ionicons name="mic" size={16} color={fg} />
          <Txt variant="caption" color={fg}>
            {t('learn.endsSpeaking')}
          </Txt>
        </View>
      ) : null}
      {!locked && node.kind !== 'chest' ? <Button label={t(done ? 'learn.practiceAgain' : 'learn.startLesson', { n: xp })} variant="secondary" onPress={onStart} testID="start-lesson" /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: 48 },
  // decoration must never swallow taps meant for the nodes underneath
  untouchable: { pointerEvents: 'none' },
  climb: { margin: space.lg, marginBottom: space.sm, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border, gap: space.sm },
  climbTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  altitudeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  camp: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, marginTop: space.lg, marginBottom: space.xs },
  rope: { flex: 1, height: 0, borderTopWidth: 2, borderColor: colors.borderStrong, borderStyle: 'dashed' },
  campBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.navy, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  campLocked: { backgroundColor: colors.locked },
  unitCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, margin: space.lg, marginBottom: space.sm, padding: space.md, paddingLeft: space.lg, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 2, borderLeftWidth: 6, borderColor: colors.border },
  unitNumber: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  unitTitleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  unitGoal: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  unitBar: { marginTop: space.sm },
  guidebook: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  nodes: { alignItems: 'center', paddingBottom: space.md },
  nodeRow: { alignItems: 'center', alignSelf: 'stretch' },
  // the START bubble is wider than the node: centre both on the same axis
  nodeStack: { alignItems: 'center' },
  trail: { height: 28, alignSelf: 'stretch', alignItems: 'center' },
  stone: { position: 'absolute', width: 10, height: 8, borderRadius: 5, backgroundColor: colors.borderStrong },
  stoneLit: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary },
  mascot: { position: 'absolute', top: '34%' },
  mascotRight: { right: 14 },
  mascotLeft: { left: 14 },
  dim: { opacity: 0.35 },
  nodeWrap: { borderRadius: NODE / 2 + 6, borderWidth: 5, borderColor: 'transparent' },
  nodeFace: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.7)' },
  micBadge: { position: 'absolute', right: -2, bottom: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  startBubble: { alignSelf: 'center', marginBottom: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.md, borderWidth: 2, backgroundColor: colors.white },
  card: { alignSelf: 'stretch', marginHorizontal: space.lg, marginTop: space.md, borderRadius: radius.lg, borderWidth: 2, padding: space.lg, gap: space.sm },
  cardSub: { fontSize: 15, lineHeight: 21 },
  cardHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.xs },
  summit: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  summitBody: { fontSize: 14, lineHeight: 20 },
  toast: { position: 'absolute', bottom: 24, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.navy, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill },
})
