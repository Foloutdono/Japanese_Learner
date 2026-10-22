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
// adjective before it (食べ + ます, 新しかっ + た). A particle or a
// copula ends any run before it and is a row of its own (standsAlone).
// An auxiliary the model glossed on its own is a word the model named,
// and keeps its row. Punctuation is no row at all.
//
// The head token carries the row's state, level and gloss; the
// surface and the reading are the run's own, joined.
//
// A module of its own rather than an export of SentenceBreakdown.jsx:
// a component file exports components only (react-refresh), and the
// tests read this directly.
import { coversToken, isEnding } from './grammarSpans'
import { lineState, tokState } from './tokens'

const SKIP_POS = new Set(['symbol', 'punctuation', 'filler'])
const FOLDS_AUXILIARY = new Set(['verb', 'adjective', 'auxiliary'])
// A particle, and the copula, always stand on a row of their own
// (plan 095, owner-directed): は is not the tail of 今日, and です is
// not the tail of いい, whatever run the model bound them into. Each
// is a grammar point with a card, and a part of its own in the parts a
// rule is made of (partsOf); the words list leaves it to its numbered
// card (plan 160). The past-tense た／だ and the polite ます are
// inflection and stay with their verb: 休んだ is one word to a learner.
const COPULA = new Set(['だ', 'です'])
function standsAlone(tok) {
  if (tok.pos === 'particle') return true
  return tok.pos === 'auxiliary' && COPULA.has(tok.lemma || tok.surface)
}

export function rowsOf(tokens) {
  const rows = []
  let i = 0
  while (i < tokens.length) {
    const tok = tokens[i]
    if (SKIP_POS.has(tok.pos) || !(tok.surface ?? '').trim()) { i += 1; continue }
    let end = i
    if (standsAlone(tok)) {
      // its own row, whatever the model bound it into
    } else if (typeof tok.span_end === 'number' && tok.span_end > i) {
      end = Math.min(tok.span_end, tokens.length - 1)
      for (let k = i + 1; k <= end; k += 1) {
        if (standsAlone(tokens[k])) { end = k - 1; break }
      }
    } else if (FOLDS_AUXILIARY.has(tok.pos)) {
      while (end + 1 < tokens.length && tokens[end + 1].pos === 'auxiliary'
        && !tokens[end + 1].meaning && !standsAlone(tokens[end + 1])) end += 1
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

// ── The words a sentence is built from (plan 160) ───────────────
// The rows the words list draws: a word with a card (the deck's or the
// pool's), or a content word the course has no card for (a name) --
// never a particle, a copula, or a word a construction is written on
// with no card of its own (〜てはいけません's いけません, which read
// "to go"): those are the rule's, and its numbered card says what they
// do. Each carries the endings written on it (isEnding: 作ります is 作る
// + ます), which ride it as tags rather than taking a number. A word of
// speech the course has no rule for -- ぞ, かしら, the negative ん --
// carries the line the server wrote for it (`gloss`, plan 272), and a
// row is the one place that line is read.
export function wordRowsOf(analysis) {
  const tokens = analysis?.tokens ?? analysis?.words ?? []
  const grammar = analysis?.grammar ?? []
  const endings = grammar.filter(isEnding)
  return rowsOf(tokens)
    .filter(row => row.head.vocab_match || row.head.gloss || lineState(row.head, grammar) !== 'particle')
    .map(row => ({
      ...row,
      endings: endings.filter(p => row.tokens.some(tok => coversToken(p, tok))),
    }))
}

// A row's word as the list names it: the dictionary's spelling where
// the word has a card (話す, not the 話し of the sentence), else the
// sentence's own; and its reading where that spelling is not kana.
export function rowName(row) {
  const entry = row.head.vocab_match?.entry
  const name = entry ? (entry.kanji || entry.kana || row.surface) : row.surface
  const reading = entry?.kana && entry.kana !== name ? entry.kana : ''
  return { name, reading }
}

// The words a point is made of (plan 160), as a learner reads them
// rather than as the tokenizer cut them: the rows it is written on
// (て + は + いけません, not て + は + いけ + ませ + ん), after the word it
// attaches to when a word stands just before it (話し + て + は +
// いけません, ここ + で). `in` is false for that word alone.
export function partsOf(point, analysis) {
  const rows = rowsOf(analysis?.tokens ?? analysis?.words ?? [])
  const covered = rows.filter(row => row.tokens.some(tok => coversToken(point, tok)))
  if (!covered.length) return []
  const before = rows[rows.indexOf(covered[0]) - 1]
  const parts = covered.map(row => ({ surface: row.surface, in: true }))
  return before?.head.vocab_match ? [{ surface: before.surface, in: false }, ...parts] : parts
}

// The words the phone's Words sheet shows (plan 220): the list's rows
// written in Japanese. A line of a song can carry English ("Oh what do
// you mean"), which has no card, no reading and no gloss, and the sheet
// listed it word by word.
const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u

export function wordTileRows(analysis) {
  return wordRowsOf(analysis).filter(row => JAPANESE.test(row.surface))
}

/** Whether a word is new to the learner: no card studied yet. */
export function isFreshWord(row) {
  const state = tokState(row.head)
  return state === 'unknown' || state === 'offdeck'
}

