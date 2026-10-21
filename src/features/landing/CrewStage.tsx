import { StyleSheet, View } from 'react-native'
import { space } from '../../theme/tokens'
import { AnimatedMascot, GUIDES } from '../../ui/Mascot'
import { Float } from '../../ui/Reveal'
import { Txt } from '../../ui/Txt'

/** The crew on phones: the living mascots in a row (the web plays the Remotion version). */
export function CrewStage() {
  return (
    <View style={styles.row}>
      {GUIDES.map((g, i) => (
        <View key={g.id} style={styles.guide}>
          <Float amplitude={4} duration={2000 + i * 180} delay={i * 120}>
            <AnimatedMascot id={g.id} size={92} mood={i % 3 === 0 ? 'talk' : i % 3 === 1 ? 'happy' : 'cheer'} />
          </Float>
          <Txt variant="label">{g.name}</Txt>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg },
  guide: { alignItems: 'center', gap: 4 },
})
