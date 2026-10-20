/**
 * Thin client for the Aytla API (see /server).
 * The base URL is baked in at build time: set EXPO_PUBLIC_API_URL for
 * production builds; development talks to the local server.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787').replace(/\/+$/, '')

/** `code` is the server's stable error code, or 'network' when the server could not be reached. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status: number) {
    super(code)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  token?: string | null
  timeoutMs?: number
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000)
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })
  } catch {
    throw new ApiError('network', 0)
  } finally {
    clearTimeout(timer)
  }

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    // non-JSON body: handled below through the status code
  }
  if (!response.ok) {
    const code = typeof data === 'object' && data !== null && typeof (data as { error?: unknown }).error === 'string' ? (data as { error: string }).error : 'server_error'
    throw new ApiError(code, response.status)
  }
  return data as T
}

// -- response shapes ------------------------------------------------------------

export interface ProvidersResponse {
  telegram: boolean
  /** sign in with Google (through Clerk) is configured on the server */
  google: boolean
}

export interface TelegramStartResponse {
  code: string
  secret: string
  url: string
  expiresAt: number
}

export type TelegramPollResponse = { status: 'pending' } | ({ status: 'confirmed' } & AuthResponse)

export interface AccountUser {
  id: number
  /** empty for accounts created through Telegram, or through Google when the email belongs to another account */
  email: string
  telegram?: boolean
  google?: boolean
  name: string
  guide: string
  tier: number
}

export interface AuthResponse {
  token: string
  user: AccountUser
}

export interface SyncGetResponse {
  state: unknown
  updatedAt: number
}

export interface SyncPutResponse {
  adopted: 'client' | 'server'
  state: unknown
  updatedAt: number
}

export interface LeagueEntry {
  rank: number
  userId: number
  name: string
  guide: string
  xp: number
  me: boolean
}

export interface LeagueResponse {
  weekId: string
  tier: number
  tierName: string
  joined: boolean
  promoteTop: number
  demoteBottom: number
  entries: LeagueEntry[]
}

export interface CoachScenario {
  id: string
  guide: string
  level: string
}

export interface CoachScenariosResponse {
  available: boolean
  dailyLimit: number
  scenarios: CoachScenario[]
}

export interface CoachReply {
  text: string
  translation: string
  correction: string
  better: string
}

export interface CoachChatResponse {
  reply: CoachReply
  remaining: number
}
