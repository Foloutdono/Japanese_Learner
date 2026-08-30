// ── The stats model ───────────────────────────────────────
// /api/stats answers in the shape it stores things in: category →
// level → mode → counts, three levels of nesting deep. That shape is
// fine to compute and impossible to explore — you can read one level's
// four modes, or scroll a long way and read another's, but you can't
// ask "where am I weakest", "is my recall worse than my recognition",
// or "how much of N3 is actually mastered" without doing arithmetic in
// your head across a page of cards.
//
// So the screen doesn't render that tree. It flattens it to one row
// per (category, level, mode) — around seventy rows, the whole picture
// — and then pivots: group by any axis, sort by any measure, filter,
// and re-total. Everything here is a pure function over the payload,
// so the Explorer is a view and nothing else, and every number on
// screen is derived from the same place.

export const CATEGORIES = ['kana', 'vocab', 'kanji', 'grammar']

// ── The two axes the mode key is really carrying ──────────
// A mode key encodes two independent things: how the question is asked
// and which way round it runs. Splitting them turns one twelve-value
// dimension nobody can hold in their head into two smaller ones that
// answer real questions: "am I better at recognising than recalling?" is
// the single most useful thing this dataset can tell you, and the old
// screen couldn't express it at all.
//
// Both axes now come from domain/studyModes.js. They used to be two maps
// right here — the third and fourth copies of the mode key space — and
// their failure mode was quiet: an unlisted key fell through
// `FORMAT[mode] ?? mode` to become its own one-row "format" bucket, and
// through `DIRECTION[mode] ?? 'recognition'` to be labelled recognition
// whatever it actually was. A mode could therefore be mis-reported for
// as long as nobody happened to compare the numbers by hand.
//
// `choice` is gone as a format. Multiple choice is a hint now (see
// HintBar), so a flashcard is a flashcard whether or not the learner
// asked for the options — which is also the honest thing to report,
// since both used to write to separate SRS tracks for the same
// knowledge and split every statistic in two.
export { FORMATS, DIRECTIONS } from './studyModes'

import {
  MODES as STUDY_MODES, FORMATS as _FORMATS,
  modeLabel as registryLabel,
} from './studyModes'
import { kanaSetLabel } from './kanaSets'

// Legacy fallbacks, for rows written before the taxonomy change. They can
// go when the SRS wipe lands and card_modes holds only registry keys.
const LEGACY_FORMAT = {
  'qcm': 'flashcard', 'mcq': 'flashcard',
  'qcm-kj-m': 'flashcard', 'qcm-m-kj': 'flashcard',
  'flashcard': 'flashcard',
  'flashcard-kj-m': 'flashcard', 'flashcard-m-kj': 'flashcard',
  'write': 'writing', 'fill': 'fill',
}
const LEGACY_DIRECTION = {
  'qcm': 'recognition', 'mcq': 'recognition', 'flashcard': 'recognition',
  'qcm-kj-m': 'recognition', 'flashcard-kj-m': 'recognition',
  'qcm-m-kj': 'recall', 'flashcard-m-kj': 'recall', 'fill': 'recall',
  'write': 'production',
}

/**
 * The format/direction pair for a mode key, registry first, then the
 * legacy table. An unknown key falls back to the FIRST declared format
 * rather than becoming its own bucket, so a stray key can no longer
 * invent a column in the Explorer.
 */
function axesFor(mode) {
  const m = STUDY_MODES[mode]
  if (m) return { format: m.format, direction: m.statsDirection }
  return {
    format: LEGACY_FORMAT[mode] ?? _FORMATS[0],
    direction: LEGACY_DIRECTION[mode] ?? 'recognition',
  }
}

// Recognition: the form is in front of you, produce the meaning.
// Recall: the meaning is in front of you, produce the form — from
// memory, but only enough to pick or check it. Production: write it
// stroke by stroke with nothing to lean on. That's a real difficulty
// ladder, and a user's numbers almost always fall down it.

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
// them, and 'hiragana_combos' was reaching the screen verbatim in a
// column whose other rows read N5 and N4. Same helper the kana picker
// and the daily queue use, so a set is named one way everywhere.
export function groupLabel(t, key) {
  return kanaSetLabel(t, key)
}

export function formatLabel(t, format) {
  return {
    flashcard: t.modeFlashcard,
    typing: t.modeType,
    writing: t.modeWrite,
    fill: t.modeFill,
  }[format] ?? format
}

export function directionLabel(t, direction) {
  return {
    recognition: t.dirRecognition,
    recall: t.dirRecall,
    production: t.dirProduction,
  }[direction] ?? direction
}

// The mode label. The `category` argument is retained because this screen
// still reads whatever keys are in card_modes, which for pre-taxonomy rows
// are the un-namespaced legacy ones where the same string meant different
// things per section ('flashcard-m-kj' was "→ word" under vocab and
// "→ kanji" under kanji). A registry key names its own source, so the
// noun is no longer needed to disambiguate — but old rows survive in the
// DB until the wipe, and they still have to read sensibly.
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

// ── Flatten ───────────────────────────────────────────────
/**
 * One row per (category, level, mode) bucket, with everything the
 * screen sorts or filters on precomputed. `null` accuracy — as opposed
 * to 0 — is the honest answer for a bucket nobody has reviewed yet,
 * and keeps unstudied rows from sorting to the bottom of an accuracy
 * ranking as though they'd been failed.
 */
export function flattenStats(stats, t) {
  if (!stats) return []
  const rows = []

  for (const category of CATEGORIES) {
    const section = stats[category]
    if (!section) continue

    for (const [group, modes] of Object.entries(section)) {
      for (const [mode, s] of Object.entries(modes)) {
        if (!s) continue
        const { format, direction } = axesFor(mode)
        rows.push({
          id: `${category}/${group}/${mode}`,
          category,
          group,
          mode,
          format,
          direction,
          label: modeLabel(t, category, mode),
          total: s.total ?? 0,
          new: s.new ?? 0,
          learning: s.learning ?? 0,
          mastered: s.mastered ?? 0,
          due: s.due_now ?? 0,
          reviews: s.reviews ?? 0,
          correct: s.correct ?? 0,
        })
      }
    }
  }
  return rows.map(withDerived)
}

function withDerived(row) {
  return {
    ...row,
    started: row.total - row.new,
    masteryPct: row.total > 0 ? (row.mastered / row.total) * 100 : 0,
    accuracyPct: row.reviews > 0 ? (row.correct / row.reviews) * 100 : null,
  }
}

const ZERO = { total: 0, new: 0, learning: 0, mastered: 0, due: 0, reviews: 0, correct: 0 }

/** Add up any set of rows into one row-shaped total. */
export function sumRows(rows) {
  const acc = rows.reduce((a, r) => {
    for (const k of Object.keys(ZERO)) a[k] += r[k]
    return a
  }, { ...ZERO })
  return withDerived(acc)
}

// ── Pivot ─────────────────────────────────────────────────
export const DIMENSIONS = ['category', 'group', 'format', 'direction', 'mode']

export function dimensionLabel(t, dim) {
  return {
    category: t.dimCategory,
    group: t.dimLevel,
    format: t.dimFormat,
    direction: t.dimDirection,
    mode: t.dimMode,
  }[dim] ?? dim
}

function bucketLabel(t, dim, key, rows) {
  if (dim === 'category') return categoryLabel(t, key)
  if (dim === 'format') return formatLabel(t, key)
  if (dim === 'direction') return directionLabel(t, key)
  if (dim === 'group') return groupLabel(t, key)
  // A mode key is only meaningful next to the category it came from.
  if (dim === 'mode') return modeLabel(t, rows[0]?.category, key)
  return key
}

/**
 * Group rows along one axis. Insertion order is preserved from the
 * payload (N5 → N1, hiragana → katakana), which is already the order a
 * learner thinks in — no alphabetic sort would improve on it.
 */
export function groupRows(rows, dim, t) {
  const buckets = new Map()
  for (const row of rows) {
    const key = row[dim]
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(row)
  }
  return [...buckets.entries()].map(([key, groupRows_]) => ({
    key,
    dim,
    label: bucketLabel(t, dim, key, groupRows_),
    rows: groupRows_,
    totals: sumRows(groupRows_),
  }))
}

// ── Sort ──────────────────────────────────────────────────
// Every measure sorts high-to-low by default because that's the
// question being asked of it ("where is the most X?"). Accuracy is the
// exception the other way round — an accuracy ranking is a hunt for
// the weak spots — and rows with no reviews are pinned last in both
// directions, since "no data" is not a score.
export const SORTS = ['mastery', 'due', 'accuracy', 'size', 'reviews', 'name']

export function sortLabel(t, key) {
  return {
    mastery: t.mastered,
    due: t.dueNow,
    accuracy: t.accuracy,
    size: t.total,
    reviews: t.totalReviews,
    name: t.sortName,
  }[key] ?? key
}

/**
 * The arrow shown on the active sort chip. It describes what the list
 * *does*, not what the flag is called: `desc` means "the useful
 * direction for this measure", and for accuracy that is worst-first,
 * which walks up the page rather than down. Printing ↓ there because
 * the flag says `desc` would be a label contradicting the list right
 * underneath it.
 */
export function sortArrow(key, desc) {
  const ascending = key === 'accuracy' ? desc : !desc
  return ascending ? '↑' : '↓'
}

const MEASURE = {
  mastery: x => x.masteryPct,
  due: x => x.due,
  size: x => x.total,
  reviews: x => x.reviews,
}

export function sortItems(items, sortKey, desc = true) {
  const sorted = [...items]
  const dir = desc ? 1 : -1

  if (sortKey === 'name') {
    sorted.sort((a, b) => (a.label ?? '').localeCompare(b.label ?? '') * -dir)
    return sorted
  }

  if (sortKey === 'accuracy') {
    sorted.sort((a, b) => {
      const av = valueOf(a).accuracyPct
      const bv = valueOf(b).accuracyPct
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      return (av - bv) * dir
    })
    return sorted
  }

  const measure = MEASURE[sortKey] ?? MEASURE.mastery
  sorted.sort((a, b) => (measure(valueOf(b)) - measure(valueOf(a))) * dir)
  return sorted
}

// Groups carry their numbers on `.totals`, leaf rows carry them
// directly — one accessor so the comparators don't care which they got.
const valueOf = item => item.totals ?? item

// ── The practice calendar ─────────────────────────────────
/**
 * The trend array (sparse — only days with reviews) laid out as whole
 * weeks ending on today, oldest week first, each week Monday-first.
 *
 * Intensity is ranked against the user's own busiest day rather than a
 * fixed scale: fifty reviews is a huge day for one person and a warm-up
 * for another, and a calendar that reads as empty for the second is
 * telling them nothing.
 */
export function buildCalendar(trend, weeks = 53) {
  const counts = new Map((trend ?? []).map(d => [d.date, d.count]))
  const max = Math.max(1, ...(trend ?? []).map(d => d.count))

  const today = new Date()
  today.setHours(12, 0, 0, 0)          // midday: immune to DST shifts
  // Walk back to the end of this week (Sunday) so the last column is a
  // whole week and today never sits mid-column with future days above.
  const end = new Date(today)
  end.setDate(end.getDate() + (7 - isoDay(end)))

  const days = []
  const cursor = new Date(end)
  cursor.setDate(cursor.getDate() - weeks * 7 + 1)

  for (let i = 0; i < weeks * 7; i++) {
    const iso = toISO(cursor)
    const count = counts.get(iso) ?? 0
    days.push({
      date: iso,
      count,
      future: cursor > today,
      level: count === 0 ? 0 : Math.min(4, 1 + Math.floor((count / max) * 3.999)),
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  const columns = []
  for (let w = 0; w < weeks; w++) columns.push(days.slice(w * 7, w * 7 + 7))
  return { columns, max, days }
}

// Monday = 1 … Sunday = 7, so a week column runs Mon→Sun like a
// Japanese calendar rather than starting on Sunday.
function isoDay(d) {
  return d.getDay() === 0 ? 7 : d.getDay()
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Month boundaries for the calendar's top axis. */
export function monthTicks(columns) {
  const ticks = []
  let last = null
  columns.forEach((week, i) => {
    const first = week.find(d => !d.future) ?? week[0]
    const month = first.date.slice(0, 7)
    if (month !== last) {
      ticks.push({ index: i, month: Number(first.date.slice(5, 7)) - 1 })
      last = month
    }
  })
  return ticks
}

// ── The interval ladder ───────────────────────────────────
// How far ahead the scheduler has pushed each card. This is the one
// chart that shows the SRS itself working: a healthy deck is a wave
// moving right over months, and a deck that never leaves the first two
// rungs is one being relearned forever.
export const INTERVAL_BUCKETS = [
  { key: 'learning', min: 0,   max: 0,    labelKey: 'intervalLearning' },
  { key: 'day',      min: 1,   max: 1,    labelKey: 'intervalDay' },
  { key: 'week',     min: 2,   max: 6,    labelKey: 'intervalWeek' },
  { key: 'weeks',    min: 7,   max: 20,   labelKey: 'intervalWeeks' },
  { key: 'month',    min: 21,  max: 59,   labelKey: 'intervalMonth' },
  { key: 'months',   min: 60,  max: 179,  labelKey: 'intervalMonths' },
  { key: 'season',   min: 180, max: 364,  labelKey: 'intervalSeason' },
  { key: 'year',     min: 365, max: Infinity, labelKey: 'intervalYear' },
]

export function bucketIntervals(histogram) {
  const buckets = INTERVAL_BUCKETS.map(b => ({ ...b, count: 0 }))
  for (const { days, count } of histogram ?? []) {
    const bucket = buckets.find(b => days >= b.min && days <= b.max)
    if (bucket) bucket.count += count
  }
  return buckets
}

// ── Quality mix ───────────────────────────────────────────
// Same six ratings, same colours and same words the rating bar itself
// uses (see RatingBar.jsx) — this is a record of which button you
// pressed, so it should look like those buttons.
export function qualityRows(mix, t) {
  const LABELS = {
    5: t.perfect, 4: t.correctHesit, 3: t.difficult,
    2: t.wrongSeen, 1: t.wrongRated, 0: t.blackout,
  }
  return [5, 4, 3, 2, 1, 0].map(q => ({
    q,
    label: LABELS[q],
    count: Number(mix?.[q] ?? mix?.[String(q)] ?? 0),
  }))
}
