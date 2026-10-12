import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — Today and the dictionary stay the phone's below the desk (plan 114) ──
// The desk stands a column beside the dial (plan 199), and keeps the
// dictionary's dock open with no ✕. At 390 the dial stands alone, what
// the column holds is the services sheet's, and the dictionary's entry
// is a sheet that is opened by a tap and closed by its ✕.

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => ({
    ok: true, status: 200,
    json: async () => (String(path).startsWith('/api/dictionary?')
      ? { results: [{ type: 'kanji', kanji: '駅', kana: 'エキ', meaning: 'station', level: 'N5', status: { status: 'new' } }], total: 1, has_more: false }
      : { groups: [] }),
  })),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
const EMPTY = { total: 0, by_source: {}, lanes: [], next_due: null, pace: { target: 10, newToday: 4 } }
const todayRef = vi.hoisted(() => ({ current: null }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: todayRef.current, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: { goalLevel: 'N4', goalTargetDate: '2027-03-14', goalSetAt: '2026-09-01T00:00:00Z', plannedPerDay: 10, itemsTotal: 100, itemsDone: 10, actual14: 70, days14: 14 }, failed: false }),
  useVolumes: () => ({ data: null }),
  refreshJourney: vi.fn(), seedJourneyStatus: vi.fn(), openStatus: vi.fn(),
}))
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => ({ level: 12, jlptLevel: 'N5', streak: 3, week: [], guided: { today: true } }),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

// 時間割 (plan 181): an empty week unless a test fills it, so the day
// stands as it did for every test that is not about the agenda.
const agenda = vi.hoisted(() => ({ blocks: [] }))
vi.mock('./stores/agenda', () => ({ useAgenda: () => ({ blocks: agenda.blocks, failed: false }), saveAgenda: vi.fn() }))
const WEEK = [
  { id: 1, subject: 'kanji', days: [0, 1, 2, 3, 4], start: 540, end: 660, notify: true, lead: 10 },
  { id: 2, subject: 'dictation', days: [2], start: 780, end: 840, notify: true, lead: 15 },
  { id: 3, subject: 'reading', days: [5], start: 840, end: 960, notify: false, lead: 0 },
]
const { default: TodayScreen } = await import('./screens/TodayScreen')
const { default: DictionaryScreen } = await import('./screens/DictionaryScreen')

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))

describe('Today below the desk', () => {
  beforeEach(() => { todayRef.current = EMPTY })

  it('stands the dial alone, and nothing beside it', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/today']}><TodayScreen session={{}} /></MemoryRouter>
      </LangProvider>
    )
    await settle()
    const main = document.querySelector('main.today')
    expect(main.querySelector(':scope > .tdy')).not.toBeNull()
    expect(document.querySelector('.tdy-desk, .desk-side, .desk-journey, .pass--strip')).toBeNull()
    // No agenda, no block.
    expect(document.querySelector('.agd-now, .tdy-day__cell--door')).toBeNull()
  })

  it('says what is next on the agenda in the day\'s figures, a door to the agenda', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 7, 10, 0))
    agenda.blocks = WEEK
    todayRef.current = { ...EMPTY, total: 12, lanes: [{ id: 'vocab:N5:vocab.flashcard.f2b', kind: 'section', source: 'vocab', deck: 'N5', mode: 'vocab.flashcard.f2b', due: 12 }] }
    try {
      await render(
        <LangProvider>
          <MemoryRouter initialEntries={['/today']}><TodayScreen session={{}} /></MemoryRouter>
        </LangProvider>
      )
      await settle()
      // Not on the screen: the room is the dial's.
      expect(document.querySelector('main.today .tdy-day, .agd-now')).toBeNull()
      document.querySelector('.tdy-door').click()
      await settle()
      const cell = document.querySelector('.tdy-sheet .tdy-day__cell--door')
      expect(cell.querySelector('.tdy-day__fig').textContent).toBe('En cours')
      expect(cell.querySelector('.tdy-day__what').textContent).toBe('Kanji')
      expect(cell.getAttribute('href')).toBe('/profile/settings/agenda')
      // A thumb's door, and nothing wider than the phone.
      expect(Math.round(cell.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    } finally {
      agenda.blocks = []
      vi.useRealTimers()
    }
  })
})

describe('the dictionary below the desk', () => {
  it('opens no entry until one is tapped, and the entry closes', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/dictionary']}>
          <Routes><Route path="/dictionary" element={<DictionaryScreen session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    expect(document.querySelector('.dict-dock')).toBeNull()
    document.querySelector('.dict-entry-card').click()
    await settle()
    const dock = document.querySelector('.dict-dock')
    expect(dock).not.toBeNull()
    expect(dock.querySelector('.dict-entry__close')).not.toBeNull()
  })
})
