// ── The rows (plan 084) ───────────────────────────────────────
// The word-by-word breakdown as the practice modes show it groups the
// tokenizer's morphemes back into WORDS: one row per word, not one
// per morpheme. The tokenizer cuts 会いました into 会い / まし / た,
// which is the right unit for readings and deck matches and the wrong
// one for a learner scanning a list.
//
// A run folds back into the word it is by `span_end` when the server
// bound a model's gloss to the run (study/analysis.merge_deep), else
// by the grammar of it -- a trailing auxiliary belongs to the verb or
// adjective before it (食べ + ます, 新しい + です). An auxiliary the
// model glossed on its own (です as "polite copula") is a word the
// model named, and keeps its row. Punctuation is no row at all.
//
// The head token carries the row's state, level and gloss; the
// surface and the reading are the run's own, joined.
//
// A module of its own rather than an export of SentenceBreakdown.jsx:
// a component file exports components only (react-refresh), and the
// tests read this directly.
const SKIP_POS = new Set(['symbol', 'punctuation', 'filler'])
const FOLDS_AUXILIARY = new Set(['verb', 'adjective', 'auxiliary'])

export function rowsOf(tokens) {
  const rows = []
  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]
    if (SKIP_POS.has(tok.pos) || !(tok.surface ?? '').trim()) { i += 1; continue }
    let end = i
    if (typeof tok.span_end === 'number' && tok.span_end > i) {
      end = Math.min(tok.span_end, tokens.length - 1)
    } else if (FOLDS_AUXILIARY.has(tok.pos)) {
      while (end + 1 < tokens.length && tokens[end + 1].pos === 'auxiliary' && !tokens[end + 1].meaning) end += 1
    }
    const group = tokens.slice(i, end + 1)
    rows.push({
      head: tok,
      tokens: group,
      surface: group.map(t => t.surface).join(''),
      reading: group.map(t => t.reading || t.surface).join(''),
    })
    i = end + 1
  }
  return rows
}
