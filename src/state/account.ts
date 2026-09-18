import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { UserState } from '../core/types'
import { ApiError, api, type AccountUser, type AuthResponse, type SyncGetResponse, type SyncPutResponse } from '../lib/api'
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
  logout: () => Promise<void>
  syncNow: () => Promise<void>
}

function isUserState(value: unknown): value is UserState {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<UserState>
  return v.version === 1 && typeof v.xp === 'number' && typeof v.updatedAt === 'number' && typeof v.profile === 'object' && v.profile !== null && typeof v.lessons === 'object'
}

const hasProgress = (s: UserState) => s.xp > 0 || Object.keys(s.lessons).length > 0

let inFlight: Promise<void> | null = null

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
        await reconcile(token)
      }

      return {
        token: null,
        account: null,
        status: 'idle',
        lastSyncAt: 0,

        register: async (email, password) => {
          const name = useApp.getState().user.profile.name
          await adoptSession(await api<AuthResponse>('/auth/register', { method: 'POST', body: { email, password, name } }))
        },

        login: async (email, password) => {
          await adoptSession(await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }))
        },

        logout: async () => {
          const { token } = get()
          set({ token: null, account: null, status: 'idle' })
          if (token) await api('/auth/logout', { method: 'POST', token }).catch(() => undefined)
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
      name: 'everest-account-v1',
      storage: createJSONStorage(() => AsyncStorage),
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
