import { rng, BOARD_SEED } from './kit/rng'

// ── 改札 — the everyday clear's sweep, as numbers (plan 191) ─────────
// The canvas's Main board (390×844) computes its whole ceremony in its
// constructor: when each card launches, how long it flies, where it
// lands and at what angle, and the beats after the last one. This is
// that constructor, for a run of any length, with no DOM: ClearPhone
// draws what it returns, and the tests read it directly.
//
// The board's pacing, kept as drawn: launches accelerate from 260ms to
// 40ms (×0.84 a card), the last three slow down (70, 130, 230ms), a
// flight lasts ~3.1 gaps (at full speed ~8 cards are in the air), the
// last three fly longer and the last lands with weight. A run longer
// than the board's 32 is drawn as the board's 32 flights: the readable
// head (the twelve slow launches) and the ritardando (the last three)
// one card each, and the fast middle carrying the rest in bundles --
// the counter and the piles take each bundle at once, as the board's
// 40ms pace already blurs them. A shorter run keeps the board's own
// formula for its length, so a few cards sweep through in a breath.

/** The flights the board draws at most. */
export const DRAWN = 32
// A long run's flights: these first ones one card each (the gaps above
// the 40ms floor), and the last three.
const HEAD = 12
const TAIL = 3

/** The piles' centres, px off the screen's centre line: three, or two centred. */
export const PILE_X = Object.freeze({ 3: [-119.5, 0, 119.5], 2: [-59.75, 59.75] })

/** A landed card is drawn at .9: 100.8 × 66.6, its face the pile's button. */
export const FACE_W = 100.8

// The deck's fan: the card under the top one and the one under that.
const FAN = ['none', 'translate(10px,-8px) rotate(5deg)', 'translate(-11px,-13px) rotate(-6deg)']

/** The pile a verdict falls on: three piles keep it, two fold Perfect into Justes. */
export function pileOf(verdict, piles = 3) {
  const v = Number.isInteger(verdict) ? Math.max(0, Math.min(2, verdict)) : 1
  return piles === 3 ? v : Math.min(v, 1)
}

// The groups of cards each flight carries, as index lists into the run.
function groups(count) {
  if (count <= DRAWN) return Array.from({ length: count }, (_, i) => [i])
  const out = []
  for (let i = 0; i < HEAD; i++) out.push([i])
  const middle = DRAWN - HEAD - TAIL
  const pool = count - HEAD - TAIL
  let at = HEAD
  for (let j = 0; j < middle; j++) {
    const size = Math.floor(pool / middle) + (j < pool % middle ? 1 : 0)
    out.push(Array.from({ length: size }, (_, k) => at + k))
    at += size
  }
  for (let i = count - TAIL; i < count; i++) out.push([i])
  return out
}

/** The board's gaps between launches for `n` flights (n - 1 of them). */
export function launchGaps(n) {
  const gaps = []
  for (let i = 0; i < n - 4; i++) gaps.push(Math.max(40, Math.round(260 * 0.84 ** i)))
  gaps.push(...[70, 130, 230].slice(Math.max(0, 4 - n)))
  return gaps
}

/**
 * The whole sweep for a run's faces ({ term, kana, line, verdict }) on
 * `piles` piles (3, or 2 when the learner's bar offers no Perfect):
 *
 *   flights  [{ i, face, v, cards, counts, d, f, tx, ax, sy, jit, lean,
 *             fast, last }] -- each drawn flight, the card it shows, the
 *             pile it lands on, the run's cards it carries (and how many
 *             per pile), its launch and length (ms) and its geometry
 *   L, R, A  each flight's launch, read (its centre on the slot line, the
 *             lamp) and landing, in ms on the flights' clock
 *   cum      the run's cards read once flight i has been read
 *   faces    each pile's button: { x, jit } -- its top card's face (x px
 *             off the centre line, its left edge) or the pile's own place
 *   beats    { SWEEP, DONE, SEAL, IMPACT, ROLL, FLY, RISE, PRESSED, GLIDE,
 *             FARE, HOME, CHIP, MERGE, CHIPGONE, TAIL, FINAL } (ms), and
 *             `order`, their names in order
 *   total    the run's cards
 */
export function sweepPlan(cards, { piles = 3 } = {}) {
  const faces = cards ?? []
  const count = faces.length
  const sets = groups(count)
  const n = sets.length
  const gaps = launchGaps(n)
  const L = [460]
  for (let i = 1; i < n; i++) L.push(L[i - 1] + gaps[i - 1])
  const F = L.map((_, i) => (i === n - 1 ? 940 : i === n - 2 ? 740 : i === n - 3 ? 600
    : Math.min(860, Math.max(340, Math.round(gaps[i] * 3.1 + 60)))))
  const R = L.map((l, i) => Math.round(l + (i === n - 1 ? 0.567 : 0.562) * F[i]))
  const OUT = L.map((l, i) => Math.round(l + 0.668 * F[i]))
  const A = L.map((l, i) => Math.round(l + 0.86 * F[i]))

  const r = rng(BOARD_SEED)
  const PX = PILE_X[piles] ?? PILE_X[3]
  const depth = [0, 0, 0]
  const seen = new Set()
  const flights = sets.map((set, i) => {
    // The card a flight shows: its last, unless the bundle holds a pile
    // no flight has landed on yet -- then that pile's card, so every
    // pile that counts a card has one on it.
    let shown = set[set.length - 1]
    for (const k of set) {
      const p = pileOf(faces[k].verdict, piles)
      if (!seen.has(p)) shown = k
    }
    const face = faces[shown]
    const v = pileOf(face.verdict, piles)
    seen.add(v)
    const per = [0, 0, 0]
    for (const k of set) per[pileOf(faces[k].verdict, piles)] += 1
    const kk = depth[v]++
    const last = i === n - 1
    const jit = (r() * 6 - 3).toFixed(1)
    const jx = r() * 5 - 2.5
    // Each card leans toward its pile on the way out; the middle pile's a
    // little either way (the board's die, in the board's order).
    const lean = piles === 3
      ? (v === 0 ? 8 : v === 2 ? -8 : r() * 4 - 2)
      : (v === 0 ? 8 : -8)
    return {
      i, face, v, cards: set.length, counts: per,
      d: L[i], f: F[i],
      tx: Number((PX[v] + jx).toFixed(1)),
      // the middle column bows left, right, left… so it never falls on one axis
      ax: piles === 3 && v === 1 && !last ? (kk % 2 ? 13 : -13) : 0,
      sy: Number((-Math.min(kk, 5) * 1.5).toFixed(1)),
      jit: Number(jit),
      lean: Number(lean.toFixed(1)),
      fast: F[i] <= 560,
      last,
    }
  })
  const cum = []
  flights.forEach((fl, i) => cum.push((cum[i - 1] ?? 0) + fl.cards))

  // Each pile's button is its top card's face: the last flight it took.
  const pileFaces = PX.map((x, v) => {
    let top = null
    flights.forEach(fl => { if (fl.v === v) top = fl })
    return top ? { x: Number((top.tx - FACE_W / 2).toFixed(1)), jit: top.jit } : { x: Number((x - FACE_W / 2).toFixed(1)), jit: 0 }
  })

  // The beats after the sweep, one focal point each: the last card clears
  // the slab (the counter becomes the header, the reader steps away); the
  // seal appears once it has landed and slams; the streak rolls; the seal
  // flies to today's slot while the piles rise; the figure glides home as
  // the fare arrives; the prime's chip flies into the total, which counts;
  // the tail lands on the counted total.
  const DONE = (n ? OUT[n - 1] : 200) + 20
  const SEAL = DONE + 300
  const IMPACT = SEAL + 358
  const FLY = IMPACT + 650
  const PRESSED = FLY + 670
  const GLIDE = PRESSED + 60
  const HOME = GLIDE + 500
  const CHIP = HOME + 20
  const MERGE = CHIP + 704
  const TAIL = MERGE + 420
  const beats = {
    SWEEP: 0, DONE, SEAL, IMPACT, ROLL: IMPACT + 90, FLY, RISE: PRESSED - 100, PRESSED, GLIDE,
    FARE: GLIDE + 260, HOME, CHIP, MERGE, CHIPGONE: CHIP + 800, TAIL, FINAL: TAIL + 900,
  }
  const order = ['SWEEP', 'DONE', 'SEAL', 'IMPACT', 'ROLL', 'FLY', 'RISE', 'PRESSED', 'GLIDE', 'FARE', 'HOME',
    'CHIP', 'MERGE', 'CHIPGONE', 'TAIL', 'FINAL']
  return { flights, L, R, A, cum, faces: pileFaces, beats, order, total: count, fan: FAN }
}

/** The count's ease (the board's): from `from` to `to` over 520ms after the merge. */
export function fareAt(t, merge, from, to) {
  if (t < merge) return from
  const p = Math.min(1, (t - merge) / 520)
  return from + Math.round((to - from) * (1 - (1 - p) ** 3))
}

/** The ink specks the slam throws: the board's thirteen, round the rim of the 168px stamp. */
export function sealSpecks() {
  const rs = rng(306)
  return Array.from({ length: 13 }, (_, j) => {
    const deg = -24 + j * (360 / 13) + (rs() * 12 - 6)
    const sz = 5 + Math.round(rs() * 3)
    const a = (deg * Math.PI) / 180
    const rr = 78
    const out = 24 + rs() * 16
    return {
      x: Number((84 + Math.cos(a) * rr - sz / 2).toFixed(1)),
      y: Number((84 + Math.sin(a) * rr - sz / 2).toFixed(1)),
      s: sz,
      dx: Number((Math.cos(a) * out).toFixed(1)),
      dy: Number((Math.sin(a) * out).toFixed(1)),
      d: (j % 4) * 12,
    }
  })
}

/**
 * The screen's vertical places for a frame `height` px tall (the board's
 * 844 drawn into it). The top half -- the counter, the deck, the reader,
 * the stamp, the header, the week -- stands where the board drew it; the
 * board's two slacks (87px between the streak and the fare, 88 between
 * the summary and tomorrow) take a taller screen's air or give it up on a
 * shorter one, and the tail stands on the screen's foot. Under 667px the
 * board is laid out at 667 and drawn smaller (`scale`). During the sweep
 * the piles hang lower (`low`, 150 on the board) as far as the screen's
 * foot lets their names show.
 */
export function layoutFor(height) {
  const H = Math.max(667, Math.round(height || 844))
  const scale = height && height < 667 ? height / 667 : 1
  // The air between the streak and the tail, past what the fare, the
  // piles and the summary hold: shared (87 over the fare, 88 under the
  // summary at 844); short of 32 the summary keeps 16 over tomorrow and
  // the fare 8 under the streak, then the fare's gap to the piles gives.
  const free = H - 669
  let slack = 8
  let squeeze = 0
  if (free >= 32) slack = (free - 1) / 2
  else if (free >= 24) slack = free - 16
  else squeeze = Math.min(40, 24 - free)
  const fare = 177 + slack
  const piles = fare + 178 - squeeze
  const low = Math.min(150, H - 548)
  return {
    height: H,
    scale,
    fare,
    piles,
    sum: piles + 102,
    tomorrow: H - 194,
    low,
    rest: Number((piles - 399.2).toFixed(1)),
    fall: 242 + low,
  }
}
