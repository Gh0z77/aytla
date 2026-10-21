import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * An invite code arrives on the website as ?ref=CODE; it is kept until the
 * visitor creates an account (any method), then sent once with the sign-up.
 */
const KEY = 'aytla-ref-v1'
let pending: string | null | undefined

export async function rememberReferral(code: string): Promise<void> {
  const clean = code.trim().toUpperCase()
  if (!/^[A-Z0-9]{6,12}$/.test(clean)) return
  pending = clean
  try {
    await AsyncStorage.setItem(KEY, clean)
  } catch {
    // memory only, then
  }
}

export async function pendingReferral(): Promise<string | null> {
  if (pending !== undefined) return pending
  try {
    pending = await AsyncStorage.getItem(KEY)
  } catch {
    pending = null
  }
  return pending
}

export async function clearReferral(): Promise<void> {
  pending = null
  try {
    await AsyncStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

/** the link to share: the website with this learner's code */
export function inviteLink(code: string): string {
  const base = process.env.EXPO_PUBLIC_SITE_URL?.replace(/\/+$/, '') || (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://aytla.app')
  return `${base}/?ref=${code}`
}
