import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 引き上げ — the line's sheet, at 390px (plan 291) ──────────────
// The gate and the sheet themselves are LearnScreen.browser.test.jsx's;
// this pins the keyboard's way into the sheet on the phone. Its strip
// of roundels is one tab stop, the page in view's (hooks/useSheetPager),
// and the others are buttons at tabindex -1: the sheet's first focus
// lands on the line that was tapped, not on the strip's first roundel,
// and the trap wraps over that roundel and the page in view alone.

const apiJson = vi.fn()
const apiFetch = vi.fn()
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/cachedJson', async (importOriginal) => ({
  ...(await importOriginal()),
  cachedJson: (...a) => apiJson(...a),
}))
vi.mock('../stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 0, by_source: {}, lanes: [], next_due: null, pace: null }, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
vi.mock('../stores/stats', () => ({
  useStats: () => ({
    data: {
      vocab: {}, kana: {}, kanji: {}, grammar: {},
      items: { vocab: { N5: { total: 10, learned: 10, score: 1 }, N4: { total: 10, learned: 4, score: 0.5 } }, kana: {}, kanji: {}, grammar: {} },
    },
    failed: false,
  }),
  refreshStats: vi.fn(),
  seedStats: vi.fn(),
}))
vi.mock('../stores/basics', () => ({
  useBasics: () => ({ data: null, failed: false }),
  refreshBasics: vi.fn(),
}))
vi.mock('../lib/audio', async (importOriginal) => ({ ...(await importOriginal()), playAnnouncement: vi.fn() }))
vi.mock('../stores/departure', () => ({ beginDeparture: vi.fn() }))
vi.mock('../stores/boarding', () => ({ board: commit => commit() }))
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: LearnScreen } = await import('./LearnScreen')
const { seedSummary } = await import('../stores/profileSummary')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
const sheet = () => document.body.querySelector('.lrn-sheet')
const page = () => sheet().querySelector('.lrn-page:not([inert])')

beforeEach(() => {
  seedSummary({ username: 'Tester', level: 1, xp: 0, xpPrevLevel: 0, xpForNext: 100, jlptLevel: 'N4' })
  apiJson.mockImplementation(async () => ({}))
  apiFetch.mockImplementation(async path => {
    if (path === '/api/profile/modes') return { ok: true, status: 200, json: async () => ({ main: { vocab: 'vocab.flashcard.b2f' } }) }
    return { ok: true, status: 200, json: async () => ({}) }
  })
})

describe('the line\'s sheet at phone width (plan 291)', () => {
  it('opens with the focus on the page in view\'s roundel, and keeps Tab to it and its page', async () => {
    const screen = await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn']}>
          <div className="phone">
            <div className="phone__content">
              <Routes>
                <Route path="/learn" element={<LearnScreen session={{ access_token: 'tok' }} />} />
              </Routes>
            </div>
          </div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    // Not the first line: the strip's first roundel is kana's.
    screen.container.querySelectorAll('.plate--line .plate__head')[1].click()
    await vi.waitFor(() => expect(sheet()).toBeTruthy())
    await settle(300)
    expect(page().getAttribute('aria-label')).toBe('Vocabulaire JLPT')
    const stop = sheet().querySelector('.prc-sheet__stop[aria-current]')
    expect(stop.getAttribute('aria-label')).toBe('Vocabulaire JLPT')
    expect(stop).not.toBe(sheet().querySelector('.prc-sheet__stop'))
    expect(document.activeElement).toBe(stop)
    // The trap's stops are that roundel and the page in view's controls,
    // the inert pages' none of them: Tab past Embarquer comes back to
    // the roundel, and Shift+Tab from it goes back to Embarquer.
    const go = page().querySelector('.prc-page__go')
    go.focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(stop)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(go)
  })
})
