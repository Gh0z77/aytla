import { ScrollView, StyleSheet, View } from 'react-native'
import { CREW, type Mood } from '../src/ui/mascot/draw'
import { Mascot } from '../src/ui/Mascot'
import { Txt } from '../src/ui/Txt'
import { colors, space } from '../src/theme/tokens'

const MOODS: Mood[] = ['happy', 'cheer', 'sad', 'think', 'talk', 'sleep']

/** The whole crew in every mood: a design review page, not linked from the app (open /crew). */
export default function CrewSheet() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {CREW.map((c) => (
        <View key={c.id} style={styles.row}>
          <Txt variant="heading" style={styles.name}>
            {c.name}
          </Txt>
          {MOODS.map((mood) => (
            <View key={mood} style={styles.cell}>
              <Mascot id={c.id} size={120} mood={mood} />
              <Txt variant="caption" color={colors.textMuted}>
                {mood}
              </Txt>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, flexWrap: 'wrap' },
  name: { width: 110 },
  cell: { alignItems: 'center', gap: 4 },
})
