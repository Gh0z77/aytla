import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { UserState } from '../core/types'
import { secureStorage } from '../lib/secureStorage'
import { track } from '../lib/analytics'
import { clearReferral, pendingReferral } from '../lib/referral'
import { ApiError, api, type AccountUser, type AuthResponse, type SyncGetResponse, type SyncPutResponse, type TelegramPollResponse, type TelegramStartResponse } from '../lib/api'
import { useApp } from './store'

/**
 * Optional account. The app is fully usable as a guest; signing in adds cloud
 * sync (last write wins on the learner's own clock) and the weekly league.
 */
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline'

interface AccountStore {
  token: string | null
  account: AccountUser | null
  status: SyncStatus
  lastSyncAt: number
  register: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  /** `openLink` opens the t.me link (the screen owns that, so a browser can open it from the tap itself) */
  loginWithTelegram: (openLink: (url: string) => Promise<void> | void, signal?: AbortSignal) => Promise<void>
  /** exchanges a Clerk session token (after Google sign-in) for an app session */
  loginWithGoogle: (clerkToken: string, email: string, name: string) => Promise<void>
  logout: () => Promise<void>
  /** permanently deletes the account on the server; throws ApiError when the server could not be reached */
  deleteAccount: () => Promise<void>
  syncNow: () => Promise<void>
}

function isUserState(value: unknown): value is UserState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<UserState>
  return v.version === 1 && typeof v.xp === 'number' && typeof v.updatedAt === 'number' && typeof v.profile === 'object' && v.profile !== null && typeof v.lessons === 'object'
}

const hasProgress = (s: UserState) => s.xp > 0 || Object.keys(s.lessons).length > 0

let inFlight: Promise<void> | null = null
const TELEGRAM_POLL_MS = 2000

export const useAccount = create<AccountStore>()(
  persist(
    (set, get) => {
      /** After signing in, decide which side is ahead; a fresh guest device always takes the account's progress. */
      const reconcile = async (token: string) => {
        const local = useApp.getState().user
        const remote = await api<SyncGetResponse>('/sync', { token })
        if (isUserState(remote.state) && (!hasProgress(local) || remote.state.updatedAt > local.updatedAt)) {
          // keep this device's interface language and onboarding status in step with the stored profile
          useApp.setState({ user: { ...remote.state, profile: { ...remote.state.profile, onboarded: true } } })
          useApp.getState().tick()
        }
        await get().syncNow()
      }

      const adoptSession = async ({ token, user }: AuthResponse) => {
        set({ token, account: user })
        void clearReferral()
        track('signed_in', { pro: user.pro === true })
        await reconcile(token)
      }

      return {
        token: null,
        account: null,
        status: 'idle',
        lastSyncAt: 0,

        register: async (email, password) => {
          const name = useApp.getState().user.profile.name
          await adoptSession(await api<AuthResponse>('/auth/register', { method: 'POST', body: { email, password, name, ref: await pendingReferral() } }))
        },

        login: async (email, password) => {
          await adoptSession(await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }))
        },

        loginWithTelegram: async (openLink, signal) => {
          const lang = useApp.getState().user.profile.baseLang
          const started = await api<TelegramStartResponse>('/auth/telegram/start', { method: 'POST', body: { lang } })
          await openLink(started.url)
          // the learner is now in Telegram; ask the server until they confirm, give up when the code expires
          while (Date.now() < started.expiresAt) {
            await new Promise((resolve) => setTimeout(resolve, TELEGRAM_POLL_MS))
            if (signal?.aborted) throw new ApiError('cancelled', 0)
            let polled: TelegramPollResponse
            try {
              polled = await api<TelegramPollResponse>('/auth/telegram/poll', { method: 'POST', body: { code: started.code, secret: started.secret, ref: await pendingReferral() } })
            } catch (err) {
              // a dropped connection while the app is in the background is not the end of the login
              if (err instanceof ApiError && err.code === 'network') continue
              throw err
            }
            if (polled.status === 'confirmed') {
              await adoptSession(polled)
              return
            }
          }
          throw new ApiError('telegram_expired', 410)
        },

        loginWithGoogle: async (clerkToken, email, name) => {
          const fallback = useApp.getState().user.profile.name
          await adoptSession(await api<AuthResponse>('/auth/clerk', { method: 'POST', body: { token: clerkToken, email, name: name || fallback, ref: await pendingReferral() } }))
        },

        logout: async () => {
          const { token } = get()
          set({ token: null, account: null, status: 'idle' })
          if (token) await api('/auth/logout', { method: 'POST', token }).catch(() => undefined)
        },

        deleteAccount: async () => {
          const { token } = get()
          if (!token) return
          // the server removes the account with its sessions, progress and league history; the device keeps its local progress
          await api('/me', { method: 'DELETE', token })
          set({ token: null, account: null, status: 'idle', lastSyncAt: 0 })
        },

        syncNow: () => {
          const { token } = get()
          if (!token) return Promise.resolve()
          if (inFlight) return inFlight
          set({ status: 'syncing' })
          inFlight = (async () => {
            try {
              const sent = useApp.getState().user
              const result = await api<SyncPutResponse>('/sync', { method: 'PUT', token, body: { state: sent } })
              if (result.adopted === 'server' && isUserState(result.state)) {
                useApp.setState({ user: result.state })
                useApp.getState().tick()
              }
              set({ status: 'synced', lastSyncAt: Date.now() })
            } catch (err) {
              if (err instanceof ApiError && err.status === 401) set({ token: null, account: null, status: 'idle' })
              else set({ status: 'offline' })
            } finally {
              inFlight = null
            }
          })()
          return inFlight
        },
      }
    },
    {
      name: 'aytla-account-v1',
      // the token is a credential: Keychain / Keystore on phones (see lib/secureStorage)
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({ token: s.token, account: s.account, lastSyncAt: s.lastSyncAt }),
    }
  )
)

/** Push local progress to the cloud shortly after it changes (debounced), while signed in. */
export function startAutoSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastSeen = useApp.getState().user.updatedAt
  const unsubscribe = useApp.subscribe((state) => {
    if (state.user.updatedAt === lastSeen) return
    lastSeen = state.user.updatedAt
    if (!useAccount.getState().token) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void useAccount.getState().syncNow(), 2500)
  })
  return () => {
    unsubscribe()
    if (timer) clearTimeout(timer)
  }
}
