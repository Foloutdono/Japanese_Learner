// ── 試作 — the duels' drawn options, rendered by the app (plan 276) ──
// The owner asked to see each option as the app itself draws it, not as
// a mock-up: a screen with more than one option reads which to draw from
// the address (`?hub=H2`, `?race=P3`), so one build renders them all for
// the canvas. Dev only: import.meta.env.DEV is false in a production
// build, which always draws the fallback -- the pick, once it is made.
export function devVariant(key, fallback) {
  if (!import.meta.env.DEV || typeof window === 'undefined') return fallback
  return new URLSearchParams(window.location.search).get(key) ?? fallback
}
