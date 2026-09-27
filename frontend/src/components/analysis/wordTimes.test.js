import { describe, it, expect } from 'vitest'
import { morae, beatsOf, passageTiming, tokenTimes, sungAt } from './wordTimes'

const tok = (surface, reading, start) => ({ surface, reading, start, end: start + Array.from(surface).length })
// 今日は いい天気: 2 + 1 beats, a two-beat breath, 2 + 3 beats, and the
// last of them held half a beat longer -- 10.5 beats over 10.5 seconds.
const LINE = {
  text: '今日は いい天気',
  cue_start: 10,
  cue_end: 20.5,
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
    // A beat a second, the last one held: 天気 ends with the cue.
    expect(times.tokens.map(w => w.start)).toEqual([10, 12, 15, 17])
    expect(times.tokens[3].end).toBe(20.5)
  })

  it('breathes at a mark the tokenizer made a word of', () => {
    // そう、雨だ: 2 beats, a breath at the 、 (a token of its own), 2, 1.5.
    const line = {
      text: 'そう、雨だ', cue_start: 0, cue_end: 7.5,
      tokens: [tok('そう', 'そう', 0), tok('、', '、', 2), tok('雨', 'あめ', 3), tok('だ', 'だ', 4)],
    }
    expect(tokenTimes(line).tokens.map(w => w.start)).toEqual([0, 2, 4, 6])
  })

  it('counts nothing for the marks before the first word and after the last', () => {
    const line = { text: '「雨」', cue_start: 0, cue_end: 2.5, tokens: [tok('「', '「', 0), tok('雨', 'あめ', 1), tok('」', '」', 2)] }
    const times = tokenTimes(line)
    expect(times.tokens[1].start).toBe(0)
    expect(times.tokens[1].end).toBe(2.5)
  })

  it('puts a word where its anchor says, and spreads the rest around it', () => {
    const times = tokenTimes({ ...LINE, word_times: [[0, 11], [4, 16]] })
    expect(times.tokens[0].start).toBe(11)
    expect(times.tokens[2].start).toBe(16)
    // は between 今日 and the breath: after 今日's two beats of five.
    expect(times.tokens[1].start).toBeCloseTo(13)
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
    expect(sungAt(times, 18.75)).toEqual({ index: 3, progress: 0.5 })
  })

  it('is nothing outside the line', () => {
    expect(sungAt(times, 9.9)).toBeNull()
    expect(sungAt(times, 20.5)).toBeNull()
  })

  it('is before the first word while the line waits for its speech', () => {
    const late = tokenTimes({ ...LINE, word_times: [[0, 11]] })
    expect(sungAt(late, 10.5)).toEqual({ index: -1, progress: 0 })
  })
})

// What a whole track says about its lines: its pace, measured between
// the words it timed, and how early its subtitles come up.
describe('passageTiming', () => {
  // LINE's four words timed at half a second a beat, the first 0.3 s
  // after the subtitle comes up.
  const timedLine = at => ({
    ...LINE, cue_start: at - 0.3, cue_end: at + 7,
    word_times: [[0, at], [2, at + 1], [4, at + 2.5], [6, at + 3.5]],
  })

  it('reads the pace between the words measured, and the lead before the first', () => {
    const timing = passageTiming([0, 10, 20, 30, 40, 50, 60, 70].map(timedLine))
    expect(timing.secondsPerBeat).toBeCloseTo(0.5)
    expect(timing.lead).toBeCloseTo(0.3)
  })

  it('reads the pace off the fullest cues when no word was measured', () => {
    // 10.5 beats a line; cues of 10.5 to 19.5 seconds, the fullest near a
    // beat a second and the rest held through a pause.
    const lines = Array.from({ length: 10 }, (_, i) => ({ ...LINE, cue_start: 100 * i, cue_end: 100 * i + 10.5 + i }))
    const timing = passageTiming(lines)
    expect(timing.secondsPerBeat).toBeCloseTo(12.5 / 10.5)
    expect(timing.lead).toBe(0)
  })

  it('says nothing about a track too short to measure, or a Passage with no cues', () => {
    expect(passageTiming([timedLine(0)])).toBeNull()
    expect(passageTiming([{ ...LINE, cue_start: null }])).toBeNull()
    expect(passageTiming([])).toBeNull()
  })
})

describe('tokenTimes on the track\'s timing', () => {
  const held = { ...LINE, cue_end: 40 }

  it('says a line\'s words at the track\'s pace and holds the rest of its cue', () => {
    const times = tokenTimes(held, { secondsPerBeat: 1, lead: 0 })
    expect(times.tokens.map(w => w.start)).toEqual([10, 12, 15, 17])
    expect(times.tokens[3].end).toBe(20.5)
    // Said, and the line still up: its last word stays lit.
    expect(sungAt(times, 30)).toEqual({ index: 3, progress: 1 })
  })

  it('never runs a line past its cue', () => {
    expect(tokenTimes(LINE, { secondsPerBeat: 2, lead: 0 }).tokens[3].end).toBe(20.5)
  })

  it('carries a line on at the track\'s pace after its last word measured', () => {
    const times = tokenTimes({ ...held, word_times: [[0, 10], [4, 14]] }, { secondsPerBeat: 1, lead: 0 })
    expect(times.tokens[2].start).toBe(14)
    expect(times.tokens[3].start).toBe(16)
    expect(times.tokens[3].end).toBe(19.5)
  })

  it('starts a line with no word measured after the track\'s lead', () => {
    expect(tokenTimes(held, { secondsPerBeat: 1, lead: 0.5 }).tokens[0].start).toBe(10.5)
  })

  it('starts a line at the track\'s pace before its first word measured, where its subtitles come up early', () => {
    // いい measured at 16, five beats (今日, は, the breath) after 今日.
    const line = { ...held, word_times: [[4, 16]] }
    expect(tokenTimes(line, { secondsPerBeat: 1, lead: 0.3 }).tokens[0].start).toBe(11)
    // A track that is not early -- a recognised one, whose line starts on
    // its first word -- starts it with the cue.
    expect(tokenTimes(line, { secondsPerBeat: 1, lead: 0 }).tokens[0].start).toBe(10)
  })
})
