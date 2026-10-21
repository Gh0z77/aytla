import { api } from './api'

/**
 * What the API can do for this device, fetched once: whether AI practice is
 * on and whether the server can recognise speech. Until the answer arrives
 * (or when the API is unreachable) both are false, and the app behaves as
 * before: the device's own recognition or typing.
 */
interface Capabilities {
  coach: boolean
  speech: boolean
}

let known: Capabilities = { coach: false, speech: false }
let pending: Promise<Capabilities> | null = null

export function loadCapabilities(): Promise<Capabilities> {
  if (!pending) {
    pending = api<{ ok: boolean; coach?: boolean; speech?: boolean }>('/health', { timeoutMs: 8000 })
      .then((h) => {
        known = { coach: Boolean(h.coach), speech: Boolean(h.speech) }
        return known
      })
      .catch(() => {
        pending = null
        return known
      })
  }
  return pending
}

export const capabilities = (): Capabilities => known
