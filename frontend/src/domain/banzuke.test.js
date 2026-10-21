import { describe, it, expect } from 'vitest'
import { boardRows, bothRows, moveOf, DIVISIONS } from './banzuke'

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
    expect(sides[1].has(4)).toBe(false)
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
