import { describe, it, expect } from 'vitest'
import { sweepPlan, launchGaps, layoutFor, pileOf, fareAt, sealSpecks, DRAWN } from './sweep'
import { CARDS_32 } from './fixtures'

// ── 改札 — the everyday clear's sweep, as numbers (plan 191) ─────────
// The canvas's Main board computes its ceremony in its constructor;
// sweep.js is that constructor for a run of any length. These hold it to
// the board's own figures for the board's run, and to a sane shape for
// the others.

function dealt(n) {
  return Array.from({ length: n }, (_, i) => ({ ...CARDS_32[i % 32], id: `c${i}` }))
}

describe('the sweep, for the board\'s 32 cards', () => {
  const plan = sweepPlan(CARDS_32)

  it('launches as the board does: 460ms in, 260 → 40ms, the last three slowing', () => {
    const gaps = launchGaps(32)
    expect(gaps).toHaveLength(31)
    expect(gaps.slice(0, 4)).toEqual([260, 218, 183, 154])
    expect(gaps.slice(-4)).toEqual([40, 70, 130, 230])
    expect(plan.L[0]).toBe(460)
    expect(plan.L[31]).toBe(2954)
    expect(plan.flights.at(-1).f).toBe(940)
    expect(plan.flights.at(-2).f).toBe(740)
  })

  it('times the beats after it as the board does (~8s to the rest)', () => {
    const B = plan.beats
    expect(B.DONE).toBe(3602)
    expect(B.IMPACT).toBe(B.SEAL + 358)
    expect(B.PRESSED).toBe(B.FLY + 670)
    expect(B.TAIL).toBe(7284)
    expect(B.FINAL).toBe(8184)
  })

  it('lands each card on its verdict\'s pile, the board\'s seeded jitter and all', () => {
    expect(plan.flights.map(f => f.v)).toEqual(CARDS_32.map(c => c.verdict))
    // The board's die: card 0 (日, perfect) and card 1 (月, correct).
    expect(plan.flights[0].jit).toBeGreaterThanOrEqual(-3)
    expect(plan.flights[0].jit).toBeLessThanOrEqual(3)
    expect(plan.flights[0].lean).toBe(-8)
    expect(Math.abs(plan.flights[1].tx)).toBeLessThan(2.5)
    expect(plan.cum.at(-1)).toBe(32)
    // A pile's button is its top card's face.
    const lastWrong = plan.flights.filter(f => f.v === 0).at(-1)
    expect(plan.faces[0].x).toBeCloseTo(lastWrong.tx - 50.4, 1)
  })

  it('throws the board\'s thirteen specks round the 168px stamp', () => {
    const specks = sealSpecks()
    expect(specks).toHaveLength(13)
    for (const k of specks) {
      expect(Math.hypot(k.x + k.s / 2 - 84, k.y + k.s / 2 - 84)).toBeCloseTo(78, 0)
    }
  })

  it('counts the fare as the board does: 520ms, eased out', () => {
    expect(fareAt(100, 500, 197, 252)).toBe(197)
    expect(fareAt(500 + 260, 500, 197, 252)).toBeGreaterThan(240)
    expect(fareAt(500 + 520, 500, 197, 252)).toBe(252)
  })
})

describe('the sweep, for any run', () => {
  it('draws a long run as the board\'s 32 flights, the fast middle in bundles', () => {
    const plan = sweepPlan(dealt(120))
    expect(plan.flights).toHaveLength(DRAWN)
    expect(plan.cum.at(-1)).toBe(120)
    // the readable head and the last three are one card each
    expect(plan.flights.slice(0, 12).every(f => f.cards === 1)).toBe(true)
    expect(plan.flights.slice(-3).every(f => f.cards === 1)).toBe(true)
    // every card counted once, on its own pile
    const counts = [0, 0, 0]
    plan.flights.forEach(f => f.counts.forEach((c, v) => { counts[v] += c }))
    const want = [0, 0, 0]
    dealt(120).forEach(c => { want[c.verdict] += 1 })
    expect(counts).toEqual(want)
    // and the ceremony keeps the board's length
    expect(plan.beats.FINAL).toBe(sweepPlan(CARDS_32).beats.FINAL)
  })

  it('gives every pile that counts a card a card on it', () => {
    // 200 correct cards and one wrong one buried in the fast middle
    const cards = dealt(200).map((c, i) => ({ ...c, verdict: i === 100 ? 0 : 1 }))
    const plan = sweepPlan(cards)
    expect(plan.flights.some(f => f.v === 0)).toBe(true)
  })

  it('sweeps a short run at the board\'s own pace for its length, sooner', () => {
    const five = sweepPlan(dealt(5))
    expect(five.flights).toHaveLength(5)
    expect(launchGaps(5)).toEqual([260, 70, 130, 230])
    expect(five.beats.FINAL).toBeLessThan(7000)
    expect(five.beats.FINAL).toBeGreaterThan(5500)
    const one = sweepPlan(dealt(1))
    expect(one.flights).toHaveLength(1)
    expect(one.flights[0].last).toBe(true)
    expect(sweepPlan([]).flights).toHaveLength(0)
  })

  it('folds Perfect into Justes on two piles, centred', () => {
    expect(pileOf(2, 2)).toBe(1)
    expect(pileOf(2, 3)).toBe(2)
    const plan = sweepPlan(CARDS_32, { piles: 2 })
    expect(plan.faces).toHaveLength(2)
    expect(plan.flights.every(f => f.v < 2)).toBe(true)
    expect(plan.faces[0].x + 50.4).toBeLessThan(0)
    expect(plan.faces[1].x + 50.4).toBeGreaterThan(0)
    expect(plan.flights.every(f => f.ax === 0)).toBe(true)
  })
})

describe('the screen\'s places', () => {
  it('is the board at 844', () => {
    const at = layoutFor(844)
    expect(at).toMatchObject({ height: 844, scale: 1, fare: 264, piles: 442, sum: 544, tomorrow: 650, low: 150, fall: 392 })
    expect(at.rest).toBeCloseTo(42.8, 1)
  })

  it('gives up its air on a short phone, the summary clear of tomorrow and the fare of the streak', () => {
    for (const h of [667, 680, 700, 740]) {
      const at = layoutFor(h)
      expect(at.tomorrow - (at.sum + 18)).toBeGreaterThanOrEqual(16)
      expect(at.fare).toBeGreaterThanOrEqual(185)
      // the fare (124 tall) clear of the piles
      expect(at.piles - (at.fare + 124)).toBeGreaterThan(16)
      // the pile names under the piles during the sweep stay on the screen
      expect(399.2 + at.low + 132.3).toBeLessThanOrEqual(h)
    }
  })

  it('takes a tall phone\'s air into its two slacks, and draws a tiny one smaller', () => {
    const tall = layoutFor(932)
    expect(tall.fare - 177).toBeCloseTo(tall.tomorrow - (tall.sum + 18) - 1, 0)
    const tiny = layoutFor(600)
    expect(tiny.height).toBe(667)
    expect(tiny.scale).toBeCloseTo(600 / 667, 3)
  })
})
