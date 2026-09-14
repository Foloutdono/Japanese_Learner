// ── The stats model (plan 085) ────────────────────────────
// The statistics screen asks one question the profile and the fare
// gate do not: is the learning holding, and where is it leaking?
// Everything here is a pure function over two payloads —
// /api/stats (category → level → mode → counts) and /api/stats/report
// (days, strength, weakest) — so every number on the screen is derived
// in one place and the components are views and nothing else.

import { modeLabel as registryLabel } from './studyModes'
import { kanaSetLabel } from './kanaSets'

export const CATEGORIES = ['kana', 'vocab', 'kanji', 'grammar']

// ── Labels ────────────────────────────────────────────────
export function categoryLabel(t, category) {
  return {
    kana: t.kana,
    vocab: t.jlptVocab,
    kanji: t.kanji,
    grammar: t.grammarTitle,
  }[category] ?? category
}

// The deck a row sits in, as a person would name it. Most keys are
// already the display string — 'N5' is what that level is called — but
// the four kana sets are stored slugs, because card ids are built from
// them. Same helper the kana picker and the daily queue use, so a set
// is named one way everywhere.
export function groupLabel(t, key) {
  return kanaSetLabel(t, key)
}

// The mode label. The `category` argument is retained because the
// weakest list still reads whatever keys are in card_modes, which for
// pre-taxonomy rows are the un-namespaced legacy ones where the same
// string meant different things per section ('flashcard-m-kj' was
// "→ word" under vocab and "→ kanji" under kanji).
export function modeLabel(t, category, mode) {
  const fromRegistry = registryLabel(t, mode)
  if (fromRegistry !== mode) return fromRegistry

  const noun = category === 'kanji' ? t.kanjiNoun : t.wordNoun
  return {
    'qcm': t.modeQCM,
    'mcq': t.modeQCM,
    'flashcard': t.modeFlashcard,
    'write': t.modeWrite,
    'fill': t.modeFill,
    'qcm-kj-m': `${t.modeQCM} → ${t.meaning}`,
    'qcm-m-kj': `${t.modeQCM} → ${noun}`,
    'flashcard-kj-m': `${t.modeFlashcard} → ${t.meaning}`,
    'flashcard-m-kj': `${t.modeFlashcard} → ${noun}`,
  }[mode] ?? mode
}

// ── Retention by week ─────────────────────────────────────
// The report's `days` rows are sparse — (date, reviews, good) for the
// days that had any — and dated by the UTC day the review log keeps.
// They fold into whole weeks, Monday to Sunday, ending on the week
// today is in, oldest first, every week present. A week with nothing
// carries `pct: null`: not zero, which would draw a cliff the learner
// never fell off.
export const REPORT_WEEKS = 12

const DAY_MS = 24 * 60 * 60 * 1000

// Midday local, so a date string is the calendar day it names on
// either side of a DST change.
function dayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
  const dow = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - dow)
  return d
}

export function weeklyRetention(days, { weeks = REPORT_WEEKS, today = new Date() } = {}) {
  const thisMonday = mondayOf(today)
  const first = new Date(thisMonday)
  first.setDate(first.getDate() - 7 * (weeks - 1))

  const rows = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(first)
    start.setDate(first.getDate() + 7 * i)
    return { start: toISO(start), reviews: 0, good: 0, pct: null }
  })

  for (const { date, reviews, good } of days ?? []) {
    const i = Math.floor((dayOf(date) - first) / (7 * DAY_MS))
    if (i < 0 || i >= weeks) continue
    rows[i].reviews += reviews ?? 0
    rows[i].good += good ?? 0
  }
  for (const w of rows) {
    if (w.reviews > 0) w.pct = Math.round((w.good / w.reviews) * 100)
  }

  // The headline is the latest week with reviews in it — on a Monday
  // morning "this week" is not yet a number — and the delta is against
  // the earliest week on the chart that has one. Two weeks with data
  // are the least a trend can be made of. `firstIndex` is where the
  // drawing starts: the line leaves from the first week ridden, not
  // from twelve weeks ago, so a learner's second week is a line and not
  // a dot at the far right of an empty axis.
  const withData = rows.map((w, i) => (w.pct === null ? null : i)).filter(i => i !== null)
  const lastIdx = withData.at(-1) ?? null
  const firstIdx = withData[0] ?? null
  const current = lastIdx === null ? null : rows[lastIdx].pct
  const delta = withData.length >= 2 ? current - rows[firstIdx].pct : null

  return { weeks: rows, current, currentIndex: lastIdx, firstIndex: firstIdx, delta }
}

// Good-or-better is the retention definition (quality ≥ 3, the same
// line the scheduler graduates on); what falls under it is a miss.
export function missesSince(days, { window = 30, today = new Date() } = {}) {
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (window - 1), 12)
  let misses = 0
  for (const { date, reviews, good } of days ?? []) {
    if (dayOf(date) >= cutoff) misses += (reviews ?? 0) - (good ?? 0)
  }
  return misses
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── The strength ladder ───────────────────────────────────
// How far ahead the scheduler has pushed each card, in five rungs.
// The histogram arrives raw (interval_days, count) so the cut is a
// display decision made here: under a day is the learning steps, then
// a week, a month, a season, and everything that has gone quiet.
export const STRENGTH_RUNGS = [
  { key: 'day',    min: 0,  max: 0 },
  { key: 'week',   min: 1,  max: 6 },
  { key: 'month',  min: 7,  max: 29 },
  { key: 'season', min: 30, max: 89 },
  { key: 'beyond', min: 90, max: Infinity },
]

export function strengthRungs(strength) {
  const rungs = STRENGTH_RUNGS.map((r, i) => ({ ...r, index: i, count: 0 }))
  let total = 0
  for (const { days, count } of strength ?? []) {
    const rung = rungs.find(r => days >= r.min && days <= r.max)
    if (!rung) continue
    rung.count += count
    total += count
  }
  return { rungs, total }
}

// ── By line ───────────────────────────────────────────────
// One row per section, and under it one per level, each with its
// composition (new / learning / mastered, in drills — the unit the
// buckets are counted in) and its retention: correct over reviews,
// null where nothing has been reviewed.
const ZERO = { total: 0, new: 0, learning: 0, mastered: 0, reviews: 0, correct: 0 }

function sumBuckets(buckets) {
  const acc = { ...ZERO }
  for (const b of buckets) {
    if (!b) continue
    acc.total += b.total ?? 0
    acc.new += b.new ?? 0
    acc.learning += b.learning ?? 0
    acc.mastered += b.mastered ?? 0
    acc.reviews += b.reviews ?? 0
    acc.correct += b.correct ?? 0
  }
  return withDerived(acc)
}

function withDerived(row) {
  return {
    ...row,
    masteredPct: row.total > 0 ? (row.mastered / row.total) * 100 : 0,
    learningPct: row.total > 0 ? (row.learning / row.total) * 100 : 0,
    retention: row.reviews > 0 ? Math.round((row.correct / row.reviews) * 100) : null,
  }
}

export function lineRows(stats) {
  if (!stats) return []
  return CATEGORIES.map(category => {
    const section = stats[category] ?? {}
    const levels = Object.entries(section).map(([key, modes]) => ({
      key,
      ...sumBuckets(Object.values(modes ?? {})),
    }))
    return {
      category,
      levels,
      ...sumBuckets(levels),
    }
  })
}
