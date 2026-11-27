import { describe, it, expect } from 'vitest'
import {
  OWN, SHOWN, defaultPick, exactCount, matchKey, matchedCount, offered, pickAll, pickOf, splitImport, usingCount,
} from './importMatches'

const card = (raw_id, extra = {}) => ({ source: 'vocab', level: 'N5', raw_id, front: raw_id, kana: '', meaning: '', exact: false, ...extra })
const WATER = card('vocab_N5_水_みず', { exact: true })
const SOUND = card('vocab_N3_塩_しお')
const TWIN = card('kanji_N5_水', { source: 'kanji' })

describe('what a row starts on', () => {
  it('is its exact candidate, and its own card otherwise', () => {
    expect(defaultPick([WATER, TWIN])).toBe(0)
    expect(defaultPick([SOUND])).toBe(OWN)
    expect(defaultPick([])).toBe(OWN)
    expect(defaultPick(undefined)).toBe(OWN)
  })

  it('never takes a possible match without being asked', () => {
    const matches = [[SOUND, TWIN]]
    expect(pickOf({}, matches, 0)).toBe(OWN)
  })
})

describe('a choice', () => {
  const matches = [[WATER, TWIN], [SOUND], []]

  it('is the learner’s when they made one, else the default', () => {
    expect(pickOf({}, matches, 0)).toBe(0)
    expect(pickOf({ 0: OWN }, matches, 0)).toBe(OWN)
    expect(pickOf({ 0: 1 }, matches, 0)).toBe(1)
    expect(pickOf({ 1: 0 }, matches, 1)).toBe(0)
  })

  it('cannot point past what is shown', () => {
    expect(pickOf({ 1: 5 }, matches, 1)).toBe(OWN)
    expect(offered(Array.from({ length: 9 }, (_, i) => card(`c${i}`)))).toHaveLength(SHOWN)
  })

  it('counts the rows that found a match, and the ones on the app’s card now', () => {
    expect(matchedCount(matches)).toBe(2)
    expect(exactCount(matches)).toBe(1)
    expect(usingCount({}, matches)).toBe(1)
    expect(usingCount({ 1: 0 }, matches)).toBe(2)
    expect(usingCount({ 0: OWN }, matches)).toBe(0)
  })
})

describe('use the app’s cards / keep mine', () => {
  const matches = [[WATER], [SOUND], []]

  it('puts the exact rows on the app’s card and leaves a guess to the learner', () => {
    expect(pickAll(matches, { 0: OWN }, true)).toEqual({ 0: 0 })
    expect(pickAll(matches, { 1: OWN }, true)).toEqual({ 0: 0, 1: OWN })
  })

  it('does not undo a guess the learner took', () => {
    expect(pickAll(matches, { 1: 0 }, true)).toEqual({ 0: 0, 1: 0 })
  })

  it('puts every matched row back on its own', () => {
    expect(pickAll(matches, { 1: 0 }, false)).toEqual({ 0: OWN, 1: OWN })
  })
})

describe('what the import sends', () => {
  const rows = [
    { fields: { word: '水', meaning: 'water' }, notes: '' },
    { fields: { word: '塩', meaning: 'salt' }, notes: 'n' },
    { fields: { word: 'zzz', meaning: 'none' }, notes: '' },
  ]
  const matches = [[WATER], [SOUND], []]

  it('links the exact rows and writes the rest', () => {
    const { own, apps, same } = splitImport(rows, matches, {})
    expect(apps).toEqual([{ source: 'vocab', level: 'N5', raw_id: 'vocab_N5_水_みず' }])
    expect(own).toEqual([rows[1], rows[2]])
    expect(same).toBe(0)
  })

  it('keeps every row whole when none is on the app’s', () => {
    const { own, apps } = splitImport(rows, matches, { 0: OWN })
    expect(apps).toEqual([])
    expect(own).toEqual(rows)
  })

  it('takes the candidate the learner chose, not the first', () => {
    const { apps } = splitImport([rows[0]], [[WATER, TWIN]], { 0: 1 })
    expect(apps).toEqual([{ source: 'kanji', level: 'N5', raw_id: 'kanji_N5_水' }])
  })

  it('asks for a card once when two rows mean it', () => {
    const { apps, same, own } = splitImport([rows[0], rows[0]], [[WATER], [WATER]], {})
    expect(apps).toHaveLength(1)
    expect(same).toBe(1)
    expect(own).toEqual([])
  })

  it('sends everything as written when the server found nothing', () => {
    const { own, apps } = splitImport(rows, [], {})
    expect(apps).toEqual([])
    expect(own).toEqual(rows)
  })

  it('writes a row the matches have not caught up with', () => {
    // A paste edited after the answer came back: rows past the list.
    const { own } = splitImport(rows, [[WATER]], {})
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
