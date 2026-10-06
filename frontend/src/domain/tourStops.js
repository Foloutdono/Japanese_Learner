// ── 発見 — a tour's stops (plan 187) ─────────────────────────────
// Look, guess and found are every tour's; the twists and the scene join
// before the terminus where the point's tour is written (plan 187c).
// A twist per notion the point has beyond the meaning the guess asks
// (plan 189), each a stop of its own: `twist-0`, `twist-1`… Read by the
// tour itself (components/study/GrammarTour.jsx) and, on the desk, by
// its two side panels (components/study/TourPanels.jsx).

/** The tour's twists, one per notion. A payload from before plan 189
    carried one `twist`, which is a list of one. */
export function twistsOf(tour) {
  return tour.twists ?? (tour.twist ? [tour.twist] : [])
}

export function stopsOf(tour) {
  return [
    'look', 'guess', 'found',
    ...twistsOf(tour).map((_, i) => `twist-${i}`),
    tour.scene && 'scene', 'terminus',
  ].filter(Boolean)
}

/** What kind of stop it is: a twist's stop is `twist` whichever notion
    it holds, the others are their own name. */
export function stopKind(stop) {
  return stop.startsWith('twist-') ? 'twist' : stop
}

/** The twist a stop holds, by its place in the list, or -1. */
export function twistIndex(stop) {
  return stop.startsWith('twist-') ? Number(stop.slice(6)) : -1
}
