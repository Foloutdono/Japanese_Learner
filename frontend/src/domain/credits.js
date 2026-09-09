// ── 回数券 — the economy, as the client knows it (plan 069) ────
// The figures mirror backend/core/credits.py so copy can print them
// before the API has answered ("+30 at 00:00", "7 decks"); the server
// is the truth for the balance itself.
export const DAILY_REFILL = 30
export const CAP = 50
// 開通祝い — what a new account is handed on its first read, once. Well
// above CAP on purpose: the cap bounds the daily REFILL, not what a
// learner may hold (backend/core/credits.py).
export const SIGNUP_BONUS = 200
export const COST_PER_REVIEW = 1
// ── 仮名は無料 — the lines that ride without a fare ────────────
// Kana costs nothing. It is where every learner starts and the one
// thing nothing else in the app is legible without, so metering it
// prices the app out of being tried. Mirrors FREE_SOURCES in
// backend/core/credits.py, which also states it on every lane
// (`lane.free`) and in the credits summary (`freeSources`) — the
// server is the truth, and this copy is what lets the gate do its
// arithmetic before the API has answered.
export const FREE_SOURCES = ['kana']
export const FREE_DECKS = 7
export const FREE_CARDS = 200
export const PASS_DECKS = 100
export const PASS_CARDS = 10000

// There is no purchase flow yet. While this is false nothing about a
// pass is for sale: the offer screen, the pass tags on Practice and the
// analyzer and every "Go unlimited" stay out of the tree — a control
// that leads nowhere is worse than none (the owner's decision,
// plans/README.md, wave 14). Flipping it is the next wave's, with
// the store.
export const HAS_STORE = false

/**
 * Whether the cap belongs beside a balance. It bounds the daily refill,
 * not the wallet, so a balance above it — a fresh welcome is, at
 * SIGNUP_BONUS — has no honest denominator: "200/50" reads as a broken
 * fraction, and the figure stands better alone until the welcome has
 * been spent down to where the refill has something to do again.
 */
export function showsCap(balance, cap = CAP) {
  return balance != null && balance <= cap
}

/**
 * Whether a review under this mode key rides free. A mode key is
 * `<source>.<base>[.<direction>]` (backend/study/modes.py), so the
 * source is its first segment.
 */
export function isFreeMode(mode) {
  return typeof mode === 'string' && FREE_SOURCES.includes(mode.split('.')[0])
}

/**
 * Whether a lane of the day's queue rides free. The server says so on
 * the lane itself; the source is the fallback for a summary served
 * before it did. A personal deck is never free — no deck structure is
 * a kana one.
 */
export function isFreeLane(lane) {
  if (!lane) return false
  if (typeof lane.free === 'boolean') return lane.free
  return lane.kind !== 'personal' && FREE_SOURCES.includes(lane.source)
}

/** The fare a run of `due` reviews costs, `free` of which ride free. */
export function fareFor(due, free = 0) {
  return Math.max(0, due - Math.max(0, free)) * COST_PER_REVIEW
}

/**
 * How a run of `due` reviews fits a balance: how many ride today and
 * how many wait for the refill. `free` of them cost nothing and ride
 * whatever the balance is (仮名), so an empty balance is no longer the
 * same thing as an empty run. A pass (balance null) rides everything.
 */
export function runFit(due, balance, free = 0) {
  if (balance == null) return { rides: due, waits: 0 }
  const paid = Math.max(0, due - Math.max(0, free))
  const rides = (due - paid) + Math.min(paid, Math.max(0, Math.floor(balance / COST_PER_REVIEW)))
  return { rides, waits: due - rides }
}
