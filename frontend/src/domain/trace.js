// ── 初見 — whether a traced stroke is the stroke (plan 213) ──────
// The glyph tour's writing stop asks each stroke to be drawn from its
// start (the full dot) to its end (the ring), along it. Pure geometry
// in KanjiVG's own units, the 109-unit square its paths are drawn in,
// so the board's size on the screen never changes the verdict: on a
// 390px phone a unit is about three pixels.
//
// `drawn` is the learner's line as points, `guide` the stroke sampled
// from its start to its end (TraceBoard reads it off the path itself).

/** The tolerances, in KanjiVG units. `reach`: how far from the dot a
    stroke may start, or from the ring end -- a fingertip's width.
    `near`: how far the line may stand off the stroke. `cover`: the
    share of the stroke the line must pass near. `keep`: the share of
    the line that must stay near the stroke. */
export const TRACE = { reach: 16, near: 12, cover: 0.7, keep: 0.75 }

/** How many points a stroke is sampled at: one every two units or so,
    and never fewer than a short tick needs to be judged on. */
export function sampleCount(length) {
  return Math.max(8, Math.ceil(length / 2))
}

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

// From a point to the segment a-b.
function toSegment(p, a, b) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (!len2) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/** From a point to a polyline (a single point is a polyline too). */
export function toLine(p, line) {
  if (line.length === 1) return dist(p, line[0])
  let best = Infinity
  for (let i = 1; i < line.length; i++) best = Math.min(best, toSegment(p, line[i - 1], line[i]))
  return best
}

function share(points, line, within) {
  if (!points.length) return 0
  return points.filter(p => toLine(p, line) <= within).length / points.length
}

/**
 * 'ok', or what went wrong, in the order a learner would fix it:
 * 'start' (begun away from the dot -- or drawn the wrong way round),
 * 'end' (stopped short of the ring), 'path' (wandered off the stroke).
 */
export function traceVerdict(drawn, guide, tol = TRACE) {
  if (!drawn?.length || !guide?.length) return 'start'
  if (dist(drawn[0], guide[0]) > tol.reach) return 'start'
  if (dist(drawn[drawn.length - 1], guide[guide.length - 1]) > tol.reach) return 'end'
  if (share(guide, drawn, tol.near) < tol.cover) return 'path'
  if (share(drawn, guide, tol.near * 1.5) < tol.keep) return 'path'
  return 'ok'
}
