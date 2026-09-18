import { Ionicons } from '@expo/vector-icons'
import { Redirect, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { COURSE } from '../../content/course'
import { buildPath, currentNode, type PathNode, type PathUnit } from '../../core/path'
import { CHEST_GEMS, XP_RULES } from '../../core/progress'
import { useT } from '../../i18n'
import { tapFeedback } from '../../lib/haptics'
import { useApp } from '../../state/store'
import { NATIVE_DRIVER, colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Mascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { TopBar } from './TopBar'

/** Horizontal drift of consecutive nodes: the path winds like a mountain trail. */
const DRIFT = [0, 44, 72, 44, 0, -44, -72, -44]
const NODE = 74
const NODE_EDGE = 8

export function PathScreen() {
  const router = useRouter()
  const t = useT()
  const hydrated = useApp((s) => s.hydrated)
  const onboarded = useApp((s) => s.user.profile.onboarded)
  const lessons = useApp((s) => s.user.lessons)
  const chests = useApp((s) => s.user.chests)
  const lang = useApp((s) => s.user.profile.baseLang)
  const haptics = useApp((s) => s.user.profile.hapticsOn)
  const openChest = useApp((s) => s.openChest)

  const path = useMemo(() => buildPath(COURSE, { lessons, chests }), [lessons, chests])
  const current = useMemo(() => currentNode(path), [path])
  const [selected, setSelected] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const scroll = useRef<ScrollView>(null)
  const unitY = useRef<Record<string, number>>({})
  const scrolledTo = useRef<string | null>(null)
  const jumpToCurrent = (unitId: string) => {
    if (!current || current.unitId !== unitId || scrolledTo.current === unitId) return
    const y = unitY.current[unitId]
    if (y === undefined) return
    scrolledTo.current = unitId
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

  return (
    <Screen>
      <TopBar />
      <ScrollView ref={scroll} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {path.map((pu, unitIndex) => (
          <View
            key={pu.unit.id}
            onLayout={(e) => {
              unitY.current[pu.unit.id] = e.nativeEvent.layout.y
              jumpToCurrent(pu.unit.id)
            }}
          >
            <UnitHeader pu={pu} index={unitIndex} title={pu.unit.title[lang]} goal={pu.unit.goal[lang]} label={t('learn.unit', { n: unitIndex + 1 })} guidebook={t('learn.guidebook')} onGuidebook={() => router.push(`/unit/${pu.unit.id}`)} />
            <View style={styles.nodes}>
              <View style={[styles.mascot, styles.untouchable, unitIndex % 2 === 0 ? styles.mascotRight : styles.mascotLeft]}>
                <Mascot id={pu.unit.guide} size={120} style={pu.locked ? styles.dim : undefined} />
              </View>
              {pu.nodes.map((node, i) => {
                const drift = (DRIFT[i % DRIFT.length] ?? 0) * (unitIndex % 2 === 0 ? -1 : 1)
                const isCurrent = current?.id === node.id
                return (
                  <View key={node.id} style={styles.nodeRow}>
                    <View style={[styles.nodeStack, { transform: [{ translateX: drift }] }]}>
                      {isCurrent && selected !== node.id ? <StartBubble label={t('learn.start')} color={pu.unit.color} /> : null}
                      <NodeButton node={node} color={pu.unit.color} onPress={() => onNode(node)} />
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
        ))}
        <View style={styles.soon}>
          <Mascot id="aero" size={120} />
          <Txt color={colors.textSoft} center>
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

function UnitHeader({ pu, title, goal, label, guidebook, onGuidebook }: { pu: PathUnit; index: number; title: string; goal: string; label: string; guidebook: string; onGuidebook: () => void }) {
  const bg = pu.locked ? colors.lockedText : pu.unit.color
  return (
    <View style={[styles.unitHeader, { backgroundColor: bg }]}>
      <View style={styles.unitText}>
        <Txt variant="caption" color="rgba(255,255,255,0.85)" style={styles.unitLabel}>
          {label}
        </Txt>
        <Txt variant="heading" color={colors.white}>
          {title}
        </Txt>
        <Txt variant="body" color="rgba(255,255,255,0.9)" style={styles.unitGoal}>
          {goal}
        </Txt>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={guidebook} onPress={onGuidebook} style={({ pressed }) => [styles.guidebook, { opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name="book" size={22} color={colors.white} />
      </Pressable>
    </View>
  )
}

const ICONS: Record<PathNode['kind'], keyof typeof Ionicons.glyphMap> = { lesson: 'star', chest: 'gift', review: 'trophy' }

function NodeButton({ node, color, onPress }: { node: PathNode; color: string; onPress: () => void }) {
  const [pressed, setPressed] = useState(false)
  const locked = node.status === 'locked'
  const done = node.status === 'completed'
  const face = locked ? colors.locked : done ? colors.gold : color
  const icon = locked ? 'lock-closed' : done && node.kind !== 'chest' ? 'checkmark' : ICONS[node.kind]
  const lift = pressed ? 0 : NODE_EDGE
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${node.kind} ${node.status}`}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      testID={`node-${node.id}`}
    >
      {/* edge = the face colour darkened by an overlay, so any unit colour gets a matching rim */}
      <View style={[styles.nodeEdge, { backgroundColor: face, paddingBottom: lift, marginTop: NODE_EDGE - lift }]}>
        <View style={styles.nodeShade} />
        <View style={[styles.nodeFace, { backgroundColor: face }]}>
          <Ionicons name={icon} size={34} color={locked ? colors.lockedText : colors.white} />
        </View>
      </View>
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
    <Animated.View style={[styles.startBubble, styles.untouchable, { transform: [{ translateY: bob }] }]}>
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
      {!locked && node.kind !== 'chest' ? <Button label={t(done ? 'learn.practiceAgain' : 'learn.startLesson', { n: xp })} variant="secondary" onPress={onStart} testID="start-lesson" /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 48 },
  // decoration must never swallow taps meant for the nodes underneath
  untouchable: { pointerEvents: 'none' },
  unitHeader: { margin: space.lg, marginBottom: space.md, borderRadius: radius.lg, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md },
  unitText: { flex: 1 },
  unitLabel: { textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  unitGoal: { marginTop: 4, fontSize: 14, lineHeight: 20 },
  guidebook: { width: 46, height: 46, borderRadius: radius.md, borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  nodes: { alignItems: 'center', paddingVertical: space.md },
  nodeRow: { alignItems: 'center', alignSelf: 'stretch', marginVertical: 9 },
  // the START bubble is wider than the node: centre both on the same axis
  nodeStack: { alignItems: 'center' },
  mascot: { position: 'absolute', top: '32%' },
  mascotRight: { right: 18 },
  mascotLeft: { left: 18 },
  dim: { opacity: 0.35 },
  nodeEdge: { width: NODE, borderRadius: NODE / 2, overflow: 'hidden' },
  nodeShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.26)' },
  nodeFace: { width: NODE, height: NODE - NODE_EDGE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center' },
  startBubble: {
    alignSelf: 'center',
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  card: { alignSelf: 'stretch', marginHorizontal: space.lg, marginTop: space.md, borderRadius: radius.lg, borderWidth: 2, padding: space.lg, gap: space.sm },
  cardSub: { fontSize: 15, lineHeight: 21, marginBottom: space.xs },
  soon: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.navy,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
})
