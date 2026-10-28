// ── 対戦 — the sprint's rules, as the client draws them (plan 279) ──
// The server keeps the clock and the score (study/duel_*.py): every
// answer is timed from when it served the question, so nothing here
// decides a point. The client only draws what a question is worth while
// it waits -- the same curve, read off the same constants.

/** Where the placement test is taken again: it sets the starting Elo. */
export const LEVEL_PATH = '/profile/settings/level'

/** The sprint: sixty seconds of questions, the same ones for both players. */
export const SPRINT_MS = 60_000
/** A question's time: worth 100 for its first second, 25 at six, then 0. */
export const LIMIT_MS = 6_000
const FULL_MS = 1_000
/** A wrong answer holds the next question back this long. */
export const LOCK_MS = 1_000

/** What a right answer given `ms` after the question was served is worth. */
export function points(ms) {
  if (ms > LIMIT_MS) return 0
  if (ms <= FULL_MS) return 100
  return Math.max(25, Math.round(100 - (75 * (ms - FULL_MS)) / (LIMIT_MS - FULL_MS)))
}

/** A learner's name as another learner sees it: the handle, or « Voyageur » for one off the board. */
export function nameOf(who, t) {
  return who ?? t.pvpTraveller
}

/** Hours left on a challenge, at least one. */
export function hoursLeft(iso, now = Date.now()) {
  return Math.max(1, Math.round((Date.parse(iso) - now) / 3_600_000))
}

/** 'win' | 'loss' | 'draw', from the learner's side. */
export function outcome(mine, theirs) {
  if (mine > theirs) return 'win'
  if (mine < theirs) return 'loss'
  return 'draw'
}

/**
 * The other player's total `ms` into the sprint, from their recorded
 * answers (`[{ t, pts }]`, t in ms since their start): an asynchronous
 * duel replays them at the pace they were played.
 */
export function totalAt(timeline, ms) {
  let total = 0
  let rights = 0
  for (const e of timeline ?? []) {
    if (e.t > ms) break
    total += e.pts
    if (e.right ?? e.pts > 0) rights += 1
  }
  return { total, rights }
}

// The locale key for each refusal the duels' server answers with (its
// `code`, lib/api.js's ApiError): every code study/duel_friends.py,
// study/duels.py and routes/pvp.py can raise is here, and the test reads
// them off those files. A code a learner cannot cause (a mode or a
// reason the screens never send) reads as the plain failure.
export const ERROR_KEYS = {
  pvp_not_found: 'pvpErrNotFound',
  pvp_self: 'pvpErrSelf',
  pvp_not_friends: 'pvpErrNotFriends',
  pvp_request_cooldown: 'pvpErrCooldown',
  pvp_friend_limit: 'pvpErrFriendLimit',
  pvp_pending_limit: 'pvpErrPendingLimit',
  pvp_request_limit: 'pvpErrRequestLimit',
  pvp_search_limit: 'pvpErrSearchLimit',
  pvp_no_request: 'pvpErrNoRequest',
  pvp_not_blocked: 'pvpErrNotBlocked',
  pvp_not_placed: 'pvpErrNotPlaced',
  pvp_too_many: 'pvpErrTooMany',
  pvp_closed: 'pvpErrClosed',
  pvp_running: 'pvpErrRunning',
  pvp_played: 'pvpErrPlayed',
  pvp_waiting: 'pvpErrWaiting',
  pvp_not_started: 'pvpErrNotStarted',
  pvp_too_early: 'pvpErrTooEarly',
  pvp_not_settled: 'pvpErrNotSettled',
  pvp_review_unpaid: 'pvpErrUnpaid',
  pvp_bad_mode: 'pvpErrFailed',
  pvp_bad_reason: 'pvpErrFailed',
  pvp_no_opponent: 'pvpErrFailed',
  out_of_credits: 'pvpErrCredits',
}

/** What a screen says for a refused request: a locale key, never the server's English. */
export function errorKey(err) {
  return ERROR_KEYS[err?.code] ?? 'pvpErrFailed'
}

/** The same, about a duel itself: not found there is a duel gone (its
 *  seat given back, its paper dropped), never a username nobody holds. */
export function duelErrorKey(err) {
  return err?.code === 'pvp_not_found' ? 'pvpErrDuelGone' : errorKey(err)
}
