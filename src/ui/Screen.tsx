import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { colors, layout } from '../theme/tokens'

interface Props {
  children: ReactNode
  scroll?: boolean
  background?: string
  edges?: Edge[]
  contentStyle?: StyleProp<ViewStyle>
  /** full-width content (landing page); default is a phone-width column centred on wide screens */
  wide?: boolean
}

/** Safe-area screen with a centred phone-width column, so the same layout works on phones and desktop web. */
export function Screen({ children, scroll, background = colors.bg, edges = ['top', 'left', 'right'], contentStyle, wide }: Props) {
  const column = [styles.column, wide ? styles.wide : null, contentStyle]
  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor: background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={column}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[column, styles.fill]}>{children}</View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  column: { width: '100%', maxWidth: layout.column, alignSelf: 'center' },
  wide: { maxWidth: undefined },
})
