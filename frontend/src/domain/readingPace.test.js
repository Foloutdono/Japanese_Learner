import { describe, it, expect } from 'vitest'
import { READING_PACE_IDS, DEFAULT_READING_PACE, LONGEST_FACTOR, isReadingPace, paceFactor } from './readingPace'

describe('the reading pace', () => {
  it('runs from the standard pace to no clock at all', () => {
    expect(READING_PACE_IDS).toEqual(['standard', 'relaxed', 'slow', 'untimed'])
    expect(READING_PACE_IDS.map(paceFactor)).toEqual([1, 1.5, 2, null])
    expect(LONGEST_FACTOR).toBe(2)
  })

  it('reads an unknown pace as the standard one, never as no clock', () => {
    expect(isReadingPace(DEFAULT_READING_PACE)).toBe(true)
    for (const id of ['glacial', '', null, undefined, 'hasOwnProperty']) {
      expect(isReadingPace(id)).toBe(false)
      expect(paceFactor(id)).toBe(1)
    }
  })
})
