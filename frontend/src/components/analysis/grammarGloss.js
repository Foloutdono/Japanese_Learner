// ── The gloss a grammar point carries (plan 095) ──────────────
// The local tier ships every hit's one-line meaning as the catalogue's
// own {en, fr} pair (study/analysis._grammar_entries): the analysis is
// pure and shared across learners, so it cannot know which language
// the reader is in. The comprehension result's points (routes/
// reading.py) were already localised on the server into a plain
// string. One reader for both shapes, so a chip never prints
// "[object Object]" and never has to know where its point came from,
// and a point from a caller that predates the gloss reads as none.
//
// A module of its own rather than an export of GrammarChips.jsx: a
// component file exports components only (react-refresh), and the
// rows read this too.
export function grammarGloss(point, lang) {
  const meaning = point?.meaning
  if (!meaning) return ''
  if (typeof meaning === 'string') return meaning
  return meaning[lang] || meaning.en || ''
}
