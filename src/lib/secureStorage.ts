import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import type { StateStorage } from 'zustand/middleware'

/**
 * Where the session token lives. On phones that is the Keychain / Keystore
 * (expo-secure-store); the browser has no equivalent, so the web keeps using
 * AsyncStorage (localStorage). Values must stay small: SecureStore is meant for
 * a few kilobytes, which is plenty for a token and an account summary.
 */
const native = Platform.OS === 'ios' || Platform.OS === 'android'

// SecureStore keys may only contain letters, digits, ".", "-" and "_"
const safeKey = (name: string) => name.replace(/[^A-Za-z0-9._-]/g, '_')

export const secureStorage: StateStorage = {
  getItem: async (name) => {
    if (!native) return AsyncStorage.getItem(name)
    const stored = await SecureStore.getItemAsync(safeKey(name))
    if (stored !== null) return stored
    // sessions saved before the move to the Keychain: carry them over once
    const legacy = await AsyncStorage.getItem(name)
    if (legacy !== null) {
      await SecureStore.setItemAsync(safeKey(name), legacy)
      await AsyncStorage.removeItem(name)
    }
    return legacy
  },
  setItem: async (name, value) => {
    if (native) await SecureStore.setItemAsync(safeKey(name), value)
    else await AsyncStorage.setItem(name, value)
  },
  removeItem: async (name) => {
    if (native) await SecureStore.deleteItemAsync(safeKey(name))
    else await AsyncStorage.removeItem(name)
  },
}
