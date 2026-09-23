import { describe, it, expect } from 'vitest'
import { byRank, firstRadical } from './radicals'

const r = (number, count) => ({ number, count })
const GROUPS = [
  { stroke_count: 3, radicals: [r(30, 40), r(32, 30), r(40, 40)] },
  { stroke_count: 4, radicals: [r(61, 40), r(64, 50), r(85, 123)] },
]

describe('byRank', () => {
  it('puts the biggest family first, Kangxi order between equals', () => {
    expect([r(40, 40), r(32, 30), r(30, 40)].sort(byRank).map(x => x.number)).toEqual([30, 40, 32])
  })
})

describe('firstRadical', () => {
  it('opens the page it was left on at its biggest family', () => {
    expect(firstRadical(GROUPS, 4)).toBe(85)
    expect(firstRadical(GROUPS, 3)).toBe(30)
  })

  it('opens the first page without a stroke count, or with one it does not hold', () => {
    expect(firstRadical(GROUPS, null)).toBe(30)
    expect(firstRadical(GROUPS, 17)).toBe(30)
  })

  it('opens nothing on an empty index', () => {
    expect(firstRadical([], null)).toBeNull()
    expect(firstRadical([{ stroke_count: 1, radicals: [] }], 1)).toBeNull()
  })
})
