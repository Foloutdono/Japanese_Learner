import { describe, it, expect } from 'vitest'
import fr from '../locales/fr/index.js'
import { cardFace, reportable, contextWords, failureOf } from './feedback'

// ── Nous écrire, the pure half (plan 222) ───────────────────────────
// What a card's strip prints, which cards the flag may report, the
// joined classes in words, and a failure's area -- never its path.

describe('cardFace', () => {
  it('reads a word, a kanji, a kana and a grammar point', () => {
    expect(cardFace({ card_id: 'vocab_N5_先生_せんせい', kanji: '先生', kana: 'せんせい', meaning: 'professeur' }))
      .toEqual({ face: '先生', reading: 'せんせい', meaning: 'professeur', level: 'N5' })
    expect(cardFace({ card_id: 'kana_hiragana_a', kana: 'あ', romaji: 'a' }))
      .toEqual({ face: 'あ', reading: 'a', meaning: null, level: null })
    expect(cardFace({ card_id: 'grammar_N4_〜ても', grammar: '〜ても', meaning: ['même si', 'même'] }))
      .toEqual({ face: '〜ても', reading: null, meaning: 'même si, même', level: 'N4' })
  })
})

describe('reportable', () => {
  it('is the app’s own cards, never a personal one or a prefixed id', () => {
    expect(reportable({ card_id: 'vocab_N5_先生_せんせい' })).toBe(true)
    expect(reportable({ card_id: 'custom_12_7' })).toBe(false)
    expect(reportable({ card_id: 'u1:vocab_N5_先生_せんせい' })).toBe(false)
    expect(reportable({})).toBe(false)
    expect(reportable(null)).toBe(false)
  })
})

describe('contextWords', () => {
  it('says the classes in the learner’s words, and drops what it cannot name', () => {
    expect(contextWords({ vp: 'phone', os: 'ios', platform: 'web' }, fr)).toEqual(['téléphone', 'iOS', 'web'])
    expect(contextWords({ vp: 'desk', os: 'other', platform: 'native' }, fr)).toEqual(['ordinateur', 'application'])
  })
})

describe('failureOf', () => {
  it('keeps the area and the status, never the id after them', () => {
    expect(failureOf('/api/decks/9f3a/study?mode=f2b', 503)).toEqual({ area: '/api/decks', status: 503 })
    expect(failureOf('/api/today/queue', 0)).toEqual({ area: '/api/today', status: 0 })
    expect(failureOf(undefined, 500)).toBeNull()
  })
})
