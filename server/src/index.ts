import { serve } from '@hono/node-server'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createApp } from './app.ts'
import { createClerkVerifier } from './clerk.ts'
import { createCoachFromEnv } from './coach-anthropic.ts'
import { createGeminiCoachFromEnv } from './coach-gemini.ts'
import { openDb } from './db.ts'
import { sendDueReminders } from './reminders.ts'
import { startTelegramBot } from './telegram.ts'
import { createGeminiTranscriberFromEnv } from './transcribe.ts'

/**
 * Entry point.  Environment:
 *   PORT               default 8787
 *   DATABASE_URL       a postgres:// URL (Supabase); when set, the SQLite file is not used
 *   DATABASE_FILE      SQLite file for local runs; default ./data/aytla.db
 *   CLERK_PUBLISHABLE_KEY  enables "sign in with Google" through Clerk (same key as the app)
 *   CORS_ORIGINS       comma-separated list; default: any origin (bearer tokens, no cookies)
 *   ANTHROPIC_API_KEY  enables AI conversation practice; without credentials /coach/chat answers 503
 *                      (COACH_ENABLED=1 also enables it when the SDK finds credentials another way,
 *                      e.g. an `ant auth login` profile)
 *   COACH_MODEL        Claude model for the coach; default claude-opus-5
 *   GEMINI_API_KEY     used for AI conversation practice when there are no Anthropic credentials, and for
 *                      server-side speech recognition (POST /speech/transcribe)
 *   GEMINI_MODEL       Gemini model for the coach and speech; default gemini-3.8-flash
 *   (`npm start` loads server/.env if it exists: put secrets there, never in git)
 *   TELEGRAM_BOT_TOKEN enables "sign in with Telegram" (token from @BotFather). Run ONE process per token:
 *                      the bot uses long polling, and Telegram delivers each update to a single poller.
 */
const port = Number(process.env.PORT ?? 8787)
const databaseUrl = process.env.DATABASE_URL?.trim()
const file = process.env.DATABASE_FILE ?? path.join(process.cwd(), 'data', 'aytla.db')
if (!databaseUrl && file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true })

const db = await openDb(databaseUrl || file)
console.log(databaseUrl ? 'database: postgres' : `database: sqlite ${file}`)
const clerkKey = process.env.CLERK_PUBLISHABLE_KEY?.trim()
const clerk = clerkKey ? createClerkVerifier(clerkKey) : null
if (clerkKey && !clerk) console.error('CLERK_PUBLISHABLE_KEY does not look like a Clerk publishable key; Google sign-in is off')
const telegramToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
const bot = telegramToken ? startTelegramBot(db, telegramToken) : null
// reminders are due by the hour; checking every five minutes keeps them near the top of it
if (bot) setInterval(() => void sendDueReminders(db, bot.call, Date.now()).catch((err) => console.error('reminders failed', err)), 5 * 60 * 1000).unref()

const app = createApp({
  db,
  telegramBot: bot ? bot.username : undefined,
  clerk,
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Claude when Anthropic credentials are set, otherwise Gemini when a Gemini key is set, otherwise no AI practice
  coach: createCoachFromEnv() ?? createGeminiCoachFromEnv(),
  // speech recognition for browsers and phones without their own (Gemini listens)
  transcriber: createGeminiTranscriberFromEnv(),
})

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Aytla API listening on http://localhost:${info.port}`)
})
