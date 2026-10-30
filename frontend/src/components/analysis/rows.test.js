import { describe, it, expect } from 'vitest'
import { wordTileRows, isFreshWord, rowsOf } from './rows'

// ── The phone's Words sheet (plan 220) ──────────────────────────
// A line of a song can carry English ("Oh what do you mean"): the sheet
// listed it word by word, with no reading and no gloss. It shows the
// words written in Japanese only, and counts the new ones.
let at = 0
const tok = (surface, pos, status = null) => {
  const t = { surface, pos, start: at, end: at + surface.length,
    vocab_match: status ? { entry: { kanji: surface }, stats: { status }, level: 'N5' } : null }
  at += surface.length
  return t
}

describe('wordTileRows', () => {
  it('keeps the Japanese words and leaves the English out', () => {
    at = 0
    const tokens = [tok('Oh', 'noun'), tok('What', 'noun'), tok('夢', 'noun', 'learning'), tok('の', 'particle'), tok('底', 'noun', 'not_started')]
    expect(wordTileRows({ tokens, grammar: [] }).map(r => r.surface)).toEqual(['夢', '底'])
  })

  it('has nothing to show for a line in English alone', () => {
    at = 0
    expect(wordTileRows({ tokens: [tok('Oh', 'noun'), tok('mean', 'verb')], grammar: [] })).toEqual([])
  })
})

describe('isFreshWord', () => {
  it('is a word with no card studied yet', () => {
    at = 0
    const rows = wordTileRows({ tokens: [tok('夢', 'noun', 'learning'), tok('底', 'noun', 'not_started'), tok('夜', 'noun', 'mastered')], grammar: [] })
    expect(rows.map(isFreshWord)).toEqual([false, true, false])
  })
})

// ── An ending the server glossed keeps its row (plan 272) ─────────
// せず's ず, the written negative, has no rule of its own: folded into
// せ, its line was read nowhere. An ending that has a rule (ます) still
// rides its verb.
describe('rowsOf', () => {
  it('gives a glossed ending a row of its own', () => {
    at = 0
    const tokens = [tok('無理', 'noun', 'learning'), tok('を', 'particle'), tok('せ', 'verb', 'learning'),
      { ...tok('ず', 'auxiliary'), gloss: { en: 'not, without', fr: 'ne … pas, sans' } }]
    expect(rowsOf(tokens).map(r => r.surface)).toEqual(['無理', 'を', 'せ', 'ず'])
  })

  it('folds an ending with no line of its own into its verb', () => {
    at = 0
    const tokens = [tok('食べ', 'verb', 'learning'), tok('ます', 'auxiliary')]
    expect(rowsOf(tokens).map(r => r.surface)).toEqual(['食べます'])
  })
})
