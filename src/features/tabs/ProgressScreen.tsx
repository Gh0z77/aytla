import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useT } from '../../i18n'
import { colors, radius, space } from '../../theme/tokens'
import { TabScreen } from '../shell/TabScreen'
import { Txt } from '../../ui/Txt'
import { TopBar } from '../path/TopBar'
import { LeagueBody } from './LeagueScreen'
import { QuestsBody } from './QuestsScreen'

type Part = 'quests' | 'league'

/** One tab for everything that measures the climb: the week, quests and achievements, and the league. */
export function ProgressScreen() {
  const t = useT()
  const [part, setPart] = useState<Part>('quests')
  return (
    <TabScreen scroll>
      <TopBar />
      <View style={styles.segments}>
        {(['quests', 'league'] as const).map((p) => (
          <Pressable key={p} accessibilityRole="tab" accessibilityState={{ selected: part === p }} onPress={() => setPart(p)} style={[styles.segment, part === p ? styles.segmentOn : null]} testID={`progress-${p}`}>
            <Txt variant="label" color={part === p ? colors.primaryEdge : colors.textSoft} center>
              {t(p === 'quests' ? 'tabs.quests' : 'tabs.league')}
            </Txt>
          </Pressable>
        ))}
      </View>
      {part === 'quests' ? <QuestsBody /> : <LeagueBody />}
    </TabScreen>
  )
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', margin: space.lg, marginBottom: 0, padding: 4, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border },
  segment: { flex: 1, paddingVertical: 10, borderRadius: radius.md },
  segmentOn: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.primarySoft },
})
