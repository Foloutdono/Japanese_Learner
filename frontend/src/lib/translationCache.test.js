import { describe, it, expect } from 'vitest'
import { translatedMap } from './translationCache'

// The bug this pins: `/api/translation/vocab?word=あびる&lang=fr`
// answers `{ translation: "" }` — VOCAB_FR has no entry for it —
// and Kanji/VocabScreen's translateCard used to write that answer
// straight onto the card. `meaning: map[word] ?? cur.meaning` does
// not catch "", so the card lost its meaning entirely and the reveal
// came up blank on every word the target language is missing.
describe('translatedMap', () => {
  it('keeps the words that came back with a translation', () => {
    expect(translatedMap([['トイレ', 'toilettes'], ['浴びる', 'se baigner']]))
      .toEqual({ 'トイレ': 'toilettes', '浴びる': 'se baigner' })
  })

  it('drops a word the language has no entry for, rather than mapping it to ""', () => {
    const map = translatedMap([['あびる', ''], ['トイレ', 'toilettes']])
    expect('あびる' in map).toBe(false)
    expect(map['トイレ']).toBe('toilettes')
  })

  it('leaves the card its own meaning: an absent word falls through `??`', () => {
    const map = translatedMap([['あびる', '']])
    expect(map['あびる'] ?? 'to bathe, to shower').toBe('to bathe, to shower')
  })

  it('takes an empty list', () => {
    expect(translatedMap([])).toEqual({})
  })
})
