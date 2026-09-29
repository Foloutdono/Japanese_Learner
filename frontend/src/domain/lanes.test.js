import { describe, it, expect } from 'vitest'
import { splitTake, parseQuota, quotaParam, runPathFor, laneCount, isMainLane } from './lanes'

// ── 区間 — the run's length dealt as the queue deals (plan 135) ──
// backend study/daily_queue.interleave takes one card from each lane in
// turn, in the queue's order; the gate prints each lane's share of a
// shorter run, so the split has to be the same deal.

const lane = (id, due, fresh = 0) => ({ id, due, new: fresh })
const QUEUE = [lane('a', 5), lane('b', 1), lane('c', 3, 1)]

describe('splitTake', () => {
  it('deals round-robin in the queue\'s order, a short lane dropping out', () => {
    expect(Object.fromEntries(splitTake(QUEUE, 6))).toEqual({ a: 3, b: 1, c: 2 })
    expect(Object.fromEntries(splitTake(QUEUE, 2))).toEqual({ a: 1, b: 1, c: 0 })
  })

  it('counts new cards into a lane, as the run serves them', () => {
    expect(laneCount(QUEUE[2])).toBe(4)
    expect(Object.fromEntries(splitTake(QUEUE, 9))).toEqual({ a: 4, b: 1, c: 4 })
  })

  it('gives every lane whole with no length, or one past the total', () => {
    const whole = { a: 5, b: 1, c: 4 }
    expect(Object.fromEntries(splitTake(QUEUE, null))).toEqual(whole)
    expect(Object.fromEntries(splitTake(QUEUE, 50))).toEqual(whole)
  })
})

describe('the quota in the run\'s URL', () => {
  it('round-trips, lanes at zero left out, ids with colons elsewhere kept whole', () => {
    const q = new Map([['s~kanji~N5~kanji.flashcard.f2b', 3], ['p~7~vocab.flashcard.f2b', 0], ['b', 2]])
    const raw = quotaParam(q)
    expect(raw).toBe('b:2,s~kanji~N5~kanji.flashcard.f2b:3')
    expect(Object.fromEntries(parseQuota(raw))).toEqual({ b: 2, 's~kanji~N5~kanji.flashcard.f2b': 3 })
    expect(parseQuota('junk,:4,x:y').size).toBe(0)
  })

  it('carries a quota only when the length cuts the choice', () => {
    expect(runPathFor(QUEUE, new Set(), null)).toBe('/today/run')
    expect(runPathFor(QUEUE, new Set(), 50)).toBe('/today/run')
    expect(runPathFor(QUEUE, new Set(), 2)).toBe(`/today/run?quota=${encodeURIComponent('a:1,b:1')}`)
    // Dealt over the lanes still on.
    expect(runPathFor(QUEUE, new Set(['a']), 2)).toBe(`/today/run?quota=${encodeURIComponent('b:1,c:1')}`)
  })
})

// ── 主 — a line's main flashcard, the one the gate can board alone ──
describe('isMainLane', () => {
  it('is the recognition flashcard of every line, a deck\'s included', () => {
    for (const mode of ['kana.flashcard.f2b', 'vocab.flashcard.f2b', 'kanji.flashcard.f2b', 'grammar.flashcard.f2b', 'standard.flashcard.f2b']) {
      expect(isMainLane({ mode })).toBe(true)
    }
  })
  it('is none of the other modes', () => {
    for (const mode of ['vocab.flashcard.b2f', 'vocab.word_reading', 'kanji.readings', 'kanji.write_kanji', 'kana.write_romaji', 'grammar.fill_in', 'grammar.contrast']) {
      expect(isMainLane({ mode })).toBe(false)
    }
    expect(isMainLane({})).toBe(false)
    expect(isMainLane(null)).toBe(false)
  })
})
