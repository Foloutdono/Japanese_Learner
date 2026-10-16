// ── A held key, paced (plan 210) ───────────────────────────────
// A key held down repeats some thirty times a second, and a walk whose
// every step asks the server something (the grammar index's next
// lesson, the analyser's next sentence and its words) sent that many
// requests a second for as long as it was held. A walk keeps its held
// key -- skimming a long list by holding an arrow is a real use -- at
// one step every REPEAT_GAP_MS; a fresh press always steps.
//
// `last` is the walk's own ref, holding when it last stepped.
export const REPEAT_GAP_MS = 200

export function heldTooSoon(e, last, now = performance.now()) {
  if (e.repeat && now - (last.current ?? -Infinity) < REPEAT_GAP_MS) return true
  last.current = now
  return false
}
