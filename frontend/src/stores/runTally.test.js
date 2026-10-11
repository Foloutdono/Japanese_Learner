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

describe('the run\'s verdicts (plan 174)', () => {
  it('keeps every rating in order, a card rated twice twice, from empty per run', () => {
    startTally('kanji:N4:f2b')
    expect(peekTally().verdicts).toEqual([])
    const entry = { term: '駅', kana: 'えき', category: 'kanji', id: 'k1' }
    countReview({ quality: 4, xp: 3, entry })
    countReview({ quality: 1, xp: 1 })
    countReview({ quality: 3, xp: 2, entry })
    // A rating without a quality (none is sent today) is no segment.
    countReview({ xp: 1 })
    expect(peekTally().verdicts).toEqual([4, 1, 3])
    startTally('kanji:N3:f2b')
    expect(peekTally().verdicts).toEqual([])
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

describe('a run\'s streak (plan 178)', () => {
  it('counts the answers in a row rated good or better, and keeps the best', () => {
    startTally('reading:level:N5')
    expect(peekTally()).toMatchObject({ streak: 0, best: 0 })
    countReview({ quality: 4 })
    countReview({ quality: 3 })
    countReview({ quality: 5 })
    expect(peekTally()).toMatchObject({ streak: 3, best: 3 })
    // Difficult is good (the line retention draws), wrong breaks it.
    countReview({ quality: 2 })
    expect(peekTally()).toMatchObject({ streak: 0, best: 3 })
    countReview({ quality: 4 })
    expect(peekTally()).toMatchObject({ streak: 1, best: 3 })
  })

  it('starts again with the next run', () => {
    startTally('reading:level:N5')
    countReview({ quality: 4 })
    countReview({ quality: 4 })
    startTally('translation:level:N5')
    expect(peekTally()).toMatchObject({ streak: 0, best: 0 })
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

describe('the run\'s faces (plan 191)', () => {
  it('keeps every review\'s card face in order, on every width, a card rated twice twice', () => {
    startTally('today')
    expect(peekTally().faces).toEqual([])
    const hi = { id: 'kanji_N5_日|kanji.flashcard.f2b', term: '日', kana: 'ひ', line: 'kanji', verdict: 2, up: true, mastered: false }
    const nomu = { id: 'vocab_N5_飲む|vocab.flashcard.f2b', term: '飲む', kana: 'のむ', line: 'vocab', verdict: 0, up: false, mastered: false }
    countReview({ quality: 5, xp: 9, face: hi })
    countReview({ quality: 1, xp: 1, face: nomu })
    // A rating with no face (the practice runs) adds none.
    countReview({ quality: 4, xp: 2 })
    countReview({ quality: 4, xp: 3, face: { ...nomu, verdict: 1 } })
    expect(peekTally().faces.map(f => [f.term, f.verdict])).toEqual([['日', 2], ['飲む', 0], ['飲む', 1]])
    // The desk's entries and the count are as they were.
    expect(peekTally()).toMatchObject({ reviewed: 4, cards: [] })
    startTally('today')
    expect(peekTally().faces).toEqual([])
  })
})
