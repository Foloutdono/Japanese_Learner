import { describe, it, expect } from 'vitest'
import { besidePages, boardRows, bothRows, moveOf, DIVISIONS } from './banzuke'

// ── 番付 — what the profile's board shows (plan 262) ──
const e = (rank, username = `u${rank}`) => ({ rank, username, xp: 1000 - rank })
const shape = rows => rows.map(r => (r.gap ? '⋯' : r.e.rank))

describe('boardRows', () => {
  it('keeps the top whole while the learner stands in it', () => {
    const board = { entries: [1, 2, 3, 4, 5].map(n => e(n)), me: e(4), near: [e(3), e(4), e(5)] }
    expect(shape(boardRows(board))).toEqual([1, 2, 3, 4, 5])
  })

  it('shows the top three, the ⋯ and the learner between their neighbours', () => {
    const board = { entries: [1, 2, 3, 4, 5].map(n => e(n)), me: e(47, 'me'), near: [e(46), e(47, 'me'), e(48)] }
    expect(shape(boardRows(board))).toEqual([1, 2, 3, '⋯', 46, 47, 48])
  })

  it('draws no ⋯ where the neighbours meet the top', () => {
    const board = { entries: [1, 2, 3, 4, 5].map(n => e(n)), me: e(6, 'me'), near: [e(5), e(6, 'me'), e(7)] }
    expect(shape(boardRows(board))).toEqual([1, 2, 3, 4, 5, 6, 7])
    const close = { entries: [1, 2, 3, 4, 5].map(n => e(n)), me: e(5, 'me'), near: [] }
    expect(shape(boardRows(close))).toEqual([1, 2, 3, 4, 5])
  })

  it('closes on the learner after the top when the answer has no neighbours', () => {
    const board = { entries: [1, 2, 3, 4, 5].map(n => e(n)), me: e(9, 'me') }
    expect(shape(boardRows(board))).toEqual([1, 2, 3, 4, 5, '⋯', 9])
  })

  it('shows the top alone for a learner with no place yet', () => {
    const board = { entries: [1, 2].map(n => e(n)), me: { rank: null, username: 'me', xp: 0 }, near: [] }
    expect(shape(boardRows(board))).toEqual([1, 2])
  })
})

describe('bothRows', () => {
  it('lines both sides up by rank, a ⋯ between ranks that are not next to each other', () => {
    const week = { entries: [1, 2, 3, 4, 5].map(n => e(n)), me: e(2, 'me') }
    const all = { entries: [1, 2, 3, 4, 5].map(n => e(n)), me: e(30, 'me'), near: [e(29), e(30, 'me'), e(31)] }
    const { lines, sides } = bothRows(week, all)
    expect(lines.map(l => (l.gap ? '⋯' : l.rank))).toEqual([1, 2, 3, 4, 5, '⋯', 29, 30, 31])
    expect(sides[0].has(29)).toBe(false)
    expect(sides[1].get(30).username).toBe('me')
    expect(sides[1].get(4).username).toBe('u4')
  })

  it('fills a side cut to its top three at every rank the other shows (the screenshot of 2026-10-26)', () => {
    const week = { entries: [1, 2, 3, 4, 5].map(n => e(n)), me: e(8, 'me'), near: [e(7), e(8, 'me'), e(9)] }
    const all = { entries: [e(1, 'me'), ...[2, 3, 4, 5].map(n => e(n))], me: e(1, 'me'), near: [e(1, 'me'), e(2)] }
    const { lines, sides } = bothRows(week, all)
    expect(lines.map(l => (l.gap ? '⋯' : l.rank))).toEqual([1, 2, 3, 4, 5, '⋯', 7, 8, 9])
    expect([...sides[0].keys()]).toEqual([1, 2, 3, 4, 5, 7, 8, 9])
    expect([...sides[1].keys()]).toEqual([1, 2, 3, 4, 5])
  })
})

describe('besidePages', () => {
  const week = { total: 12, entries: [1, 2, 3, 4, 5].map(n => e(n)), me: e(8, 'me'), near: [e(7), e(8, 'me'), e(9)] }
  const all = { total: 40, entries: [e(1, 'me'), ...[2, 3, 4, 5].map(n => e(n))], me: e(1, 'me'), near: [e(1, 'me'), e(2)] }

  it('asks the lifetime for the ranks only the week shows, in one run', () => {
    expect(besidePages(week, all)).toEqual([[], [{ offset: 6, limit: 3 }]])
  })

  it('fills the side with what it read, and then asks nothing', () => {
    const read = { ...all, beside: [7, 8, 9].map(n => e(n, `a${n}`)) }
    const { sides } = bothRows(week, read)
    expect([...sides[1].keys()]).toEqual([1, 2, 3, 4, 5, 7, 8, 9])
    expect(sides[1].get(8).username).toBe('a8')
    expect(besidePages(week, read)).toEqual([[], []])
  })

  it('never asks past the board\'s last learner', () => {
    expect(besidePages(week, { ...all, total: 7 })).toEqual([[], [{ offset: 6, limit: 1 }]])
  })
})

describe('moveOf', () => {
  it('reads the move since the day began', () => {
    expect(moveOf({ move: 3 })).toBe('up')
    expect(moveOf({ move: -1 })).toBe('down')
    expect(moveOf({ move: 0 })).toBe(null)
    expect(moveOf({ move: null })).toBe(null)
  })
})

it('numbers the six divisions as the server does, foot to top', () => {
  expect(DIVISIONS.map(d => d.key)).toEqual(['jonokuchi', 'jonidan', 'sandanme', 'makushita', 'juryo', 'makuuchi'])
})
