import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = join(root, 'dist')
const targetDir = resolve(root, '../maproulette3/dist/plugins/review')

mkdirSync(targetDir, { recursive: true })

const artifacts = readdirSync(distDir).filter(
  (name) => name === 'maprouletteReviewPlugin.js' || name.endsWith('.js.map')
)

if (!artifacts.includes('maprouletteReviewPlugin.js')) {
  console.error('Missing dist/maprouletteReviewPlugin.js — run npm run build first')
  process.exit(1)
}

for (const name of artifacts) {
  copyFileSync(join(distDir, name), join(targetDir, name))
}

console.log(`Deployed to ${targetDir}:`)
for (const name of artifacts) {
  console.log(`  - ${name}`)
}
