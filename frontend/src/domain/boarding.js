// ── 乗車 — the boarding's own arithmetic (plan 075) ───────────────
// Pure functions behind screens/BoardingFlow.jsx: which stops a set of
// answers walks through, what a kana answer says about the level, the
// rhythm's items, the day track's clock, and the plan's figures. No
// React, no network -- the same layering as domain/goalMath.js, whose
// item counts and dates this reuses so the boarding and the office in
// Settings never disagree by a rounding rule.
import { NOVICE_GOAL, addDays, journeyIncludesKana, journeyLevels } from './goalMath'
import { levelItems } from './journeyProjection'

export const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

// Why the learner is here -- the second question, and the source of the
// plan's two promise lines. Stored as is (routes/onboarding.py MOTIVES).
export const MOTIVES = ['studies', 'fun', 'trip', 'live', 'friends', 'other']

// The kana check's four answers (routes/onboarding.py KANA_KNOWN).
export const KANA_ANSWERS = ['hiragana', 'katakana', 'both', 'none']

// The lines a learner can choose to ride (backend core/lines.py): any
// non-empty subset of the three, in this order. The kana are not a
// choice -- every ticket rides them, they are what the other three are
// read through -- so they are priced by the kana check, not here. All
// three on is the default; a profile with no answer reads as all three.
export const LINES = ['vocab', 'kanji', 'grammar']

/** A profile's stored answer, or every line when it never answered. */
export function linesOrAll(stored) {
  return Array.isArray(stored) && stored.length > 0 ? LINES.filter(l => stored.includes(l)) : LINES
}

/** One line on or off, keeping LINES order; never empties the set (the
 *  step's Continue is what refuses an empty choice, so a tap that
 *  would leave nothing is simply the last line going out, and the
 *  caller decides what to say about it). */
export function toggleLine(chosen, line) {
  return chosen.includes(line) ? chosen.filter(l => l !== line) : LINES.filter(l => l === line || chosen.includes(l))
}

// The rhythm: minutes a day, and the new items that fit in them -- one
// a minute, the canvas's own figure (~10 new items at 10 min), which is
// also the pace the day's queue takes as daily_new_target.
export const RHYTHMS = [5, 10, 15, 20]
export const RECOMMENDED_RHYTHM = 10
export const itemsForRhythm = min => min

// The day track runs from six in the morning to midnight in half hours.
export const DAY_START_MIN = 6 * 60
export const DAY_END_MIN = 24 * 60
export const DAY_STEP_MIN = 30
export const LAST_DEPARTURE_MIN = DAY_END_MIN - DAY_STEP_MIN

export function timeToMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Snap a minute of the day onto the track's half hours, inside it. */
export function clampDeparture(min) {
  const snapped = Math.round(min / DAY_STEP_MIN) * DAY_STEP_MIN
  return Math.min(LAST_DEPARTURE_MIN, Math.max(DAY_START_MIN, snapped))
}

/** Where a minute sits on the track, 0..1. */
export function dayFraction(min) {
  return (min - DAY_START_MIN) / (DAY_END_MIN - DAY_START_MIN)
}

/** The minute a track position (0..1) names, snapped. */
export function minuteAtFraction(fraction) {
  const raw = DAY_START_MIN + Math.min(1, Math.max(0, fraction)) * (DAY_END_MIN - DAY_START_MIN)
  return clampDeparture(raw)
}

// The three announced rides (components/onboarding/departures.js prints
// the same clock) and the part of the day each one owns: the pass
// stores the bucket (daily_departure), the nudge the exact hour.
export function bucketFor(min) {
  if (min < 11 * 60) return 'am'
  if (min < 17 * 60) return 'noon'
  return 'pm'
}

/** The kana branch sets the level: a reader of both scripts earns the
 *  level list; anyone else is a NOVICE — one script or none is short of
 *  N5, which asks for both kana and ~100 kanji.
 *
 *  It answered 'N5' for those learners, which decided two things for
 *  them at once: they never saw the level list, and their goal list
 *  started at N4, because N5 was already behind them. A learner who
 *  reads hiragana alone could not say "I want to reach N5" — the one
 *  goal they are most likely to have. Novice keeps them off the JLPT
 *  line entirely, so their goal list holds the whole of it — and the
 *  novice's own stop at its head, since the kana are still ahead of
 *  them too (`goalStops`, owner's report). */
export function levelForKana(answer) {
  return answer === 'both' ? null : 'novice'
}

/** The JLPT level the office stores for a level-list choice: the
 *  novice (no JLPT stop behind) boards at N5 like the beginner. */
export function jlptFor(choice) {
  return choice === 'novice' ? 'N5' : choice
}

/** The stops ahead of a level, in line order; the next one is first.
 *  Called with the learner's own CHOICE rather than the level the
 *  office stores, so a novice (indexOf -1) gets the whole line from N5
 *  and an N5 learner gets N4 onward. */
export function stopsAhead(level) {
  return LEVELS.slice(LEVELS.indexOf(level) + 1)
}

/** The goal list: the stops a learner can still ride TO. The novice's
 *  own stop IS the kana, so a learner who cannot yet read both scripts
 *  has not reached it -- it opens their list, and "read the kana"
 *  becomes a destination they can name rather than a stop the flow
 *  assumes behind them (owner's call). A reader of both scripts stands
 *  there already -- the level list is where they said so -- and rides
 *  on to the JLPT stops.
 *
 *  The office signs that stop like any other destination: it goes onto
 *  the pass as goalLevel 'novice' with a date, and the ghost train
 *  measures it in kana (backend core/user_level.py NOVICE_GOAL). */
export function goalStops(choice, kanaAnswer) {
  const ahead = stopsAhead(choice)
  return choice === NOVICE_GOAL && kanaAnswer !== 'both' ? [NOVICE_GOAL, ...ahead] : ahead
}

/** ~n: the figure a promise wears, rounded to the nearest `to`. */
export function approx(n, to) {
  return Math.max(to, Math.round(n / to) * to)
}

/** The cumulative kanji up to and including a level -- the level list's
 *  descriptions, from the app's own content rather than a slogan. */
export function kanjiThrough(volumes, level) {
  const upTo = LEVELS.slice(0, LEVELS.indexOf(level) + 1)
  return upTo.reduce((sum, lvl) => sum + (volumes?.kanji?.[lvl] ?? 0), 0)
}

/** The kana signs an answer already covers, out of the journey's total. */
export function kanaKnownCount(volumes, kanaAnswer) {
  const all = volumes?.kana ?? 0
  if (kanaAnswer === 'both') return all
  if (kanaAnswer === 'hiragana' || kanaAnswer === 'katakana') return Math.round(all / 2)
  return 0
}

/**
 * The plan's figures, from the learner's own answers:
 *   words, kanji,    the vocabulary, kanji and grammar points from
 *   grammar          boarding to goal -- zero on a line not in `lines`
 *   kana             the signs still unread on this ride
 *   items            everything the ride covers, kana included
 *   days, date       at `perDay` new items a day, from `now`
 *
 * A ride to the novice's own stop is the kana and nothing else: no
 * JLPT level lies behind that stop (goalMath's journeyLevels answers
 * none for it), so it promises signs rather than words.
 */
export function planFigures(volumes, level, goal, perDay, kanaAnswer, now = new Date(), lines = LINES) {
  const levels = journeyLevels(level, goal)
  const volume = line => (lines.includes(line)
    ? levels.reduce((sum, lvl) => sum + (volumes?.[line]?.[lvl] ?? 0), 0)
    : 0)
  // Only the chosen lines are promised: a learner riding kanji alone is
  // promised no words, and the ride is priced at what it covers.
  const words = volume('vocab')
  const kanji = volume('kanji')
  const grammar = volume('grammar')
  // The kana ride in front of everything else -- goalMath owns when it
  // counts at all. A ride TO that stop prices EVERY sign, the ones the
  // learner already reads included: the destination is the syllabaries
  // mastered, a marked-known sign is still checked on the way, and
  // routes/journey.py prices the pass at the same total -- a promise
  // the pass cannot pay is worse than a slower one. Every other ride
  // carries the front-load net of what the kana check marked known.
  const kana = journeyIncludesKana(level)
    ? (goal === NOVICE_GOAL
      ? (volumes?.kana ?? 0)
      : Math.max(0, (volumes?.kana ?? 0) - kanaKnownCount(volumes, kanaAnswer)))
    : 0
  const items = levels.reduce((sum, lvl) => sum + levelItems(volumes ?? {}, lvl, lines), 0) + kana
  const days = Math.max(1, Math.ceil(items / Math.max(1, perDay)))
  return { words, kanji, grammar, kana, items, days, date: addDays(now, days) }
}

// The chart is an illustration (the canvas says so on the card): two
// curves over the ride's months, the steady line climbing to the words
// promised and the crammer's flattening early. Fractions of the box,
// left to right; the caller scales them onto the SVG.
export const CHART_US = [0, 0.16, 0.32, 0.49, 0.67, 0.83, 1]
export const CHART_THEM = [0, 0.15, 0.22, 0.26, 0.28, 0.29, 0.29]

/** 1,500 → "1.5k", 500 → "500", for the chart's axis. */
export function axisLabel(n) {
  if (n >= 1000) {
    const k = n / 1000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`
  }
  return String(Math.round(n))
}
