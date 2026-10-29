// ── 対戦 — the sprint's rules, as the client draws them (plan 279) ──
// The server keeps the clock and the score (study/duel_*.py): every
// answer is timed from when it served the question, so nothing here
// decides a point. The client only draws what a question is worth while
// it waits -- the same curve, read off the same constants.

/** The sprint: two minutes of questions, the same ones for both players
 *  (plan 284). A new duel's; one dealt before keeps its own, which its
 *  run's endsAt and its cover's sprintMs say. */
export const SPRINT_MS = 120_000
/** A question's time: worth 100 for its first second, 25 at six, then 0. */
export const LIMIT_MS = 6_000
const FULL_MS = 1_000
/** A wrong answer holds the next question back this long. */
export const LOCK_MS = 1_000
/** A question's choices (plan 288; study/duel_paper.CHOICES). */
export const CHOICES = 3
/** Whether a question's choices are Japanese: a reading's or a
 *  spelling's are; a word's are meanings, a kana's its romaji (plan 289). */
export const japaneseChoices = kind => kind === 'reading' || kind === 'writing'
/** A stop's name: a JLPT level as it is written, the beginner's stop
 *  under N5 (plan 289, `novice`) in words. */
export const levelName = (t, level) => (level === 'novice' ? t.pvpNovice : level)
/** What a paper asks, by the stops its mix stands between: the
 *  beginner's asks kana where the others ask kanji (plan 289). */
export function questionWords(t, mix) {
  const levels = (mix ?? []).map(m => m.level)
  if (levels.length && levels.every(l => l === 'novice')) return t.pvpWordsKana
  return levels.includes('novice') ? t.pvpWordsKanaKanji : t.pvpWordsKanji
}

/** What a right answer given `ms` after the question was served is worth. */
export function points(ms) {
  if (ms > LIMIT_MS) return 0
  if (ms <= FULL_MS) return 100
  return Math.max(25, Math.round(100 - (75 * (ms - FULL_MS)) / (LIMIT_MS - FULL_MS)))
}

// What a right answer's speed is called on the run (plan 285): 神速 for
// one worth the full hundred, which the result counts as an « éclair »
// (study/duels.lines), 快速 for one inside two and a half seconds.
const QUICK_PTS = points(2500)

/** 'flash' | 'quick' | null, from the points an answer's speed made. */
export function speedNote(pts) {
  if (pts >= 100) return 'flash'
  if (pts >= QUICK_PTS) return 'quick'
  return null
}

/**
 * Where a streak stands in the combo's tiers (the server's `rules.tiers`,
 * `[{ at, mult }]`): what it pays, the tier it reached and the next
 * one, and how far along to it. The server scores; this draws the ring.
 */
export function comboOf(streak, tiers = []) {
  let mult = 1
  let from = 0
  let next = null
  for (const tier of tiers) {
    if (streak >= tier.at) {
      mult = tier.mult
      from = tier.at
    } else {
      next = tier.at
      break
    }
  }
  return { mult, from, next, share: next ? (streak - from) / (next - from) : 1 }
}

/** A multiplier as the run prints it: ×1,5 in French, ×1.5 in English. */
export function multOf(mult, lang) {
  return `×${mult.toLocaleString(lang)}`
}

/** A learner's name as another learner sees it: the handle, or « Voyageur » for one off the board. */
export function nameOf(who, t) {
  return who ?? t.pvpTraveller
}

/** The first challenge the learner received (GET /api/pvp's answer): a
 *  friend waiting in a live room before one waiting on the learner's
 *  run. Their own challenge, sent, and a ranked seat wait in the hall:
 *  no friend « defies » them with those (plan 287, Today's board). */
export function firstChallenge(data) {
  return data?.live?.[0] ?? data?.toPlay?.find(d => d.kind === 'friend' && d.role === 'opponent') ?? null
}

/** A sprint's time as the head prints it: 1:58, 0:09. */
export function clockOf(seconds) {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
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
