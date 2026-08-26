import { describe, it, expect } from 'vitest'
import { rectToNatural } from '../../lib/image'

// The component's one real invariant. The image is shown scaled to fit
// its container, so a rectangle dragged in DISPLAY space has to be
// converted to NATURAL image space before it can crop anything --
// everything downstream is wrong if this is wrong, and the symptom is
// recognizing the WRONG REGION, not an error. Nothing else about this
// component can fail silently in that way.
describe('rectToNatural', () => {
  it('scales up when the image is displayed smaller than it really is', () => {
    // A 4000x3000 photo shown at 400x300 -- a 10x factor.
    const out = rectToNatural(
      { x: 10, y: 20, w: 100, h: 50 },
      { width: 400, height: 300 },
      { width: 4000, height: 3000 },
    )
    expect(out).toEqual({ x: 100, y: 200, width: 1000, height: 500 })
  })

  it('is an identity when display and natural sizes match', () => {
    const out = rectToNatural(
      { x: 5, y: 6, w: 7, h: 8 },
      { width: 100, height: 100 },
      { width: 100, height: 100 },
    )
    expect(out).toEqual({ x: 5, y: 6, width: 7, height: 8 })
  })

  it('handles non-uniform scaling on each axis independently', () => {
    const out = rectToNatural(
      { x: 10, y: 10, w: 10, h: 10 },
      { width: 100, height: 200 },
      { width: 1000, height: 400 },
    )
    expect(out.x).toBe(100)
    expect(out.y).toBe(20)
    expect(out.width).toBe(100)
    expect(out.height).toBe(20)
  })

  it('never reports a negative origin', () => {
    const out = rectToNatural(
      { x: -50, y: -10, w: 20, h: 20 },
      { width: 100, height: 100 },
      { width: 200, height: 200 },
    )
    expect(out.x).toBe(0)
    expect(out.y).toBe(0)
  })

  it('never reports a region larger than the image', () => {
    const out = rectToNatural(
      { x: 0, y: 0, w: 500, h: 500 },
      { width: 100, height: 100 },
      { width: 200, height: 200 },
    )
    expect(out.width).toBeLessThanOrEqual(200)
    expect(out.height).toBeLessThanOrEqual(200)
  })
})
