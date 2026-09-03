import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RATING_SCALE, RATING_SCALES, QUALITY_LABEL_KEY, scaleFor, ratingButtons,
} from './ratingScales'

// The one property everything else rests on: each shorter bar is a
// longer one with buttons removed, NOT a different scale. If that ever
// stops being true, every stored quality — review_log, last_quality,
// the stats mix, the scheduler's own tables — silently changes meaning
// the moment a learner switches, and there is no migration that could
// tell which bar an old row came from.

const t = {
  perfect: 'Perfect', correctHesit: 'Correct', difficult: 'Difficult',
  wrongSeen: 'Almost', wrongRated: 'Wrong', blackout: 'Blackout',
}

describe('rating scales', () => {
  it('offers two buttons, four and six', () => {
    expect(RATING_SCALES.binary.qualities).toHaveLength(2)
    expect(RATING_SCALES.simple.qualities).toHaveLength(4)
    expect(RATING_SCALES.full.qualities).toHaveLength(6)
  })

  it('nests: every bar is the next one up with buttons left off', () => {
    const chain = ['binary', 'simple', 'full']
    for (let i = 0; i < chain.length - 1; i++) {
      const shorter = RATING_SCALES[chain[i]].qualities
      const longer = new Set(RATING_SCALES[chain[i + 1]].qualities)
      for (const q of shorter) {
        expect(longer.has(q), `${chain[i]}'s ${q} is not on ${chain[i + 1]}`).toBe(true)
      }
    }
    // And precisely which buttons each step adds, so a change to the
    // middle bar cannot quietly move what a stored quality means.
    const added = (a, b) => RATING_SCALES[b].qualities
      .filter(q => !RATING_SCALES[a].qualities.includes(q)).sort()
    expect(added('binary', 'simple')).toEqual([2, 3])
    expect(added('simple', 'full')).toEqual([0, 5])
  })

  it('gives the same quality the same word on every bar', () => {
    expect(ratingButtons('binary', t).map(b => b.label))
      .toEqual(['Correct', 'Wrong'])
    expect(ratingButtons('simple', t).map(b => b.label))
      .toEqual(['Correct', 'Difficult', 'Almost', 'Wrong'])
    expect(ratingButtons('full', t).map(b => b.label))
      .toEqual(['Perfect', 'Correct', 'Difficult', 'Almost', 'Wrong', 'Blackout'])
    // The shared buttons are the same word AND the same number, which
    // is what keeps the stats mix comparable across a switch.
    for (const q of RATING_SCALES.binary.qualities) {
      expect(QUALITY_LABEL_KEY[q]).toBe(QUALITY_LABEL_KEY[q])
      expect(RATING_SCALES.full.qualities).toContain(q)
    }
  })

  it('lists them all best-first, which is what the digit keys index', () => {
    for (const scale of Object.values(RATING_SCALES)) {
      const qs = scale.qualities
      expect(qs).toEqual([...qs].sort((a, b) => b - a))
    }
  })

  it('falls back rather than leaving the bar with nothing to draw', () => {
    // A stale localStorage value, an older backend, a typo in a PATCH:
    // the rating bar is the one control a review cannot happen without.
    expect(scaleFor('sixish')).toBe(RATING_SCALES[DEFAULT_RATING_SCALE])
    expect(scaleFor(undefined)).toBe(RATING_SCALES[DEFAULT_RATING_SCALE])
    expect(scaleFor(null).qualities.length).toBeGreaterThan(0)
  })

  it('defaults to the four-button bar, not the shortest one', () => {
    // Two buttons is an option, not the recommendation: it gives up the
    // scheduler's only signal between "fine" and "only just".
    expect(DEFAULT_RATING_SCALE).toBe('simple')
  })
})
