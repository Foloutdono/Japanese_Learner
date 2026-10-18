import { describe, it, expect } from 'vitest'
import { crossShare, CROSS, SHIN, ROAD, MARK_TOP, MARK_FOOT, CROSS_FOOT } from './markParts'

// ── 十 on the XP's line (plan 172, plan 200) ─────────────────────────
// The climb is one line rising across 辻 from the road's foot; 十 stands
// on the road, so its own fill starts where the line passes its foot.

describe('the mark’s parts', () => {
  it('cut the ink into 十 (two subpaths), 辶’s dot and zigzag, and the road', () => {
    expect(CROSS.match(/M/g)).toHaveLength(2)
    expect(SHIN.match(/M/g)).toHaveLength(2)
    expect(ROAD.match(/M/g)).toHaveLength(1)
  })
})

describe('crossShare', () => {
  it('is empty until the line reaches 十’s foot, full with the mark', () => {
    expect(crossShare(0)).toBe(0)
    expect(crossShare(0.2)).toBe(0)
    expect(crossShare(1)).toBe(1)
  })

  it('stands on the same line as the road’s fill', () => {
    // 十's bar is 31..783 from its foot, the road's 31..977 from its own.
    for (const share of [0.25, 0.4, 0.5, 0.64, 0.8, 0.95]) {
      const road = MARK_FOOT - (MARK_FOOT - MARK_TOP) * share
      const cross = CROSS_FOOT - (CROSS_FOOT - MARK_TOP) * crossShare(share)
      expect(cross).toBeCloseTo(road, 6)
    }
  })

  it('rises monotonically and holds its bounds for a share outside 0..1', () => {
    let last = 0
    for (let i = 0; i <= 100; i++) {
      const c = crossShare(i / 100)
      expect(c).toBeGreaterThanOrEqual(last)
      last = c
    }
    expect(crossShare(-1)).toBe(0)
    expect(crossShare(2)).toBe(1)
  })
})
