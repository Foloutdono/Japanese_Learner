import { describe, it, expect } from 'vitest'
import { carsFor, rungFor } from './cars'

// ── 号車 — how a line's cars stand (plan 251) ─────────────────────────
// The rows the cars stand in, and the lead's span, must leave the train
// with no gap in it at every count a line offers (vocab 3, kana 4,
// kanji 5, grammar 7) and at every width, two to a row at the least.

const cells = ({ lead }, n) => n - 1 + lead
const rows = (layout, n) => cells(layout, n) / layout.cols

describe('carsFor', () => {
  it('stands the drawn trains: two by two, three across, four across', () => {
    expect(carsFor(3)).toEqual({ cols: 2, lead: 2 })
    expect(carsFor(4)).toEqual({ cols: 2, lead: 1 })
    expect(carsFor(5)).toEqual({ cols: 3, lead: 2 })
    expect(carsFor(7)).toEqual({ cols: 4, lead: 2 })
  })

  it('leaves no gap in the train, at any count and width', () => {
    for (let n = 2; n <= 9; n++) {
      for (const width of [null, 400, 640, 800, 1100, 1400]) {
        const layout = carsFor(n, width)
        expect(Number.isInteger(rows(layout, n)), `${n} at ${width}`).toBe(true)
        expect(layout.lead).toBeGreaterThanOrEqual(1)
        expect(layout.lead).toBeLessThanOrEqual(layout.cols)
      }
    }
  })

  it('takes a car fewer to a row where the page is too narrow, never fewer than two', () => {
    expect(carsFor(7, 800).cols).toBe(3)
    expect(carsFor(7, 1100).cols).toBe(4)
    expect(carsFor(7, 300).cols).toBe(2)
    expect(carsFor(1)).toEqual({ cols: 1, lead: 1 })
  })
})

describe('rungFor', () => {
  it('reads the largest rung a well allows off its size', () => {
    expect(rungFor(null)).toBeNull()
    expect(rungFor({ width: 570, height: 213 })).toBe('lg')
    // Tall enough, too narrow for the specimen rungs.
    expect(rungFor({ width: 200, height: 213 })).toBe('md')
    expect(rungFor({ width: 450, height: 155 })).toBe('md')
    expect(rungFor({ width: 450, height: 100 })).toBe('sm')
  })
})
