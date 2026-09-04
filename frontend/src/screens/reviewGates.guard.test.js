import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── One implementation of the gates, not one per screen ─────────
// A source-level guard, in the house style of the design ratchets and
// the backend's retired-mode scan, because the failure it catches is
// an OMISSION — a screen that keeps its own copy, or writes a new one.
//
// The copies are what made this worth guarding: the same forty lines
// lived on six screens, and they drifted exactly as you would expect.
// The 4-second safety net reached two of them. The guard against a
// non-numeric xp_earned reached one. The reset that stops a gate
// leaking from one session into the next reached none, until a learner
// got stuck on a kana card with no rating bar and no way forward
// (KanaScreen.stuck.browser.test.jsx reproduces it).
//
// So: a screen that gates a card uses the hook, and holds none of the
// machinery itself.

const HERE = dirname(fileURLToPath(import.meta.url))

const screens = readdirSync(HERE)
  .filter(f => f.endsWith('.jsx') && !f.includes('.test.'))
  .map(f => [f, readFileSync(join(HERE, f), 'utf8')])

const gating = screens.filter(([, src]) => src.includes('useReviewGates'))

// Every name the old inlined copies were built from. A screen holding
// any of these is keeping its own machinery again.
const OWN_MACHINERY = [
  'pendingGatesRef',
  'advancedRef',
  'safetyTimerRef',
  'function checkAdvance',
  'setLocked(',
]

describe('review gates', () => {
  it('finds the screens that gate the next card', () => {
    // A sanity check on the scan itself: reading zero files would make
    // every assertion below pass vacuously forever.
    expect(gating.length).toBeGreaterThanOrEqual(6)
  })

  for (const [name, src] of gating) {
    it(`${name}: keeps none of the machinery itself`, () => {
      for (const own of OWN_MACHINERY) {
        expect(
          src.includes(own),
          `${own} is back on this screen — the hook owns it, and a copy will drift from it`,
        ).toBe(false)
      }
    })

    it(`${name}: hands the hook a session key, so a gate cannot leak between sessions`, () => {
      expect(/sessionKey:\s*\S/.test(src), 'useReviewGates called without a sessionKey').toBe(true)
    })
  }

  it('no screen plays out a review without the hook behind it', () => {
    // The other direction: a NEW screen that rolls its own gating would
    // pass every test above simply by not being in `gating` at all.
    //
    // `review_preview` is the marker, not <RatingBar>. The two
    // sentence-practice screens (reading, translation) borrow the bar
    // to collect a self-rating but schedule no card and open no gate —
    // they have nothing for the hook to hold.
    const srs = screens.filter(([, src]) => src.includes('review_preview'))
    expect(srs.length).toBeGreaterThanOrEqual(6)
    for (const [name, src] of srs) {
      expect(src.includes('useReviewGates'), `${name} plays out a review without useReviewGates`).toBe(true)
    }
  })
})
