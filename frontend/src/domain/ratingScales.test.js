import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RATING_SCALE, RATING_SCALES, QUALITY_LABEL_KEY, scaleFor, ratingButtons,
} from './ratingScales'

// The one property everything else rests on: the short bar is the long
// bar with two buttons removed, NOT a different scale. If that ever
// stops being true, every stored quality — review_log, last_quality,
// the stats mix, the scheduler's own tables — silently changes meaning
// the moment a learner switches, and there is no migration that could
// tell which bar an old row came from.

const t = {
  perfect: 'Perfect', correctHesit: 'Correct', difficult: 'Difficult',
  wrongSeen: 'Almost', wrongRated: 'Wrong', blackout: 'Blackout',
}

describe('rating scales', () => {
  it('offers four buttons and six', () => {
    expect(RATING_SCALES.simple.qualities).toHaveLength(4)
    expect(RATING_SCALES.full.qualities).toHaveLength(6)
  })

  it('makes the short bar a strict subset of the long one', () => {
    const full = new Set(RATING_SCALES.full.qualities)
    for (const q of RATING_SCALES.simple.qualities) expect(full.has(q)).toBe(true)
    // Precisely the two extremes, and nothing else, is what is dropped.
    const dropped = RATING_SCALES.full.qualities
      .filter(q => !RATING_SCALES.simple.qualities.includes(q))
    expect(dropped.sort()).toEqual([0, 5])
  })

  it('gives the same quality the same word on both bars', () => {
    for (const q of RATING_SCALES.simple.qualities) {
      expect(t[QUALITY_LABEL_KEY[q]]).toBe(t[QUALITY_LABEL_KEY[q]])
    }
    expect(ratingButtons('simple', t).map(b => b.label))
      .toEqual(['Correct', 'Difficult', 'Almost', 'Wrong'])
    expect(ratingButtons('full', t).map(b => b.label))
      .toEqual(['Perfect', 'Correct', 'Difficult', 'Almost', 'Wrong', 'Blackout'])
  })

  it('lists both best-first, which is what the digit keys index', () => {
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

  it('defaults to the short bar', () => {
    expect(DEFAULT_RATING_SCALE).toBe('simple')
  })
})
