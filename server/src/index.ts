import { serve } from '@hono/node-server'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createApp } from './app.ts'
import { createCoachFromEnv } from './coach-anthropic.ts'
import { createGeminiCoachFromEnv } from './coach-gemini.ts'
import { openDb } from './db.ts'
import { sendDueReminders } from './reminders.ts'
import { startTelegramBot } from './telegram.ts'

/**
 * Entry point.  Environment:
 *   PORT               default 8787
 *   DATABASE_FILE      default ./data/aytla.db
 *   CORS_ORIGINS       comma-separated list; default: any origin (bearer tokens, no cookies)
 *   ANTHROPIC_API_KEY  enables AI conversation practice; without credentials /coach/chat answers 503
 *                      (COACH_ENABLED=1 also enables it when the SDK finds credentials another way,
 *                      e.g. an `ant auth login` profile)
 *   COACH_MODEL        Claude model for the coach; default claude-opus-5
 *   GEMINI_API_KEY     used for AI conversation practice when there are no Anthropic credentials
 *   GEMINI_MODEL       Gemini model for the coach; default gemini-2.5-flash
 *   (`npm start` loads server/.env if it exists: put secrets there, never in git)
 *   TELEGRAM_BOT_TOKEN enables "sign in with Telegram" (token from @BotFather). Run ONE process per token:
 *                      the bot uses long polling, and Telegram delivers each update to a single poller.
 */
const port = Number(process.env.PORT ?? 8787)
const file = process.env.DATABASE_FILE ?? path.join(process.cwd(), 'data', 'aytla.db')
if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true })

const db = openDb(file)
const telegramToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
const bot = telegramToken ? startTelegramBot(db, telegramToken) : null
// reminders are due by the hour; checking every five minutes keeps them near the top of it
if (bot) setInterval(() => void sendDueReminders(db, bot.call, Date.now()).catch((err) => console.error('reminders failed', err)), 5 * 60 * 1000).unref()

const app = createApp({
  db,
  telegramBot: bot ? bot.username : undefined,
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Claude when Anthropic credentials are set, otherwise Gemini when a Gemini key is set, otherwise no AI practice
  coach: createCoachFromEnv() ?? createGeminiCoachFromEnv(),
})

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Aytla API listening on http://localhost:${info.port}`)
})
