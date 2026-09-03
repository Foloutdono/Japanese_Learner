// ── 路線図 — how far down each line you have travelled ────────
// The wall map draws each SRS section as a line with stops, and the
// learner's position on it. This is the arithmetic behind the train
// marker, kept pure so it can be tested without a browser and shared
// if a second surface (stats, profile) ever wants the same figure.
//
// A stop's "score" is how complete that level is, 0..1, computed from
// /api/stats' buckets: mastered counts fully, learning counts half,
// new counts nothing — the same weighting a learner would give it if
// asked "are you done with N5 vocab?". Aggregated across every graded
// mode of the section, because the map answers for the section, not
// for one skill: 漢字 recognised but not yet writable is genuinely
// half-travelled.
//
// The deck orders are the app's own: JLPT levels walk N5 → N1, and
// kana walks the four sets in the order the kana screen teaches them.
// A deck key the stats payload doesn't know scores 0 rather than
// disappearing — the line's length is the section's real extent, not
// the part of it the learner has data for.

export const LEVEL_STOPS = ['N5', 'N4', 'N3', 'N2', 'N1']

// The four sections that have a track at all, by route: the SRS lines
// /api/stats aggregates. Shared by the wall map and the profile's ride
// ledger so the two can never disagree about which lines exist. A new
// section lands in the map's practice register by default; adding a
// TRACK means the stats endpoint actually aggregates it, so this list
// is deliberately closed here.
export const TRACKED_LINES = { '/kana': 'kana', '/vocab': 'vocab', '/kanji': 'kanji', '/grammar': 'grammar' }

// One glyph per kana set — a stop label has room for a specimen, not
// for "HIRAGANA_COMBINATIONS". Same sets, same order as
// domain/kanaSets.js; the slug is what joins them.
export const KANA_STOPS = [
  { key: 'hiragana_basic',  label: 'あ' },
  { key: 'hiragana_combos', label: 'きゃ' },
  { key: 'katakana_basic',  label: 'ア' },
  { key: 'katakana_combos', label: 'キャ' },
]

function deckScore(deckBuckets) {
  if (!deckBuckets) return 0
  let weighted = 0
  let total = 0
  for (const bucket of Object.values(deckBuckets)) {
    if (!bucket || typeof bucket !== 'object') continue
    total += bucket.total ?? 0
    weighted += (bucket.mastered ?? 0) + 0.5 * (bucket.learning ?? 0)
  }
  if (total <= 0) return 0
  return Math.min(1, weighted / total)
}

/**
 * The stops of one line, each with its completion score.
 * `stats` is /api/stats' payload (or null/garbage — a failed fetch
 * must still draw the map, just with nobody on it yet).
 */
export function lineStops(stats, source) {
  const decks = stats?.[source]
  const order = source === 'kana'
    ? KANA_STOPS
    : LEVEL_STOPS.map(key => ({ key, label: key }))
  return order.map(({ key, label }) => ({
    key,
    label,
    score: deckScore(decks?.[key]),
  }))
}

/** Total distance travelled, in stops — the train marker's position. */
export function stopsTravelled(stops) {
  return stops.reduce((sum, s) => sum + s.score, 0)
}

/**
 * Mastered and reachable (card, mode) pairs on one line, summed over
 * every deck and graded mode — the unit the 段位 plaque counts in
 * (srs.get_mastered_count), so the profile's ride ledger and the rank
 * can be read against each other. Garbage in, zeros out, like
 * lineStops: a failed stats fetch must never throw here.
 */
export function lineTotals(stats, source) {
  let mastered = 0
  let total = 0
  const decks = stats?.[source]
  if (decks && typeof decks === 'object') {
    for (const deck of Object.values(decks)) {
      if (!deck || typeof deck !== 'object') continue
      for (const bucket of Object.values(deck)) {
        if (!bucket || typeof bucket !== 'object') continue
        total += bucket.total ?? 0
        mastered += bucket.mastered ?? 0
      }
    }
  }
  return { mastered, total }
}
