import { describe, it, expect } from 'vitest'
import { morae, beatsOf, tokenTimes, sungAt } from './wordTimes'

const tok = (surface, reading, start) => ({ surface, reading, start, end: start + Array.from(surface).length })
// 今日は いい天気: 2 + 1 beats, a breath, 2 + 3 beats.
const LINE = {
  text: '今日は いい天気',
  cue_start: 10,
  cue_end: 18.5,
  tokens: [tok('今日', 'きょう', 0), tok('は', 'は', 2), tok('いい', 'いい', 4), tok('天気', 'てんき', 6)],
}

describe('morae', () => {
  it('counts the beats of a reading, small kana riding on the one before', () => {
    expect(morae('きょう')).toBe(2)
    expect(morae('がっこう')).toBe(4)
    expect(morae('コーヒー')).toBe(4)
    expect(morae('ファン')).toBe(2)
  })

  it('reads a word with no reading by its letters', () => {
    expect(beatsOf({ surface: '雨' })).toBe(2)
    expect(beatsOf({ surface: 'What' })).toBe(2)
    expect(beatsOf({ surface: '、' })).toBe(0)
  })
})

describe('tokenTimes', () => {
  it('spreads the words over the line by their beats when nothing else is known', () => {
    const times = tokenTimes(LINE)
    // 8 beats and a half-beat breath over 8.5 seconds: a beat a second.
    expect(times.tokens.map(w => w.start)).toEqual([10, 12, 13.5, 15.5])
    expect(times.tokens[3].end).toBe(18.5)
  })

  it('puts a word where its anchor says, and spreads the rest around it', () => {
    const times = tokenTimes({ ...LINE, word_times: [[0, 11], [4, 16]] })
    expect(times.tokens[0].start).toBe(11)
    expect(times.tokens[2].start).toBe(16)
    // は between 今日 and the breath: after 今日's two beats of 3.5.
    expect(times.tokens[1].start).toBeCloseTo(11 + 5 * 2 / 3.5)
  })

  it('ends the words where an anchor at the line\'s length says the speech ends', () => {
    const times = tokenTimes({ ...LINE, word_times: [[0, 10], [8, 14]] })
    expect(times.tokens[3].end).toBe(14)
  })

  it('drops an anchor that runs backwards or outside the line', () => {
    const times = tokenTimes({ ...LINE, word_times: [[4, 16], [6, 12], [2, 30]] })
    expect(times.tokens[2].start).toBe(16)
    expect(times.tokens[3].start).toBeGreaterThan(16)
  })

  it('has nothing to say about a Sentence with no cue times', () => {
    expect(tokenTimes({ ...LINE, cue_start: null })).toBeNull()
    expect(tokenTimes({ ...LINE, tokens: [] })).toBeNull()
  })
})

describe('sungAt', () => {
  const times = tokenTimes(LINE)

  it('names the word being said and how far through it', () => {
    expect(sungAt(times, 12.5)).toEqual({ index: 1, progress: 0.5 })
    expect(sungAt(times, 17)).toEqual({ index: 3, progress: 0.5 })
  })

  it('is nothing outside the line', () => {
    expect(sungAt(times, 9.9)).toBeNull()
    expect(sungAt(times, 18.5)).toBeNull()
  })

  it('is before the first word while the line waits for its speech', () => {
    const late = tokenTimes({ ...LINE, word_times: [[0, 11]] })
    expect(sungAt(late, 10.5)).toEqual({ index: -1, progress: 0 })
  })
})
