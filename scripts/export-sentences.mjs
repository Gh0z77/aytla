/**
 * Copies every course sentence (en / uz / ru / tr) into server/src/sentences.json,
 * which the API's Telegram channel uses for the sentence of the day. Run it after
 * changing the units:
 *
 *   node scripts/export-sentences.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const unitsDir = path.join(root, 'src', 'content', 'units')
const out = []
for (const file of readdirSync(unitsDir).filter((f) => f.endsWith('.json')).sort()) {
  const unit = JSON.parse(readFileSync(path.join(unitsDir, file), 'utf8'))
  for (const s of unit.sentences ?? []) out.push({ en: s.en, uz: s.native.uz, ru: s.native.ru, tr: s.native.tr })
}
writeFileSync(path.join(root, 'server', 'src', 'sentences.json'), JSON.stringify(out) + '\n')
console.log(`${out.length} sentences → server/src/sentences.json`)
