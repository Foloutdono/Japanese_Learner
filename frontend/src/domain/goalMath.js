// ── 行先 — the goal line's honest math ───────────────────────────
// Pure functions for the departure board (scene three of the office)
// and the ghost train on the pass back: what a pace costs, when each
// service arrives, and — given /api/journey/status's facts — where the
// train really is against where the promise says it should be. Ported
// from the Ticket Office II mockup (plan 063, phase B); the projection
// is linear on purpose, same as domain/journeyProjection.js, and the
// status thresholds below ARE the design — change them in a design
// round, not in passing.
//
// Layering, deliberately: like journeyProjection.js this file mirrors
// backend concepts with no network calls, and it does NOT import the
// service ladder — callers hand paces in as numbers (components/
// onboarding/paces.js owns what a pace is called; the math doesn't
// care). The one rule it does own is the kana rule, because backend
// routes/journey.py applies the identical one to itemsTotal/itemsDone
// and the two sides must never disagree.

import { levelItems } from './journeyProjection'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
export const DAYS_PER_MONTH = 30.4
const MS_PER_DAY = 86400000

// Status thresholds, in days behind the printed date. Exactly the
// mockup's: at or past 3 days early is 順調, within ±3 is 定刻, up to
// three weeks late is やや遅れ, beyond is 遅延. actual14 === 0 is
// 運転見合わせ regardless.
const AHEAD_AT_OR_BELOW = -3
const ON_TIME_WITHIN = 3
const SLIGHTLY_BEHIND_UP_TO = 21

export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + Math.round(n))
  return x
}

/** The levels a journey covers, boarding level included; no goal means
 *  the whole line ahead (start..N1), mirroring routes/journey.py's
 *  _journey_levels. */
export function journeyLevels(startLevel, goalLevel = null) {
  const a = Math.max(0, LEVELS.indexOf(startLevel))
  const b = goalLevel != null ? LEVELS.indexOf(goalLevel) : LEVELS.length - 1
  return LEVELS.slice(a, b + 1)
}

/** The kana front-load belongs to the journey exactly when the line
 *  begins at N5 — the beginner path and the N5 picker both board
 *  there. Same rule, same shape, as routes/journey.py (plan 063 open
 *  question 2): kana rides in BOTH the total and the done count, or in
 *  neither. */
export function journeyIncludesKana(startLevel) {
  return startLevel === 'N5'
}

/** Everything the promise prices, boarding to destination — the
 *  client-side twin of routes/journey.py's _items_total. */
export function journeyItems(volumes, startLevel, goalLevel = null) {
  const kana = journeyIncludesKana(startLevel) ? (volumes.kana ?? 0) : 0
  return journeyLevels(startLevel, goalLevel)
    .reduce((sum, level) => sum + levelItems(volumes, level), kana)
}

/** What a date costs: the exact pace that covers `items` in `days`,
 *  rounded up — the charter row's number in by-date mode. Feasibility
 *  is the caller's judgement against the ladder's MAX_PACE; this
 *  function just refuses to round ambition down. */
export function requiredPerDay(items, days) {
  return Math.ceil(items / days)
}

/** Display-only minutes-a-day estimate for a pace, new material plus
 *  its immediate review tail, rounded to the nearest five with a floor
 *  of five. Always print it with a ≈ — the honest part of this number
 *  is its vagueness. */
export function minutesFor(perDay) {
  return Math.max(5, Math.round((perDay * 1.6 + 4) / 5) * 5)
}

/** One board column: when each given pace delivers `items`. `perDays`
 *  is an array of numbers (map the service ladder to `perDay` before
 *  calling). */
export function arrivalsFor(items, perDays, now = new Date()) {
  return perDays.map(perDay => {
    const days = items / perDay
    return { perDay, days, date: addDays(now, days) }
  })
}

/** 停車駅 — the calling-at strip: one stop per level from boarding to
 *  destination, each with its cumulative item count and the date a
 *  steady `perDay` reaches it. */
export function callingAt(volumes, startLevel, goalLevel, perDay, { now = new Date() } = {}) {
  const stops = []
  let cumulative = journeyIncludesKana(startLevel) ? (volumes.kana ?? 0) : 0
  for (const level of journeyLevels(startLevel, goalLevel)) {
    cumulative += levelItems(volumes, level)
    const days = cumulative / perDay
    stops.push({ level, items: cumulative, days, date: addDays(now, days) })
  }
  return stops
}

/**
 * The ghost train's whole judgement, from /api/journey/status's facts:
 *
 *   journeyModel(status, now) -> {
 *     hasGoal, plannedPerDay, actualPerDay, remaining,
 *     planned,       // Date the pass promises, or null
 *     projected,     // Date the last 14 days' rhythm actually delivers
 *     deltaDays,     // projected − planned, rounded to days
 *     daysToPlanned, // runway left before the printed date (floor 0)
 *     recovery,      // ceil(remaining / daysToPlanned) — the RAW pace
 *                    // that still makes the date; the caller offers it
 *                    // only when it is ≤ the ladder's MAX_PACE, and
 *                    // otherwise offers moving the date instead
 *     status,        // 'suspended' | 'ahead' | 'onTime'
 *                    //   | 'slightlyBehind' | 'delayed' | null
 *   }
 *
 * A goal signed by pace alone (no goalTargetDate) still has a printed
 * promise: the arrival its own signing maths implied, goalSetAt +
 * itemsTotal / plannedPerDay. A profile with no contract at all
 * (plannedPerDay null — never onboarded) judges nothing: status null.
 * Goal-less contracts ("just ride") are judged on pace kept, not on an
 * arrival: at or above the promise is onTime, 70% of it is
 * slightlyBehind, below that delayed.
 */
export function journeyModel(status, now = new Date()) {
  const {
    goalLevel = null,
    goalTargetDate = null,
    goalSetAt = null,
    plannedPerDay = null,
    itemsTotal = 0,
    itemsDone = 0,
    actual14 = 0,
    days14 = 14,
  } = status ?? {}

  const remaining = Math.max(itemsTotal - itemsDone, 0)

  if (plannedPerDay == null) {
    return {
      hasGoal: false,
      plannedPerDay: null,
      actualPerDay: null,
      remaining,
      planned: null,
      projected: null,
      deltaDays: null,
      daysToPlanned: 0,
      recovery: null,
      status: null,
    }
  }

  const hasGoal = goalLevel != null
  const actualPerDay = actual14 / days14
  const setAt = goalSetAt ? new Date(goalSetAt) : null
  const planned = hasGoal
    ? (goalTargetDate
      ? new Date(goalTargetDate)
      : setAt
        ? addDays(setAt, itemsTotal / plannedPerDay)
        : null)
    : null
  const projected = actualPerDay > 0 ? addDays(now, remaining / actualPerDay) : null
  const deltaDays = planned && projected
    ? Math.round((projected - planned) / MS_PER_DAY)
    : null
  const daysToPlanned = planned
    ? Math.max(Math.round((planned - now) / MS_PER_DAY), 0)
    : 0
  const recovery = planned && daysToPlanned > 0
    ? Math.ceil(remaining / daysToPlanned)
    : null

  let statusId
  if (actual14 === 0) {
    statusId = 'suspended'
  } else if (!hasGoal) {
    statusId = actualPerDay >= plannedPerDay
      ? 'onTime'
      : actualPerDay >= plannedPerDay * 0.7
        ? 'slightlyBehind'
        : 'delayed'
  } else if (deltaDays !== null && deltaDays <= AHEAD_AT_OR_BELOW) {
    statusId = 'ahead'
  } else if (deltaDays === null || Math.abs(deltaDays) < ON_TIME_WITHIN) {
    statusId = 'onTime'
  } else if (deltaDays <= SLIGHTLY_BEHIND_UP_TO) {
    statusId = 'slightlyBehind'
  } else {
    statusId = 'delayed'
  }

  return {
    hasGoal,
    plannedPerDay,
    actualPerDay,
    remaining,
    planned,
    projected,
    deltaDays,
    daysToPlanned,
    recovery,
    status: statusId,
  }
}
