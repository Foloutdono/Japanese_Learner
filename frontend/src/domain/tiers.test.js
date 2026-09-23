import { describe, it, expect } from 'vitest'
import { tierAtSize, tierLabelFor } from './tiers'

describe('tierAtSize', () => {
  it('opens the tier holding the first rank of the old one', () => {
    expect(tierAtSize(3, 200, 500)).toBe(1)
    expect(tierAtSize(3, 200, 100)).toBe(5)
    expect(tierAtSize(4, 500, 200)).toBe(8)
    expect(tierAtSize(1, 1000, 100)).toBe(1)
  })

  it('names a range that holds the old first rank', () => {
    for (const [tier, size, next] of [[3, 200, 500], [7, 100, 1000], [2, 1000, 200]]) {
      const first = (tier - 1) * size + 1
      const [lo, hi] = tierLabelFor(tierAtSize(tier, size, next), next).split('–').map(Number)
      expect(first).toBeGreaterThanOrEqual(lo)
      expect(first).toBeLessThanOrEqual(hi)
    }
  })

  it('keeps the tier at the same size', () => {
    expect(tierAtSize(9, 200, 200)).toBe(9)
  })
})
