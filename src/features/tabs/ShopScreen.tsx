import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { MAX_HEARTS, SHOP, type BuyFailure, type ShopItem } from '../../core/progress'
import { useT, type StringKey } from '../../i18n'
import { useApp } from '../../state/store'
import { colors, radius, space } from '../../theme/tokens'
import { Button } from '../../ui/Button'
import { Screen } from '../../ui/Screen'
import { Txt } from '../../ui/Txt'
import { TopBar } from '../path/TopBar'

const FAILURE: Record<BuyFailure, StringKey> = { gems: 'shop.noGems', max: 'shop.max', full: 'shop.full' }

const ITEMS: Array<{ id: ShopItem; icon: keyof typeof Ionicons.glyphMap; color: string; title: StringKey; body: StringKey }> = [
  { id: 'streakFreeze', icon: 'snow', color: colors.gem, title: 'shop.freeze.title', body: 'shop.freeze.body' },
  { id: 'heartRefill', icon: 'heart', color: colors.heart, title: 'shop.refill.title', body: 'shop.refill.body' },
  { id: 'xpBoost', icon: 'flash', color: colors.gold, title: 'shop.boost.title', body: 'shop.boost.body' },
]

export function ShopScreen() {
  const t = useT()
  const user = useApp((s) => s.user)
  const buy = useApp((s) => s.buy)
  const [message, setMessage] = useState<{ item: ShopItem; text: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!message) return
    const id = setTimeout(() => setMessage(null), 2200)
    return () => clearTimeout(id)
  }, [message])

  const now = Date.now()
  const boostLeft = Math.max(0, Math.ceil((user.xpBoostUntil - now) / 60_000))

  const note = (item: ShopItem): string | null => {
    if (item === 'streakFreeze') return t('shop.owned', { n: user.streak.freezes })
    if (item === 'xpBoost' && boostLeft > 0) return t('shop.boostActive', { n: boostLeft })
    return null
  }
  const unavailable = (item: ShopItem): boolean => {
    if (item === 'streakFreeze') return user.streak.freezes >= SHOP.streakFreeze.max
    if (item === 'heartRefill') return user.hearts.count >= MAX_HEARTS
    return false
  }

  return (
    <Screen scroll>
      <TopBar />
      <View style={styles.body}>
        <Txt variant="title">{t('shop.title')}</Txt>
        {ITEMS.map((item) => {
          const cost = SHOP[item.id].cost
          const info = note(item.id)
          return (
            <View key={item.id} style={styles.card}>
              <View style={styles.top}>
                <View style={[styles.icon, { backgroundColor: item.color }]}>
                  <Ionicons name={item.icon} size={30} color={colors.white} />
                </View>
                <View style={styles.flex}>
                  <Txt style={styles.bold}>{t(item.title)}</Txt>
                  <Txt color={colors.textSoft} style={styles.small}>
                    {t(item.body)}
                  </Txt>
                  {info ? (
                    <Txt variant="caption" color={colors.primary}>
                      {info}
                    </Txt>
                  ) : null}
                </View>
              </View>
              <Button
                small
                variant="secondary"
                label={t('shop.buy', { n: cost })}
                disabled={user.gems < cost || unavailable(item.id)}
                icon={<Ionicons name="diamond" size={16} color={user.gems < cost || unavailable(item.id) ? colors.lockedText : colors.gem} />}
                onPress={() => {
                  const outcome = buy(item.id)
                  setMessage({ item: item.id, ok: outcome.ok, text: outcome.ok ? t('shop.bought') : t(FAILURE[outcome.reason]) })
                }}
                testID={`buy-${item.id}`}
              />
              {message?.item === item.id ? (
                <Txt variant="caption" color={message.ok ? colors.success : colors.danger} center>
                  {message.text}
                </Txt>
              ) : null}
            </View>
          )
        })}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  small: { fontSize: 14, lineHeight: 20 },
  body: { padding: space.lg, gap: space.md },
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  top: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  icon: { width: 58, height: 58, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
})
