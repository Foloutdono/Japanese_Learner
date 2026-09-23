import { describe, it, expect } from 'vitest'
import { tokenLookup, lookupKey } from './lookup'

describe('tokenLookup', () => {
  it('opens a deck word on its lemma', () => {
    const token = { surface: '出ました', vocab_match: { entry: { kanji: '出る', kana: 'でる' } }, kanji_matches: [{ kanji: '出' }] }
    expect(tokenLookup(token)).toEqual({ category: 'vocab', term: '出る', kana: 'でる' })
  })

  it('opens a lone kanji when the token is no deck word', () => {
    expect(tokenLookup({ surface: '駅', vocab_match: null, kanji_matches: [{ kanji: '駅' }] }))
      .toEqual({ category: 'kanji', term: '駅' })
  })

  it('has no entry for a particle, punctuation, or a compound of kanji the deck lacks', () => {
    expect(tokenLookup({ surface: 'は', vocab_match: null, kanji_matches: [] })).toBeNull()
    expect(tokenLookup({ surface: '。' })).toBeNull()
    expect(tokenLookup({ surface: '駅前', vocab_match: null, kanji_matches: [{ kanji: '駅' }, { kanji: '前' }] })).toBeNull()
    expect(tokenLookup(null)).toBeNull()
    expect(lookupKey(tokenLookup(null))).toBeNull()
  })
})
