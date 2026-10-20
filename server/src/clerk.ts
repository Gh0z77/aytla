import { createRemoteJWKSet, jwtVerify } from 'jose'

/**
 * Sign in with Google (and any other provider) goes through Clerk. The app
 * completes the OAuth flow with Clerk and sends us the Clerk session JWT; we
 * verify it against Clerk's published keys and hand back our own bearer token,
 * so the rest of the API does not care how the learner signed in.
 *
 * The Frontend API host is encoded in the publishable key, so one variable
 * (CLERK_PUBLISHABLE_KEY, the same the app uses) is enough on the server.
 */
export interface ClerkIdentity {
  /** the Clerk user id (`sub`) */
  id: string
}

export interface ClerkVerifier {
  verify(token: string): Promise<ClerkIdentity>
}

/** `pk_test_<base64 "host$">` → "host" */
export function frontendApiFromPublishableKey(key: string): string | null {
  const m = /^pk_(test|live)_([A-Za-z0-9+/=]+)$/.exec(key.trim())
  if (!m) return null
  try {
    const host = Buffer.from(m[2] as string, 'base64').toString('utf8').replace(/\$$/, '')
    return /^[a-z0-9.-]+$/i.test(host) ? host : null
  } catch {
    return null
  }
}

export function createClerkVerifier(publishableKey: string): ClerkVerifier | null {
  const host = frontendApiFromPublishableKey(publishableKey)
  if (!host) return null
  const issuer = `https://${host}`
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
  return {
    async verify(token) {
      const { payload } = await jwtVerify(token, jwks, { issuer })
      if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('clerk token without subject')
      return { id: payload.sub }
    },
  }
}
