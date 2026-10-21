import { StyleSheet, View } from 'react-native'
import { colors, radius, space } from '../../theme/tokens'
import { AnimatedMascot, GUIDES } from '../../ui/Mascot'
import { Float } from '../../ui/Reveal'
import { Txt } from '../../ui/Txt'

/**
 * The hero on phones: the guide says the first sentence, the crew listens.
 * (On the web, HeroStage.web.tsx plays the Remotion composition instead.)
 */
export function HeroStage() {
  return (
    <View style={styles.stage}>
      <View style={styles.bubble}>
        <Txt variant="heading" color={colors.text}>
          Hello! How are you?
        </Txt>
      </View>
      <View style={styles.crew}>
        {GUIDES.slice(0, 3).map((g, i) => (
          <Float key={g.id} amplitude={5 + i * 2} duration={1800 + i * 230} delay={i * 150}>
            <AnimatedMascot id={g.id} size={i === 0 ? 128 : 84} mood={i === 0 ? 'talk' : 'cheer'} />
          </Float>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  stage: { flex: 1, padding: space.lg, justifyContent: 'space-between', gap: space.lg },
  bubble: { alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: radius.lg, borderBottomLeftRadius: 6, paddingHorizontal: space.lg, paddingVertical: space.md },
  crew: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
})
