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

/** The fare a run of `due` reviews costs. */
export function fareFor(due) {
  return Math.max(0, due) * COST_PER_REVIEW
}

/**
 * How a run of `due` reviews fits a balance: how many ride today and
 * how many wait for the refill. A pass (balance null) rides everything.
 */
export function runFit(due, balance) {
  if (balance == null) return { rides: due, waits: 0 }
  const rides = Math.min(due, Math.max(0, Math.floor(balance / COST_PER_REVIEW)))
  return { rides, waits: due - rides }
}
