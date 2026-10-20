import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { Platform, type ColorValue } from 'react-native'
import { useT } from '../../src/i18n'
import { colors, layout } from '../../src/theme/tokens'

type IconName = keyof typeof Ionicons.glyphMap

const icon =
  (name: IconName) =>
  ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={size + 4} color={color} />

/**
 * Four tabs: learn, practise, progress (league + quests + achievements) and
 * profile. The shop is reached from the gem counter and from the profile.
 * On desktop web the bar is as wide as the phone column the screens use.
 */
export default function TabsLayout() {
  const t = useT()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '800', fontFamily: 'Manrope_800ExtraBold' },
        tabBarStyle: {
          borderTopWidth: 2,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
          height: 74,
          paddingTop: 8,
          paddingBottom: 10,
          ...(Platform.OS === 'web' ? { width: '100%', maxWidth: layout.column, alignSelf: 'center', borderLeftWidth: 2, borderRightWidth: 2, borderColor: colors.border } : null),
        },
      }}
    >
      <Tabs.Screen name="learn" options={{ title: t('tabs.learn'), tabBarIcon: icon('home') }} />
      <Tabs.Screen name="practice" options={{ title: t('tabs.practice'), tabBarIcon: icon('mic') }} />
      <Tabs.Screen name="progress" options={{ title: t('tabs.progress'), tabBarIcon: icon('trophy') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), tabBarIcon: icon('person') }} />
    </Tabs>
  )
}
