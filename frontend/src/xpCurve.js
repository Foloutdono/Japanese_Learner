// ── Client-side XP curve mirror ──────────────────────────
// Mirrors the backend's level thresholds (srs/xp.py's xp_threshold)
// so the UI can compute a new level's xpPrevLevel/xpForNext locally
// right after a review, without waiting on a fresh /api/profile fetch
// (see userProfileSummary.js's applyXpGain). Keep LEVEL_XP_BASE/
// LEVEL_XP_EXPONENT in sync with the backend if that curve ever
// changes — a mismatch just means the optimistic bar briefly shows
// the wrong span until the next real fetch corrects it (fetchSummary
// always wins, since it's the source of truth).
const LEVEL_XP_BASE = 60
const LEVEL_XP_EXPONENT = 1.5

// Total cumulative XP required to *reach* `level` (level 1 = 0 XP).
// Mirrors xp_threshold() in srs/xp.py exactly, formula for formula.
export function xpThreshold(level) {
  if (level <= 1) return 0
  return Math.round(LEVEL_XP_BASE * Math.pow(level - 1, LEVEL_XP_EXPONENT))
}