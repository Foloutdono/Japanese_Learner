import { describe, expect, it } from 'vitest'
import { cardProgress, stripFills } from './cardProgress'

describe('cardProgress', () => {
  it('reads the figure the server sent, held to 0..1', () => {
    expect(cardProgress('learning', 0.375)).toBe(0.375)
    expect(cardProgress('learning', 1.4)).toBe(1)
    expect(cardProgress('learning', -1)).toBe(0)
  })

  it('falls back on the stage for the two ends only', () => {
    expect(cardProgress('new')).toBe(0)
    expect(cardProgress('mastered')).toBe(1)
    expect(cardProgress('learning')).toBeNull()
    expect(cardProgress(undefined)).toBeNull()
  })
})

describe('stripFills', () => {
  it('fills the stretch a new card stands at', () => {
    expect(stripFills('new', 0)).toEqual([1, 0, 0])
  })

  it('fills the middle stretch by how far through learning the card is', () => {
    expect(stripFills('learning', 0.25)).toEqual([1, 0.25, 0])
    expect(stripFills('learning')).toEqual([1, 0, 0])
  })

  it('fills the whole strip for a mastered card', () => {
    expect(stripFills('mastered', 1)).toEqual([1, 1, 1])
  })
})
