import { describe, it, expect } from 'vitest'
import {
  ROLL_SPEEDS, DEFAULT_ROLL_SPEED, isRollMode, isRollSpeed, stepSpeed, rollLines, rollEntries, hasReadings, rollSeconds,
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

  it('carries the furigana the analysis gave, a reading on the kanji alone', () => {
    const analysis = { tokens: [
      { surface: '駅', furigana: [{ text: '駅', reading: 'えき' }] },
      { surface: 'で', furigana: [{ text: 'で' }] },
      { surface: '待ち', furigana: [{ text: '待', reading: 'ま' }, { text: 'ち' }] },
      { surface: '。', furigana: [{ text: '。' }] },
    ] }
    const entries = rollEntries({ breakdown: [{ jp: '駅で待ち。', analysis }] })
    expect(entries[0].parts.filter(p => p.reading).map(p => p.reading)).toEqual(['えき', 'ま'])
    expect(entries[0].parts.map(p => p.text).join('')).toBe('駅で待ち。')
    expect(hasReadings(entries)).toBe(true)
  })

  it('draws a line whole when its analysis is missing or spells something else', () => {
    const off = { tokens: [{ surface: '駅', furigana: [{ text: '駅', reading: 'えき' }] }] }
    for (const analysis of [undefined, null, { tokens: [] }, off]) {
      const entries = rollEntries({ breakdown: [{ jp: '駅で待ちました。', analysis }] })
      expect(entries[0].parts).toEqual([{ text: '駅で待ちました。' }])
      expect(hasReadings(entries)).toBe(false)
    }
  })
})
