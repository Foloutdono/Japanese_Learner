import { describe, it, expect } from 'vitest'
import { platformOf, runAt, shareRight, lastRide, nextPaper, nextScene } from './practiceGate'

// ── 実践の改札 — the phone's Practice gate, as data (plan 290) ──────

describe('where a run at a grade goes', () => {
  it('names the platform by its path, and boards its run as App.jsx routes it', () => {
    expect(platformOf('/practice/reading')).toBe('reading')
    expect(runAt('reading', 'N4')).toBe('/practice/reading/level/N4')
    expect(runAt('translation', 'N2')).toBe('/practice/translation/level/N2')
    // One axis each: the grade is the run.
    expect(runAt('comprehension', 'N3')).toBe('/practice/comprehension/N3')
    expect(runAt('dictation', 'N5')).toBe('/practice/dictation/N5')
    expect(runAt('composition', 'N1')).toBe('/practice/composition/N1')
  })

  it('reads the share right off what was graded, none when nothing was', () => {
    expect(shareRight({ done: 24, right: 20, of: 24 })).toBe(83)
    expect(shareRight({ done: 1, right: 0, of: 0 })).toBeNull()
    expect(shareRight(null)).toBeNull()
  })
})

describe('the last ride', () => {
  it('is the newest a grade alone boards again', () => {
    const records = {
      reading: { N4: { done: 3, right: 3, of: 3, last: '2026-10-10T08:00:00+00:00' } },
      dictation: { N5: { done: 2, right: 1, of: 2, last: '2026-10-11T08:00:00.5+00:00' }, N4: { done: 1, right: 1, of: 1, last: null } },
      // Newer, but a scene and a paper are no grade's ride.
      conversation: { N4: { done: 9, right: 9, of: 9, last: '2026-10-20T08:00:00+00:00' } },
      exam: { N4: { done: 1, right: 30, of: 40, last: '2026-10-21T08:00:00+00:00' } },
    }
    expect(lastRide(records)).toEqual({ platform: 'dictation', grade: 'N5', rec: records.dictation.N5 })
  })

  it('is none for a learner who has ridden nothing', () => {
    expect(lastRide({})).toBeNull()
    expect(lastRide(null)).toBeNull()
  })
})

describe('what Embarquer offers where a run needs a pick', () => {
  it('sits the first paper not yet sat, else the first', () => {
    const a = { id: 'a', last: { correct: 1, total: 2 } }
    const b = { id: 'b', last: null }
    expect(nextPaper([a, b])).toBe(b)
    expect(nextPaper([a])).toBe(a)
    expect(nextPaper([])).toBeNull()
  })

  it('opens the first scene with nothing graded, else the first', () => {
    const scenes = [{ id: 'cafe' }, { id: 'station' }]
    expect(nextScene(scenes, { cafe: { done: 2, right: 1 } })).toBe(scenes[1])
    expect(nextScene(scenes, { cafe: {}, station: {} })).toBe(scenes[0])
    expect(nextScene([], {})).toBeNull()
  })
})
