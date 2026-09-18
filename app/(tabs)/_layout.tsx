import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import type { ColorValue } from 'react-native'
import { useT } from '../../src/i18n'
import { colors } from '../../src/theme/tokens'

type IconName = keyof typeof Ionicons.glyphMap

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} size={size + 2} color={color} />

export default function TabsLayout() {
  const t = useT()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { borderTopWidth: 2, borderTopColor: colors.border, backgroundColor: colors.bg, height: 76, paddingTop: 8, paddingBottom: 12 },
      }}
    >
      <Tabs.Screen name="learn" options={{ title: t('tabs.learn'), tabBarIcon: icon('home') }} />
      <Tabs.Screen name="practice" options={{ title: t('tabs.practice'), tabBarIcon: icon('barbell') }} />
      <Tabs.Screen name="league" options={{ title: t('tabs.league'), tabBarIcon: icon('trophy') }} />
      <Tabs.Screen name="quests" options={{ title: t('tabs.quests'), tabBarIcon: icon('ribbon') }} />
      <Tabs.Screen name="shop" options={{ title: t('tabs.shop'), tabBarIcon: icon('storefront') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon('person') }} />
    </Tabs>
  )
}
