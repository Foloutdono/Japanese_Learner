import { describe, it, expect } from 'vitest'
import { firstSense, specimenFor } from './specimen'

// ── 見本 — the card a platform asks, drawn small (plan 136) ─────────
// Each mode maps onto the stop's one card by its shape in the registry;
// what is worth pinning is that every platform the four lines offer
// gets the specimen that is TRUE of it (the prompt first, the answer
// after), and that a card missing the field a mode needs draws nothing
// rather than half a well.

const KANA = { jp: 'キャ', romaji: 'kya' }
const VOCAB = { jp: '何', reading: 'なん', meaning: 'quoi, que' }
const KANJI = { jp: '日', meaning: 'jour; soleil; Japon', reading: 'ニチ・ひ', radical: '日' }
const GRAMMAR = {
  jp: 'から〜まで',
  meaning: "de... à..., depuis... jusqu'à...",
  sentence: '九時から五時まではたらきます。',
  blank: { before: '学校', after: '駅まであるきます。', choices: ['へ', 'から〜まで'] },
}
const text = part => part.text

describe('specimenFor', () => {
  it('asks a flashcard front to back, and back to front', () => {
    const f2b = specimenFor('vocab.flashcard.f2b', VOCAB)
    expect([f2b.kind, text(f2b.q), text(f2b.a)]).toEqual(['pair', '何', 'quoi'])
    expect([f2b.q.jp, f2b.a.jp]).toEqual([true, false])
    const b2f = specimenFor('vocab.flashcard.b2f', VOCAB)
    expect([text(b2f.q), text(b2f.a)]).toEqual(['quoi', '何'])
  })

  it('reads kana against its romaji, not a meaning', () => {
    expect(text(specimenFor('kana.flashcard.f2b', KANA).a)).toBe('kya')
    expect(specimenFor('kana.write_romaji', KANA)).toEqual({ kind: 'type', q: { text: 'キャ', jp: true }, typed: 'kya' })
    expect(specimenFor('kana.write_kana', KANA)).toMatchObject({ kind: 'draw', q: { text: 'kya' }, ghost: 'キャ' })
  })

  it('draws a kanji from its meaning, and reads it and its radical off the glyph', () => {
    expect(specimenFor('kanji.write_kanji', KANJI)).toMatchObject({ kind: 'draw', q: { text: 'jour' }, ghost: '日' })
    expect(text(specimenFor('kanji.readings', KANJI).a)).toBe('ニチ・ひ')
    expect(text(specimenFor('kanji.radical', KANJI).a)).toBe('日')
    expect(text(specimenFor('vocab.word_reading', VOCAB).a)).toBe('なん')
  })

  it('names the rule at work in a sentence, and blanks it among its rivals', () => {
    expect(specimenFor('grammar.fill_in', GRAMMAR)).toMatchObject({ kind: 'sentence', sentence: GRAMMAR.sentence, a: { text: 'から〜まで' } })
    expect(specimenFor('grammar.contrast', GRAMMAR)).toEqual({ kind: 'blank', ...GRAMMAR.blank })
  })

  it('stands a pair too long for one line of the well', () => {
    expect(specimenFor('grammar.flashcard.f2b', GRAMMAR).stack).toBe(true)
    expect(specimenFor('vocab.flashcard.f2b', VOCAB).stack).toBe(false)
  })

  it('draws nothing for a field the card does not carry, the browse, or no card', () => {
    expect(specimenFor('grammar.contrast', { jp: 'は', meaning: 'thème' })).toBeNull()
    expect(specimenFor('grammar.fill_in', { jp: 'は', meaning: 'thème' })).toBeNull()
    expect(specimenFor('kanji.radical', { ...KANJI, radical: null })).toBeNull()
    expect(specimenFor('fast_review', VOCAB)).toBeNull()
    expect(specimenFor('vocab.flashcard.f2b', null)).toBeNull()
    expect(specimenFor('nope', VOCAB)).toBeNull()
  })
})

describe('firstSense', () => {
  it('keeps a gloss\'s first sense, whichever separator it uses', () => {
    expect(firstSense('chose, affaire, fait')).toBe('chose')
    expect(firstSense('jour; soleil')).toBe('jour')
    expect(firstSense('conditionnel : si / quand')).toBe('conditionnel : si / quand')
    expect(firstSense('10,000 yen')).toBe('10,000 yen')
    expect(firstSense(undefined)).toBe('')
  })
})
