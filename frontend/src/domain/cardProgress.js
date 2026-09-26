// ── The card's bar, new to mastered (plan 147) ──────────────────
// Every card a run serves carries `progress`, 0 for a new card and 1 for
// a mastered one (srs.py's _progress): the four learning steps fill the
// first half, a graduated card's interval the second, on a log scale up
// to the 21 days that make it mastered. Each rating's review_preview
// carries where that rating leaves it.
//
// A card from a route that sends no `progress` (the first ride, an old
// saved queue) still has its stage, which settles the two ends; a card
// in learning with no figure draws no band rather than a wrong one.
export const STAGES = ['new', 'learning', 'mastered']

export function cardProgress(stage, progress) {
  if (typeof progress === 'number' && Number.isFinite(progress)) {
    return Math.min(1, Math.max(0, progress))
  }
  if (stage === 'new') return 0
  if (stage === 'mastered') return 1
  return null
}

// The three stretches of the card panel's fare strip: the stages behind
// the card full, the one it is in filled to its progress, the ones
// ahead empty. A new card stands at its first stop, so that stretch is
// full; a card in learning fills the middle one by how far it has come.
export function stripFills(stage, progress) {
  const at = Math.max(0, STAGES.indexOf(stage))
  const within = stage === 'learning' ? (cardProgress(stage, progress) ?? 0) : 1
  return STAGES.map((_, i) => (i < at ? 1 : i === at ? within : 0))
}
