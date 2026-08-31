import { describe, it, expect } from 'vitest'
import { lineStops, stopsTravelled, LEVEL_STOPS, KANA_STOPS } from './lineProgress'

// Buckets shaped exactly like /api/stats: source -> deck -> mode -> counts.
const stats = {
  vocab: {
    N5: {
      'vocab.flashcard.f2b': { total: 100, new: 0, learning: 0, mastered: 100 },
      'vocab.mcq.meaning':   { total: 100, new: 20, learning: 40, mastered: 40 },
    },
    N4: {
      'vocab.flashcard.f2b': { total: 200, new: 200, learning: 0, mastered: 0 },
    },
    // N3..N1 absent from the payload entirely.
  },
  kana: {
    hiragana_basic: { 'kana.mcq.reading': { total: 46, new: 0, learning: 0, mastered: 46 } },
  },
}

describe('lineStops', () => {
  it('walks JLPT levels N5→N1 and scores mastered + half learning over total', () => {
    const stops = lineStops(stats, 'vocab')
    expect(stops.map(s => s.key)).toEqual(LEVEL_STOPS)
    // N5: (100 + 40 + 0.5*40) / 200 = 0.8
    expect(stops[0].score).toBeCloseTo(0.8)
    // N4: untouched -> 0; N3..N1: absent -> 0, but still drawn.
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
    // A failed fetch, and the onboarding test's today-shaped mock, must
    // both fall through to "nobody on this line yet", never a crash.
    for (const bad of [null, undefined, {}, { total: 0, lanes: [] }]) {
      const stops = lineStops(bad, 'kanji')
      expect(stops).toHaveLength(5)
      expect(stopsTravelled(stops)).toBe(0)
    }
  })

  it('caps a corrupt over-full bucket at one stop', () => {
    const weird = { kanji: { N5: { m: { total: 10, learning: 0, mastered: 99 } } } }
    expect(lineStops(weird, 'kanji')[0].score).toBe(1)
  })
})

describe('stopsTravelled', () => {
  it('sums the stop scores into the marker position', () => {
    expect(stopsTravelled(lineStops(stats, 'vocab'))).toBeCloseTo(0.8)
  })
})
