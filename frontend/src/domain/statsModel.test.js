import { describe, it, expect } from 'vitest'
import {
  weeklyRetention, retentionSeries, missesSince, strengthRungs, modeRow, bucketRow,
  lineGrid, lineGrids, weakestByLine, cardHeadword, deckCode,
} from './statsModel'

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

// ── Plan 138: the days while the weeks are few ──
describe('retentionSeries', () => {
  it('a learner one week in gets a stop per day, the rest of the week ahead', () => {
    // TODAY is Wednesday 16 Sept; ridden Monday and Tuesday.
    const r = retentionSeries([
      { date: '2026-09-14', reviews: 10, good: 9 },
      { date: '2026-09-15', reviews: 20, good: 15 },
    ], { today: TODAY })
    expect(r.unit).toBe('day')
    expect(r.points.map(p => p.start)).toEqual([
      '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20',
    ])
    expect(r.points.map(p => p.pct)).toEqual([90, 75, null, null, null, null, null])
    expect(r.currentIndex).toBe(1)
    expect(r.firstIndex).toBe(0)
    expect(r.current).toBe(75)
    expect(r.delta).toBeNull()
  })

  it('starts on the first ridden day, not on its Monday', () => {
    const r = retentionSeries([{ date: '2026-09-16', reviews: 4, good: 4 }], { today: TODAY })
    expect(r.points[0].start).toBe('2026-09-16')
    expect(r.points).toHaveLength(5)
  })

  it('draws weeks from the fourth week on', () => {
    const three = retentionSeries([{ date: '2026-09-01', reviews: 4, good: 3 }], { today: TODAY })
    expect(three.unit).toBe('day')
    const four = retentionSeries([{ date: '2026-08-26', reviews: 4, good: 3 }], { today: TODAY })
    expect(four.unit).toBe('week')
    expect(four.points).toHaveLength(12)
    expect(four.firstIndex).toBe(8)
  })

  it('nothing ridden is the weekly shape with nothing in it', () => {
    const r = retentionSeries([], { today: TODAY })
    expect(r.unit).toBe('week')
    expect(r.currentIndex).toBeNull()
  })
})

describe('lineGrid', () => {
  const b = (reviews, correct) => ({ total: 50, new: 10, learning: 20, mastered: 20, reviews, correct })
  const stats = {
    kanji: {
      N5: { 'kanji.flashcard.f2b': b(100, 98), 'kanji.write_kanji': b(40, 39), 'kanji.radical': b(0, 0) },
      N4: { 'kanji.flashcard.f2b': b(50, 43), 'kanji.write_kanji': b(20, 16), 'kanji.radical': b(0, 0) },
      N3: { 'kanji.flashcard.f2b': b(0, 0) },
    },
    items: { ignored: true },
  }

  it('a row per exercise ridden, in the registry\'s order; a column per deck ridden', () => {
    const g = lineGrid(stats, 'kanji')
    expect(g.rows.map(r => r.mode)).toEqual(['kanji.flashcard.f2b', 'kanji.write_kanji'])
    expect(g.decks).toEqual(['N5', 'N4'])
    expect(g.rows[1].cells.map(c => c.pct)).toEqual([98, 80])
    expect(g.reviews).toBe(210)
    expect(g.retention).toBe(93)
  })

  it('a cell nobody has reviewed is null; a line absent is empty', () => {
    const g = lineGrid({ vocab: { N5: { 'vocab.flashcard.f2b': b(10, 9), 'vocab.word_reading': b(0, 0) }, N4: { 'vocab.word_reading': b(5, 5) } } }, 'vocab')
    expect(g.rows.map(r => r.mode)).toEqual(['vocab.flashcard.f2b', 'vocab.word_reading'])
    expect(g.rows[0].cells.map(c => c.pct)).toEqual([90, null])
    const none = lineGrid(stats, 'grammar')
    expect(none.rows).toEqual([])
    expect(none.retention).toBeNull()
  })
})

describe('lineGrids', () => {
  const b = (reviews, correct) => ({ total: 50, reviews, correct })
  it('marks each line\'s lowest cell under the learner\'s own average, once', () => {
    const { grids, average } = lineGrids({
      kana: { hiragana_basic: { 'kana.flashcard.f2b': b(100, 100) } },
      kanji: { N5: { 'kanji.flashcard.f2b': b(100, 97) }, N4: { 'kanji.flashcard.f2b': b(50, 42), 'kanji.write_kanji': b(40, 30) } },
      grammar: { N5: { 'grammar.flashcard.f2b': b(3, 0) } },
    })
    expect(average).toBe(92)
    const leaks = grids.map(g => g.rows.flatMap(r => r.cells).filter(c => c.leak).map(c => `${c.deck} ${c.mode}`))
    // Kana holds; kanji leaks at N4's drawing (75%, under 84% for its
    // sense); grammar's three reviews are too few to call.
    expect(leaks).toEqual([[], [], ['N4 kanji.write_kanji'], []])
  })

  it('no reviews anywhere is no average and no red', () => {
    const { grids, average } = lineGrids({})
    expect(average).toBeNull()
    expect(grids.every(g => g.rows.length === 0)).toBe(true)
  })
})

describe('weakestByLine', () => {
  it('reads each line\'s own cards off the one list', () => {
    const lines = weakestByLine([
      { category: 'vocab', raw_id: 'vocab_N5_靴下_くつした' },
      { category: 'kanji', raw_id: 'kanji_N4_急' },
      { category: 'kanji', raw_id: 'kanji_N4_仕' },
    ])
    expect(lines.kana).toEqual([])
    expect(lines.kanji.map(w => w.raw_id)).toEqual(['kanji_N4_急', 'kanji_N4_仕'])
  })
})

describe('cardHeadword', () => {
  it('peels the id down to the thing studied', () => {
    expect(cardHeadword('kanji_N4_急', 'kanji', 'N4')).toBe('急')
    expect(cardHeadword('vocab_N5_靴下_くつした', 'vocab', 'N5')).toBe('靴下')
    expect(cardHeadword('vocab_N5__コート', 'vocab', 'N5')).toBe('コート')
    expect(cardHeadword('kana_きゃ', 'kana', 'hiragana_combos')).toBe('きゃ')
    expect(cardHeadword('')).toBe('？')
  })
})

describe('deckCode', () => {
  it('writes a kana set as its first glyph and a level as itself', () => {
    expect(deckCode('katakana_combos')).toBe('キャ')
    expect(deckCode('N4')).toBe('N4')
  })
})

// ── One platform (plan 114) ──
// The desk's station split prints each platform's own composition and
// due count beside it, read from the same buckets the stats screen sums.
// Its figure is what the cards add up to (plan 184), so a platform with
// nothing mastered but a week's work behind it does not read 0.
describe('modeRow', () => {
  const stats = {
    vocab: { N5: { 'vocab.flashcard.f2b': { total: 80, new: 40, learning: 20, mastered: 20, learned: 30, due_now: 7, reviews: 50, correct: 40 } } },
  }

  it('is one bucket with its figure, its shares and its due count', () => {
    const row = modeRow(stats, 'vocab', 'N5', 'vocab.flashcard.f2b')
    expect(row).toMatchObject({ total: 80, mastered: 20, learning: 20, new: 40, learned: 30, due: 7 })
    // The bar: the figure in full, the cards met beyond it in part.
    expect(row.learnedPct).toBe(37.5)
    expect(row.metPct).toBe(12.5)
  })

  it('is null where there is no bucket', () => {
    expect(modeRow(stats, 'vocab', 'N4', 'vocab.flashcard.f2b')).toBeNull()
    expect(modeRow(stats, 'vocab', 'N5', 'fast-review')).toBeNull()
    expect(modeRow(null, 'vocab', 'N5', 'vocab.flashcard.f2b')).toBeNull()
  })
})

describe('bucketRow', () => {
  it('reads a scoped stats route\'s bucket', () => {
    const row = bucketRow({ total: 40, new: 30, learning: 6, mastered: 4, learned: 7, due_now: 3 })
    expect(row).toMatchObject({ total: 40, mastered: 4, learning: 6, learned: 7, due: 3, learnedPct: 17.5, metPct: 7.5 })
  })

  it('counts a week of work, where nothing is mastered yet', () => {
    const row = bucketRow({ total: 100, new: 60, learning: 40, mastered: 0, learned: 23, due_now: 0 })
    expect(row.learned).toBe(23)
    expect(row.learnedPct).toBe(23)
    expect(row.metPct).toBe(17)
  })

  it('never draws the met part negative, whatever a payload says', () => {
    expect(bucketRow({ total: 10, new: 6, learning: 1, mastered: 3, learned: 5 }).metPct).toBe(0)
  })

  it('reads a payload from before the figure as the mastered cards it had', () => {
    const row = bucketRow({ total: 40, new: 30, learning: 6, mastered: 4, due_now: 3 })
    expect(row).toMatchObject({ learned: 4, learnedPct: 10, metPct: 15 })
  })

  it('is no row for an empty tier\'s {error} or a failed fetch', () => {
    expect(bucketRow({ error: 'Empty tier' })).toBeNull()
    expect(bucketRow(null)).toBeNull()
    expect(bucketRow(undefined)).toBeNull()
  })
})
