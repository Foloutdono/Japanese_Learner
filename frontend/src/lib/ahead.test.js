import { describe, it, expect } from 'vitest'
import {
  aheadInstants, aheadQuery, laneLine, localMidnight, minutesFor, planNudges, whenLabel, widgetPayload,
  NUDGE_IDS,
} from './ahead'
import en from '../locales/en/index.js'

// ── 発車案内 — the day ahead (plan 155) ────────────────────────
// What the notifications and the widget say is decided here, from the
// answer of GET /api/today/ahead. The rules: one a day at most, none on
// a day with nothing due, none today once the learner has ridden, and
// every figure the gate's own.

const t = en
const kanaSetLabel = (_t, deck) => `set:${deck}`
// A Sunday, 10:00 on the device's clock.
const NOW = new Date(2026, 8, 27, 10, 0)
const at = (day, h = 19, m = 0) => new Date(2026, 8, 27 + day, h, m)

const lane = (source, deck, count, extra = {}) => ({ kind: 'section', source, deck, mode: 'm', count, new: 0, ...extra })

function ahead(points, over = {}) {
  return { points, seconds_per_review: 10, rode_today: false, words: [], ...over }
}

describe('aheadInstants', () => {
  it('names the hour on each of the next seven days, today while it is ahead', () => {
    const got = aheadInstants({ hour: 19, minute: 0 }, NOW)
    expect(got).toHaveLength(7)
    expect(got[0]).toEqual(at(0))
    expect(got[6]).toEqual(at(6))
  })
  it('starts tomorrow once today’s hour has passed', () => {
    const got = aheadInstants({ hour: 7, minute: 30 }, NOW)
    expect(got).toHaveLength(7)
    expect(got[0]).toEqual(at(1, 7, 30))
  })
  it('skips an hour a minute away', () => {
    expect(aheadInstants({ hour: 10, minute: 0 }, new Date(2026, 8, 27, 9, 59, 30))[0]).toEqual(at(1, 10))
  })
})

describe('aheadQuery', () => {
  it('sends the instants and the device’s midnight as instants', () => {
    const q = new URLSearchParams(aheadQuery([at(0), at(1)], NOW, 'fr').split('?')[1])
    expect(q.get('at').split(',')).toEqual([at(0).toISOString(), at(1).toISOString()])
    expect(q.get('since')).toBe(localMidnight(NOW).toISOString())
    expect(q.get('lang')).toBe('fr')
  })
})

describe('minutesFor', () => {
  it('rounds to the minute, never below one, and says nothing without a pace', () => {
    expect(minutesFor(42, 10)).toBe(7)
    expect(minutesFor(2, 10)).toBe(1)
    expect(minutesFor(42, null)).toBeNull()
    expect(minutesFor(0, 10)).toBeNull()
  })
})

describe('laneLine', () => {
  it('names a line and level, a kana set, or the deck', () => {
    expect(laneLine(lane('vocab', 'N5', 3), t, kanaSetLabel)).toBe('Vocabulary N5')
    expect(laneLine(lane('kana', 'hiragana_basic', 3), t, kanaSetLabel)).toBe('set:hiragana_basic')
    expect(laneLine({ kind: 'personal', deck_name: 'Anime', count: 2 }, t, kanaSetLabel)).toBe('Anime')
  })
})

describe('planNudges', () => {
  const plan = (a, platform = 'android', now = NOW) =>
    planNudges({ ahead: a, time: '19:00', t, kanaSetLabel, now, platform })

  it('writes the train’s count, its minutes and its new cards', () => {
    const [n] = plan(ahead([{ at: at(0).toISOString(), total: 42, new: 3, lanes: [lane('vocab', 'N5', 30), lane('kanji', 'N5', 12)] }]))
    expect(n.id).toBe(NUDGE_IDS[0])
    expect(n.at).toEqual(at(0))
    expect(n.title).toBe('Your 19:00 train · 42 cards')
    expect(n.body).toBe('About 7 min · 3 new')
    expect(n.lines).toEqual(['Vocabulary N5 · 30', 'Kanji N5 · 12'])
    expect(n.extra).toEqual({ to: '/today' })
  })

  it('puts the lanes under the body on iOS, in the expanded list on Android', () => {
    const a = ahead([{ at: at(0).toISOString(), total: 5, new: 0, lanes: [lane('vocab', 'N5', 5)] }])
    expect(plan(a, 'ios')[0].body).toBe('About a minute\nVocabulary N5 · 5')
    expect(plan(a, 'android')[0].body).toBe('About a minute')
  })

  it('sends nothing on a day with nothing due', () => {
    const got = plan(ahead([
      { at: at(0).toISOString(), total: 0, new: 0, lanes: [] },
      { at: at(1).toISOString(), total: 4, new: 0, lanes: [] },
    ]))
    expect(got.map(n => n.at)).toEqual([at(1)])
    // Ids are handed out in order, so a skipped day leaves no hole.
    expect(got[0].id).toBe(NUDGE_IDS[0])
  })

  it('stays silent today once the learner has ridden, and not tomorrow', () => {
    const got = plan(ahead([
      { at: at(0).toISOString(), total: 12, new: 0, lanes: [] },
      { at: at(1).toISOString(), total: 30, new: 0, lanes: [] },
    ], { rode_today: true }))
    expect(got.map(n => n.at)).toEqual([at(1)])
  })

  it('falls back to the gate’s words before there is a pace', () => {
    const [n] = plan(ahead([{ at: at(1).toISOString(), total: 8, new: 0, lanes: [] }], { seconds_per_review: null }))
    expect(n.body).toBe(t.brdNotifText)
  })

  it('never schedules one that would fire while the app is open', () => {
    const now = new Date(2026, 8, 27, 18, 59, 30)
    expect(plan(ahead([{ at: at(0).toISOString(), total: 8, new: 0, lanes: [] }]), 'android', now)).toEqual([])
  })
})

describe('widgetPayload', () => {
  const today = { total: 24, seconds_per_review: 10, lanes: [
    { kind: 'section', source: 'vocab', due: 18, new: 2 },
    { kind: 'section', source: 'kanji', due: 4, new: 0 },
    { kind: 'section', source: 'grammar', due: 0, new: 0 },
  ] }
  const a = ahead([
    { at: at(1).toISOString(), total: 40, new: 5, lanes: [] },
    { at: at(2).toISOString(), total: 61, new: 5, lanes: [] },
  ], { words: [{ jp: '山', reading: 'やま', meaning: 'mountain', source: 'vocab' }] })

  it('counts now from the gate, then each day ahead from its midnight', () => {
    const w = widgetPayload({ today, ahead: a, t, now: NOW })
    expect(w.points).toEqual([
      { from: NOW.getTime(), total: 24, unit: 'cards', minutes: '4 min' },
      { from: localMidnight(at(1)).getTime(), total: 40, unit: 'cards', minutes: '7 min' },
      { from: localMidnight(at(2)).getTime(), total: 61, unit: 'cards', minutes: '10 min' },
    ])
  })

  it('carries the stripe’s lanes, the words and every label, in the learner’s language', () => {
    const w = widgetPayload({ today, ahead: a, t, now: NOW })
    expect(w.lanes).toEqual([{ line: 'vocab', n: 20 }, { line: 'kanji', n: 4 }])
    expect(w.words).toEqual([{ jp: '山', reading: 'やま', meaning: 'mountain' }])
    expect(w.labels).toEqual({ title: t.widgetTitle, clear: t.widgetClear, depart: t.depart })
  })

  it('still counts when the plan could not be fetched', () => {
    const w = widgetPayload({ today, ahead: null, t, now: NOW })
    expect(w.points).toEqual([{ from: NOW.getTime(), total: 24, unit: 'cards', minutes: '4 min' }])
    expect(w.words).toEqual([])
  })
})

describe('whenLabel', () => {
  it('says today, tomorrow, then the day of the week', () => {
    expect(whenLabel(at(0), NOW, t, 'en')).toBe('Today')
    expect(whenLabel(at(1, 7, 30), NOW, t, 'en')).toBe('Tomorrow')
    // 29 September 2026 is a Tuesday.
    expect(whenLabel(at(2), NOW, t, 'en')).toBe('Tuesday')
    expect(whenLabel(at(2), NOW, t, 'fr')).toBe('Mardi')
  })
})
