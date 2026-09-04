// ── 路線図 — how far down each line you have travelled ────────
// The wall map draws each SRS section as a line with stops, and the
// learner's position on it. This reads the arithmetic behind the train
// marker, kept here so the map and the profile's ledger cannot drift
// apart about how far along a line you are.
//
// A stop's score is /api/stats' own per-deck figure, 0..1, and the
// unit is CARDS: a kanji is one kanji whether or not you can also
// write it and name its radical. It used to be computed here out of
// the per-mode buckets, which counted (card x mode) drills — so the
// kanji line's denominator was 11,175 rather than 2,235, and a learner
// who never drew a kanji was capped at four fifths of the line with
// nothing on screen saying why. The per-mode view still exists and is
// still the right unit for the stats screen's bars; it is the wrong
// one for a map. See routes/stats.py's `items` block for the score
// itself, which is continuous — a card counts for how far its longest
// interval has come toward the 21-day mastery mark, so one pass over a
// deck no longer buys exactly half of it.
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

/** One deck's `items` entry, defended against every shape that isn't
 *  one: a failed fetch, an older backend that predates the block, a
 *  test's today-shaped mock. The map must still draw. */
function deckItems(stats, source, deckKey) {
  const entry = stats?.items?.[source]?.[deckKey]
  if (!entry || typeof entry !== 'object') return { score: 0, learned: 0, total: 0 }
  const total = Number(entry.total) || 0
  return {
    score: Math.min(1, Math.max(0, Number(entry.score) || 0)),
    learned: Math.min(total, Math.max(0, Number(entry.learned) || 0)),
    total,
  }
}

/** The deck keys of one line, in the order the app teaches them. */
function lineOrder(source) {
  return source === 'kana'
    ? KANA_STOPS
    : LEVEL_STOPS.map(key => ({ key, label: key }))
}

/**
 * The stops of one line, each with its completion score.
 * `stats` is /api/stats' payload (or null/garbage — a failed fetch
 * must still draw the map, just with nobody on it yet).
 */
export function lineStops(stats, source) {
  return lineOrder(source).map(({ key, label }) => ({
    key,
    label,
    score: deckItems(stats, source, key).score,
  }))
}

/** Total distance travelled, in stops — the train marker's position. */
export function stopsTravelled(stops) {
  return stops.reduce((sum, s) => sum + s.score, 0)
}

/**
 * Cards learned and cards there are, on one line — the profile
 * ledger's figure, and the fraction its rail fills to, so that one row
 * cannot print two different answers about the same line. It used to
 * count (card, mode) pairs while the rail beside it averaged the stop
 * scores: finish N5 vocab and nothing else and the rail said 20% while
 * the figure said 1,838 / 24,118, which is 7.6%.
 *
 * "Learned" is whole cards only — a count of things you know should
 * not be fractional. The partial credit the stops carry is where
 * work-in-progress shows up, which is the map's job, not this one's.
 * Garbage in, zeros out, like lineStops: a failed stats fetch must
 * never throw here.
 */
export function lineTotals(stats, source) {
  let learned = 0
  let total = 0
  for (const { key } of lineOrder(source)) {
    const deck = deckItems(stats, source, key)
    learned += deck.learned
    total += deck.total
  }
  return { learned, total }
}
