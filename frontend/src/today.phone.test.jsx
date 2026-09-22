import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — Today and the dictionary stay the phone's below the desk (plan 113) ──
// The desk stands the pass strip and the pass's back beside the fare
// gate, and keeps the dictionary's dock open with no ✕. At 390 the strip
// still heads the gate, nothing stands beside it, and the dictionary's
// entry is a sheet that is opened by a tap and closed by its ✕.

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
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 0, by_source: {}, lanes: [], next_due: null, pace: { target: 10, newToday: 4 } }, failed: false }),
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

const { default: TodayScreen } = await import('./screens/TodayScreen')
const { default: DictionaryScreen } = await import('./screens/DictionaryScreen')

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))

describe('Today below the desk', () => {
  it('heads the gate with the strip and stands nothing beside it', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/today']}><TodayScreen session={{}} /></MemoryRouter>
      </LangProvider>
    )
    await settle()
    const main = document.querySelector('main.today')
    expect(main.querySelector(':scope > .pass--strip')).not.toBeNull()
    expect(document.querySelector('.desk-side, .desk-journey')).toBeNull()
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
