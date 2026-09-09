import { describe, it, expect } from 'vitest'
import {
  approx, axisLabel, bucketFor, clampDeparture, dayFraction, jlptFor, kanaKnownCount, kanjiThrough,
  levelForKana, minuteAtFraction, minutesToTime, planFigures, stopsAhead, timeToMinutes,
} from './boarding'

const VOLUMES = {
  vocab: { N5: 667, N4: 634, N3: 1832, N2: 1796, N1: 3476 },
  kanji: { N5: 103, N4: 166, N3: 367, N2: 367, N1: 1232 },
  grammar: { N5: 71, N4: 71, N3: 71, N2: 71, N1: 71 },
  kana: 224,
}

describe('the day track', () => {
  it('reads and prints the clock', () => {
    expect(timeToMinutes('07:30')).toBe(450)
    expect(minutesToTime(450)).toBe('07:30')
    expect(minutesToTime(21 * 60)).toBe('21:00')
  })
  it('snaps onto half hours between six and the last departure', () => {
    expect(clampDeparture(7 * 60 + 14)).toBe(7 * 60)
    expect(clampDeparture(7 * 60 + 16)).toBe(7 * 60 + 30)
    expect(clampDeparture(3 * 60)).toBe(6 * 60)
    expect(clampDeparture(25 * 60)).toBe(23 * 60 + 30)
  })
  it('maps a minute to the rail and back', () => {
    expect(dayFraction(6 * 60)).toBe(0)
    expect(dayFraction(15 * 60)).toBeCloseTo(0.5)
    expect(minuteAtFraction(0)).toBe(6 * 60)
    expect(minuteAtFraction(1)).toBe(23 * 60 + 30)
    expect(minuteAtFraction(0.5)).toBe(15 * 60)
  })
  it('buckets the hour into the three announced rides', () => {
    expect(bucketFor(timeToMinutes('07:30'))).toBe('am')
    expect(bucketFor(timeToMinutes('10:30'))).toBe('am')
    expect(bucketFor(timeToMinutes('12:30'))).toBe('noon')
    expect(bucketFor(timeToMinutes('16:30'))).toBe('noon')
    expect(bucketFor(timeToMinutes('21:00'))).toBe('pm')
  })
})

describe('the kana check and the level', () => {
  // It answered 'N5' for a reader of one script or none, which put them
  // AT the first stop: they never saw the level list, and their goal
  // list opened at N4, so "reach N5" — the likeliest goal a beginner
  // has — was the one thing they could not ask for (owner's report).
  // One script or none is short of N5, which asks for both kana and
  // ~100 kanji, so the answer is the novice.
  it('boards one script or none as a novice, and asks the reader of both', () => {
    expect(levelForKana('hiragana')).toBe('novice')
    expect(levelForKana('katakana')).toBe('novice')
    expect(levelForKana('none')).toBe('novice')
    expect(levelForKana('both')).toBeNull()
  })
  it('boards the novice at the first stop', () => {
    expect(jlptFor('novice')).toBe('N5')
    expect(jlptFor('N3')).toBe('N3')
  })
  it('offers only the stops ahead', () => {
    expect(stopsAhead('N5')).toEqual(['N4', 'N3', 'N2', 'N1'])
    expect(stopsAhead('N2')).toEqual(['N1'])
    expect(stopsAhead('N1')).toEqual([])
    // The novice has passed none of them: the whole line is ahead, N5
    // first. It is why the goal list is asked for the CHOICE and not
    // for the level the office stores (which is N5 for them both).
    expect(stopsAhead('novice')).toEqual(['N5', 'N4', 'N3', 'N2', 'N1'])
  })
  it('counts the kanji through a stop from the volumes', () => {
    expect(kanjiThrough(VOLUMES, 'N5')).toBe(103)
    expect(kanjiThrough(VOLUMES, 'N4')).toBe(269)
    expect(approx(kanjiThrough(VOLUMES, 'N4'), 50)).toBe(250)
    expect(approx(3, 50)).toBe(50)
  })
  it('knows how many signs a kana answer already covers', () => {
    expect(kanaKnownCount(VOLUMES, 'both')).toBe(224)
    expect(kanaKnownCount(VOLUMES, 'hiragana')).toBe(112)
    expect(kanaKnownCount(VOLUMES, 'none')).toBe(0)
    expect(kanaKnownCount(null, 'both')).toBe(0)
  })
})

describe('the plan', () => {
  it('prices the ride from the learner’s own answers', () => {
    const now = new Date('2026-09-07T00:00:00Z')
    const f = planFigures(VOLUMES, 'N5', 'N4', 10, 'both', now)
    expect(f.words).toBe(667 + 634)
    expect(f.kanji).toBe(103 + 166)
    // Kana already read are not on the ride.
    expect(f.items).toBe(667 + 634 + 103 + 166 + 71 + 71)
    expect(f.days).toBe(Math.ceil(f.items / 10))
    expect(f.date.getTime()).toBeGreaterThan(now.getTime())
    const none = planFigures(VOLUMES, 'N5', 'N4', 10, 'none', now)
    expect(none.items).toBe(f.items + 224)
    // Above N5 the kana never counted.
    expect(planFigures(VOLUMES, 'N3', 'N2', 10, 'none', now).items).toBe(1832 + 367 + 71 + 1796 + 367 + 71)
  })
  it('survives missing volumes with a ride of nothing', () => {
    const f = planFigures(null, 'N5', 'N4', 10, 'both')
    expect(f.words).toBe(0)
    expect(f.items).toBe(0)
    expect(f.days).toBe(1)
  })
  it('labels the axis in k above a thousand', () => {
    expect(axisLabel(500)).toBe('500')
    expect(axisLabel(1000)).toBe('1k')
    expect(axisLabel(1500)).toBe('1.5k')
  })
})
