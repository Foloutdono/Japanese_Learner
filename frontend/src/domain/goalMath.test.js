import { describe, it, expect } from 'vitest'
import {
  DAYS_PER_MONTH,
  addDays,
  arrivalsFor,
  callingAt,
  journeyIncludesKana,
  journeyItems,
  journeyLevels,
  journeyModel,
  minutesFor,
  requiredPerDay,
} from './goalMath'

// Same pinned volumes as journeyProjection.test.js — deliberately not
// imported from anywhere, so a math regression can't hide behind a
// content change. Level items: N5 841 · N4 871 · N3 2270 · N2 2234 ·
// N1 4779; kana 224.
const VOLUMES = {
  vocab: { N5: 667, N4: 634, N3: 1832, N2: 1796, N1: 3476 },
  kanji: { N5: 103, N4: 166, N3: 367, N2: 367, N1: 1232 },
  grammar: { N5: 71, N4: 71, N3: 71, N2: 71, N1: 71 },
  kana: 224,
}

// A fixed clock (UTC midnight) so every projected date is exact.
const NOW = new Date('2026-09-02T00:00:00Z')
const iso = d => d.toISOString().slice(0, 10)

describe('journeyLevels / journeyItems', () => {
  it('runs boarding level to destination, inclusive', () => {
    expect(journeyLevels('N5', 'N3')).toEqual(['N5', 'N4', 'N3'])
    expect(journeyLevels('N4', 'N4')).toEqual(['N4'])
  })

  it('runs to the terminus when there is no destination', () => {
    expect(journeyLevels('N2')).toEqual(['N2', 'N1'])
  })

  it('prices the journey with kana exactly when the line starts at N5', () => {
    // The rule routes/journey.py applies to itemsTotal AND itemsDone —
    // both sides or neither (plan 063, open question 2).
    expect(journeyIncludesKana('N5')).toBe(true)
    expect(journeyIncludesKana('N4')).toBe(false)
    expect(journeyItems(VOLUMES, 'N5', 'N4')).toBe(224 + 841 + 871)
    expect(journeyItems(VOLUMES, 'N4', 'N3')).toBe(871 + 2270)
    expect(journeyItems(VOLUMES, 'N2')).toBe(2234 + 4779)
  })
})

describe('requiredPerDay', () => {
  it('prices N5→N3 in three months at 47 a day — the refusal case', () => {
    // The plan's worked example: 47 is past the ladder's fastest (25),
    // so the board answers 運休, not a quietly rounded-down number.
    const items = journeyItems(VOLUMES, 'N5', 'N3') // 4,206
    expect(requiredPerDay(items, 3 * DAYS_PER_MONTH)).toBe(47)
  })

  it('never rounds ambition down', () => {
    expect(requiredPerDay(100, 33)).toBe(4) // 3.03…
    expect(requiredPerDay(99, 33)).toBe(3)
  })
})

describe('minutesFor', () => {
  it('keeps the mockup ladder: 5→10, 10→20, 15→30, 20→35, 25→45', () => {
    expect([5, 10, 15, 20, 25].map(minutesFor)).toEqual([10, 20, 30, 35, 45])
  })

  it('floors at five minutes', () => {
    expect(minutesFor(1)).toBe(5)
  })
})

describe('arrivalsFor / callingAt', () => {
  it('prices each service of a ladder', () => {
    const rows = arrivalsFor(1000, [5, 10], NOW)
    expect(rows[0]).toMatchObject({ perDay: 5, days: 200 })
    expect(iso(rows[0].date)).toBe(iso(addDays(NOW, 200)))
    expect(rows[1].days).toBe(100)
  })

  it('lists every stop with its cumulative load and date', () => {
    const stops = callingAt(VOLUMES, 'N5', 'N4', 10, { now: NOW })
    expect(stops.map(s => s.level)).toEqual(['N5', 'N4'])
    expect(stops[0].items).toBe(224 + 841) // kana rides in front
    expect(stops[1].items).toBe(224 + 841 + 871)
    expect(stops[1].days).toBeCloseTo(193.6, 5)
    expect(iso(stops[1].date)).toBe(iso(addDays(NOW, 193.6)))
  })
})

// ── journeyModel — the ghost train's judgement ───────────────────
// One contract for most cases: 1,000 items, 10 a day, signed 56 days
// ago, printed date 44 days ahead. Only the last-14-days rhythm moves.
const CONTRACT = {
  goalLevel: 'N3',
  goalTargetDate: '2026-10-16', // NOW + 44 days
  goalSetAt: '2026-07-08T00:00:00Z', // NOW − 56 days
  plannedPerDay: 10,
  itemsTotal: 1000,
  days14: 14,
}

describe('journeyModel with a dated goal', () => {
  it('reports delayed with the honest recovery pace', () => {
    const m = journeyModel({ ...CONTRACT, itemsDone: 112, actual14: 28 }, NOW)
    expect(m.actualPerDay).toBe(2)
    expect(m.remaining).toBe(888)
    expect(iso(m.projected)).toBe(iso(addDays(NOW, 444)))
    expect(m.deltaDays).toBe(400)
    expect(m.daysToPlanned).toBe(44)
    expect(m.recovery).toBe(21) // ceil(888 / 44) — still a real service
    expect(m.status).toBe('delayed')
  })

  it('holds onTime when the rhythm matches the promise', () => {
    const m = journeyModel({ ...CONTRACT, itemsDone: 560, actual14: 140 }, NOW)
    expect(m.deltaDays).toBe(0)
    expect(m.status).toBe('onTime')
  })

  it('reports ahead past three days early', () => {
    const m = journeyModel({ ...CONTRACT, itemsDone: 784, actual14: 196 }, NOW)
    expect(m.deltaDays).toBe(-29)
    expect(m.status).toBe('ahead')
  })

  it('reports slightlyBehind inside the three-week amber band', () => {
    const m = journeyModel({ ...CONTRACT, itemsDone: 504, actual14: 126 }, NOW)
    expect(m.deltaDays).toBe(11)
    expect(m.status).toBe('slightlyBehind')
  })

  it('suspends on fourteen silent days but still knows the recovery', () => {
    const m = journeyModel({ ...CONTRACT, itemsDone: 112, actual14: 0 }, NOW)
    expect(m.projected).toBeNull()
    expect(m.deltaDays).toBeNull()
    expect(m.status).toBe('suspended')
    expect(m.recovery).toBe(21) // 運転再開 needs the number ready
  })

  it('draws the thresholds exactly where the mockup drew them', () => {
    // planned = NOW + 40; one item a day makes projected = NOW + remaining.
    const base = {
      goalLevel: 'N3', goalTargetDate: '2026-10-12',
      goalSetAt: '2026-07-08T00:00:00Z',
      plannedPerDay: 10, itemsTotal: 100, actual14: 14, days14: 14,
    }
    const at = remaining =>
      journeyModel({ ...base, itemsDone: 100 - remaining }, NOW).status
    expect(at(37)).toBe('ahead') // −3: the ahead line is inclusive
    expect(at(38)).toBe('onTime') // −2
    expect(at(42)).toBe('onTime') // +2
    expect(at(43)).toBe('slightlyBehind') // +3
    expect(at(61)).toBe('slightlyBehind') // +21
    expect(at(62)).toBe('delayed') // +22
  })

  it('lets the recovery pace exceed the ladder — the caller offers the date move instead', () => {
    // 12 days of runway for 888 items: 74/day is the true number, and
    // the domain reports it truly; gating against MAX_PACE is the
    // component's job (paces.js owns the ladder).
    const m = journeyModel({
      ...CONTRACT,
      goalTargetDate: iso(addDays(NOW, 12)),
      itemsDone: 112,
      actual14: 28,
    }, NOW)
    expect(m.recovery).toBe(74)
  })
})

describe('journeyModel edge contracts', () => {
  it('falls back to the signing arithmetic when the goal has no printed date', () => {
    // A by-pace goal: the promise is still goalSetAt + total/pace.
    const m = journeyModel({
      ...CONTRACT, goalTargetDate: null, itemsDone: 112, actual14: 28,
    }, NOW)
    // setAt + 1000/10 days = NOW − 56 + 100 = NOW + 44 — same date the
    // printed contract carries, by construction.
    expect(iso(m.planned)).toBe('2026-10-16')
    expect(m.deltaDays).toBe(400)
  })

  it('judges a goal-less pass on pace kept, not on an arrival', () => {
    const open = { plannedPerDay: 10, itemsTotal: 7013, itemsDone: 500, days14: 14 }
    expect(journeyModel({ ...open, actual14: 140 }, NOW)).toMatchObject({
      hasGoal: false, planned: null, deltaDays: null, recovery: null, status: 'onTime',
    })
    expect(journeyModel({ ...open, actual14: 98 }, NOW).status).toBe('slightlyBehind') // exactly 70%
    expect(journeyModel({ ...open, actual14: 97 }, NOW).status).toBe('delayed')
    expect(journeyModel({ ...open, actual14: 0 }, NOW).status).toBe('suspended')
  })

  it('judges nothing when there is no contract at all', () => {
    const m = journeyModel({
      goalLevel: null, goalTargetDate: null, goalSetAt: null,
      plannedPerDay: null, itemsTotal: 0, itemsDone: 0, actual14: 0, days14: 14,
    }, NOW)
    expect(m.status).toBeNull()
    expect(m.hasGoal).toBe(false)
    expect(m.planned).toBeNull()
  })
})
