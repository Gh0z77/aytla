import { serve } from '@hono/node-server'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { createApp } from './app.ts'
import { createCoachFromEnv } from './coach-anthropic.ts'
import { openDb } from './db.ts'

/**
 * Entry point.  Environment:
 *   PORT               default 8787
 *   DATABASE_FILE      default ./data/everest.db
 *   CORS_ORIGINS       comma-separated list; default: any origin (bearer tokens, no cookies)
 *   ANTHROPIC_API_KEY  enables AI conversation practice; without it /coach/chat answers 503
 */
const port = Number(process.env.PORT ?? 8787)
const file = process.env.DATABASE_FILE ?? path.join(process.cwd(), 'data', 'everest.db')
if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true })

const app = createApp({
  db: openDb(file),
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  coach: createCoachFromEnv(),
})

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`EVEREST AI API listening on http://localhost:${info.port}`)
})
