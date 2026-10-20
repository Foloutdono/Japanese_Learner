import { describe, expect, it } from 'vitest'
import { TRACE, beginTrace, followTrace, runLengths, sampleCount, traceDone, traceMiss, traceProgress } from './trace'

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

// The hand drawing `drawn` on `guide`: 'start' where it cannot begin,
// 'ok' once the ink reaches the ring, else what to fix when it lifts.
function verdict(drawn, guide) {
  let run = beginTrace(guide, drawn[0])
  if (!run) return 'start'
  for (const p of drawn.slice(1)) {
    run = followTrace(run, guide, p)
    if (traceDone(run, guide)) return 'ok'
  }
  return traceDone(run, guide) ? 'ok' : traceMiss(run)
}

describe('the ink follows the stroke (plans 216, 263)', () => {
  const stroke = line(20, 30, 90, 30)

  it('takes a line drawn from the dot to the ring along the stroke', () => {
    expect(verdict(line(22, 32, 88, 29, 12), stroke)).toBe('ok')
  })

  it('allows a fingertip of slack at the dot and at the ring', () => {
    expect(verdict(line(20 + TRACE.reach - 2, 30, 90, 30), stroke)).toBe('ok')
    expect(verdict(line(20, 30 + TRACE.near - 2, 90, 30 + TRACE.near - 2), stroke)).toBe('ok')
  })

  it('refuses a line begun away from the dot', () => {
    expect(verdict(line(50, 30, 90, 30), stroke)).toBe('start')
  })

  it('refuses the stroke drawn the wrong way round', () => {
    expect(verdict(line(90, 30, 20, 30), stroke)).toBe('start')
  })

  it('refuses a line stopped short of the ring', () => {
    expect(verdict(line(20, 30, 60, 30), stroke)).toBe('end')
  })

  it('refuses a straight cut across a curved stroke', () => {
    const bowl = arc()
    expect(verdict(bowl.filter((_, i) => i % 3 === 0), bowl)).toBe('ok')
    expect(verdict(line(24, 50, 84, 50), bowl)).toBe('path')
  })

  it('refuses a line that wanders off and back', () => {
    const wander = [...line(20, 30, 55, 80, 10), ...line(55, 80, 90, 30, 10)]
    expect(verdict(wander, stroke)).toBe('path')
  })

  it('takes the ink on again only from where it stopped', () => {
    let run = beginTrace(stroke, [20, 30])
    run = followTrace(run, stroke, [50, 30])
    run = followTrace(run, stroke, [50, 70])
    expect(run.off).toBe(true)
    // Back on the stroke further on than the ink: nothing.
    run = followTrace(run, stroke, [75, 30])
    expect(traceProgress(run, stroke)).toBeCloseTo(30 / 70, 1)
    // Back where the ink stopped: it goes on, and reaches the ring.
    run = followTrace(run, stroke, [50, 30])
    expect(run.off).toBe(false)
    run = followTrace(run, stroke, [90, 30])
    expect(traceDone(run, stroke)).toBe(true)
    expect(traceMiss(run)).toBe('path')
  })

  it('refuses a tap', () => {
    expect(verdict([[20, 30]], stroke)).toBe('end')
  })

  it('follows a quick flick drawn in two points', () => {
    expect(verdict([[20, 30], [90, 30]], stroke)).toBe('ok')
  })

  it('judges a short tick by its ends', () => {
    const tick = line(70, 20, 74, 26, 4)
    expect(verdict(line(70, 21, 75, 27, 3), tick)).toBe('ok')
  })

  it('never takes the ink back, nor past the finger', () => {
    let run = beginTrace(stroke, [20, 30])
    run = followTrace(run, stroke, [55, 30])
    expect(traceProgress(run, stroke)).toBeCloseTo(0.5, 1)
    run = followTrace(run, stroke, [30, 30])
    expect(traceProgress(run, stroke)).toBeCloseTo(0.5, 1)
    // A finger that jumps ahead leaves the ink where it was.
    run = followTrace(run, stroke, [55, 30])
    run = followTrace({ ...run, last: [88, 30] }, stroke, [88, 30])
    expect(traceProgress(run, stroke)).toBeCloseTo(0.5, 1)
  })
})

describe('the geometry', () => {
  it('measures the guide as it goes', () => {
    expect(runLengths([[0, 0], [3, 4], [3, 10]])).toEqual([0, 5, 11])
  })

  it('samples a stroke every couple of units, never under eight', () => {
    expect(sampleCount(4)).toBe(8)
    expect(sampleCount(80)).toBe(40)
  })
})
