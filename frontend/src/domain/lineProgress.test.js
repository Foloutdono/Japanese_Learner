import { describe, it, expect } from 'vitest'
import { lineStops, lineTotals, stopsTravelled, LEVEL_STOPS, KANA_STOPS } from './lineProgress'

// The unit is CARDS, not (card x mode) drills, and it comes from
// /api/stats' `items` block rather than being recomputed here out of
// the per-mode buckets. Those buckets are still in the payload — the
// stats screen's bars are drawn per mode and should be — so a fixture
// carries both, and the point of most of these tests is that the map
// reads the one and ignores the other.

const stats = {
  // Per-mode buckets, the stats screen's unit. Deliberately telling a
  // DIFFERENT story from the items block below, so a test cannot pass
  // by accident on the old arithmetic.
  vocab: {
    N5: {
      'vocab.flashcard.f2b': { total: 100, new: 0, learning: 0, mastered: 100 },
      'vocab.mcq.meaning':   { total: 100, new: 100, learning: 0, mastered: 0 },
    },
  },
  kana: {
    hiragana_basic: { 'kana.mcq.reading': { total: 46, new: 46, learning: 0, mastered: 0 } },
  },
  // Per-card, the map's unit.
  items: {
    vocab: {
      N5: { total: 665, learned: 532, score: 0.8 },
      N4: { total: 634, learned: 0, score: 0 },
      // N3..N1 absent from the payload entirely.
    },
    kana: {
      hiragana_basic: { total: 71, learned: 71, score: 1 },
    },
  },
}

describe('lineStops', () => {
  it('walks JLPT levels N5→N1 and takes each stop score from the items block', () => {
    const stops = lineStops(stats, 'vocab')
    expect(stops.map(s => s.key)).toEqual(LEVEL_STOPS)
    // 0.8 is the items block's answer. The per-mode buckets in the same
    // fixture would give (100 + 0) / 200 = 0.5, so this fails if the
    // map ever goes back to counting drills.
    expect(stops[0].score).toBeCloseTo(0.8)
    // N4 untouched -> 0; N3..N1 absent -> 0, but still drawn.
    expect(stops.slice(1).map(s => s.score)).toEqual([0, 0, 0, 0])
  })

  it('walks the four kana sets with their specimen labels', () => {
    const stops = lineStops(stats, 'kana')
    expect(stops.map(s => s.key)).toEqual(KANA_STOPS.map(s => s.key))
    expect(stops[0].label).toBe('あ')
    expect(stops[0].score).toBe(1)
    expect(stops[1].score).toBe(0)
  })

  it('draws a full-length, zero-score line from a missing or foreign payload', () => {
    // A failed fetch, the onboarding test's today-shaped mock, and a
    // backend deployed before this block existed must all fall through
    // to "nobody on this line yet", never a crash. The frontend and the
    // backend ship separately, so that last one is a real window.
    const noItems = { kanji: { N5: { m: { total: 10, mastered: 10 } } } }
    for (const bad of [null, undefined, {}, { total: 0, lanes: [] }, noItems]) {
      const stops = lineStops(bad, 'kanji')
      expect(stops).toHaveLength(5)
      expect(stopsTravelled(stops)).toBe(0)
    }
  })

  it('clamps a corrupt score into the range the map can draw', () => {
    const weird = { items: { kanji: { N5: { total: 10, learned: 99, score: 4 }, N4: { score: -2 } } } }
    const stops = lineStops(weird, 'kanji')
    expect(stops[0].score).toBe(1)
    expect(stops[1].score).toBe(0)
  })
})

describe('lineTotals', () => {
  it('counts cards learned out of cards there are, summed over the line', () => {
    expect(lineTotals(stats, 'vocab')).toEqual({ learned: 532, total: 665 + 634 })
  })

  it('never reports more learned than the deck holds', () => {
    const weird = { items: { kanji: { N5: { total: 10, learned: 99, score: 1 } } } }
    expect(lineTotals(weird, 'kanji')).toEqual({ learned: 10, total: 10 })
  })

  it('zeros out rather than throwing on a payload it does not recognise', () => {
    for (const bad of [null, undefined, {}, { items: 'nope' }]) {
      expect(lineTotals(bad, 'kanji')).toEqual({ learned: 0, total: 0 })
    }
  })
})

describe('stopsTravelled', () => {
  it('sums the stop scores into the marker position', () => {
    expect(stopsTravelled(lineStops(stats, 'vocab'))).toBeCloseTo(0.8)
  })
})
