// ── 発見 — a tour's stops (plan 187) ─────────────────────────────
// Look, guess and found are every tour's; the twist and the scene join
// before the terminus where the point's tour is written (plan 187c).
// Read by the tour itself (components/study/GrammarTour.jsx) and, on the
// desk, by its two side panels (components/study/TourPanels.jsx).
export function stopsOf(tour) {
  return ['look', 'guess', 'found', tour.twist && 'twist', tour.scene && 'scene', 'terminus'].filter(Boolean)
}
