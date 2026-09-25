// ── Where a grammar point sits on the sentence (plan 095) ───────
// The local tier ships every hit with `segments`, the [start, end]
// pieces of the sentence it is written on (study/analysis's
// _grammar_entries): one piece for a point written in one piece, one
// per part for から〜まで, whose start..end reaches over a clause it
// does not own. A screen lights the pieces, never the stretch between
// them. A point from a caller that predates the pieces (a video
// session stored before them) falls back to its span, and one with no
// offsets at all lights nothing.
//
// Lit at the TOKEN: the line is drawn token by token with the reading
// over each, and a piece that begins inside an inflecting word (〜くて
// inside 大きく) lights the word it grew out of, which is the word a
// learner would point at.
//
// A module of its own, like rows.js: a component file exports
// components only (react-refresh), and three composers read this.
export function spansOf(point) {
  if (Array.isArray(point?.segments) && point.segments.length) return point.segments
  if (typeof point?.start === 'number' && typeof point?.end === 'number') return [[point.start, point.end]]
  return []
}

export function coversToken(point, token) {
  if (typeof token?.start !== 'number' || typeof token?.end !== 'number') return false
  return spansOf(point).some(([s, e]) => s < token.end && token.start < e)
}

// The constructions a sentence is built with, in the order the local
// tier found them: every point but the markers (は, を), which ride the
// word rows. The phone's stage and the practice rows list these; the
// desk numbers numberedPointsOf below.
export function constructionsOf(analysis) {
  return (analysis?.grammar ?? []).filter(g => g.kind !== 'marker')
}

// The desk's grammar box (plan 134, owner-directed): every point the
// sentence uses -- the particles' markers (を, で, は) with the
// constructions -- in the order they stand in the sentence, so the
// numbers on the cards and on the subtitle read left to right. One list
// for GrammarPoints' `numbered`, SubtitleLine and the card in focus.
export function numberedPointsOf(analysis) {
  return [...(analysis?.grammar ?? [])].sort((a, b) => (a.start ?? 0) - (b.start ?? 0))
}

// One point twice in a sentence (〜し、〜し) is two chips and two
// lights, so the key is the occurrence, not the card.
export function pointKey(point) {
  return point ? `${point.raw_id}_${point.start}` : null
}
