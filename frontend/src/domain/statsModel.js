// ── The stats model (plans 085, 138) ──────────────────────
// The statistics screen asks one question the profile and the fare
// gate do not: is the learning holding, and where is it leaking?
// Everything here is a pure function over two payloads —
// /api/stats (category → level → mode → counts) and /api/stats/report
// (days, strength, each line's weakest cards) — so every number on the
// screen is derived in one place and the components are views and
// nothing else.

import { modeLabel as registryLabel, MODES_FOR_SOURCE } from './studyModes'
import { kanaSetLabel, kanaSets } from './kanaSets'

export const CATEGORIES = ['kana', 'vocab', 'kanji', 'grammar']

// ── Labels ────────────────────────────────────────────────

// The deck a row sits in, as a person would name it. Most keys are
// already the display string — 'N5' is what that level is called — but
// the four kana sets are stored slugs, because card ids are built from
// them. Same helper the kana picker and the daily queue use, so a set
// is named one way everywhere.
export function groupLabel(t, key) {
  return kanaSetLabel(t, key)
}

// The deck as a grid's column head writes it (plan 138): a JLPT level
// is already short (N5), a kana set is its first glyph (あ, きゃ, ア,
// キャ) — the sign its stop is written on, so the column reads as the
// line's stops do. The full name stays in the cell's accessible name.
export function deckCode(key) {
  return kanaSets({}).find(s => s.slug === key)?.code ?? key
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

// ── Retention, drawn in days while the weeks are few (plan 138) ──
// A learner one week in had a chart of one stop — a dot and a dashed
// rail across a card. While the line would draw DAILY_WEEKS weeks or
// fewer it draws their days instead: a stop per day from the first
// ridden day, and the days left in this week ahead of it. From the
// fourth week the weeks are enough to be a line and it draws weeks.
//
// Both shapes carry the same fields — `points` ({ start, reviews,
// good, pct }), `currentIndex` (the last point ridden), `firstIndex`
// (where the drawing starts) — and `unit`, which the screen reads to
// name a point. A day's delta is noise, so days carry none.
export const DAILY_WEEKS = 3

export function retentionSeries(days, { today = new Date() } = {}) {
  const weekly = weeklyRetention(days, { today })
  const drawn = weekly.firstIndex === null ? 0 : weekly.weeks.length - weekly.firstIndex
  if (drawn === 0 || drawn > DAILY_WEEKS) {
    return {
      unit: 'week',
      points: weekly.weeks,
      current: weekly.current,
      currentIndex: weekly.currentIndex,
      firstIndex: weekly.firstIndex,
      delta: weekly.delta,
    }
  }

  const from = dayOf(weekly.weeks[weekly.firstIndex].start)
  const byDate = new Map()
  for (const { date, reviews, good } of days ?? []) {
    if (!(reviews > 0) || dayOf(date) < from) continue
    const row = byDate.get(date) ?? { reviews: 0, good: 0 }
    row.reviews += reviews
    row.good += good ?? 0
    byDate.set(date, row)
  }
  const first = [...byDate.keys()].sort()[0]
  const sunday = mondayOf(today)
  sunday.setDate(sunday.getDate() + 6)

  const points = []
  for (const d = dayOf(first); d <= sunday; d.setDate(d.getDate() + 1)) {
    const start = toISO(d)
    const { reviews = 0, good = 0 } = byDate.get(start) ?? {}
    points.push({ start, reviews, good, pct: reviews > 0 ? Math.round((good / reviews) * 100) : null })
  }
  const currentIndex = points.findLastIndex(p => p.pct !== null)
  return { unit: 'day', points, current: points[currentIndex].pct, currentIndex, firstIndex: 0, delta: null }
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

// ── Buckets ───────────────────────────────────────────────
// /api/stats counts in drills, per deck per mode: composition (new /
// learning / mastered) and retention, correct over reviews, null where
// nothing has been reviewed.
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

/**
 * One platform's own figures (plan 114, the desk's station split): the
 * bucket /api/stats keeps for one mode of one deck — how many of its
 * cards are mastered, in progress and new, and how many are due now —
 * with the derived shares the stats screen's composition bar draws.
 * Null where the payload holds no such bucket (a failed fetch, a mode
 * with no pool at that deck, the fast review).
 */
export function modeRow(stats, source, deck, mode) {
  return bucketRow(stats?.[source]?.[deck]?.[mode])
}

/**
 * The same row from one bucket on its own (plan 115): what a scoped
 * stats route answers — a theme band's, a frequency tier's — which
 * /api/stats does not carry. A route that has nothing to count answers
 * 200 with `{error}` rather than a bucket, so that is no row either.
 */
export function bucketRow(b) {
  if (!b || typeof b !== 'object' || b.error) return null
  return { ...sumBuckets([b]), due: Math.max(0, Number(b.due_now) || 0) }
}

// ── A line's grid (plan 138) ──────────────────────────────
// Each line's plate draws its retention by exercise and by deck: a row
// per exercise the learner has ridden (the registry's order, the order
// a station lists its platforms), a column per deck they have ridden in
// (the line's own order), each cell correct over reviews, lifetime, as
// the line's own figure is. A cell nobody has reviewed is null; an
// exercise or a deck with no reviews anywhere is not drawn at all, so a
// learner who only reads kanji sees one row, not five with four empty.
export function lineGrid(stats, category) {
  const section = stats?.[category] ?? {}
  const decks = Object.keys(section)
  const registry = MODES_FOR_SOURCE[category] ?? []
  const seen = new Set(decks.flatMap(d => Object.keys(section[d] ?? {})))
  const order = [...registry.filter(m => seen.has(m)), ...[...seen].filter(m => !registry.includes(m))]
  const reviewed = (deck, mode) => Number(section[deck]?.[mode]?.reviews) > 0

  const modes = order.filter(m => decks.some(d => reviewed(d, m)))
  const cols = decks.filter(d => modes.some(m => reviewed(d, m)))
  const rows = modes.map(mode => ({
    mode,
    cells: cols.map(deck => gridCell(section[deck]?.[mode], deck, mode)),
  }))

  const { reviews, correct } = sumBuckets(decks.flatMap(d => Object.values(section[d] ?? {})))
  return {
    category,
    decks: cols,
    rows,
    reviews,
    correct,
    retention: reviews > 0 ? Math.round((correct / reviews) * 100) : null,
  }
}

function gridCell(bucket, deck, mode) {
  const reviews = Math.max(0, Number(bucket?.reviews) || 0)
  const correct = Math.max(0, Number(bucket?.correct) || 0)
  return { deck, mode, reviews, correct, pct: reviews > 0 ? Math.round((correct / reviews) * 100) : null, leak: false }
}

// A cell needs this many reviews before it can be called a leak: two
// misses in three tries is a coin, not a weakness.
export const LEAK_MIN_REVIEWS = 5

/**
 * The four lines' grids, and the learner's own average across all of
 * them — the line every cell is read against. In each grid the one
 * cell furthest under that average (with LEAK_MIN_REVIEWS behind it)
 * is marked `leak`: the plate's red, the one place in the line to look.
 * A line with nothing under the average has no red.
 */
export function lineGrids(stats) {
  const grids = CATEGORIES.map(category => lineGrid(stats, category))
  const reviews = grids.reduce((n, g) => n + g.reviews, 0)
  const correct = grids.reduce((n, g) => n + g.correct, 0)
  const average = reviews > 0 ? correct / reviews : null
  if (average !== null) {
    for (const grid of grids) {
      let low = null
      for (const cell of grid.rows.flatMap(r => r.cells)) {
        if (cell.reviews < LEAK_MIN_REVIEWS) continue
        const ratio = cell.correct / cell.reviews
        if (ratio < average && (low === null || ratio < low.correct / low.reviews)) low = cell
      }
      if (low) low.leak = true
    }
  }
  return { grids, average: average === null ? null : Math.round(average * 100) }
}

// ── The weakest, by line (plan 138) ───────────────────────
// /api/stats/report sends each line's most-missed cards in one list,
// the lines in order; a plate reads its own.
export function weakestByLine(weakest) {
  const lines = Object.fromEntries(CATEGORIES.map(c => [c, []]))
  for (const w of weakest ?? []) lines[w.category]?.push(w)
  return lines
}

// A card's headword, off its id. Ids are `<category>_<level>_<thing>` —
// with kana having no level (`kana_あ`) and vocab carrying both writings
// (`vocab_N5_山_やま`). Peeling the known prefixes off is exact where the
// reverse index resolved the card, and the trailing segment is a decent
// guess where it didn't. A vocabulary word with no kanji form leaves
// that field empty (`vocab_N5__やま`), so fall through to the kana.
export function cardHeadword(rawId = '', category, level) {
  if (!rawId) return '？'

  let rest = rawId
  if (category && rest.startsWith(`${category}_`)) rest = rest.slice(category.length + 1)
  else rest = rest.replace(/^(kana|vocab|kanji|grammar)_/, '')
  if (level && rest.startsWith(`${level}_`)) rest = rest.slice(level.length + 1)

  const parts = rest.split('_')
  const head = parts[0] || parts[1] || rest
  return head.length > 10 ? `${head.slice(0, 10)}…` : head
}
