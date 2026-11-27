import { describe, it, expect } from 'vitest'
import {
  NO, OWN, SHOWN, YES, defaultPick, exactCount, matchKey, matchedCount, offered, pickOf, splitImport, usingCount,
} from './importMatches'

const card = (raw_id, extra = {}) => ({ source: 'vocab', level: 'N5', raw_id, front: raw_id, kana: '', meaning: '', exact: false, ...extra })
const WATER = card('vocab_N5_水_みず', { exact: true })
const SOUND = card('vocab_N3_塩_しお')
const TWIN = card('kanji_N5_水', { source: 'kanji' })

describe('what a row is until the notice is answered', () => {
  it('is its own card: nothing is taken without being asked', () => {
    expect(pickOf({}, [[WATER]], 0)).toBe(OWN)
    expect(pickOf({}, [[WATER]], 0, null)).toBe(OWN)
    expect(pickOf({}, [[WATER]], 0, NO)).toBe(OWN)
    expect(splitImport([{ fields: {}, notes: '' }], [[WATER]], {}).apps).toEqual([])
  })

  it('is its exact candidate after yes, and its own card for a guess', () => {
    expect(defaultPick([WATER, TWIN])).toBe(0)
    expect(defaultPick([SOUND])).toBe(OWN)
    expect(defaultPick([])).toBe(OWN)
    expect(defaultPick(undefined)).toBe(OWN)
    expect(pickOf({}, [[WATER], [SOUND]], 0, YES)).toBe(0)
    expect(pickOf({}, [[WATER], [SOUND]], 1, YES)).toBe(OWN)
  })
})

describe('a choice', () => {
  const matches = [[WATER, TWIN], [SOUND], []]

  it('is the learner’s when they made one, and outlasts the answer', () => {
    expect(pickOf({ 0: OWN }, matches, 0, YES)).toBe(OWN)
    expect(pickOf({ 0: 1 }, matches, 0, YES)).toBe(1)
    expect(pickOf({ 1: 0 }, matches, 1, YES)).toBe(0)
    expect(pickOf({ 1: 0 }, matches, 1)).toBe(0)
  })

  it('cannot point past what is shown', () => {
    expect(pickOf({ 1: 5 }, matches, 1, YES)).toBe(OWN)
    expect(offered(Array.from({ length: 9 }, (_, i) => card(`c${i}`)))).toHaveLength(SHOWN)
  })

  it('counts the rows that found a match, the sure ones, and those on the app’s card', () => {
    expect(matchedCount(matches)).toBe(2)
    expect(exactCount(matches)).toBe(1)
    expect(usingCount({}, matches)).toBe(0)
    expect(usingCount({}, matches, YES)).toBe(1)
    expect(usingCount({ 1: 0 }, matches, YES)).toBe(2)
    expect(usingCount({ 0: OWN }, matches, YES)).toBe(0)
    expect(usingCount({ 1: 0 }, matches, NO)).toBe(1)
  })
})

describe('what the import sends', () => {
  const rows = [
    { fields: { word: '水', meaning: 'water' }, notes: '' },
    { fields: { word: '塩', meaning: 'salt' }, notes: 'n' },
    { fields: { word: 'zzz', meaning: 'none' }, notes: '' },
  ]
  const matches = [[WATER], [SOUND], []]

  it('writes every row until the learner says yes', () => {
    const { own, apps } = splitImport(rows, matches, {})
    expect(apps).toEqual([])
    expect(own).toEqual(rows)
  })

  it('links the exact rows after yes and writes the rest', () => {
    const { own, apps, same } = splitImport(rows, matches, {}, YES)
    expect(apps).toEqual([{ source: 'vocab', level: 'N5', raw_id: 'vocab_N5_水_みず' }])
    expect(own).toEqual([rows[1], rows[2]])
    expect(same).toBe(0)
  })

  it('keeps a row whole when the learner switched it back to their own', () => {
    const { own, apps } = splitImport(rows, matches, { 0: OWN }, YES)
    expect(apps).toEqual([])
    expect(own).toEqual(rows)
  })

  it('takes the candidate the learner chose, not the first', () => {
    const { apps } = splitImport([rows[0]], [[WATER, TWIN]], { 0: 1 }, YES)
    expect(apps).toEqual([{ source: 'kanji', level: 'N5', raw_id: 'kanji_N5_水' }])
  })

  it('takes a guess the learner picked in the details', () => {
    const { apps, own } = splitImport(rows, matches, { 1: 0 }, YES)
    expect(apps.map(a => a.raw_id)).toEqual(['vocab_N5_水_みず', 'vocab_N3_塩_しお'])
    expect(own).toEqual([rows[2]])
  })

  it('asks for a card once when two rows mean it', () => {
    const { apps, same, own } = splitImport([rows[0], rows[0]], [[WATER], [WATER]], {}, YES)
    expect(apps).toHaveLength(1)
    expect(same).toBe(1)
    expect(own).toEqual([])
  })

  it('sends everything as written when the server found nothing', () => {
    const { own, apps } = splitImport(rows, [], {}, YES)
    expect(apps).toEqual([])
    expect(own).toEqual(rows)
  })

  it('writes a row the matches have not caught up with', () => {
    // A paste edited after the answer came back: rows past the list.
    const { own } = splitImport(rows, [[WATER]], {}, YES)
    expect(own).toEqual([rows[1], rows[2]])
  })
})

describe('the key a set of matches belongs to', () => {
  it('changes with a row’s fields and not with its notes', () => {
    const a = [{ fields: { word: '水' }, notes: 'a' }]
    expect(matchKey(a)).toBe(matchKey([{ fields: { word: '水' }, notes: 'b' }]))
    expect(matchKey(a)).not.toBe(matchKey([{ fields: { word: '火' }, notes: 'a' }]))
  })
})
