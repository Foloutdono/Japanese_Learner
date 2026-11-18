import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CARD_FIELDS, choseAny, fieldsFor, hasStrip, lineOf } from './cardContents'

// ── 札の中身 (plan 326) — what a flip card may show, and where ──

const ALL = {
  vocab: [...CARD_FIELDS.vocab.question, ...CARD_FIELDS.vocab.answer],
  kanji: [...CARD_FIELDS.kanji.answer],
}
const word = mode => ({ card_id: 'vocab_N4_届ける_とどける', mode })
const kanji = mode => ({ card_id: 'kanji_N4_送', mode })

describe('the fields', () => {
  it('are the backend\'s (study/card_contents.py), line by line and side by side', () => {
    const py = readFileSync(fileURLToPath(new URL('../../../backend/study/card_contents.py', import.meta.url)), 'utf8')
    for (const [line, sides] of Object.entries(CARD_FIELDS)) {
      const block = py.slice(py.indexOf(`"${line}": {`))
      for (const [side, fields] of Object.entries(sides)) {
        const m = block.match(new RegExp(`"${side}": \\(([^)]*)\\)`))
        const theirs = [...m[1].matchAll(/"([a-z]+)"/g)].map(x => x[1])
        expect(theirs).toEqual(fields)
      }
    }
  })
})

describe('where a card shows them', () => {
  it('owns only the app\'s vocab and kanji cards, in their flip modes', () => {
    expect(lineOf(word('vocab.flashcard.f2b'))).toBe('vocab')
    expect(lineOf(kanji('kanji.flashcard.f2b'))).toBe('kanji')
    expect(lineOf({ card_id: 'deck_3_12', mode: 'standard.flashcard.f2b' })).toBeNull()
    expect(hasStrip(word('vocab.flashcard.b2f'))).toBe(true)
    expect(hasStrip(word('vocab.word_reading'))).toBe(true)
    expect(hasStrip(kanji('kanji.write_kanji'))).toBe(false)
    expect(hasStrip({ card_id: 'grammar_N5_x', mode: 'grammar.ladder' })).toBe(false)
  })

  it('puts on the question only what cannot answer it', () => {
    expect(fieldsFor(word('vocab.flashcard.f2b'), ALL, 'question')).toEqual(['furigana', 'sentence'])
    // A sentence holds the word a meaning → word card asks for, and
    // furigana or a sentence would read a reading card for the learner.
    expect(fieldsFor(word('vocab.flashcard.b2f'), ALL, 'question')).toEqual([])
    expect(fieldsFor(word('vocab.word_reading'), ALL, 'question')).toEqual([])
    expect(fieldsFor(kanji('kanji.flashcard.f2b'), ALL, 'question')).toEqual([])
  })

  it('puts under the answer what was chosen, in the page\'s order', () => {
    expect(fieldsFor(word('vocab.flashcard.b2f'), { vocab: ['verb', 'example'] }, 'answer')).toEqual(['example', 'verb'])
    expect(fieldsFor(kanji('kanji.flashcard.b2f'), ALL, 'answer')).toEqual(['words', 'radical', 'strokes'])
    expect(fieldsFor(word('vocab.flashcard.f2b'), { vocab: [], kanji: ['words'] }, 'answer')).toEqual([])
  })

  it('knows when nothing was chosen', () => {
    expect(choseAny(null)).toBe(false)
    expect(choseAny({ vocab: [], kanji: [] })).toBe(false)
    expect(choseAny({ vocab: [], kanji: ['strokes'] })).toBe(true)
  })
})
