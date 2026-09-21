import { describe, it, expect } from 'vitest'
import { TAB_IDS, gateBeside, tabFor } from './tabs'

// ── Which gate is next along the bar ──────────────────────────
// The arithmetic behind the sideways flick (hooks/useGateSwipe), on
// its own in the node lane: it is three rules, and each one of them
// is a decision rather than a detail — where it answers from, in what
// order, and what it does at the ends.

describe('the gate beside one', () => {
  it('walks the bar in the order the bar prints', () => {
    expect(TAB_IDS).toEqual(['learn', 'practice', 'today', 'dictionary', 'profile'])
    expect(gateBeside('/today', 1)).toBe('/dictionary')
    expect(gateBeside('/today', -1)).toBe('/practice')
  })

  it('does not wrap at either end', () => {
    // Past Learn and past Profile there is no next gate: wrapping
    // would turn one over-eager flick into a jump across the app.
    expect(gateBeside('/learn', -1)).toBeNull()
    expect(gateBeside('/profile', 1)).toBeNull()
    expect(gateBeside('/learn', 1)).toBe('/practice')
    expect(gateBeside('/profile', -1)).toBe('/dictionary')
  })

  it('answers from anywhere behind a gate, and lands on the gate', () => {
    // The lit gate is the answer wherever you are standing under the
    // chrome — not the sibling station, which is why a flick from a
    // level opens the next GATE and not the next line.
    expect(gateBeside('/learn/decks', 1)).toBe('/practice')
    expect(gateBeside('/learn/vocab/N5', 1)).toBe('/practice')
    expect(gateBeside('/profile/settings/sound', -1)).toBe('/dictionary')
    expect(gateBeside('/dictionary/analyzer', -1)).toBe('/today')
  })

  it('is no gate at all off the five', () => {
    // The dev routes carry no tab bar, and nothing else is under it.
    expect(tabFor('/dev/ride')).toBeNull()
    expect(gateBeside('/dev/ride', 1)).toBeNull()
    expect(gateBeside('/', 1)).toBeNull()
    expect(gateBeside('', 1)).toBeNull()
    expect(gateBeside(undefined, 1)).toBeNull()
  })
})
