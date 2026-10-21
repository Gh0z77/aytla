import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, Platform } from 'react-native'
import { api } from './api'

/**
 * Product analytics and crash reports into our own API (see server/telemetry).
 * One random id per install, no personal data in the properties; events queue
 * locally and go out in batches, so a flaky connection costs nothing and a
 * guest's events are never lost. `token()` lets signed-in events carry the
 * account, which the server resolves itself.
 */
type Props = Record<string, string | number | boolean>
interface QueuedEvent {
  name: string
  ts: number
  props: Props
}

const ID_KEY = 'aytla-anon-v1'
const FLUSH_EVERY_MS = 20_000
const FLUSH_AT = 20
export const APP_VERSION = '1.0.0'

let anon: string | null = null
let queue: QueuedEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let tokenOf: () => string | null = () => null
let sending = false

const randomId = () => Array.from({ length: 24 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('')

async function anonId(): Promise<string> {
  if (anon) return anon
  try {
    const stored = await AsyncStorage.getItem(ID_KEY)
    if (stored) return (anon = stored)
    anon = randomId()
    await AsyncStorage.setItem(ID_KEY, anon)
  } catch {
    anon = anon ?? randomId()
  }
  return anon
}

/** record an event; the name is snake_case, props are small scalars */
export function track(name: string, props: Props = {}): void {
  queue.push({ name, ts: Date.now(), props })
  if (queue.length >= FLUSH_AT) void flush()
  else if (!timer) timer = setTimeout(() => void flush(), FLUSH_EVERY_MS)
}

export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (sending || queue.length === 0) return
  sending = true
  const batch = queue.slice(0, 50)
  try {
    await api('/events', { method: 'POST', body: { anon: await anonId(), events: batch }, token: tokenOf(), timeoutMs: 10_000 })
    queue = queue.slice(batch.length)
  } catch {
    // keep the batch for the next try; cap the backlog so a long offline stretch cannot grow forever
    if (queue.length > 500) queue = queue.slice(-500)
  } finally {
    sending = false
    if (queue.length > 0 && !timer) timer = setTimeout(() => void flush(), FLUSH_EVERY_MS)
  }
}

export async function reportError(message: string, stack?: string): Promise<void> {
  try {
    await api('/errors', { method: 'POST', body: { anon: await anonId(), message, stack: stack ?? '', platform: Platform.OS, version: APP_VERSION }, token: tokenOf(), timeoutMs: 10_000 })
  } catch {
    // reporting must never itself be a problem
  }
}

/** call once at start: flushes on background, catches uncaught errors; `token` supplies the session for signed-in events */
export function startAnalytics(token: () => string | null): () => void {
  tokenOf = token
  const sub = AppState.addEventListener('change', (state) => {
    if (state !== 'active') void flush()
  })
  const cleanups: Array<() => void> = [() => sub.remove()]
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const onError = (e: ErrorEvent) => void reportError(e.message || 'error', e.error instanceof Error ? e.error.stack : '')
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason: unknown = e.reason
      void reportError(reason instanceof Error ? reason.message : String(reason), reason instanceof Error ? reason.stack : '')
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    window.addEventListener('pagehide', () => void flush())
    cleanups.push(() => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    })
  } else {
    const utils = (globalThis as { ErrorUtils?: { getGlobalHandler(): (e: Error, fatal?: boolean) => void; setGlobalHandler(h: (e: Error, fatal?: boolean) => void): void } }).ErrorUtils
    if (utils) {
      const previous = utils.getGlobalHandler()
      utils.setGlobalHandler((error, fatal) => {
        void reportError(`${fatal ? 'fatal: ' : ''}${error.message}`, error.stack)
        previous(error, fatal)
      })
      cleanups.push(() => utils.setGlobalHandler(previous))
    }
  }
  track('app_open', { platform: Platform.OS })
  return () => cleanups.forEach((fn) => fn())
}
