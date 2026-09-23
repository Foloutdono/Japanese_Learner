import { describe, it, expect } from 'vitest'
import { startTally, countReview, peekTally, tallyAccuracy } from './runTally'
import { publishEntry, withdrawEntry, peekEntry } from './deskEntry'

describe('the run tally', () => {
  it('counts rated cards, the good ones and the XP, from zero per run', () => {
    startTally('kana:hiragana_basic:f2b')
    expect(peekTally()).toMatchObject({ key: 'kana:hiragana_basic:f2b', reviewed: 0, good: 0, xp: 0 })
    expect(tallyAccuracy(peekTally())).toBeNull()

    countReview({ quality: 5, xp: 12 })
    countReview({ quality: 3, xp: 8 })
    countReview({ quality: 2, xp: 2 })
    countReview({ quality: 0, xp: undefined })
    expect(peekTally()).toMatchObject({ reviewed: 4, good: 2, xp: 22 })
    expect(tallyAccuracy(peekTally())).toBe(50)

    startTally('vocab:N5:f2b')
    expect(peekTally()).toMatchObject({ key: 'vocab:N5:f2b', reviewed: 0, good: 0, xp: 0 })
  })
})

describe('the docked entry', () => {
  it('is withdrawn only by the publish that put it there', () => {
    const first = publishEntry({ term: '山', category: 'vocab' })
    const second = publishEntry({ term: '川', category: 'vocab' })
    withdrawEntry(first)
    expect(peekEntry()).toMatchObject({ term: '川' })
    withdrawEntry(second)
    expect(peekEntry()).toBeNull()
  })
})
