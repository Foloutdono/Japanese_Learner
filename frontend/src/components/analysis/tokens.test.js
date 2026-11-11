import { describe, it, expect } from 'vitest'
import { tokState, isUnknownToken, isPoolWord, tokRomaji, wordGloss } from './tokens'

// ── A word past the course (plan 148) ────────────────────────────
// The breakdown's words the JLPT deck does not teach now carry the
// JMdict pool's card (study/analysis.py's _pool_match): a meaning, an
// id, no level, and `pool`. On the line such a word keeps the off-deck
// rule until the learner takes it up, whatever the tokenizer called it
// -- a な-adjective's stem is "other" and an interjection is no content
// class, and both used to be drawn as scaffolding with no rule at all.
const pool = (pos, status = 'not_started') => ({
  surface: 'x', pos,
  vocab_match: { level: null, raw_id: 'vocab_jmdict_1', pool: true, entry: { kanji: '', kana: 'x', meaning: 'm' }, stats: { status } },
})
const deck = (pos, status) => ({
  surface: 'x', pos,
  vocab_match: { level: 'N5', raw_id: 'vocab_N5_x_x', entry: { kanji: 'x', kana: 'x', meaning: 'm' }, stats: { status } },
})

describe('a pool word on the line', () => {
  it('is off-deck until taken up, whatever its part of speech', () => {
    for (const pos of ['noun', 'other', 'interjection']) {
      expect(tokState(pool(pos))).toBe('offdeck')
    }
    // Before the learner's stats are attached (the pure local tier).
    expect(tokState({ ...pool('noun'), vocab_match: { ...pool('noun').vocab_match, stats: undefined } })).toBe('offdeck')
  })

  it('is the learner\'s word once taken up', () => {
    expect(tokState(pool('noun', 'new'))).toBe('unknown')
    expect(tokState(pool('other', 'learning'))).toBe('learning')
    expect(tokState(pool('interjection', 'mastered'))).toBe('mastered')
  })

  it('leaves the deck words and the scaffolding as they were', () => {
    expect(tokState(deck('noun', 'not_started'))).toBe('unknown')
    expect(tokState({ surface: 'は', pos: 'particle', vocab_match: null })).toBe('particle')
    expect(tokState({ surface: '真っさら', pos: 'other', vocab_match: null })).toBe('particle')
    expect(tokState({ surface: '桃源', pos: 'noun', vocab_match: null })).toBe('offdeck')
  })

  it('counts as unknown for i+1 exactly where the server counts it', () => {
    // Untaken, it is off-deck on the server (attach_user_state).
    expect(isUnknownToken(pool('noun'))).toBe(false)
    expect(isUnknownToken(pool('noun', 'new'))).toBe(true)
    expect(isUnknownToken(pool('noun', 'learning'))).toBe(false)
    expect(isUnknownToken(deck('noun', 'not_started'))).toBe(true)
  })

  it('is told by its `pool` flag alone', () => {
    expect(isPoolWord(pool('noun'))).toBe(true)
    expect(isPoolWord(deck('noun', 'new'))).toBe(false)
    expect(isPoolWord({ surface: 'は' })).toBe(false)
    expect(isPoolWord(null)).toBe(false)
  })
})

// ── The rōmaji under a word on the phone's stage (plan 263) ──
describe('a word in rōmaji', () => {
  const w = (surface, reading, pos = 'noun') => ({ surface, reading, pos })
  it('reads a word by its reading, a kana word by its spelling', () => {
    expect(tokRomaji(w('学校', 'がっこう'))).toBe('gakkou')
    expect(tokRomaji(w('ギター', ''))).toBe('gitaa')
    expect(tokRomaji(w('きっと', '', 'adverb'))).toBe('kitto')
  })

  // Plan 272: the reading of a katakana word is its sound in hiragana,
  // which draws a long vowel as the row's usual one (こうひい).
  it('reads a katakana word by its own long vowels', () => {
    expect(tokRomaji(w('コーヒー', 'こうひい'))).toBe('koohii')
    expect(tokRomaji(w('パーティー', 'ぱあてぃー'))).toBe('paatii')
    expect(tokRomaji(w('こんにちは', 'こんにちわ', 'interjection'))).toBe('konnichiwa')
  })

  it('says a particle the way it is said', () => {
    expect(tokRomaji(w('は', 'は', 'particle'))).toBe('wa')
    expect(tokRomaji(w('へ', 'へ', 'particle'))).toBe('e')
    expect(tokRomaji(w('を', 'を', 'particle'))).toBe('o')
    // The letter, not the particle: は inside a word is ha.
    expect(tokRomaji(w('はな', 'はな'))).toBe('hana')
  })

  it('writes nothing under a mark or a word in Latin letters', () => {
    expect(tokRomaji(w('、', '', 'punctuation'))).toBe('')
    expect(tokRomaji(w('love', '', 'noun'))).toBe('')
  })
})

// ── A number or a name the course has no card for (plan 266) ──
// The local tier glosses it itself, in both languages, as it does a
// grammar point: 三十 had no card and its row said nothing, and 田中 read
// as a word the course does not teach.
describe('the gloss of a word with no card', () => {
  const number = { surface: '三十', pos: 'noun', vocab_match: null, gloss: { en: '30', fr: '30' } }
  const name = { surface: '田中', pos: 'noun', vocab_match: null, gloss: { en: 'family name', fr: 'nom de famille' } }

  it('is the local tier\'s line, in the reader\'s language', () => {
    expect(wordGloss(number, 'en')).toBe('30')
    expect(wordGloss(name, 'en')).toBe('family name')
    expect(wordGloss(name, 'fr')).toBe('nom de famille')
  })

  it('falls back to the English, and gives way to a card or a bought gloss', () => {
    expect(wordGloss({ ...name, gloss: { en: 'family name' } }, 'fr')).toBe('family name')
    expect(wordGloss({ ...name, meaning: 'Tanaka (a surname)' }, 'fr')).toBe('Tanaka (a surname)')
    expect(wordGloss({ ...deck('noun', 'new'), gloss: { en: 'x' } }, 'en')).toBe('m')
  })

  it('is nothing for a word with neither', () => {
    expect(wordGloss({ surface: 'は', pos: 'particle', vocab_match: null }, 'en')).toBe('')
    expect(wordGloss(null, 'en')).toBe('')
  })
})
