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

// ── Optimistic XP guess for the reward toast ─────────────────────
// compute_review_xp (srs/xp.py) also factors in today's review count
// and streak bonus — server-only state this module has no access to
// — so instead of reimplementing that formula, this just remembers
// the last real xp_earned seen for each quality rating and reuses it
// as an instant guess next time a card gets that same rating. It's
// wrong exactly as often as the streak/daily bonus actually changes
// between two reviews of the same quality, which is rare, and even
// then it's off by a small, fixed amount — good enough for a toast
// that's on screen well under two seconds, i.e. gone long before the
// real response would have arrived anyway on a slow connection. The
// real amount from the review response always wins for anything that
// persists (see applyXpGain in userProfileSummary.js) — this is only
// ever used for the instant flash.
const XP_GUESS_STORAGE_KEY = 'jp-xp-estimate'
const DEFAULT_XP_GUESS = 5

function loadXpGuesses() {
  try {
    const raw = window.localStorage.getItem(XP_GUESS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

let xpGuesses = loadXpGuesses()

export function estimateReviewXp(quality) {
  return xpGuesses[quality] ?? DEFAULT_XP_GUESS
}

export function recordReviewXp(quality, amount) {
  xpGuesses = { ...xpGuesses, [quality]: amount }
  try {
    window.localStorage.setItem(XP_GUESS_STORAGE_KEY, JSON.stringify(xpGuesses))
  } catch {
    // Best-effort — a failed write just means the next reload starts
    // from DEFAULT_XP_GUESS again, nothing else is affected.
  }
}