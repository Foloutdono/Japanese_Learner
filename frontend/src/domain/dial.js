// ── 一目 — the day's dial (plan 199) ────────────────────────────
// The owner's pick A2 of the canvas "Tsuji — Today at a glance": the
// day is a ring, one arc a line in its pigment, round the count and
// the minutes; inside it a thinner ring says how much of the run the
// balance boards. Drawn in a 248-unit box whatever its size on screen
// (components/station/TodayDial.jsx), so the arcs are measured here
// once, along the circle, from the top, clockwise.

export const DIAL = Object.freeze({
  size: 248,
  // The lines' ring, and the gap left between two of its arcs.
  r: 118,
  gap: 8,
  // Half the arc's stroke: a round cap reaches this far past the end it
  // is drawn at, so each arc is drawn this much short at both ends and
  // the gap between two neighbours is still `gap`.
  cap: 3,
  // The fare's ring, inside it.
  fareR: 104,
})

const circumference = r => 2 * Math.PI * r

/**
 * The ring's arcs. `parts` are [{ key, n, lit }]: a line's cards in the
 * day and how many of them the run takes (`lit`, at most `n`, all of
 * them when left out). A part with nothing is not drawn; a lone part is
 * the whole ring, with no gap to leave. Each arc is { key, start, len,
 * lit, litLen, whole }: where it starts and how long it is in path
 * units, and the length of the share the run takes (drawn over the
 * rest, which dims, when the arc is `cut`).
 */
export function dialArcs(parts, { r = DIAL.r, gap = DIAL.gap, cap = DIAL.cap } = {}) {
  const shown = (parts ?? []).filter(p => p.n > 0)
  const total = shown.reduce((sum, p) => sum + p.n, 0)
  if (!total) return []
  const c = circumference(r)
  const litOf = p => Math.min(Math.max(p.lit ?? p.n, 0), p.n)
  if (shown.length === 1) {
    const [p] = shown
    return [{ key: p.key, start: 0, len: c, lit: litOf(p), litLen: (c * litOf(p)) / p.n, cut: litOf(p) < p.n, whole: true }]
  }
  const usable = c - gap * shown.length
  let at = gap / 2
  return shown.map(p => {
    const span = (usable * p.n) / total
    const lit = litOf(p)
    const arc = {
      key: p.key,
      start: at + cap,
      len: Math.max(0, span - 2 * cap),
      lit,
      litLen: Math.max(0, (span * lit) / p.n - 2 * cap),
      cut: lit < p.n,
      whole: false,
    }
    at += span + gap
    return arc
  })
}

/**
 * The fare's ring: the share of the run the balance boards, as the
 * length of its arc from the top and the point it ends at (where the
 * dot is drawn). `share` is clamped to 0..1.
 */
export function fareArc(rides, total, { r = DIAL.fareR, size = DIAL.size } = {}) {
  const share = total > 0 ? Math.min(1, Math.max(0, rides / total)) : 0
  const c = circumference(r)
  const angle = share * 2 * Math.PI
  const mid = size / 2
  return { share, c, len: c * share, x: mid + r * Math.sin(angle), y: mid - r * Math.cos(angle) }
}
