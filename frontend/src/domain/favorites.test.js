import { describe, it, expect } from 'vitest'
import { favoriteRef, favoriteId } from './favorites'

// The key a row is kept under has to be the one routes/favorites.py
// resolves — backend/tests/test_dictionary_favorites.py derives the
// same keys from served rows and reads them back. These pin the
// client's half.
describe('favoriteRef', () => {
  it('names a kanji by its character', () => {
    expect(favoriteRef({ type: 'kanji', kanji: '駅', kana: 'エキ', level: 'N5' }))
      .toEqual({ kind: 'kanji', key: '駅' })
    // A pool character has no level and no card; the reference is the
    // same shape, because the character is the whole of its identity.
    expect(favoriteRef({ type: 'kanji', kanji: '龠', level: null, status: null }))
      .toEqual({ kind: 'kanji', key: '龠' })
  })

  it('names a word by both halves, the deck key way', () => {
    expect(favoriteRef({ type: 'vocab', kanji: '電車', kana: 'でんしゃ' }))
      .toEqual({ kind: 'vocab', key: '電車::でんしゃ' })
    // A kana-only word keeps the seam so the two halves stay two.
    expect(favoriteRef({ type: 'vocab', kanji: '', kana: 'テープ' }))
      .toEqual({ kind: 'vocab', key: '::テープ' })
    // A packed deck reading is stored as served.
    expect(favoriteRef({ type: 'vocab', kanji: '毎月', kana: 'まいげつ/まいつき' }))
      .toEqual({ kind: 'vocab', key: '毎月::まいげつ/まいつき' })
  })

  it('names a grammar point by its card id and a kana by itself', () => {
    expect(favoriteRef({ type: 'grammar', raw_id: 'grammar_N5_〜てから', pattern: '〜てから' }))
      .toEqual({ kind: 'grammar', key: 'grammar_N5_〜てから' })
    expect(favoriteRef({ type: 'hiragana', kana: 'あ', romaji: 'a' }))
      .toEqual({ kind: 'hiragana', key: 'あ' })
    expect(favoriteRef({ type: 'katakana', kana: 'キャ', romaji: 'kya' }))
      .toEqual({ kind: 'katakana', key: 'キャ' })
  })

  it('has nothing to say for a row with no identity', () => {
    expect(favoriteRef(null)).toBeNull()
    expect(favoriteRef({ type: 'kanji' })).toBeNull()
    expect(favoriteRef({ type: 'vocab', kanji: '', kana: '' })).toBeNull()
    expect(favoriteRef({ type: 'grammar', pattern: '〜てから' })).toBeNull()
    expect(favoriteRef({ type: 'radical', kanji: '水' })).toBeNull()
  })
})

describe('favoriteId', () => {
  it('is one string per reference, the kind before the first colon', () => {
    expect(favoriteId({ kind: 'vocab', key: '電車::でんしゃ' })).toBe('vocab:電車::でんしゃ')
    expect(favoriteId(null)).toBeNull()
    // Two collections filing the same character are two favourites.
    expect(favoriteId(favoriteRef({ type: 'kanji', kanji: '一' })))
      .not.toBe(favoriteId(favoriteRef({ type: 'vocab', kanji: '一', kana: 'いち' })))
  })
})
