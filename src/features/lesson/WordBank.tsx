import { StyleSheet, View } from 'react-native'
import { tapFeedback } from '../../lib/haptics'
import { colors, space } from '../../theme/tokens'
import { Tile } from './parts'

interface Props {
  tokens: string[]
  /** indices into `tokens`, in the order the learner tapped them */
  chosen: number[]
  onChange: (chosen: number[]) => void
  disabled?: boolean
  haptics?: boolean
}

/**
 * Tap-to-build sentence: tiles move from the bank to the answer lines and
 * back. Tiles are tracked by index, so repeated words ("the ... the") work.
 */
export function WordBank({ tokens, chosen, onChange, disabled, haptics = true }: Props) {
  const used = new Set(chosen)
  const add = (i: number) => {
    tapFeedback(haptics)
    onChange([...chosen, i])
  }
  const remove = (i: number) => {
    tapFeedback(haptics)
    onChange(chosen.filter((x) => x !== i))
  }
  return (
    <View>
      <View style={styles.answer} accessibilityLabel="Your answer">
        {chosen.map((i) => (
          <Tile key={`a-${i}`} label={tokens[i] ?? ''} onPress={() => remove(i)} disabled={disabled} style={styles.tile} />
        ))}
      </View>
      <View style={styles.bank}>
        {tokens.map((token, i) => (
          <Tile key={`b-${i}`} label={token} state={used.has(i) ? 'ghost' : 'idle'} onPress={() => add(i)} disabled={disabled || used.has(i)} style={styles.tile} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  answer: {
    minHeight: 116,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.border,
    paddingVertical: space.sm,
    marginBottom: space.xl,
  },
  bank: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  tile: { margin: 4 },
})
