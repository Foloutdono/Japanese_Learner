import { describe, it, expect } from 'vitest'
import { startTally, countReview, countXp, peekTally, tallyAccuracy, tallyMisses } from './runTally'
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

describe('a practice run\'s tally (plan 129)', () => {
  it('counts a sentence at its rating and its fare when it lands', () => {
    startTally('reading:level:N5')
    countReview({ quality: 4 })
    expect(peekTally()).toMatchObject({ reviewed: 1, good: 1, xp: 0 })
    countXp(7)
    countReview({ quality: 1 })
    countXp(1)
    // Nothing paid is nothing counted.
    countXp(0)
    countXp(undefined)
    expect(peekTally()).toMatchObject({ reviewed: 2, good: 1, xp: 8 })
    expect(tallyAccuracy(peekTally())).toBe(50)
  })
})

describe('the run\'s misses (plan 115)', () => {
  it('keeps each card by its entry, with the rating it got last', () => {
    startTally('kanji:N5:f2b')
    const eki = { term: '駅', kana: 'えき', category: 'vocab', session: {} }
    const yama = { term: '山', category: 'kanji' }
    countReview({ quality: 1, xp: 1, entry: eki })
    countReview({ quality: 2, xp: 1, entry: yama })
    countReview({ quality: 5, xp: 9, entry: { term: '川', category: 'kanji' } })
    countReview({ quality: 4, xp: 1 })
    expect(tallyMisses(peekTally()).map(m => m.term)).toEqual(['駅', '山'])
    // Missed, then got right: not a miss.
    countReview({ quality: 4, xp: 5, entry: { ...eki } })
    expect(tallyMisses(peekTally()).map(m => m.term)).toEqual(['山'])
    expect(peekTally().reviewed).toBe(5)
    startTally('kanji:N4:f2b')
    expect(tallyMisses(peekTally())).toEqual([])
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
