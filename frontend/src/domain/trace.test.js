import { describe, expect, it } from 'vitest'
import { TRACE, sampleCount, toLine, traceVerdict } from './trace'

// A stroke as a line of samples from (x0, y0) to (x1, y1).
function line(x0, y0, x1, y1, n = 30) {
  return Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n])
}

// An arc: the bowl of a stroke like あ's third, from its left to its right.
function arc(n = 40) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = Math.PI * (i / n)
    return [54 - 30 * Math.cos(a), 50 + 30 * Math.sin(a)]
  })
}

describe('traceVerdict (plan 216)', () => {
  const stroke = line(20, 30, 90, 30)

  it('takes a line drawn from the dot to the ring along the stroke', () => {
    expect(traceVerdict(line(22, 32, 88, 29, 12), stroke)).toBe('ok')
  })

  it('allows a fingertip of slack at either end', () => {
    expect(traceVerdict(line(20 + TRACE.reach - 2, 30, 90 - TRACE.reach + 2, 30), stroke)).toBe('ok')
  })

  it('refuses a line begun away from the dot', () => {
    expect(traceVerdict(line(50, 30, 90, 30), stroke)).toBe('start')
  })

  it('refuses the stroke drawn the wrong way round', () => {
    expect(traceVerdict(line(90, 30, 20, 30), stroke)).toBe('start')
  })

  it('refuses a line stopped short of the ring', () => {
    expect(traceVerdict(line(20, 30, 60, 30), stroke)).toBe('end')
  })

  it('refuses a straight cut across a curved stroke', () => {
    const bowl = arc()
    expect(traceVerdict(bowl.filter((_, i) => i % 3 === 0), bowl)).toBe('ok')
    expect(traceVerdict(line(24, 50, 84, 50), bowl)).toBe('path')
  })

  it('refuses a line that wanders off and back', () => {
    const wander = [...line(20, 30, 55, 80, 10), ...line(55, 80, 90, 30, 10)]
    expect(traceVerdict(wander, stroke)).toBe('path')
  })

  it('refuses a tap, or nothing at all', () => {
    expect(traceVerdict([], stroke)).toBe('start')
    expect(traceVerdict([[20, 30]], stroke)).toBe('end')
  })

  it('judges a short tick by its ends', () => {
    const tick = line(70, 20, 74, 26, 4)
    expect(traceVerdict(line(70, 21, 75, 27, 3), tick)).toBe('ok')
  })
})

describe('the geometry', () => {
  it('measures a point against a polyline', () => {
    expect(toLine([5, 3], [[0, 0], [10, 0]])).toBe(3)
    expect(toLine([13, 4], [[0, 0], [10, 0]])).toBe(5)
    expect(toLine([1, 1], [[1, 4]])).toBe(3)
  })

  it('samples a stroke every couple of units, never under eight', () => {
    expect(sampleCount(4)).toBe(8)
    expect(sampleCount(80)).toBe(40)
  })
})
