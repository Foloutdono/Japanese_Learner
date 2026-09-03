import { describe, it, expect } from 'vitest'
import {
  translatedMap, applyTranslations, retranslateSelection,
} from './translationCache'

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

// The card as the backend hands it over: the MCQ options live under
// hints.indice_1 (three distractors plus the right answer, shuffled —
// routes/vocab.py), and `choices`, which translateCard used to write
// to, is not a field on it at all. So a language switch mid-card left
// the prompt in the new language and the options in the old one.
const wordForm = entry => entry.kanji || entry.kana

function vocabCard() {
  return {
    card_id: 'v1',
    kanji: 'お手洗い',
    kana: 'おてあらい',
    meaning: 'restroom, toilet',
    direction: 'f2b',
    hints: {
      indice_1: [
        { kanji: '本', kana: 'ほん', meaning: 'book' },
        { kanji: 'お手洗い', kana: 'おてあらい', meaning: 'restroom, toilet' },
        { kanji: '', kana: 'あびる', meaning: 'to bathe, to shower' },
      ],
      indice_3: [{ text: 'お', reading: '' }],
    },
  }
}

const FR = {
  'お手洗い': 'toilettes',
  '本': 'livre',
}

describe('applyTranslations', () => {
  it('rewrites the prompt and the MCQ options together', () => {
    const card = applyTranslations(vocabCard(), wordForm, FR)
    expect(card.meaning).toBe('toilettes')
    expect(card.hints.indice_1.map(c => c.meaning))
      .toEqual(['livre', 'toilettes', 'to bathe, to shower'])
  })

  it('keeps the right answer gradable: the option and the prompt agree', () => {
    const card = applyTranslations(vocabCard(), wordForm, FR)
    // What MCQGrid compares — `correct` against the picked option.
    const correct = card.meaning
    const options = card.hints.indice_1.map(c => c.meaning)
    expect(options.filter(o => o === correct)).toHaveLength(1)
  })

  it('leaves an option the map has no entry for exactly as it was', () => {
    const before = vocabCard()
    const card = applyTranslations(before, wordForm, FR)
    // あびる has no French gloss — the option keeps its English one,
    // and is not even rebuilt.
    expect(card.hints.indice_1[2]).toBe(before.hints.indice_1[2])
  })

  it('leaves the card its own meaning when the card itself is untranslated', () => {
    expect(applyTranslations(vocabCard(), wordForm, {}).meaning).toBe('restroom, toilet')
  })

  it('carries the other hints through untouched', () => {
    const before = vocabCard()
    expect(applyTranslations(before, wordForm, FR).hints.indice_3).toBe(before.hints.indice_3)
  })

  it('invents no hints on a card that has none', () => {
    const card = applyTranslations({ kanji: '本', meaning: 'book' }, wordForm, FR)
    expect(card).toEqual({ kanji: '本', meaning: 'livre' })
  })

  it('passes a radical card\'s options through — they carry a char, not a meaning', () => {
    const before = {
      kanji: '海',
      meaning: 'sea',
      hints: { indice_1: [{ char: '氵' }, { char: '木' }] },
    }
    const card = applyTranslations(before, entry => entry.kanji, { '海': 'mer' })
    expect(card.meaning).toBe('mer')
    expect(card.hints.indice_1).toEqual([{ char: '氵' }, { char: '木' }])
  })

  it('does not mutate the card it was given', () => {
    const before = vocabCard()
    applyTranslations(before, wordForm, FR)
    expect(before.meaning).toBe('restroom, toilet')
    expect(before.hints.indice_1[0].meaning).toBe('book')
  })
})

describe('retranslateSelection', () => {
  const options = vocabCard().hints.indice_1

  it('follows the row the learner picked into the new language', () => {
    expect(retranslateSelection('book', options, wordForm, FR)).toBe('livre')
  })

  it('leaves a pick whose option has no translation alone', () => {
    expect(retranslateSelection('to bathe, to shower', options, wordForm, FR))
      .toBe('to bathe, to shower')
  })

  it('leaves a Japanese pick alone — the meaning->word direction', () => {
    expect(retranslateSelection('お手洗い', options, wordForm, FR)).toBe('お手洗い')
  })

  it('passes null through: nothing has been picked yet', () => {
    expect(retranslateSelection(null, options, wordForm, FR)).toBe(null)
  })

  it('passes through when the card has no options at all', () => {
    expect(retranslateSelection('book', undefined, wordForm, FR)).toBe('book')
  })

  it('still matches the option it was rewritten with', () => {
    const card = applyTranslations(vocabCard(), wordForm, FR)
    const selected = retranslateSelection('book', options, wordForm, FR)
    expect(card.hints.indice_1.map(c => c.meaning)).toContain(selected)
  })
})
