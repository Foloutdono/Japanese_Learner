import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — a line's split on the narrowest desk (plan 136) ─────────────
// At 1100px the page beside the stops is under 720px, and a well
// beside a description and the figures would squeeze the description
// to a word a line. LinePlatforms measures its box and draws no wells
// there; the rest of the filled split holds (lineSplit.wide is the
// full one).

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({ points: [], learned: 0, started: 0, total: 91, totals: {} })),
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
  vocab: { N5: { 'vocab.flashcard.f2b': { total: 674, new: 643, learning: 31, mastered: 0, due_now: 3, reviews: 90, correct: 70 } } },
  items: { vocab: { N5: { total: 674, learned: 0, started: 31, score: 0 } } },
}
vi.mock('./stores/stats', () => ({ useStats: () => ({ data: STATS, failed: false }), refreshStats: vi.fn() }))
vi.mock('./stores/stationSamples', () => ({
  useStationSamples: (source, enabled = true) => (enabled ? { N5: { sample: ['何', '私'], card: { jp: '何', reading: 'なん', meaning: 'quoi' } } } : null),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: VocabScreen } = await import('./screens/VocabScreen')
const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))

describe('a line\'s split at 1100px (plan 136)', () => {
  it('draws no wells, and keeps each description at a readable measure', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/vocab/N5']}>
          <div className="phone phone--desk">
            <div className="phone__content"><Routes><Route path="/learn/vocab/:level" element={<VocabScreen session={null} />} /></Routes></div>
          </div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    expect(document.querySelector('.desk-platforms').getBoundingClientRect().width).toBeLessThan(720)
    expect(document.querySelector('.desk-spec')).toBeNull()
    const card = document.querySelector('.desk-platforms > .platform-grid .platform-card')
    expect(card.querySelector('.platform-card__body').getBoundingClientRect().width).toBeGreaterThan(200)
    // The rest of the split holds: the stops' samples and bars, the
    // figures, the foot.
    expect(document.querySelector('.desk-stop__sample').textContent).toBe('何 私')
    expect(document.querySelector('.desk-stop__bar')).not.toBeNull()
    expect(card.querySelector('.desk-mode-fig__due').textContent).toMatch(/^3/)
    expect(card.querySelector('.desk-mode-fig__now')).toBeNull()
    expect(document.querySelector('.desk-split__foot .platform-card__title').textContent).toBe('Révision rapide')
  })
})
