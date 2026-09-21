import { describe, it, expect } from 'vitest'
import { TAB_IDS, gateBeside, gateRootFor, tabFor } from './tabs'

// ── Which gate is next along the bar ──────────────────────────
// The arithmetic behind the sideways flick (hooks/useGateSwipe), on
// its own in the node lane: it is three rules, and each one of them
// is a decision rather than a detail.

describe('which gate a pathname is', () => {
  it('tells a gate apart from a station behind it', () => {
    expect(gateRootFor('/learn')).toBe('learn')
    expect(gateRootFor('/learn/')).toBe('learn')
    // tabFor answers the bar's looser question — which gate is lit —
    // and that is NOT the question the flick asks.
    expect(tabFor('/learn/vocab/N5')).toBe('learn')
    expect(gateRootFor('/learn/vocab/N5')).toBeNull()
  })

  it('is no gate at all off the five', () => {
    expect(gateRootFor('/dev/ride')).toBeNull()
    expect(gateRootFor('/')).toBeNull()
    expect(gateRootFor('')).toBeNull()
    expect(gateRootFor(undefined)).toBeNull()
  })
})

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

  it('offers nothing from a station behind a gate', () => {
    expect(gateBeside('/learn/decks', 1)).toBeNull()
    expect(gateBeside('/profile/stats', -1)).toBeNull()
  })
})
