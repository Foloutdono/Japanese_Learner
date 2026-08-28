import { describe, it, expect } from 'vitest'
import { levelItems, projectJourney } from './journeyProjection'

// The real shape GET /api/onboarding/volumes serves, values pinned to
// the content decks at writing time — the test intentionally does NOT
// import them from anywhere, so a projection-math regression can't
// hide behind a content change.
const VOLUMES = {
  vocab: { N5: 667, N4: 634, N3: 1832, N2: 1796, N1: 3476 },
  kanji: { N5: 103, N4: 166, N3: 367, N2: 367, N1: 1232 },
  grammar: { N5: 71, N4: 71, N3: 71, N2: 71, N1: 71 },
  kana: 224,
}

describe('levelItems', () => {
  it('counts items, not (card, mode) pairs', () => {
    expect(levelItems(VOLUMES, 'N5')).toBe(667 + 103 + 71) // 841
  })
})

describe('projectJourney', () => {
  it('crosses the N5 line inside month three at 10 a day', () => {
    const { milestones } = projectJourney(VOLUMES, 'N5', 10)
    expect(milestones[0].level).toBe('N5')
    expect(milestones[0].items).toBe(841)
    expect(Math.ceil(milestones[0].monthIndex)).toBe(3)
  })

  it('starts the journey at the boarding level, not at N5', () => {
    const { milestones, totalItems } = projectJourney(VOLUMES, 'N2', 20)
    expect(milestones.map(m => m.level)).toEqual(['N2', 'N1'])
    expect(totalItems).toBe(1796 + 367 + 71 + 3476 + 1232 + 71)
  })

  it('puts kana in front of everything on the beginner path', () => {
    const withKana = projectJourney(VOLUMES, 'N5', 10, { includeKana: true })
    const without = projectJourney(VOLUMES, 'N5', 10)
    expect(withKana.milestones[0].items).toBe(841 + 224)
    expect(withKana.totalItems - without.totalItems).toBe(224)
  })

  it('caps the curve at the journey total instead of promising forever', () => {
    const { points, totalItems } = projectJourney(VOLUMES, 'N1', 20, { months: 12 })
    const last = points[points.length - 1]
    expect(totalItems).toBe(3476 + 1232 + 71)
    expect(last.cumulativeItems).toBe(totalItems)
    // The horizon covers 13 points: month 0 through month 12.
    expect(points).toHaveLength(13)
    expect(points[0].cumulativeItems).toBe(0)
  })

  it('drops milestones beyond the horizon rather than drawing them off-map', () => {
    // 5/day for a year is ~1,824 items — N5+N4 (1,712) fits, N3 does not.
    const { milestones } = projectJourney(VOLUMES, 'N5', 5)
    expect(milestones.map(m => m.level)).toEqual(['N5', 'N4'])
  })
})
