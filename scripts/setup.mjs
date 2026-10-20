#!/usr/bin/env node
/**
 * One-time project setup. Run from the project root:   node scripts/setup.mjs
 *
 * The app code (app/, src/) is hand-written; everything version-sensitive is
 * taken from the official Expo template so it always matches the installed SDK:
 *   1. scaffold the default Expo template into ./_scaffold (no install)
 *   2. copy its config files (package.json, tsconfig, app.json, eslint, assets)
 *   3. patch app.json / package.json for EVEREST AI
 *   4. copy the brand images from ../assets
 *   5. install dependencies with `expo install` (SDK-compatible versions)
 *   6. git init + first commit
 *
 * Safe to re-run: it never overwrites app/ or src/.
 */
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scaffold = path.join(root, '_scaffold')
const brand = path.resolve(root, '..', 'assets', 'brand')

const run = (cmd, cwd = root) => {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const writeJson = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)

// 1 ─ scaffold ────────────────────────────────────────────────────────────────
if (!existsSync(path.join(root, 'package.json'))) {
  rmSync(scaffold, { recursive: true, force: true })
  run('npx --yes create-expo-app@latest _scaffold --template default --no-install')

  // 2 ─ take the template's configuration, not its example screens
  for (const entry of ['package.json', 'tsconfig.json', 'app.json', '.gitignore', 'eslint.config.js', 'expo-env.d.ts']) {
    const from = path.join(scaffold, entry)
    if (existsSync(from)) cpSync(from, path.join(root, entry))
  }
  cpSync(path.join(scaffold, 'assets'), path.join(root, 'assets'), { recursive: true })
  rmSync(scaffold, { recursive: true, force: true })
} else {
  console.log('package.json exists: skipping scaffold')
}

// 3 ─ app.json ────────────────────────────────────────────────────────────────
const appJsonPath = path.join(root, 'app.json')
const appJson = readJson(appJsonPath)
const expo = appJson.expo ?? (appJson.expo = {})
expo.name = 'EVEREST AI'
expo.slug = 'everest-ai'
expo.scheme = 'everestai'
expo.orientation = 'portrait'
expo.userInterfaceStyle = 'light'
expo.ios = { ...(expo.ios ?? {}), bundleIdentifier: 'uz.everestai.app', supportsTablet: true }
expo.android = { ...(expo.android ?? {}), package: 'uz.everestai.app' }
// single-page web build: learner state lives in the browser, nothing to pre-render on a server
expo.web = { ...(expo.web ?? {}), bundler: 'metro', output: 'single' }
// typed routes need generated types before `tsc` can pass; plain string hrefs keep the toolchain simple
if (expo.experiments) delete expo.experiments.typedRoutes
writeJson(appJsonPath, appJson)

// package.json scripts
const pkgPath = path.join(root, 'package.json')
const pkg = readJson(pkgPath)
pkg.name = 'everest-ai'
pkg.scripts = {
  ...pkg.scripts,
  typecheck: 'tsc --noEmit',
  test: 'vitest run',
  'content:check': 'vitest run src/content',
  check: 'npm run typecheck && npm run test',
}
delete pkg.scripts['reset-project']
writeJson(pkgPath, pkg)

// 4 ─ brand images ────────────────────────────────────────────────────────────
const copyBrand = (from, to) => {
  const src = path.join(brand, from)
  if (!existsSync(src)) {
    console.warn(`! missing brand asset: ${src}`)
    return
  }
  mkdirSync(path.dirname(path.join(root, to)), { recursive: true })
  cpSync(src, path.join(root, to))
}

// 5 ─ dependencies ────────────────────────────────────────────────────────────
run('npm install')
run('npx expo install @react-native-async-storage/async-storage expo-speech expo-haptics')
run('npm install zustand')
run('npm install --save-dev vitest')

// 6 ─ git ─────────────────────────────────────────────────────────────────────
if (!existsSync(path.join(root, '.git'))) {
  run('git init')
  run('git add -A')
  run('git commit -m "EVEREST AI: universal learning app (web, Android, iOS)"')
}

console.log('\nSetup complete.\n  npm run check      type-check + unit tests\n  npm run web        open the web app\n  npx expo start     scan the QR code with Expo Go on your phone\n')
