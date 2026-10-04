import { describe, it, expect } from 'vitest'
import {
  SUBJECTS, SUBJECT_GROUPS, SUBJECT_PATH, OPENABLE_PATHS, agendaDay, axisFor, axisTicks, durationParts, blockProblem, blocksOn, clashWith, clock, dayName,
  dayRuns, daysLabel, forServer, fromInput, newBlock, nextBlock, occurrences, snap, toInput, withBlock,
} from './agenda'

// The agenda's rules (plan 181), held to the server's: routes/agenda.py
// refuses what blockProblem and clashWith call wrong, and the two must
// agree or the page would send what the server turns away.

const block = (over = {}) => ({ subject: 'kanji', days: [0, 1, 2, 3, 4], start: 540, end: 660, notify: true, lead: 10, ...over })

describe('the clock', () => {
  it('prints minutes as the 24-hour clock', () => {
    expect(clock(0)).toBe('0:00')
    expect(clock(540)).toBe('9:00')
    expect(clock(14 * 60 + 5)).toBe('14:05')
    expect(clock(1440)).toBe('24:00')
  })

  it('reads and writes the time input', () => {
    expect(toInput(540)).toBe('09:00')
    expect(fromInput('09:00')).toBe(540)
    expect(fromInput('23:55')).toBe(1435)
    expect(fromInput('24:00')).toBeNull()
    expect(fromInput('9:00')).toBeNull()
    expect(fromInput('')).toBeNull()
    // The end of the day has no input value: it is drawn at the last mark.
    expect(toInput(1440)).toBe('23:55')
  })

  it('snaps to the five-minute marks', () => {
    expect(snap(541)).toBe(540)
    expect(snap(543)).toBe(545)
  })

  it('starts the week on a Monday', () => {
    expect(agendaDay(new Date(2026, 9, 5))).toBe(0) // Mon 5 Oct 2026
    expect(agendaDay(new Date(2026, 9, 4))).toBe(6) // Sun
    expect(dayName(0, 'en', 'long')).toBe('Monday')
    expect(dayName(6, 'en', 'short')).toBe('Sun')
  })
})

describe('what is wrong with a block', () => {
  it('names the first broken rule', () => {
    expect(blockProblem(block())).toBeNull()
    expect(blockProblem(block({ days: [] }))).toBe('days')
    expect(blockProblem(block({ start: null }))).toBe('time')
    expect(blockProblem(block({ end: 1500 }))).toBe('time')
    expect(blockProblem(block({ start: 540, end: 550 }))).toBe('length')
    expect(blockProblem(block({ start: 600, end: 540 }))).toBe('length')
    // A quarter of an hour is enough; the end of the day is allowed.
    expect(blockProblem(block({ start: 540, end: 555 }))).toBeNull()
    expect(blockProblem(block({ start: 1380, end: 1440 }))).toBeNull()
  })
})

describe('a clash', () => {
  const week = [block({ days: [0, 1], start: 540, end: 660 }), block({ subject: 'reading', days: [5], start: 840, end: 960 })]

  it('needs a shared day and a shared minute', () => {
    expect(clashWith(block({ days: [1], start: 600, end: 700 }), week)).toBe(week[0])
    expect(clashWith(block({ days: [2], start: 600, end: 700 }), week)).toBeNull()
    expect(clashWith(block({ days: [0], start: 700, end: 760 }), week)).toBeNull()
  })

  it('lets one block touch the next', () => {
    expect(clashWith(block({ days: [0], start: 660, end: 720 }), week)).toBeNull()
    expect(clashWith(block({ days: [0], start: 480, end: 540 }), week)).toBeNull()
  })

  it('never clashes with the block being edited', () => {
    expect(clashWith(week[0], week, 0)).toBeNull()
    expect(clashWith(week[0], week)).toBe(week[0])
  })

  it('finds the first free hour for a new block', () => {
    expect(newBlock([])).toMatchObject({ start: 540, end: 600, days: [0, 1, 2, 3, 4], notify: true, lead: 10 })
    const busy = [block({ start: 540, end: 660 })]
    expect(newBlock(busy)).toMatchObject({ start: 660, end: 720 })
  })
})

describe('the days of a block', () => {
  it('runs consecutive days together', () => {
    expect(dayRuns([0, 1, 2, 3, 4])).toEqual([[0, 4]])
    expect(dayRuns([4, 0, 2, 3])).toEqual([[0, 0], [2, 4]])
    expect(dayRuns([])).toEqual([])
  })

  it('says them in a short line', () => {
    expect(daysLabel([0, 1, 2, 3, 4], 'en', 'Every day')).toBe('Mon–Fri')
    expect(daysLabel([0, 2, 3], 'en', 'Every day')).toBe('Mon, Wed–Thu')
    expect(daysLabel([0, 1, 2, 3, 4, 5, 6], 'en', 'Every day')).toBe('Every day')
  })

  it('lists the blocks of a day by their start', () => {
    const a = block({ start: 840, end: 900, days: [0] })
    const b = block({ start: 540, end: 600, days: [0, 1] })
    expect(blocksOn([a, b], 0)).toEqual([b, a])
    expect(blocksOn([a, b], 2)).toEqual([])
  })
})

describe('the week ahead', () => {
  // Wednesday 7 October 2026, 10:00.
  const now = new Date(2026, 9, 7, 10, 0)

  it('lists every occurrence in time order, today and the seven days after', () => {
    const occ = occurrences([block({ days: [2], start: 540, end: 600 }), block({ subject: 'reading', days: [2, 3], start: 840, end: 900 })], now)
    expect(occ.map(o => [o.block.subject, o.start.getDate(), o.start.getHours()])).toEqual([
      ['kanji', 7, 9], ['reading', 7, 14], ['reading', 8, 14], ['kanji', 14, 9], ['reading', 14, 14],
    ])
  })

  it('keeps the wall clock across a change of daylight saving', () => {
    // Europe moved its clocks back on Sunday 25 October 2026.
    const before = new Date(2026, 9, 24, 12, 0)
    const sunday = occurrences([block({ days: [6], start: 9 * 60, end: 10 * 60 })], before)[0].start
    expect([sunday.getDate(), sunday.getHours(), sunday.getMinutes()]).toEqual([25, 9, 0])
  })

  it('finds the block under way, else the next one', () => {
    const week = [block({ subject: 'kanji', days: [2], start: 540, end: 660 }), block({ subject: 'reading', days: [2], start: 840, end: 900 })]
    expect(nextBlock(week, now)).toMatchObject({ now: true, block: week[0] })
    expect(nextBlock(week, new Date(2026, 9, 7, 12, 0))).toMatchObject({ now: false, block: week[1] })
    // After the day's last block it is next week's first.
    const after = nextBlock(week, new Date(2026, 9, 7, 16, 0))
    expect(after).toMatchObject({ now: false, block: week[0] })
    expect(after.start.getDate()).toBe(14)
    expect(nextBlock([], now)).toBeNull()
  })
})

describe('editing the list', () => {
  const a = block({ subject: 'kanji' })
  const b = block({ subject: 'reading', days: [5], start: 840, end: 960 })

  it('adds, replaces and drops without touching the original', () => {
    const week = [a]
    expect(withBlock(week, -1, b)).toEqual([a, b])
    expect(withBlock([a, b], 0, { ...a, subject: 'grammar' }).map(x => x.subject)).toEqual(['grammar', 'reading'])
    expect(withBlock([a, b], 0, null)).toEqual([b])
    expect(week).toEqual([a])
  })

  it('sends the server only the fields it holds', () => {
    expect(forServer([{ ...a, id: 7, extra: 'x' }])).toEqual([a])
  })
})

describe('the subjects', () => {
  it('are the server\'s eleven, each opening a place a notification may open', () => {
    expect(SUBJECTS).toHaveLength(11)
    for (const subject of SUBJECTS) expect(OPENABLE_PATHS.has(SUBJECT_PATH[subject])).toBe(true)
  })
})

describe('the week as drawn', () => {
  it('runs from the morning to midnight', () => {
    expect(axisFor([block()])).toEqual({ from: 360, to: 1440 })
    expect(axisFor([])).toEqual({ from: 360, to: 1440 })
  })

  it('reaches back to the mark before a block that starts earlier', () => {
    expect(axisFor([block({ start: 270, end: 330 })])).toEqual({ from: 180, to: 1440 })
    expect(axisFor([block({ start: 270, end: 330 })], 120)).toEqual({ from: 240, to: 1440 })
    expect(axisFor([block({ start: 0, end: 60 })])).toEqual({ from: 0, to: 1440 })
  })

  it('marks every step, both ends included', () => {
    expect(axisTicks({ from: 360, to: 1440 })).toEqual([360, 540, 720, 900, 1080, 1260, 1440])
    expect(axisTicks({ from: 360, to: 1440 }, 120)).toHaveLength(10)
  })

  it('says a length in hours and minutes', () => {
    expect(durationParts(120)).toEqual({ h: 2, m: 0 })
    expect(durationParts(90)).toEqual({ h: 1, m: 30 })
    expect(durationParts(45)).toEqual({ h: 0, m: 45 })
  })

  it('groups every subject once, the queue and the lines before the platforms', () => {
    expect([...SUBJECT_GROUPS.learn, ...SUBJECT_GROUPS.practice]).toEqual(SUBJECTS)
  })
})
