import { describe, it, expect } from 'vitest'
import { clsOf, inpOf } from './vitals'

// ── 速度 — the two figures as their thresholds define them ──────────
// The trail of 2026-10-18 read CLS 1.32 for a first ride and its Today:
// six small windows summed over three minutes on one page.

describe('clsOf', () => {
  it('takes the worst session window, not the sum', () => {
    const shifts = [
      { t: 0, value: 0.05 }, { t: 400, value: 0.05 },   // one window: 0.10
      { t: 3000, value: 0.08 },                          // a gap of > 1 s: a new one
      { t: 9000, value: 0.02 }, { t: 9500, value: 0.02 },
    ]
    expect(clsOf(shifts)).toBeCloseTo(0.10)
  })

  it('closes a window at five seconds even without a gap', () => {
    const shifts = Array.from({ length: 12 }, (_, i) => ({ t: i * 900, value: 0.01 }))
    // 0..4500 is six shifts; 5400 opens the next window.
    expect(clsOf(shifts)).toBeCloseTo(0.06)
  })

  it('is zero with nothing moved', () => {
    expect(clsOf([])).toBe(0)
  })
})

describe('inpOf', () => {
  it('is the slowest interaction under fifty', () => {
    expect(inpOf([40, 256, 120])).toBe(256)
  })

  it('skips one per fifty from the top', () => {
    const many = Array.from({ length: 100 }, (_, i) => i + 1)   // 1..100
    expect(inpOf(many)).toBe(98)
  })

  it('is nothing with no interaction', () => {
    expect(inpOf([])).toBeUndefined()
  })
})
