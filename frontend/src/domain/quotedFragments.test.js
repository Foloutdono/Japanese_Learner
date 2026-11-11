import { describe, it, expect } from 'vitest'
import { answerSentences, quotedFragments, sentenceFor } from './quotedFragments'

const TEXT = [
  { jp: 'きのう、友達と公園に行きました。' },
  { jp: '公園はとても広かったです。' },
  { jp: '友達は新しいカメラを持っていました。' },
]

describe('the sentence a question quotes', () => {
  it('reads the quoted fragments, two characters or longer', () => {
    expect(quotedFragments('What does 「新しい」 mean?')).toEqual(['新しい'])
    expect(quotedFragments('「は」 and 「持って」')).toEqual(['持って'])
    expect(quotedFragments('Why did they go?')).toEqual([])
    expect(quotedFragments(undefined)).toEqual([])
  })

  it('opens the one sentence a fragment is in', () => {
    expect(sentenceFor(TEXT, ['新しい'])).toBe(2)
    expect(sentenceFor(TEXT, ['広かった'])).toBe(1)
  })

  it('names no sentence for a fragment in several, or in none', () => {
    expect(sentenceFor(TEXT, ['友達'])).toBe(-1)
    expect(sentenceFor(TEXT, ['公園'])).toBe(-1)
    expect(sentenceFor(TEXT, ['電車'])).toBe(-1)
    // The next fragment is tried when one is ambiguous.
    expect(sentenceFor(TEXT, ['友達', 'カメラ'])).toBe(2)
  })
})

describe('the sentence a question rests on (plan 301b)', () => {
  it('reads the sentences the question names, sorted, once each', () => {
    expect(answerSentences({ question: 'Why did they go?', at: [2] }, TEXT)).toEqual([2])
    expect(answerSentences({ question: 'Why?', at: [2, 0, 2] }, TEXT)).toEqual([0, 2])
  })

  it('names over the quote: `at` is what the author meant', () => {
    expect(answerSentences({ question: 'What does 「新しい」 mean?', at: [0] }, TEXT)).toEqual([0])
  })

  it('falls back to the one sentence its quote is in, for a question written before `at`', () => {
    expect(answerSentences({ question: 'What does 「新しい」 mean?' }, TEXT)).toEqual([2])
    expect(answerSentences({ question: 'Why did they go?' }, TEXT)).toEqual([])
  })

  it('leaves out an index the text does not have', () => {
    expect(answerSentences({ question: 'Why?', at: [9, -1, 1.5, '1'] }, TEXT)).toEqual([])
    expect(answerSentences({ question: 'What does 「広かった」 mean?', at: [9] }, TEXT)).toEqual([1])
    expect(answerSentences(null, TEXT)).toEqual([])
  })
})
