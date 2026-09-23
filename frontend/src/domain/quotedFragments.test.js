import { describe, it, expect } from 'vitest'
import { quotedFragments, sentenceFor } from './quotedFragments'

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
