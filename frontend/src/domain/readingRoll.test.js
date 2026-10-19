import { describe, it, expect } from 'vitest'
import {
  ROLL_SPEEDS, DEFAULT_ROLL_SPEED, isRollMode, isRollSpeed, stepSpeed, rollLines, rollSeconds,
} from './readingRoll'

describe('the rolling text', () => {
  it('steps through the speeds and stops at either end', () => {
    expect(stepSpeed(3, 1)).toBe(4)
    expect(stepSpeed(3, -1)).toBe(2)
    expect(stepSpeed(ROLL_SPEEDS[0], -1)).toBe(ROLL_SPEEDS[0])
    expect(stepSpeed(ROLL_SPEEDS.at(-1), 1)).toBe(ROLL_SPEEDS.at(-1))
    // A speed nobody offers steps from the default's place.
    expect(stepSpeed(7, 1)).toBe(stepSpeed(DEFAULT_ROLL_SPEED, 1))
  })

  it('knows its modes and speeds', () => {
    expect(isRollMode('rolling')).toBe(true)
    expect(isRollMode('whole')).toBe(true)
    for (const bad of ['', 'scroll', null, undefined]) expect(isRollMode(bad)).toBe(false)
    expect(isRollSpeed(5)).toBe(true)
    for (const bad of [0, 7, '5', null]) expect(isRollSpeed(bad)).toBe(false)
  })

  it('rolls the breakdown\'s sentences, or the text cut at its sentence ends', () => {
    expect(rollLines({ breakdown: [{ jp: '駅で待ちました。' }, { jp: '電車は遅れました。' }], text: 'x' }))
      .toEqual(['駅で待ちました。', '電車は遅れました。'])
    expect(rollLines({ text: '駅で待ちました。電車は遅れました。\n雨でした！' }))
      .toEqual(['駅で待ちました。', '電車は遅れました。', '雨でした！'])
    expect(rollLines({ text: '' })).toEqual([])
    expect(rollLines(null)).toEqual([])
  })

  it('takes as long as its characters over its speed', () => {
    const lines = ['あいうえお', 'かきくけこ']   // ten characters
    expect(rollSeconds(lines, 5)).toBe(2)
    expect(rollSeconds(lines, 1)).toBe(10)
    expect(rollSeconds(['あ'], 10)).toBe(1)   // never a roll too short to see
  })
})
