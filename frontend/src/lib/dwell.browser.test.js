import { describe, it, expect, afterEach } from 'vitest'
import { stopwatch } from './dwell'

// ── 滞在 — the stopwatch that stops ────────────────────────────
// The whole reason this module exists rather than a pair of
// Date.now() calls is that it must NOT count time the tab was hidden:
// a learner who wanders off mid-boarding and comes back an hour later
// did not spend an hour choosing a study rhythm, and a handful of
// those makes every median on the funnel dashboard meaningless.
// So that is what is pinned here.

const sleep = ms => new Promise(r => setTimeout(r, ms))

function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

afterEach(() => setVisibility('visible'))

describe('stopwatch', () => {
  it('counts time the tab is being looked at', async () => {
    const w = stopwatch()
    await sleep(90)
    const ms = w.read()
    w.stop()
    expect(ms).toBeGreaterThanOrEqual(60)
    expect(Number.isInteger(ms)).toBe(true)
  })

  it('stops counting while the tab is hidden, and resumes after', async () => {
    const w = stopwatch()
    await sleep(60)
    setVisibility('hidden')
    const atHide = w.read()

    await sleep(250)                 // a long absence
    const afterAbsence = w.read()
    // The absence must contribute (almost) nothing. A small delta is
    // tolerated for the tick between sleep resolving and the event.
    expect(afterAbsence - atHide).toBeLessThan(40)

    setVisibility('visible')
    await sleep(80)
    const afterReturn = w.read()
    w.stop()
    expect(afterReturn).toBeGreaterThan(afterAbsence + 40)
    // And the hidden quarter-second is still not in the total.
    expect(afterReturn).toBeLessThan(250)
  })

  it('laps to zero so each question is measured on its own', async () => {
    const w = stopwatch()
    await sleep(80)
    const first = w.lap()
    const immediately = w.read()
    await sleep(60)
    const second = w.lap()
    w.stop()

    expect(first).toBeGreaterThanOrEqual(50)
    expect(immediately).toBeLessThan(25)     // reset, not accumulated
    expect(second).toBeGreaterThanOrEqual(35)
    expect(second).toBeLessThan(first + 40)  // the first lap is not carried in
  })

  it('starts banked at zero when it is created on a hidden tab', async () => {
    setVisibility('hidden')
    const w = stopwatch()
    await sleep(120)
    const ms = w.read()
    w.stop()
    expect(ms).toBe(0)
  })

  it('can be stopped twice without complaining', () => {
    const w = stopwatch()
    w.stop()
    expect(() => w.stop()).not.toThrow()
    expect(w.read()).toBeGreaterThanOrEqual(0)
  })
})
