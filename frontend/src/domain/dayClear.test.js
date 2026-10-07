import { describe, it, expect } from 'vitest'
import {
  kanjiNumber, ticketName, ticketRoute, ticketNumber, clearTier, milestoneLadder,
  sealDate, ticketDate, weekdayKanji, daysBefore, verdictOf, cardFace, pileCounts, runMarks,
  levelBar, clearPaid, fareTotal, clearModel, restWeek,
} from './dayClear'
import {
  CARDS_32, RUN_DAY, CLEAR_DAY, CLEAR_TICKET7, CLEAR_MONTH30, RUN_MONTH30, REST_WEEK, TODAY,
} from '../components/dayclear/fixtures'

// ── 終着 — the day cleared, as facts (plan 191) ──────────────────────
describe('the ticket\'s names', () => {
  it('writes the days in kanji', () => {
    expect([1, 7, 10, 14, 30, 50, 100, 365, 400, 1200, 10000].map(kanjiNumber))
      .toEqual(['一', '七', '十', '十四', '三十', '五十', '百', '三百六十五', '四百', '千二百', '一万'])
  })

  it('names each ticket by the owner\'s list, else by its days', () => {
    expect([3, 7, 14, 30, 50, 100, 200, 365, 400, 500].map(ticketName))
      .toEqual(['三日', '七日', '十四日', '一ヶ月', '五十日', '百日', '二百日', '一年', '四百日', '五百日'])
    expect(ticketRoute(7)).toBe('辻 ⇄ 七日目')
    expect(ticketRoute(30)).toBe('辻 ⇄ 三十日目')
    expect(ticketNumber(7)).toBe('0007')
  })

  it('plays a ticket at 3, 7 and 14 and a month from 30', () => {
    expect([null, 3, 7, 14, 30, 50, 100, 365, 400].map(clearTier))
      .toEqual(['day', 'ticket', 'ticket', 'ticket', 'month', 'month', 'month', 'month', 'month'])
  })

  it('shows the ladder to a year, and every hundred after it once a year is behind', () => {
    expect(milestoneLadder(14)).toEqual([3, 7, 14, 30, 50, 100, 200, 365])
    expect(milestoneLadder(365)).toEqual([3, 7, 14, 30, 50, 100, 200, 365, 400])
    expect(milestoneLadder(420)).toEqual([3, 7, 14, 30, 50, 100, 200, 365, 400, 500])
  })
})

describe('the day\'s dates', () => {
  it('prints the seal\'s and the ticket\'s feet and the weekday, by the UTC day', () => {
    expect(sealDate(TODAY)).toBe('06·10·2026')
    expect(ticketDate(TODAY)).toBe('06.10.2026')
    expect(weekdayKanji(TODAY)).toBe('火')
    expect(daysBefore(TODAY, 6)).toBe('2026-09-30')
    expect(daysBefore('2026-09-25', 13)).toBe('2026-09-12')
    expect(daysBefore(TODAY, -1)).toBe('2026-10-07')
  })
})

describe('the run\'s cards', () => {
  it('reads a rating\'s verdict: < 3 wrong, 3–4 correct, 5 perfect', () => {
    expect([0, 1, 2, 3, 4, 5, undefined].map(verdictOf)).toEqual([0, 0, 0, 1, 1, 2, 0])
  })

  it('draws a served card\'s face from its kind, its lane and its climb', () => {
    const kanji = { card_id: 'kanji_N5_日', mode: 'kanji.flashcard.f2b', source: 'builtin_kanji', kanji: '日', kana: 'ひ', lane: { source: 'kanji', id: 'kanji:N5' } }
    expect(cardFace(kanji, { quality: 5, preview: { stage_up: 'learning' } }))
      .toEqual({ id: 'kanji_N5_日|kanji.flashcard.f2b', term: '日', kana: 'ひ', line: 'kanji', verdict: 2, up: true, mastered: false })
    const vocab = { card_id: 'v', mode: 'm', source: 'builtin_vocab', kanji: '電車', kana: 'でんしゃ', lane: { source: 'vocab' } }
    expect(cardFace(vocab, { quality: 4 })).toMatchObject({ term: '電車', kana: 'でんしゃ', line: 'vocab', verdict: 1, up: false })
    const grammar = { card_id: 'g', mode: 'm', source: 'builtin_grammar', grammar: '〜は', meaning: 'topic, the thing talked about', lane: { source: 'grammar' } }
    expect(cardFace(grammar, { quality: 1 })).toMatchObject({ term: '〜は', kana: 'topic', line: 'grammar', verdict: 0 })
    const kana = { card_id: 'k', mode: 'm', source: 'builtin_kana', kana: 'あ', romaji: 'a', lane: { source: 'kana' } }
    expect(cardFace(kana, { quality: 4, preview: { stage_up: 'mastered' } })).toMatchObject({ term: 'あ', kana: 'a', mastered: true, up: true })
    const mine = { card_id: 'c', mode: 'm', source: 'custom', structure: 'vocab', fields: { word: 'ねこ', meaning: 'cat' }, lane: { kind: 'personal' } }
    expect(cardFace(mine, { quality: 4 })).toMatchObject({ term: 'ねこ', kana: '', line: 'personal' })
  })

  it('counts the canvas\'s run: 6 · 18 · 8, four up and one mastered', () => {
    expect(pileCounts(CARDS_32)).toEqual([6, 18, 8])
    expect(runMarks(CARDS_32)).toEqual({ up: 4, mastered: 1 })
  })
})

describe('the fare and the level bar', () => {
  it('pays the bonus and the jackpot, never twice on a day already cleared', () => {
    expect(clearPaid(CLEAR_DAY)).toBe(55)
    expect(clearPaid(CLEAR_TICKET7)).toBe(310)
    expect(clearPaid({ ...CLEAR_DAY, already: true })).toBe(0)
    expect(clearPaid({ cleared: false })).toBe(0)
    expect(fareTotal(CLEAR_DAY, RUN_DAY)).toBe(252)
  })

  it('fills level 14 from 38 % to 64 % on the everyday fare', () => {
    const bar = levelBar(CLEAR_DAY.level, 252)
    expect(bar.level).toBe(14)
    expect(bar.next).toBe(15)
    expect(Math.round(bar.from * 100)).toBe(38)
    expect(Math.round(bar.to * 100)).toBe(64)
    expect(bar.crossed).toBe(false)
  })

  it('starts the bar at 0 when the fare crossed into the level', () => {
    const bar = levelBar(CLEAR_MONTH30.level, 1387)
    expect(bar).toMatchObject({ level: 15, from: 0, crossed: true })
  })
})

describe('the ceremony\'s model', () => {
  it('reads the everyday clear as the boards print it', () => {
    const m = clearModel(CLEAR_DAY, RUN_DAY)
    expect(m).toMatchObject({
      tier: 'day', streak: 6, milestone: null, ticket: null,
      seal: { day: '火', foot: '06·10·2026' },
      piles: [6, 18, 8], marks: { up: 4, mastered: 1 }, minutes: 11, count: 32,
      fare: { run: 197, bonus: 55, jackpot: 0, total: 252 },
      tomorrow: { cards: 18, minutes: 6 }, next: { milestone: 7, jackpot: 250 },
    })
    expect(m.week.map(d => d.kanji).join('')).toBe('水木金土日月火')
  })

  it('reads the month: a ticket of 30 days, +1 387', () => {
    const m = clearModel(CLEAR_MONTH30, RUN_MONTH30)
    expect(m).toMatchObject({ tier: 'month', ticket: { days: 30, date: '06.10.2026' }, fare: { total: 1387 } })
  })
})

describe('the rest-day notice\'s week', () => {
  it('lays the rest day over the missed one and waits on today', () => {
    const week = restWeek(
      ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map(date => ({ date, count: 12 })),
      ['2026-10-06'],
      '2026-10-07',
    )
    expect(week).toEqual(REST_WEEK)
  })

  it('draws a rest day the profile\'s week marks, already seen, as covered', () => {
    const profileWeek = [
      ...['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map(date => ({ date, count: 12 })),
      { date: '2026-10-06', count: 0, practice: 0, rest: true },
    ]
    expect(restWeek(profileWeek, [], '2026-10-07')).toEqual(REST_WEEK)
  })
})
