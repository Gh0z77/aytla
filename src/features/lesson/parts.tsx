import { Ionicons } from '@expo/vector-icons'
import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import type { CharacterId } from '../../core/types'
import { speak } from '../../lib/speech'
import { EDGE, colors, radius, space } from '../../theme/tokens'
import { Mascot } from '../../ui/Mascot'
import { Txt } from '../../ui/Txt'

export type TileState = 'idle' | 'selected' | 'correct' | 'wrong' | 'ghost'

const TILE_COLORS: Record<TileState, { face: string; edge: string; border: string; text: string }> = {
  idle: { face: colors.white, edge: colors.borderStrong, border: colors.border, text: colors.text },
  selected: { face: colors.primaryTint, edge: colors.primary, border: colors.primary, text: colors.primaryEdge },
  correct: { face: colors.successSoft, edge: colors.success, border: colors.success, text: colors.successText },
  wrong: { face: colors.dangerSoft, edge: colors.danger, border: colors.danger, text: colors.dangerText },
  ghost: { face: colors.border, edge: colors.border, border: colors.border, text: 'transparent' },
}

interface TileProps {
  label: string
  onPress?: () => void
  state?: TileState
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  children?: ReactNode
  big?: boolean
}

/** A chunky word tile / answer card. */
export function Tile({ label, onPress, state = 'idle', disabled, style, children, big }: TileProps) {
  const [pressed, setPressed] = useState(false)
  const c = TILE_COLORS[state]
  const inert = disabled || state === 'ghost' || !onPress
  const down = pressed && !inert
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inert, selected: state === 'selected' }}
      disabled={inert}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={style}
    >
      <View style={[styles.tileEdge, { backgroundColor: c.edge, paddingBottom: down ? 0 : EDGE - 1, marginTop: down ? EDGE - 1 : 0 }]}>
        <View style={[styles.tileFace, big ? styles.tileFaceBig : null, { backgroundColor: c.face, borderColor: c.border }]}>
          {children}
          <Txt variant="body" color={c.text} center style={big ? styles.bigLabel : undefined}>
            {label}
          </Txt>
        </View>
      </View>
    </Pressable>
  )
}

export function SpeakerButton({ text, slow, size = 44 }: { text: string; slow?: boolean; size?: number }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={slow ? 'Play slowly' : 'Play audio'}
      onPress={() => speak(text, { slow })}
      style={({ pressed }) => [styles.speaker, { width: size, height: size, borderRadius: size / 3, opacity: pressed ? 0.75 : 1 }]}
    >
      <Ionicons name={slow ? 'hourglass-outline' : 'volume-high'} size={size * 0.5} color={colors.white} />
    </Pressable>
  )
}

/** The guide "says" the prompt in a speech bubble; English prompts get a speaker button. */
export function PromptBubble({ guide, text, audio }: { guide: CharacterId; text: string; audio?: string }) {
  return (
    <View style={styles.promptRow}>
      <Mascot id={guide} size={92} />
      <View style={styles.bubble}>
        {audio ? <SpeakerButton text={audio} size={36} /> : null}
        <Txt variant="body" style={styles.bubbleText}>
          {text}
        </Txt>
      </View>
    </View>
  )
}

export function Instruction({ children }: { children: ReactNode }) {
  return (
    <Txt variant="heading" style={styles.instruction}>
      {children}
    </Txt>
  )
}

const styles = StyleSheet.create({
  tileEdge: { borderRadius: radius.md },
  tileFace: { minHeight: 46, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tileFaceBig: { minHeight: 120, paddingVertical: 14, gap: 6 },
  bigLabel: { fontWeight: '700' },
  speaker: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  promptRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginBottom: space.lg },
  bubble: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    marginBottom: space.lg,
    backgroundColor: colors.white,
  },
  bubbleText: { flex: 1, fontSize: 18, lineHeight: 26 },
  instruction: { marginBottom: space.lg },
})
