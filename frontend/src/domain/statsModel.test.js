import { describe, it, expect } from 'vitest'
import { monthTicks } from './statsModel'

// ── 練習暦 — which months the calendar can name ──────────────
// A month is named where its run of weeks starts and prints into the
// columns that run owns. The calendar's first and last months are
// partial by construction, so either can own a single week — 19px on a
// 390px phone, against ~39px for "SEPT." — and both were printed into
// it and cut to two letters. A run of one goes unnamed now; the weeks
// themselves are untouched.

/** `weeks` columns of seven days, starting on the given Monday. */
function columnsFrom(startISO, weeks) {
  const start = new Date(`${startISO}T12:00:00Z`)
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = new Date(start)
      day.setUTCDate(day.getUTCDate() + w * 7 + d)
      return { date: day.toISOString().slice(0, 10), future: false }
    }))
}

describe('monthTicks', () => {
  it('names a month where its run of weeks starts', () => {
    // 2026-06-01 is a Monday. The fifth column opens on 29 June, so
    // June owns five and July starts in the sixth.
    const ticks = monthTicks(columnsFrom('2026-06-01', 9))
    expect(ticks.map(t => t.month)).toEqual([5, 6])   // June, July
    expect(ticks.map(t => t.index)).toEqual([0, 5])
  })

  it('leaves a month owning a single column unnamed', () => {
    // Nine columns from 2026-06-01 land August in the last one alone.
    const nine = monthTicks(columnsFrom('2026-06-01', 10))
    expect(nine.map(t => t.month)).not.toContain(7)   // August: one week
    // One more week and August owns two — enough to print.
    expect(monthTicks(columnsFrom('2026-06-01', 11)).map(t => t.month)).toContain(7)
  })

  it('takes the minimum as a parameter, and 1 keeps every month', () => {
    const all = monthTicks(columnsFrom('2026-06-01', 10), 1)
    expect(all.map(t => t.month)).toEqual([5, 6, 7])
  })

  it('measures a run against the months as they fall, not as they print', () => {
    // Dropping a tick must not lengthen the run of the one after it:
    // every kept tick still starts on its own month's first column.
    const ticks = monthTicks(columnsFrom('2026-06-01', 10))
    for (const tick of ticks) {
      const first = columnsFrom('2026-06-01', 10)[tick.index][0]
      expect(Number(first.date.slice(5, 7)) - 1).toBe(tick.month)
    }
  })
})
