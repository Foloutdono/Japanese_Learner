import { describe, it, expect } from 'vitest'
import { weeklyRetention, missesSince, strengthRungs, lineRows } from './statsModel'

// A Wednesday, so "this week" started two days earlier.
const TODAY = new Date(2026, 8, 16, 12) // 2026-09-16

describe('weeklyRetention', () => {
  it('folds sparse days into twelve whole weeks, oldest first, this week last', () => {
    const r = weeklyRetention([], { today: TODAY })
    expect(r.weeks).toHaveLength(12)
    expect(r.weeks.at(-1).start).toBe('2026-09-14')       // Monday of this week
    expect(r.weeks[0].start).toBe('2026-06-29')           // eleven Mondays earlier
    expect(r.current).toBeNull()
    expect(r.delta).toBeNull()
  })

  it('a week is good over reviews, rounded; a week with nothing is null, not zero', () => {
    const r = weeklyRetention([
      { date: '2026-09-14', reviews: 10, good: 8 },
      { date: '2026-09-15', reviews: 10, good: 9 },   // same week → 17/20
      { date: '2026-09-13', reviews: 3,  good: 1 },   // the Sunday before → last week
    ], { today: TODAY })
    expect(r.weeks.at(-1).pct).toBe(85)
    expect(r.weeks.at(-2).pct).toBe(33)
    expect(r.weeks.at(-3).pct).toBeNull()
  })

  it('the headline is the latest week with reviews, the delta against the earliest', () => {
    const r = weeklyRetention([
      { date: '2026-07-01', reviews: 10, good: 7 },   // first week on the chart
      { date: '2026-09-08', reviews: 10, good: 9 },   // last week
    ], { today: TODAY })
    expect(r.current).toBe(90)
    expect(r.currentIndex).toBe(10)                   // not 11: this week is empty
    expect(r.firstIndex).toBe(0)
    expect(r.delta).toBe(20)
  })

  it('one week of data is a point, not a trend', () => {
    const r = weeklyRetention([{ date: '2026-09-15', reviews: 4, good: 4 }], { today: TODAY })
    expect(r.current).toBe(100)
    expect(r.firstIndex).toBe(11)
    expect(r.delta).toBeNull()
  })

  it('days outside the window are ignored', () => {
    const r = weeklyRetention([{ date: '2026-01-01', reviews: 4, good: 0 }], { today: TODAY })
    expect(r.weeks.every(w => w.reviews === 0)).toBe(true)
  })
})

describe('missesSince', () => {
  it('counts reviews that were not good, inside the window only', () => {
    const days = [
      { date: '2026-09-16', reviews: 10, good: 7 },   // today: 3
      { date: '2026-08-18', reviews: 5,  good: 4 },   // day 30 of 30: 1
      { date: '2026-08-17', reviews: 5,  good: 0 },   // day 31: out
    ]
    expect(missesSince(days, { window: 30, today: TODAY })).toBe(4)
  })
})

describe('strengthRungs', () => {
  it('cuts the raw histogram into five rungs', () => {
    const { rungs, total } = strengthRungs([
      { days: 0, count: 3 }, { days: 1, count: 2 }, { days: 6, count: 1 },
      { days: 7, count: 4 }, { days: 29, count: 1 }, { days: 30, count: 5 },
      { days: 89, count: 1 }, { days: 90, count: 2 }, { days: 400, count: 1 },
    ])
    expect(rungs.map(r => r.count)).toEqual([3, 3, 5, 6, 3])
    expect(total).toBe(20)
  })

  it('an empty histogram is five empty rungs', () => {
    const { rungs, total } = strengthRungs(undefined)
    expect(rungs.map(r => r.count)).toEqual([0, 0, 0, 0, 0])
    expect(total).toBe(0)
  })
})

describe('lineRows', () => {
  const stats = {
    kana:  { hiragana_basic: { 'kana.flashcard': { total: 10, new: 0, learning: 2, mastered: 8, reviews: 40, correct: 38 } } },
    vocab: {
      N5: { 'vocab.flashcard.f2b': { total: 100, new: 50, learning: 30, mastered: 20, reviews: 200, correct: 150 },
            'vocab.word_reading':  { total: 100, new: 100, learning: 0, mastered: 0, reviews: 0, correct: 0 } },
      N4: { 'vocab.flashcard.f2b': { total: 100, new: 100, learning: 0, mastered: 0, reviews: 0, correct: 0 } },
    },
    items: { ignored: true },
  }

  it('sums every level and mode into one row per line, in the fixed order', () => {
    const rows = lineRows(stats)
    expect(rows.map(r => r.category)).toEqual(['kana', 'vocab', 'kanji', 'grammar'])
    const vocab = rows[1]
    expect(vocab.total).toBe(300)
    expect(vocab.mastered).toBe(20)
    expect(vocab.retention).toBe(75)
    expect(vocab.masteredPct).toBeCloseTo(6.67, 1)
  })

  it('a level nobody has reviewed has null retention; a section absent has nothing', () => {
    const rows = lineRows(stats)
    const n4 = rows[1].levels.find(l => l.key === 'N4')
    expect(n4.retention).toBeNull()
    expect(rows[2].total).toBe(0)
    expect(rows[2].levels).toEqual([])
  })

  it('no payload is no rows', () => {
    expect(lineRows(null)).toEqual([])
  })
})
