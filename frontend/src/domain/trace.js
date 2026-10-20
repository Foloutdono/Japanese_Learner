// ── 初見 — how far a traced stroke has come along the stroke (plans 216, 263) ──
// The glyph tour's writing stop asks each stroke to be drawn from its
// start (the full dot) to its end (the ring), along it. Since plan 263
// the ink is the stroke's own, filled as the hand goes: the finger only
// says how far along the stroke it has come, and only ever forward, so
// a wavering line still leaves the stroke's shape on the board. Pure
// geometry in KanjiVG's own units, the 109-unit square its paths are
// drawn in, so the board's size on the screen never changes the
// verdict: on a 390px phone a unit is about three pixels.
//
// `guide` is the stroke sampled from its start to its end at even steps
// along it (domain/strokePath's sampleStroke). A run is the hand on the
// board: `at`, the last sample the ink has reached; `strayed`, whether
// the finger has left the stroke on the way; `off`, whether it is off
// it now -- the ink then waits where it stopped, and the finger takes
// it on again only from there; `last`, where the finger was.

/** The tolerances, in KanjiVG units. `reach`: how far from the dot a
    stroke may start -- a fingertip's width. `near`: how far the finger
    may stand off the stroke and still carry the ink. `look`: how far
    ahead of the ink the finger is looked for, so a line cut across a
    curve, or one that leaves and comes back further on, carries nothing.
    `done`: the share of the stroke that makes it whole. */
export const TRACE = { reach: 16, near: 13, look: 18, done: 0.96 }

/** How many points a stroke is sampled at: one every two units or so,
    and never fewer than a short tick needs to be judged on. */
export function sampleCount(length) {
  return Math.max(8, Math.ceil(length / 2))
}

// A finger moved further than this between two events is walked in
// steps of it, so a quick flick is followed as well as a slow line.
const STEP = 2

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** The length of the guide up to each of its samples. */
export function runLengths(guide) {
  const run = [0]
  for (let i = 1; i < guide.length; i++) run.push(run[i - 1] + dist(guide[i - 1], guide[i]))
  return run
}

/** A run begun at `p`, or null where the stroke cannot begin there
    (away from the dot -- or at the wrong end of it). */
export function beginTrace(guide, p, tol = TRACE) {
  if (!guide?.length || !p || dist(p, guide[0]) > tol.reach) return null
  return { at: 0, strayed: false, off: false, last: p }
}

/** The run once the finger has come to `p`: the ink moved on to the
    sample nearest the finger within `look` ahead of it, never back. */
export function followTrace(run, guide, p, tol = TRACE) {
  const lengths = runLengths(guide)
  const steps = Math.max(1, Math.ceil(dist(run.last, p) / STEP))
  let { at, strayed, off } = run
  for (let k = 1; k <= steps; k++) {
    const q = [run.last[0] + ((p[0] - run.last[0]) * k) / steps, run.last[1] + ((p[1] - run.last[1]) * k) / steps]
    const look = off ? 0 : tol.look
    let best = Infinity
    let to = at
    for (let j = at; j < guide.length && lengths[j] - lengths[at] <= look; j++) {
      const d = dist(q, guide[j])
      if (d < best) { best = d; to = j }
    }
    off = best > tol.near
    if (off) strayed = true
    else at = Math.max(at, to)
  }
  return { at, strayed, off, last: p }
}

/** The share of the stroke the ink has reached, 0 to 1. */
export function traceProgress(run, guide) {
  if (!run || guide.length < 2) return run && guide.length ? 1 : 0
  const lengths = runLengths(guide)
  const total = lengths[lengths.length - 1]
  return total ? lengths[run.at] / total : 1
}

/** Whether the ink has reached the ring: the stroke is traced. */
export function traceDone(run, guide, tol = TRACE) {
  return !!run && traceProgress(run, guide) >= tol.done
}

/** What to fix, for a hand lifted before the ring: 'path' (it left the
    stroke on the way) or 'end' (it stopped short). A stroke begun away
    from the dot is 'start', and beginTrace says so. */
export function traceMiss(run) {
  return run?.strayed ? 'path' : 'end'
}
