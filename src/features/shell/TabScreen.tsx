import { Ionicons } from '@expo/vector-icons'
import { usePathname, useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import { dayKey } from '../../core/time'
import { useT, type StringKey } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, layout, radius, space } from '../../theme/tokens'
import { Mascot } from '../../ui/Mascot'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { MissionCard } from '../path/MissionCard'

/** Desktop web starts here; below it the tab screens look like the phone app. */
export const DESKTOP_MIN_WIDTH = 1000

export function useDesktop(): boolean {
  const { width } = useWindowDimensions()
  return Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH
}

const NAV: Array<{ href: string; label: StringKey; icon: keyof typeof Ionicons.glyphMap }> = [
  { href: '/learn', label: 'tabs.learn', icon: 'home' },
  { href: '/practice', label: 'tabs.practice', icon: 'mic' },
  { href: '/progress', label: 'tabs.progress', icon: 'trophy' },
  { href: '/profile', label: 'tabs.profile', icon: 'person' },
]

/**
 * A tab screen. On a phone (and narrow browser windows) it is the plain
 * screen with the bottom tab bar. On desktop web it becomes three columns:
 * a navigation rail, the screen itself, and a "today" panel with the daily
 * mission and the streak, so the page uses the width instead of floating a
 * phone column in the middle.
 */
export function TabScreen({ children, scroll, background }: { children: ReactNode; scroll?: boolean; background?: string }) {
  const desktop = useDesktop()
  if (!desktop) {
    return (
      <Screen scroll={scroll} background={background}>
        {children}
      </Screen>
    )
  }
  return (
    <View style={styles.shell}>
      <Rail />
      <View style={[styles.center, background ? { backgroundColor: background } : null]}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.centerScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.column}>{children}</View>
          </ScrollView>
        ) : (
          <View style={[styles.column, styles.flex]}>{children}</View>
        )}
      </View>
      <Aside />
    </View>
  )
}

function Rail() {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  return (
    <View style={styles.rail}>
      <Pressable accessibilityRole="link" onPress={() => router.push('/learn')} style={styles.brand}>
        <Mascot id="everest" size={40} mood="talk" />
        <Txt variant="heading" style={styles.brandText}>
          aytla
        </Txt>
      </Pressable>
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Pressable key={item.href} accessibilityRole="link" accessibilityState={{ selected: active }} onPress={() => router.push(item.href as never)} style={({ pressed }) => [styles.navItem, active ? styles.navActive : null, { opacity: pressed ? 0.8 : 1 }]} testID={`rail-${item.href.slice(1)}`}>
            <Ionicons name={active ? item.icon : (`${item.icon}-outline` as keyof typeof Ionicons.glyphMap)} size={24} color={active ? colors.primary : colors.textSoft} />
            <Txt variant="label" color={active ? colors.primary : colors.textSoft}>
              {t(item.label)}
            </Txt>
          </Pressable>
        )
      })}
    </View>
  )
}

function Aside() {
  const t = useT()
  const streak = useApp((s) => s.user.streak.current)
  const gems = useApp((s) => s.user.gems)
  const spoken = useApp((s) => s.user.days[dayKey(Date.now())]?.spoken ?? 0)
  return (
    // a ScrollView grows to fill a row on the web, so the fixed width lives on a wrapping View
    <View style={styles.aside}>
      <ScrollView contentContainerStyle={styles.asideContent} showsVerticalScrollIndicator={false}>
        <Txt variant="caption" color={colors.textMuted} style={styles.asideTitle}>
          {t('shell.today')}
        </Txt>
        <MissionCard compact />
        <View style={styles.stats}>
          <Stat icon="flame" color={streak > 0 ? colors.flame : colors.textMuted} value={String(streak)} label={t('shell.streakDays', { n: streak })} />
          <Stat icon="mic" color={colors.success} value={String(spoken)} label={t('top.spoken')} />
          <Stat icon="diamond" color={colors.gem} value={String(gems)} label={t('result.gems')} />
        </View>
      </ScrollView>
    </View>
  )
}

function Stat({ icon, color, value, label }: { icon: keyof typeof Ionicons.glyphMap; color: string; value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={20} color={color} />
      <Txt variant="heading">{value}</Txt>
      <Txt variant="caption" color={colors.textSoft} numberOfLines={2} style={styles.flex}>
        {label}
      </Txt>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shell: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg, justifyContent: 'center' },
  rail: { width: 236, paddingVertical: space.xl, paddingHorizontal: space.md, gap: 6, borderRightWidth: 2, borderColor: colors.border },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, marginBottom: space.lg },
  brandText: { fontSize: 26, letterSpacing: -0.5 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 12, borderRadius: radius.lg },
  navActive: { backgroundColor: colors.primaryTint },
  center: { flex: 1, maxWidth: layout.column + 160, borderRightWidth: 2, borderColor: colors.border },
  centerScroll: { flexGrow: 1 },
  column: { width: '100%' },
  aside: { width: 340, flexShrink: 0 },
  asideContent: { padding: space.lg, gap: space.md },
  asideTitle: { textTransform: 'uppercase', letterSpacing: 1 },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, alignItems: 'center', gap: 2, padding: space.sm, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.white },
})
