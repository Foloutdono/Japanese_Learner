import { describe, it, expect } from 'vitest'
import { cardTier, xpClimb, driftWords, sinceMonth } from './passCard'
import fr from '../locales/fr/index.js'

// ── 定期券 — the learner's card, by its plan (plan 172) ──────────

describe('cardTier', () => {
  it('draws the free card until the credits are known, and on the free plan', () => {
    expect(cardTier(null)).toBe('free')
    expect(cardTier(undefined)).toBe('free')
    expect(cardTier({ plan: 'free', unlimited: false })).toBe('free')
  })

  it("draws the server's paid plan, unlimited, as Max", () => {
    expect(cardTier({ plan: 'pass', unlimited: true })).toBe('max')
    expect(cardTier({ unlimited: true })).toBe('max')
  })

  it('reads pro and max as themselves', () => {
    expect(cardTier({ plan: 'pro', unlimited: false })).toBe('pro')
    expect(cardTier({ plan: 'max', unlimited: true })).toBe('max')
  })
})

describe('xpClimb', () => {
  it('measures the climb into the level against its span', () => {
    expect(xpClimb({ xp: 1500, xpPrevLevel: 1000, xpForNext: 2000 })).toEqual({ into: 500, span: 1000, share: 0.5 })
  })

  it('never leaves 0..1, and never divides by nothing', () => {
    expect(xpClimb({ xp: 900, xpPrevLevel: 1000, xpForNext: 2000 }).share).toBe(0)
    expect(xpClimb({ xp: 2600, xpPrevLevel: 1000, xpForNext: 2000 }).share).toBe(1)
    expect(xpClimb({ xp: 5, xpPrevLevel: 5, xpForNext: 5 })).toEqual({ into: 0, span: 1, share: 0 })
  })

  it('is an empty climb before the summary has come', () => {
    expect(xpClimb(null)).toEqual({ into: 0, span: 1, share: 0 })
  })
})

describe('driftWords', () => {
  it('says the days ahead or late, and nothing on time', () => {
    expect(driftWords(fr, { status: 'ahead', days: 3 })).toBe(fr.cardDriftAhead(3))
    expect(driftWords(fr, { status: 'delayed', days: 2 })).toBe(fr.cardDriftLate(2))
    expect(driftWords(fr, { status: 'onTime', days: null })).toBeNull()
    expect(driftWords(fr, null)).toBeNull()
  })
})

describe('sinceMonth', () => {
  it("prints the boarding's month in the learner's language", () => {
    expect(sinceMonth('2026-03-14T09:00:00Z', 'fr')).toBe('mars 2026')
    expect(sinceMonth('2026-03-14T09:00:00Z', 'en')).toBe('March 2026')
  })

  it('prints nothing rather than a guess', () => {
    expect(sinceMonth(null, 'fr')).toBeNull()
    expect(sinceMonth('not a date', 'fr')).toBeNull()
  })
})
