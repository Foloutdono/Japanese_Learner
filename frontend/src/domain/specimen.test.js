import { describe, it, expect } from 'vitest'
import { bare, firstSense, specimenFor } from './specimen'

// ── 見本 — the card a car asks, as its run draws it (plans 137, 251) ──
// Each mode maps onto the stop's one card by its shape in the registry;
// what is worth pinning is that every car the four lines offer gets the
// face that is TRUE of it (the prompt first, the answer after; the field
// for what is typed, the slab for what is traced), and that a card
// missing the field a mode needs draws nothing rather than half a face.

const KANA = { jp: 'キャ', romaji: 'kya' }
const VOCAB = { jp: '何', reading: 'なん', meaning: 'quoi, que' }
const KANJI = { jp: '日', meaning: 'jour; soleil; Japon', reading: 'ニチ・ひ', radical: '日' }
const GRAMMAR = {
  jp: 'から〜まで',
  meaning: "de... à..., depuis... jusqu'à...",
  sentence: '九時から五時まではたらきます。',
  blank: { before: '学校', after: '駅まであるきます。', choices: ['へ', 'から〜まで'] },
  build: { pieces: [{ text: '九時' }, { gap: 'から' }, { text: '五時' }, { gap: 'まで' }, { text: 'はたらきます。' }], tr: 'Je travaille de 9 h à 17 h.' },
  write: { situation: 'Tu travailles de 9 h à 17 h.', helpers: [{ text: '九時', reading: 'くじ' }], model: '九時から五時まではたらきます。' },
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
    // The two readings in their two fields, told apart by their script.
    expect(specimenFor('kanji.readings', KANJI)).toEqual({ kind: 'readings', q: { text: '日', jp: true }, on: 'ニチ', kun: 'ひ' })
    expect(specimenFor('kanji.readings', { ...KANJI, reading: 'ひ' })).toMatchObject({ on: null, kun: 'ひ' })
    // The radical under the run's own label for it.
    expect(specimenFor('kanji.radical', KANJI)).toMatchObject({ kind: 'pair', a: { text: '日' }, tag: 'radicalNumber' })
    expect(text(specimenFor('vocab.word_reading', VOCAB).a)).toBe('なん')
  })

  it('names the rule at work in a sentence, and blanks it among its rivals', () => {
    expect(specimenFor('grammar.fill_in', GRAMMAR)).toMatchObject({ kind: 'sentence', sentence: GRAMMAR.sentence, point: 'から〜まで', a: { text: 'から〜まで' } })
    expect(specimenFor('grammar.contrast', GRAMMAR)).toEqual({ kind: 'blank', ...GRAMMAR.blank })
  })

  it('builds the run\'s sentence round its holes, and gives Écrire its situation to say', () => {
    expect(specimenFor('grammar.build', GRAMMAR)).toEqual({ kind: 'build', ...GRAMMAR.build })
    expect(specimenFor('grammar.write', GRAMMAR)).toEqual({
      kind: 'write', situation: GRAMMAR.write.situation, point: 'から〜まで', helpers: GRAMMAR.write.helpers, typed: GRAMMAR.write.model,
    })
  })

  it('starts the ladder on its first rung, Choisir, with the walk it climbs', () => {
    expect(specimenFor('grammar.ladder', GRAMMAR)).toEqual({ kind: 'blank', ...GRAMMAR.blank, walk: true })
    // A point with no blank falls back to the flashcard it is asked as.
    expect(specimenFor('grammar.ladder', { jp: 'は', meaning: 'thème' })).toMatchObject({ kind: 'pair', q: { text: 'は' } })
  })

  it('draws nothing for a field the card does not carry, the browse, or no card', () => {
    expect(specimenFor('grammar.contrast', { jp: 'は', meaning: 'thème' })).toBeNull()
    expect(specimenFor('grammar.fill_in', { jp: 'は', meaning: 'thème' })).toBeNull()
    expect(specimenFor('grammar.build', { jp: 'は', build: { pieces: [{ text: 'は' }] } })).toBeNull()
    expect(specimenFor('grammar.write', { jp: 'は', write: { situation: 'x' } })).toBeNull()
    expect(specimenFor('kanji.radical', { ...KANJI, radical: null })).toBeNull()
    expect(specimenFor('kanji.readings', { ...KANJI, reading: '' })).toBeNull()
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

describe('bare', () => {
  it('writes a pattern as a sentence does', () => {
    expect(bare('〜たら')).toBe('たら')
    expect(bare('から〜まで')).toBe('から〜まで')
    expect(bare(null)).toBe('')
  })
})
