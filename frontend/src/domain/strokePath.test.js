import { describe, expect, it } from 'vitest'
import { parseStroke, sampleStroke } from './strokePath'

// あ's first stroke, as KanjiVG writes it (03042.svg).
const A1 = 'M31.01,33c0.88,0.88,2.75,1.82,5.25,1.75c8.62-0.25,20-2.12,29.5-4.25c1.51-0.34,4.62-0.88,6.62-0.5'
// A stroke of 丗 (04e17.svg), whose second curve is a smooth one (s).
const SMOOTH = 'M52.75,15.25c1.25,0.5,2,2.25,2.25,3.25s0,66.75-0.25,73'

describe('parseStroke (plan 216)', () => {
  it('reads relative curves from where the last one ended', () => {
    const segments = parseStroke(A1)
    expect(segments).toHaveLength(3)
    expect(segments[0][0]).toEqual([31.01, 33])
    const end = segments[2][3]
    expect(end[0]).toBeCloseTo(72.38, 5)
    expect(end[1]).toBeCloseTo(30, 5)
  })

  it('reflects the last control point for a smooth curve', () => {
    const [first, second] = parseStroke(SMOOTH)
    expect(first[2][0]).toBeCloseTo(54.75, 5)
    // 2 × the end (55, 18.5) − the control point before it (54.75, 17.5).
    expect(second[1][0]).toBeCloseTo(55.25, 5)
    expect(second[1][1]).toBeCloseTo(19.5, 5)
    expect(second[3][0]).toBeCloseTo(54.75, 5)
    expect(second[3][1]).toBeCloseTo(91.5, 5)
  })

  it('reads absolute commands, lines and a close', () => {
    const segments = parseStroke('M10,10 C20,0 30,0 40,10 S60,20 70,10 L70,30 h-10 v5 Z')
    expect(segments[1][1]).toEqual([50, 20])
    expect(segments[2][3]).toEqual([70, 30])
    expect(segments[3][3]).toEqual([60, 30])
    expect(segments[4][3]).toEqual([60, 35])
    expect(segments.at(-1)[3]).toEqual([10, 10])
  })

  it('reads numbers run together as SVG writes them', () => {
    const [seg] = parseStroke('M1.5.5c1-1,2-2,3-3')
    expect(seg[0]).toEqual([1.5, 0.5])
    expect(seg[3]).toEqual([4.5, -2.5])
  })

  it('draws nothing from nothing', () => {
    expect(parseStroke('')).toEqual([])
    expect(sampleStroke('')).toEqual([])
  })
})

describe('sampleStroke', () => {
  it('walks the stroke from its start to its end at even steps', () => {
    const pts = sampleStroke('M0,0 L30,40', 10)
    expect(pts).toHaveLength(11)
    expect(pts[0]).toEqual([0, 0])
    expect(pts[10][0]).toBeCloseTo(30, 5)
    expect(pts[10][1]).toBeCloseTo(40, 5)
    expect(pts[5][0]).toBeCloseTo(15, 5)
    expect(pts[5][1]).toBeCloseTo(20, 5)
  })

  it('samples a stroke every couple of units by default', () => {
    const pts = sampleStroke('M0,0 L80,0')
    expect(pts).toHaveLength(41)
  })
})
