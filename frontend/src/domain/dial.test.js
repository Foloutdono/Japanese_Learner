import { describe, it, expect } from 'vitest'
import { DIAL, dialArcs, fareArc } from './dial'

const C = 2 * Math.PI * DIAL.r

describe('the day\'s dial (plan 199)', () => {
  it('shares the ring by the lines\' counts, a gap between two arcs', () => {
    const arcs = dialArcs([
      { key: 'kana', n: 8 }, { key: 'vocab', n: 158 }, { key: 'kanji', n: 86 }, { key: 'grammar', n: 14 },
    ])
    expect(arcs.map(a => a.key)).toEqual(['kana', 'vocab', 'kanji', 'grammar'])
    // Each arc drawn a cap short at both ends: arcs, caps and gaps make
    // the circle whole.
    const drawn = arcs.reduce((s, a) => s + a.len + 2 * DIAL.cap, 0)
    expect(drawn + DIAL.gap * arcs.length).toBeCloseTo(C, 6)
    // In order from the top, each starting a gap after the last.
    for (let i = 1; i < arcs.length; i++) {
      const prevEnd = arcs[i - 1].start + arcs[i - 1].len + DIAL.cap
      expect(arcs[i].start - DIAL.cap - prevEnd).toBeCloseTo(DIAL.gap, 6)
    }
    // Vocabulary, 158 of 266, is the longest.
    expect(Math.max(...arcs.map(a => a.len))).toBe(arcs[1].len)
    // Nothing cut: every arc is lit whole.
    expect(arcs.every(a => a.litLen === a.len)).toBe(true)
  })

  it('lights the share a shorter run takes, and leaves out a line with nothing', () => {
    const arcs = dialArcs([
      { key: 'kana', n: 8, lit: 8 }, { key: 'vocab', n: 158, lit: 11 }, { key: 'kanji', n: 0 },
    ])
    expect(arcs.map(a => a.key)).toEqual(['kana', 'vocab'])
    expect(arcs[0].litLen).toBe(arcs[0].len)
    expect(arcs[1].lit).toBe(11)
    expect(arcs[1].litLen).toBeLessThan(arcs[1].len / 10)
  })

  it('draws a lone line as the whole ring, and nothing as no arc', () => {
    const [one] = dialArcs([{ key: 'vocab', n: 12, lit: 6 }])
    expect(one).toMatchObject({ whole: true, start: 0, lit: 6 })
    expect(one.len).toBeCloseTo(C, 6)
    expect(one.litLen).toBeCloseTo(C / 2, 6)
    expect(dialArcs([])).toEqual([])
    expect(dialArcs([{ key: 'kana', n: 0 }])).toEqual([])
  })

  it('ends the fare\'s arc where its share of the run does', () => {
    const half = fareArc(5, 10)
    expect(half.share).toBe(0.5)
    expect(half.len).toBeCloseTo(half.c / 2, 6)
    // Half way round from the top is the bottom of the ring.
    expect(half.x).toBeCloseTo(DIAL.size / 2, 6)
    expect(half.y).toBeCloseTo(DIAL.size / 2 + DIAL.fareR, 6)
    expect(fareArc(0, 10).len).toBe(0)
    expect(fareArc(12, 10).share).toBe(1)
    expect(fareArc(3, 0).share).toBe(0)
  })
})
