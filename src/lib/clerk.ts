/**
 * Sign in with Google goes through Clerk. The publishable key is baked in at
 * build time; without it the app simply does not offer Google sign-in, and
 * nothing from Clerk is mounted (the rest of the app never depends on it).
 */
export const CLERK_PUBLISHABLE_KEY = (process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '').trim()

export const clerkEnabled = /^pk_(test|live)_/.test(CLERK_PUBLISHABLE_KEY)
