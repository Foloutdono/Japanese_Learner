// Guard 1's gate. Stylelint's raw exit code is useless to CI here: the
// existing 19k-line stylesheet has a large, known population of
// violations that this repository has deliberately chosen not to
// mass-edit (see plan 044, "Out of scope"). What CI needs to know is
// narrower and more useful -- did this change make it worse?
//
// The key is deliberately line-number-free. A violation that merely
// moved down the file when someone inserted a rule above it is the
// same violation, and a ratchet that fired on that would be noise
// nobody reads.
import stylelint from 'stylelint'
import { readFileSync, writeFileSync } from 'node:fs'

const BASELINE = new URL('../.stylelint-baseline.json', import.meta.url)

const key = w =>
  `${w.rule}::${w.text.replace(/\bline \d+/g, 'line N').replace(/\(\S+\)$/, '').trim()}`

const { results } = await stylelint.lint({ files: 'src/**/*.css', formatter: 'json' })
const now = {}
for (const f of results) for (const w of f.warnings) now[key(w)] = (now[key(w)] || 0) + 1

if (process.argv.includes('--write')) {
  writeFileSync(BASELINE, JSON.stringify(now, null, 2) + '\n')
  console.log(`baseline written: ${Object.keys(now).length} kinds, ${Object.values(now).reduce((a, b) => a + b, 0)} violations`)
  process.exit(0)
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'))
const worse = Object.entries(now).filter(([k, n]) => n > (base[k] ?? 0))
const better = Object.entries(base).filter(([k, n]) => n > (now[k] ?? 0))

if (worse.length) {
  console.error('Guard 1 (stylelint) found NEW or WORSENED violations:\n')
  for (const [k, n] of worse) {
    console.error(`  ${n} (was ${base[k] ?? 0})  ${k}`)
  }
  console.error(`\nRun 'npm run lint:css:report' for full file:line detail.`)
  console.error(`If this is deliberate, regenerate the baseline with 'node scripts/stylelint-ratchet.mjs --write' and explain why in the commit message.`)
}

if (better.length) {
  console.log('Guard 1 (stylelint): some violations improved since the baseline was recorded:\n')
  for (const [k, n] of better) {
    console.log(`  ${now[k] ?? 0} (was ${n})  ${k}`)
  }
  console.log(`\nNice work. Consider re-running with --write to shrink the baseline and lock in the improvement.`)
}

if (!worse.length && !better.length) {
  const total = Object.values(now).reduce((a, b) => a + b, 0)
  console.log(`Guard 1 (stylelint): no change. ${Object.keys(now).length} accepted kinds, ${total} accepted violations.`)
}

process.exit(worse.length ? 1 : 0)
