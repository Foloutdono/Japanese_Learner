import { useSyncExternalStore } from 'react'

// ── 本日の乗車 — this run's tally (plan 114) ────────────────────
// What the desk's session panel prints beside a run: how many cards
// this run has rated, how many of them good or better, and the XP they
// earned. Module state rather than screen state because the six SRS
// runs already share one review path (hooks/useReviewGates), and that
// hook is where the count is kept — so every run counts the same way
// and no screen had to learn a new prop.
//
// "Good" is quality ≥ 3, the line the scheduler graduates on and the
// statistics screen calls retention (domain/statsModel.js). The XP is
// what the review's own preview said it earned, the figure the toast
// and the level bar show.
//
// The phone counts too — a few integers, no DOM — and nothing reads it.
//
// Since plan 115 it also keeps the cards themselves, by the dictionary
// entry each was revealed on (stores/deskEntry) and with the rating it
// got last, so the panel can end a run with the ones that went badly
// (tallyMisses): a card missed then got right is not a miss.
// `startedAt` (plan 126): when the run started, for the rhythm the
// desk's card panel prints -- minutes elapsed, cards a minute.
//
// The practice runs count here too since plan 129 (reading,
// translation, dictation, composition, comprehension), for the same
// session panel: a sentence at its rating (countReview, with no XP --
// a practice fare is only known once the result has answered), and the
// fare when it lands (countXp, from hooks/usePracticeXp).
//
// `verdicts` (plan 174): every rating of this run in the order it was
// given, the quality alone, for the run's meter under the head on a
// phone (components/study/RunConsole.jsx) -- a segment a rating, in
// its verdict's ink. Unlike `cards` it keeps a card rated twice twice:
// the meter counts ratings, as the run's length does.
//
// `streak` / `best` (plan 178): the answers in a row rated good or better
// at this moment, and the longest such run this run has had. Counted from
// the rating alone, so a mode needs to say nothing more than it already
// does -- the five practice runs show it as the stamp in their head
// (components/study/RunStreak.jsx), which each used to keep for itself
// off a local flag, in two of the five.
const EMPTY = Object.freeze({ key: null, reviewed: 0, good: 0, xp: 0, cards: Object.freeze([]), verdicts: Object.freeze([]), startedAt: null, streak: 0, best: 0 })

let tally = EMPTY
const listeners = new Set()
function emit() { listeners.forEach(fn => fn()) }
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }

/** A new run: the session's identity, and every figure back to zero. */
export function startTally(key) {
  tally = { ...EMPTY, key, startedAt: Date.now() }
  emit()
}

/** One rated card; `entry` is the dictionary entry it was revealed on, if any. */
export function countReview({ quality, xp, entry } = {}) {
  const id = entryId(entry)
  const streak = quality >= 3 ? tally.streak + 1 : 0
  tally = {
    ...tally,
    reviewed: tally.reviewed + 1,
    good: tally.good + (quality >= 3 ? 1 : 0),
    xp: tally.xp + (Number.isFinite(xp) ? xp : 0),
    // Last rating wins, and the card moves to the end: the order the
    // misses are listed in is the order they were last seen.
    cards: id ? [...tally.cards.filter(c => c.id !== id), { id, entry: shape(entry), quality }] : tally.cards,
    verdicts: Number.isFinite(quality) ? [...tally.verdicts, quality] : tally.verdicts,
    streak,
    best: Math.max(tally.best, streak),
  }
  emit()
}

/** The fare of a practice answer, once its result has answered (plan 129). */
export function countXp(xp) {
  if (!Number.isFinite(xp) || xp <= 0) return
  tally = { ...tally, xp: tally.xp + xp }
  emit()
}

function entryId(entry) {
  if (!entry || (!entry.term && !entry.id)) return null
  return [entry.category ?? '', entry.id ?? '', entry.term ?? '', entry.kana ?? ''].join('\u0000')
}
function shape({ term, kana, category, id, label, session }) {
  return { term, kana, category, id, label, session }
}

/** The run's cards whose last rating was below good, as their entries. */
export function tallyMisses({ cards }) {
  return cards.filter(c => !(c.quality >= 3)).map(c => ({ ...c.entry, key: c.id }))
}

/** The share rated good or better, as a whole percent; null before the first. */
export function tallyAccuracy({ reviewed, good }) {
  return reviewed > 0 ? Math.round((good / reviewed) * 100) : null
}

export function peekTally() {
  return tally
}

export function useRunTally() {
  return useSyncExternalStore(subscribe, peekTally, peekTally)
}
