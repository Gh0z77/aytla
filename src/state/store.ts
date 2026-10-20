import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  addCoachNote,
  applyLessonResult,
  buy as buyItem,
  createInitialState,
  loseHeart as loseHeartPure,
  openChest as openChestPure,
  rollDay,
  syncHearts,
  updateProfile,
  type BuyFailure,
  type ShopItem,
} from '../core/progress'
import { completeChallenge as completeChallengePure } from '../core/mission'
import type { LessonResult, Profile, Rewards, UserState } from '../core/types'

/**
 * App state. All rules live in src/core as pure functions; the store only
 * holds the current UserState, stamps the clock and persists to device storage
 * (AsyncStorage on phones, localStorage on the web). Works fully offline.
 */
interface AppStore {
  user: UserState
  hydrated: boolean
  lastRewards: Rewards | null
  /** the lesson or review the last rewards came from (null for practice and games) */
  lastLessonId: string | null
  /** roll the day over and refill hearts; call on launch and when the app returns to the foreground */
  tick: () => void
  setProfile: (patch: Partial<Profile>) => void
  completeSession: (result: LessonResult) => Rewards
  loseHeart: () => void
  buy: (item: ShopItem) => { ok: true } | { ok: false; reason: BuyFailure }
  openChest: (chestId: string) => number
  markLessonsDone: (lessonIds: string[]) => void
  rememberCorrection: (better: string, note: string) => void
  /** the sentence of the day was attempted; rewards are empty when it was already done today */
  completeChallenge: (sentenceId: string, correct: boolean) => Rewards
  reset: () => void
}

export const useApp = create<AppStore>()(
  persist(
    (set, get) => ({
      user: createInitialState(Date.now()),
      hydrated: false,
      lastRewards: null,
      lastLessonId: null,

      tick: () => {
        const now = Date.now()
        set({ user: rollDay(syncHearts(get().user, now), now) })
      },

      setProfile: (patch) => set({ user: updateProfile(get().user, patch, Date.now()) }),

      completeSession: (result) => {
        const { state, rewards } = applyLessonResult(get().user, result, Date.now())
        set({ user: state, lastRewards: rewards, lastLessonId: result.lessonId })
        return rewards
      },

      loseHeart: () => set({ user: loseHeartPure(get().user, Date.now()) }),

      buy: (item) => {
        const outcome = buyItem(get().user, item, Date.now())
        set({ user: outcome.state })
        return outcome.ok ? { ok: true } : { ok: false, reason: outcome.reason }
      },

      openChest: (chestId) => {
        const { state, gems } = openChestPure(get().user, chestId, Date.now())
        set({ user: state })
        return gems
      },

      // placement: "I already know this" marks earlier lessons as done without awarding XP
      markLessonsDone: (lessonIds) => {
        const user = get().user
        const now = Date.now()
        const lessons = { ...user.lessons }
        lessonIds.forEach((id) => {
          if (!lessons[id]) lessons[id] = { completed: 1, bestAccuracy: 0, lastAt: now }
        })
        set({ user: { ...user, lessons, updatedAt: now } })
      },

      rememberCorrection: (better, note) => set({ user: addCoachNote(get().user, { better, note }, Date.now()) }),

      completeChallenge: (sentenceId, correct) => {
        const { state, rewards } = completeChallengePure(get().user, sentenceId, correct, Date.now())
        set({ user: state })
        return rewards
      },

      reset: () => set({ user: createInitialState(Date.now()), lastRewards: null, lastLessonId: null }),
    }),
    {
      name: 'aytla-user-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ user: s.user }),
      onRehydrateStorage: () => () => {
        useApp.setState({ hydrated: true })
        useApp.getState().tick()
      },
    }
  )
)
