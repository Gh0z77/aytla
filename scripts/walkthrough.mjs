#!/usr/bin/env node
/**
 * End-to-end walkthrough of the web app with screenshots.
 *
 *   node scripts/walkthrough.mjs [outDir] [baseUrl]
 *
 * Drives the installed Edge (no browser download) through: landing → welcome →
 * path → a full lesson (solving every exercise from the course content) →
 * result → tabs → guidebook → practice. Fails loudly on console/page errors.
 * Needs the dev server:  npx expo start --port 8081
 */
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { normalize, tokenize } from '../src/core/text.ts'
import { uz } from '../src/i18n/uz.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.resolve(process.argv[2] ?? path.join(root, 'walkthrough-shots'))
const base = process.argv[3] ?? 'http://localhost:8081'
mkdirSync(out, { recursive: true })

const unitsDir = path.join(root, 'src/content/units')
const units = readdirSync(unitsDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(path.join(unitsDir, f), 'utf8')))
const words = units.flatMap((u) => u.words)
const sentences = units.flatMap((u) => u.sentences)

const problems = []
let shot = 0
const snap = async (page, name) => {
  shot += 1
  const file = path.join(out, `${String(shot).padStart(2, '0')}-${name}.png`)
  await page.screenshot({ path: file })
  console.log(`  shot ${path.basename(file)}`)
}
const watch = (page, label) => {
  page.on('pageerror', (e) => problems.push(`[${label}] pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[${label}] console.error: ${m.text().slice(0, 300)}`)
  })
}
const visibleExact = async (page, text) => (await page.getByText(text, { exact: true }).count()) > 0
const enabledButtons = (page) => page.locator('[role="button"][aria-label]:not([aria-disabled="true"])')

async function clickTile(page, tile, lang) {
  const want = normalize(tile, lang)
  const buttons = enabledButtons(page)
  const labels = await buttons.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
  // the bank sits after the answer line in the DOM, so the LAST enabled match is the unused bank tile
  for (let i = labels.length - 1; i >= 0; i--) {
    if (normalize(labels[i], lang) === want) {
      await buttons.nth(i).click()
      return true
    }
  }
  return false
}

const seenKinds = new Set()

async function solveExercise(page) {
  const has = (key) => visibleExact(page, uz[key])

  if (await has('lesson.listen') || await has('lesson.listenType')) {
    if (!seenKinds.has('listen')) { seenKinds.add('listen'); await snap(page, 'exercise-listen') }
    await page.getByText(uz['lesson.cantListen'], { exact: true }).click()
    return 'listen(skipped)'
  }
  if (await has('lesson.speak')) {
    if (!seenKinds.has('speak')) { seenKinds.add('speak'); await snap(page, 'exercise-speak') }
    await page.getByText(uz['lesson.cantSpeak'], { exact: true }).click()
    return 'speak(skipped)'
  }

  if (await has('lesson.match')) {
    if (!seenKinds.has('match')) { seenKinds.add('match'); await snap(page, 'exercise-match') }
    const labels = await enabledButtons(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
    const pairs = words.filter((w) => labels.includes(w.en) && labels.includes(w.native.uz))
    for (const w of pairs) {
      await page.locator(`[role="button"][aria-label="${w.en}"]:not([aria-disabled="true"])`).first().click()
      await page.locator(`[role="button"][aria-label="${w.native.uz}"]:not([aria-disabled="true"])`).first().click()
      await page.waitForTimeout(120)
    }
    return `match(${pairs.length})`
  }

  if (await has('lesson.select')) {
    if (!seenKinds.has('select')) { seenKinds.add('select'); await snap(page, 'exercise-select') }
    const labels = await enabledButtons(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
    for (const w of words) {
      if (labels.includes(w.en) && (await visibleExact(page, w.native.uz))) {
        await page.locator(`[role="button"][aria-label="${w.en}"]`).first().click()
        return `select(${w.en})`
      }
    }
    throw new Error('select: no matching word found')
  }

  if (await has('lesson.fill')) {
    if (!seenKinds.has('fill')) { seenKinds.add('fill'); await snap(page, 'exercise-fill') }
    const labels = await enabledButtons(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
    // the card shows "<before> ______<after>": the right option is the one that rebuilds the sentence
    const shown = (await page.getByText('______', { exact: true }).first().locator('xpath=..').textContent()) ?? ''
    for (const s of sentences) {
      if (!(await visibleExact(page, s.native.uz))) continue
      const option = labels.find((l) => normalize(shown.replace('______', l), 'en') === normalize(s.en, 'en'))
      if (option) {
        await page.locator(`[role="button"][aria-label="${option}"]`).first().click()
        return `fill(${option})`
      }
    }
    throw new Error('fill: no matching sentence found')
  }

  if (await has('lesson.type')) {
    if (!seenKinds.has('type')) { seenKinds.add('type'); await snap(page, 'exercise-type') }
    for (const s of sentences) {
      if (await visibleExact(page, s.native.uz)) {
        await page.locator('textarea').fill(s.en)
        return `type(${s.en})`
      }
    }
    throw new Error('type: no matching sentence found')
  }

  if (await has('lesson.translate')) {
    for (const s of sentences) {
      const fromEnglish = await visibleExact(page, s.en)
      const fromNative = !fromEnglish && (await visibleExact(page, s.native.uz))
      if (!fromEnglish && !fromNative) continue
      const kind = fromEnglish ? 'bank-en' : 'bank-native'
      if (!seenKinds.has(kind)) { seenKinds.add(kind); await snap(page, `exercise-${kind}`) }
      const lang = fromEnglish ? 'uz' : 'en'
      for (const tile of tokenize(fromEnglish ? s.native.uz : s.en, lang)) {
        if (!(await clickTile(page, tile, lang))) throw new Error(`bank: tile "${tile}" not found for ${s.id}`)
      }
      return `${kind}(${s.id})`
    }
    throw new Error('bank: no matching sentence found')
  }

  throw new Error('unknown exercise on screen')
}

async function playLesson(page, label) {
  let feedbackShot = false
  for (let i = 0; i < 60; i++) {
    if (page.url().includes('/result')) return
    const done = await solveExercise(page)
    console.log(`  ${label} #${i + 1}: ${done}`)
    const check = page.locator('[data-testid="check"]')
    if (!done.includes('skipped')) {
      if (!done.startsWith('match')) await check.click()
      await page.locator('[data-testid="continue"]').waitFor({ timeout: 8000 })
      if (!feedbackShot) { feedbackShot = true; await snap(page, 'feedback-correct') }
      await page.locator('[data-testid="continue"]').click()
    }
    await page.waitForTimeout(250)
  }
  throw new Error('lesson did not finish within 60 exercises')
}

/** Metro needs a while after `expo start`; wait for it instead of failing on the first request. */
async function waitForServer(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  throw new Error(`dev server did not answer at ${url} within ${timeoutMs / 1000}s (start it with: npx expo start --port 8081)`)
}

await waitForServer(base)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  // ── desktop landing ─────────────────────────────────────────────────────────
  console.log('desktop landing')
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const dpage = await desktop.newPage()
  watch(dpage, 'desktop')
  await dpage.goto(base, { waitUntil: 'networkidle' })
  await dpage.locator('[data-testid="landing-start"]').waitFor({ timeout: 60000 })
  await dpage.waitForTimeout(800)
  await snap(dpage, 'landing-desktop-top')
  await dpage.mouse.move(720, 600)
  await dpage.mouse.wheel(0, 900)
  await dpage.waitForTimeout(500)
  await snap(dpage, 'landing-desktop-mid')
  await dpage.mouse.wheel(0, 1200)
  await dpage.waitForTimeout(500)
  await snap(dpage, 'landing-desktop-bottom')
  await desktop.close()

  // ── phone-sized app ─────────────────────────────────────────────────────────
  console.log('phone walkthrough')
  const phone = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })
  const page = await phone.newPage()
  watch(page, 'phone')
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="landing-start"]').waitFor({ timeout: 60000 })
  await snap(page, 'landing-phone')
  await page.locator('[data-testid="landing-start"]').click()

  const next = page.locator('[data-testid="welcome-next"]')
  await next.waitFor({ timeout: 30000 })
  await snap(page, 'welcome-1-language')
  await next.click()
  await page.locator('input').fill('Ali')
  await snap(page, 'welcome-2-name')
  await next.click()
  await snap(page, 'welcome-3-goal')
  await next.click()
  await snap(page, 'welcome-4-level')
  await next.click()
  await snap(page, 'welcome-5-guide')
  await next.click()

  await page.locator('[data-testid="node-u01-l1"]').waitFor({ timeout: 30000 })
  await page.waitForTimeout(600)
  await snap(page, 'learn-path')
  await page.locator('[data-testid="node-u01-l1"]').click()
  await page.locator('[data-testid="start-lesson"]').waitFor()
  await snap(page, 'learn-node-card')
  await page.locator('[data-testid="start-lesson"]').click()

  await page.waitForURL('**/lesson/**')
  await page.waitForTimeout(600)
  await playLesson(page, 'lesson 1')
  await page.locator('[data-testid="result-continue"]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(700)
  await snap(page, 'result')
  await page.locator('[data-testid="result-continue"]').click()
  await page.locator('[data-testid="node-u01-l2"]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(500)
  await snap(page, 'learn-after-lesson')

  for (const tab of ['practice', 'quests', 'shop', 'profile']) {
    await page.goto(`${base}/${tab}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    await snap(page, `tab-${tab}`)
  }
  await page.goto(`${base}/unit/u01`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await snap(page, 'guidebook')

  await page.goto(`${base}/lesson/practice`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await snap(page, 'practice-session')
  await phone.close()
} finally {
  await browser.close()
}

if (problems.length) {
  console.log(`\n${problems.length} browser problem(s):`)
  problems.forEach((p) => console.log(' -', p))
  process.exitCode = 1
} else {
  console.log('\nNo console or page errors.')
}
