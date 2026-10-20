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
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { normalize, tokenize } from '../src/core/text.ts'
import { uz } from '../src/i18n/uz.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.resolve(process.argv[2] ?? path.join(root, 'walkthrough-shots'))
const base = process.argv[3] ?? 'http://localhost:8081'
const apiBase = process.argv[4] ?? 'http://localhost:8787'
// The whole walkthrough takes longer than some runners allow for one command, so it can be run in parts.
// scripts/walkthrough.config.json: { "units": ["u05", "u06"] } plays one lesson of each listed unit and nothing else;
// { "units": [] } (or no file) runs the main walkthrough. A 5th argument `units=u05,u06` does the same.
const configFile = path.join(root, 'scripts', 'walkthrough.config.json')
const config = existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8').replace(/^﻿/, '')) : {}
const onlyUnits = (process.argv[5] ?? '').startsWith('units=') ? process.argv[5].slice('units='.length).split(',').filter(Boolean) : Array.isArray(config.units) ? config.units : []
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
    // the same word can be taught in two units: one pair per English label
    const pairs = words.filter((w, i) => labels.includes(w.en) && labels.includes(w.native.uz) && words.findIndex((o) => o.en === w.en && o.native.uz === w.native.uz) === i)
    for (const w of pairs) {
      await page.locator(`[role="button"][aria-label="${w.en}"]:not([aria-disabled="true"])`).first().click()
      // "park" / "park": the pair is two buttons with one label, so the second click must hit the OTHER one
      await page.locator(`[role="button"][aria-label="${w.native.uz}"]:not([aria-disabled="true"])`).nth(w.en === w.native.uz ? 1 : 0).click()
      await page.waitForTimeout(120)
    }
    return `match(${pairs.length})`
  }

  if (await has('lesson.select')) {
    if (!seenKinds.has('select')) { seenKinds.add('select'); await snap(page, 'exercise-select') }
    const labels = await enabledButtons(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
    // read the prompt itself: a word like "park" is the same in both languages, so "is it visible" proves nothing
    const asked = ((await page.locator('[data-testid="select-prompt"]').first().textContent()) ?? '').trim()
    for (const w of words) {
      if (labels.includes(w.en) && w.native.uz === asked) {
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

  if (await has('lesson.say')) {
    if (!seenKinds.has('say')) { seenKinds.add('say'); await snap(page, 'exercise-say') }
    for (const s of sentences) {
      if (await visibleExact(page, s.native.uz)) {
        await page.locator('textarea').fill(s.en)
        return `say(${s.en})`
      }
    }
    throw new Error('say: no matching sentence found')
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
  await dpage.goto(base, { waitUntil: 'networkidle', timeout: 120000 })
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

  // the live demo on the landing page: build a sentence, check it
  await dpage.goto(base, { waitUntil: 'networkidle' })
  await dpage.locator('[data-testid="demo-bank"]').click()
  await dpage.waitForTimeout(400)
  for (const s of sentences) {
    if (!(await visibleExact(dpage, s.native.uz))) continue
    for (const tile of tokenize(s.en, 'en')) if (!(await clickTile(dpage, tile, 'en'))) throw new Error(`demo: tile "${tile}" not found`)
    break
  }
  await dpage.locator('[data-testid="demo-check"]').click()
  await dpage.locator('[data-testid="demo-feedback"]').waitFor({ timeout: 5000 })
  await dpage.locator('[data-testid="landing-demo"]').scrollIntoViewIfNeeded()
  await dpage.waitForTimeout(300)
  await snap(dpage, 'landing-desktop-demo')

  // the app itself at desktop width: onboarding, the path, a lesson
  await dpage.locator('[data-testid="landing-start"]').first().click()
  const dnext = dpage.locator('[data-testid="welcome-next"]')
  await dnext.waitFor({ timeout: 30000 })
  await dnext.click()
  await dnext.click()
  await dpage.locator('input').fill('Ali')
  for (let i = 0; i < 4; i++) await dnext.click()
  await dpage.locator('[data-testid="node-u01-l1"]').waitFor({ timeout: 30000 })
  await dpage.waitForTimeout(600)
  await snap(dpage, 'learn-desktop')
  await dpage.goto(`${base}/lesson/u01-l1`, { waitUntil: 'networkidle' })
  await dpage.waitForTimeout(900)
  await snap(dpage, 'lesson-desktop')
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
  await page.getByText(uz['goal.travel'], { exact: true }).click()
  await snap(page, 'welcome-2-goal')
  await next.click()
  await page.locator('input').fill('Ali')
  await snap(page, 'welcome-3-name')
  await next.click()
  await snap(page, 'welcome-4-daily-goal')
  await next.click()
  await snap(page, 'welcome-5-level')
  await next.click()
  await snap(page, 'welcome-6-guide')
  await next.click()

  await page.locator('[data-testid="node-u01-l1"]').waitFor({ timeout: 30000 })
  await page.waitForTimeout(600)

  // `units=u05,u06,...` as the 5th argument: only play one lesson of each listed unit (a different lesson per unit)
  if (onlyUnits.length > 0) {
    for (const [i, unitId] of onlyUnits.entries()) {
      const lessonId = `${unitId}-l${(i % 5) + 1}`
      await page.goto(`${base}/lesson/${lessonId}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(900)
      await playLesson(page, lessonId)
      await page.waitForTimeout(500)
    }
    await browser.close()
    console.log(problems.length === 0 ? '\nNo console or page errors.' : `\n${problems.length} problem(s):\n${problems.join('\n')}`)
    process.exit(problems.length === 0 ? 0 : 1)
  }

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
  // scripts/walkthrough.config.json { "accountOnly": true }: skip straight to the account / league / AI chat part
  if (!config.accountOnly) {

  for (const tab of ['practice', 'progress', 'shop', 'profile']) {
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

  // ── Summit Run ───────────────────────────────────────────────────────────────
  await page.goto(`${base}/game/run`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="run-start"]').waitFor({ timeout: 20000 })
  await snap(page, 'game-ready')
  await page.locator('[data-testid="run-start"]').click()
  // steer into the right lane for a few gates, reading the gates like a learner would
  for (let gate = 0; gate < 4; gate++) {
    await page.waitForTimeout(700)
    const prompt = (await page.locator('[data-testid="run-prompt"]').textContent()) ?? ''
    const word = words.find((w) => w.native.uz === prompt)
    if (word) {
      const box = await page.getByText(word.en, { exact: true }).first().boundingBox()
      const lane = box ? Math.min(2, Math.floor(((box.x + box.width / 2) / 412) * 3)) : 1
      // the runner starts in the middle lane and stays where the last gate left it; recentre, then move
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.press('ArrowLeft')
      for (let i = 0; i < lane; i++) await page.keyboard.press('ArrowRight')
    }
    if (gate === 1) await snap(page, 'game-running')
    await page.waitForTimeout(3200)
  }
  await snap(page, 'game-after-gates')

  // ── Avalanche ────────────────────────────────────────────────────────────────
  await page.goto(`${base}/game/avalanche`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="fall-start"]').waitFor({ timeout: 20000 })
  await snap(page, 'avalanche-ready')
  await page.locator('[data-testid="fall-start"]').click()
  for (let round = 0; round < 2; round++) {
    await page.waitForTimeout(600)
    const prompt = (await page.locator('[data-testid="fall-prompt"]').textContent()) ?? ''
    const sentence = sentences.find((s) => s.native.uz === prompt)
    if (!sentence) break
    const tokens = tokenize(sentence.en, 'en')
    for (const [i, token] of tokens.entries()) {
      // tiles slide in from above the slope: wait until this word is on screen, then tap it
      const tile = page.locator('[data-testid="fall-tile"]').filter({ hasText: new RegExp(`^${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first()
      await tile.waitFor({ timeout: 15000 })
      const built = await page.locator('[data-testid="fall-built"]').boundingBox()
      const fieldTop = built ? built.y + built.height + 24 : 260
      for (let tries = 0; tries < 100; tries++) {
        const box = await tile.boundingBox()
        if (box && box.y >= fieldTop) break
        await page.waitForTimeout(100)
      }
      await tile.click({ force: true })
      if (round === 0 && i === 0) await snap(page, 'avalanche-running')
    }
    console.log(`  avalanche: built "${sentence.en}"`)
    await page.waitForTimeout(1100)
  }
  await snap(page, 'avalanche-after-rounds')

  // ── placement test: pass two checks like a learner who knows the basics, then give up ──
  await page.goto(`${base}/placement`, { waitUntil: 'networkidle' })
  await page.locator('[data-testid="placement-check"]').waitFor({ timeout: 20000 })
  await snap(page, 'placement-question')
  for (let question = 0; question < 4; question++) {
    const done = await solveExercise(page)
    console.log(`  placement #${question + 1}: ${done}`)
    await page.locator('[data-testid="placement-check"]').click()
    await page.waitForTimeout(300)
  }
  for (let i = 0; i < 3 && !(await page.locator('[data-testid="placement-go"]').isVisible()); i++) {
    await page.locator('[data-testid="placement-dont-know"]').click()
    await page.waitForTimeout(300)
  }
  await snap(page, 'placement-result')
  console.log(`  placement: ${(await page.locator('[data-testid="placement-unit"]').textContent()) ?? ''}`)
  await page.locator('[data-testid="placement-go"]').click()
  await page.waitForTimeout(1200)
  await snap(page, 'learn-after-placement')

  // ── goal units: play one lesson of each, a different lesson every time ──
  for (const lessonId of ['u19-l1', 'u20-l2', 'u21-l3', 'u22-l4']) {
    await page.goto(`${base}/lesson/${lessonId}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(900)
    if (lessonId === 'u19-l1') await snap(page, 'goal-unit-lesson')
    await playLesson(page, lessonId)
    await page.waitForTimeout(600)
  }
  await page.goto(`${base}/learn`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)

  await page.goto(`${base}/privacy`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await snap(page, 'privacy')

  // ── the interface in Russian and Turkish: a fresh learner each, key screens only ──
  for (const [lang, label] of [['ru', 'Русский'], ['tr', 'Türkçe']]) {
    console.log(`${lang} interface`)
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })
    const lp = await ctx.newPage()
    watch(lp, lang)
    await lp.goto(base, { waitUntil: 'networkidle' })
    await lp.locator('[data-testid="landing-start"]').waitFor({ timeout: 60000 })
    await lp.locator(`[role="button"][aria-label="${label}"]`).first().click()
    await lp.waitForTimeout(500)
    await snap(lp, `${lang}-landing`)
    await lp.locator('[data-testid="landing-start"]').click()
    const go = lp.locator('[data-testid="welcome-next"]')
    await go.waitFor({ timeout: 30000 })
    await go.click()
    await snap(lp, `${lang}-welcome-goal`)
    await go.click()
    await lp.locator('input').fill('Ali')
    for (let i = 0; i < 4; i++) await go.click()
    await lp.locator('[data-testid="node-u01-l1"]').waitFor({ timeout: 30000 })
    await lp.waitForTimeout(600)
    await snap(lp, `${lang}-learn`)
    for (const tab of ['practice', 'progress', 'profile']) {
      await lp.goto(`${base}/${tab}`, { waitUntil: 'networkidle' })
      await lp.waitForTimeout(900)
      await snap(lp, `${lang}-${tab}`)
    }
    await lp.goto(`${base}/lesson/u01-l1`, { waitUntil: 'networkidle' })
    await lp.waitForTimeout(900)
    await snap(lp, `${lang}-lesson`)
    await lp.goto(`${base}/game/avalanche`, { waitUntil: 'networkidle' })
    await lp.locator('[data-testid="fall-start"]').waitFor({ timeout: 20000 })
    await snap(lp, `${lang}-game`)
    await ctx.close()
  }

  }

  // ── account, cloud sync, league, AI chat (only when the API server is running) ──
  const apiUp = await fetch(`${apiBase}/health`).then((r) => r.ok).catch(() => false)
  if (apiUp) {
    console.log('account flow')
    await page.goto(`${base}/account`, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="account-email"]').fill(`walkthrough+${Date.now()}@example.com`)
    await page.locator('[data-testid="account-password"]').fill('correct horse battery')
    await snap(page, 'account-form')
    await page.locator('[data-testid="account-submit"]').click()
    await page.getByText(uz['account.synced'], { exact: true }).waitFor({ timeout: 20000 })
    await snap(page, 'profile-signed-in')

    await page.goto(`${base}/progress`, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="progress-league"]').click()
    await page.getByText(/^\d+ XP$/).first().waitFor({ timeout: 20000 })
    await snap(page, 'league')

    await page.goto(`${base}/coach`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await snap(page, 'coach-list')
    const firstScenario = page.locator('[data-testid="scenario-meet"]')
    if ((await firstScenario.count()) > 0) {
      await firstScenario.click()
      await page.locator('[data-testid="coach-input"]').waitFor({ timeout: 15000 })
      await page.waitForTimeout(8000) // the guide opens the conversation
      await page.locator('[data-testid="coach-input"]').fill('Hello! My name is Ali. I am from Uzbekistan.')
      await page.locator('[data-testid="coach-send"]').click()
      await page.waitForTimeout(9000)
      await snap(page, 'coach-chat')
    }
  } else {
    console.log('API server not running: skipping the account flow (start it with: node server/src/index.ts)')
  }
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
