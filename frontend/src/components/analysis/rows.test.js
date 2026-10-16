import { describe, it, expect } from 'vitest'
import { wordTileRows, isFreshWord } from './rows'

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
