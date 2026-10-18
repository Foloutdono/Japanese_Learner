import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 号車 — a line's station on the short desk (plan 251) ─────────────
// At 1280×600 the cars cannot share the window's height and keep their
// faces: they stand at their floor and the page scrolls, the line whole
// over them. Each car keeps its face, its name and its record, and its
// description gives way, the face keeping the room.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({ points: [], learned: 0, started: 0, total: 0, totals: {} })),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
const SUMMARY = { level: 3, jlptLevel: 'N5', streak: 1 }
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => SUMMARY,
  useProfileSummaryState: () => ({ summary: SUMMARY, failed: false }),
}))
const STATS = {
  kanji: { N5: { 'kanji.flashcard.f2b': { total: 103, new: 63, learning: 31, mastered: 9, due_now: 7, reviews: 260, correct: 200 } } },
  items: { kanji: { N5: { total: 103, learned: 22, started: 40, score: 0.21 } } },
}
vi.mock('./stores/stats', () => ({ useStats: () => ({ data: STATS, failed: false }), refreshStats: vi.fn() }))
vi.mock('./stores/stationSamples', () => ({
  useStationSamples: (source, enabled = true) => (enabled
    ? { N5: { sample: ['日', '一'], card: { jp: '日', meaning: 'jour', reading: 'ニチ・ひ', radical: '日' } } }
    : null),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: KanjiScreen } = await import('./screens/KanjiScreen')
const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))
const rect = el => el.getBoundingClientRect()

describe('a line\'s station on the short desk (plan 251)', () => {
  it('stands the cars at their floor under the whole line, and lets the page scroll', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/kanji/N5']}>
          <div className="phone phone--desk">
            <div className="phone__content"><Routes><Route path="/learn/kanji/:level" element={<KanjiScreen session={null} />} /></Routes></div>
          </div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const cars = [...document.querySelectorAll('.desk-platforms > .platform-grid .platform-card')]
    expect(cars).toHaveLength(5)
    for (const c of cars) expect(rect(c).height).toBeGreaterThanOrEqual(5 * 52 - 1)
    expect(document.documentElement.scrollHeight).toBeGreaterThan(window.innerHeight)
    // The line whole, its names kept.
    expect(document.querySelectorAll('.desk-station__line .route-stop')).toHaveLength(5)
    expect(getComputedStyle(document.querySelector('.desk-station__line .route-stop__jp')).display).not.toBe('none')
    for (const car of cars) {
      expect(getComputedStyle(car.querySelector('.platform-card__desc')).display).toBe('none')
      expect(car.querySelector('.desk-spec__face')).not.toBeNull()
      expect(rect(car.querySelector('.platform-card__title')).height).toBeGreaterThan(0)
    }
    expect(cars[0].querySelector('.desk-mode-fig__due').textContent).toBe('7 à réviser')
  })
})
