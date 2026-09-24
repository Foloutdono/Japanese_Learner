import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ── Every card run's side, wired the same way (plan 123) ───────────
// The session panel says what a run has done and, at its end, which
// cards went badly -- but only if the run tells it the run is done. The
// grammar run did not, so its side promised an entry "once the card is
// revealed" long after the last card. And a run whose batch failed stood
// the panel's zeros and that promise beside its error. Each card run now
// passes `done`, and stands an empty column (side={null}) on an error
// with no card. The browses stand a bare panel, the entry alone (plan
// 119; the figures left the side for the console in plan 124), and have
// no end.

const here = dirname(fileURLToPath(import.meta.url))
const RUNS = ['KanaRun', 'KanjiRun', 'VocabRun', 'StudyRun', 'TodayRun', 'GrammarRun']

describe('the card runs\' side', () => {
  for (const run of RUNS) {
    it(`${run} passes done, and no panel beside an error`, () => {
      const src = readFileSync(join(here, 'screens', `${run}.jsx`), 'utf8')
      // The browse's side is the one `reviewCards.length > 0 ?` stands.
      const runSrc = src.replace(/side=\{reviewCards\.length > 0 \? <SessionPanel\b[^>]*\/>/g, '')
      const runPanels = [...runSrc.matchAll(/<SessionPanel\b([^>]*)\/>/g)].map(m => m[1])
      expect(runPanels.length, run).toBeGreaterThan(0)
      for (const p of runPanels) expect(p, run).toMatch(/done=\{done\}/)
      expect(src, run).toMatch(/side=\{error && !card \? null :/)
    })
  }
})
