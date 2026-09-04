import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Every screen that gates the next card must un-gate it ────────
// A source-level guard, in the house style of the design ratchets and
// the backend's retired-mode scan, because the failure it catches is
// an OMISSION: a screen that never writes the line at all.
//
// The gate set, `locked` and the celebration state are per-review, but
// they live on the screen, which survives stepping back to the mode
// picker and coming in again. A screen that does not reset them on a
// session change strands the next review permanently — the queue never
// advances, the rating bar hides itself the instant you rate, and the
// card sits revealed with no way forward. That shipped on five
// screens; KanaScreen.stuck.browser.test.jsx reproduces it and pins
// the behaviour, and this stops the other four (and the next one
// written) from drifting back.
//
// storageKey is deliberately the dependency: it is the session's own
// identity (deck/level/set + mode), so the reset fires exactly when
// the session changes and never mid-card.

const HERE = dirname(fileURLToPath(import.meta.url))

const screens = readdirSync(HERE)
  .filter(f => f.endsWith('.jsx') && !f.includes('.test.'))
  .map(f => [f, readFileSync(join(HERE, f), 'utf8')])
  .filter(([, src]) => src.includes('pendingGatesRef'))

describe('review gates', () => {
  it('finds the screens that gate the next card', () => {
    // A sanity check on the scan itself: if this ever reads zero files
    // the assertions below would pass vacuously forever.
    expect(screens.length).toBeGreaterThanOrEqual(5)
  })

  for (const [name, src] of screens) {
    // TodayScreen has no picker of its own — leaving it unmounts the
    // screen and takes the refs with it — so it is the one screen the
    // session reset has nothing to reset.
    const hasPicker = /setMode\(null\)|setLevel\(null\)|setSelectedSet\(null\)/.test(src)

    it(`${name}: clears stale gates when a review starts`, () => {
      expect(
        src.includes('gates.clear()'),
        'a gate left over from a finished review can never be cleared by this one',
      ).toBe(true)
    })

    if (!hasPicker) continue

    it(`${name}: resets the review machinery when the session changes`, () => {
      const reset = src.match(/useEffect\(\(\) => \{([\s\S]*?)\}, \[storageKey\]\)/)
      expect(reset, 'no effect keyed on storageKey — leaving a card mid-flight strands the next').toBeTruthy()
      const body = reset[1]
      for (const line of ['pendingGatesRef.current.clear()', 'advancedRef.current = false', 'setLocked(false)']) {
        expect(body, `${line} missing from the session reset`).toContain(line)
      }
    })
  }
})
