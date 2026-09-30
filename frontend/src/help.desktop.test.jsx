import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — Help on the rail (the owner's ask, 2026-09-30) ─────────────
// A pill of ? and its word at the masthead's end plays the lit gate's guide again on
// demand, whatever its stamp says: in place on the gate's own screen,
// after walking to the gate from a station behind it, and from the "?"
// key -- never from a field. The profile here has seen every guide, so
// nothing opens by itself.

const apiJson = vi.fn(async () => ({}))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: 'u1' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  },
}))
const GUIDED = { today: true, learn: true, practice: true, dictionary: true, profile: true }
vi.mock('./stores/profileSummary', async (o) => ({ ...(await o()),
  useProfileSummary: () => ({ level: 12, xp: 1200, xpPrevLevel: 1000, xpForNext: 1500, username: 'Aiko', streak: 3, guided: GUIDED }),
  useProfileSummaryState: () => ({ summary: null, failed: false }),
  refreshSummary: vi.fn(),
}))
vi.mock('./stores/journey', () => ({
  useJourneyStatus: () => ({ data: null, failed: false }),
  refreshJourney: vi.fn(),
  seedJourneyStatus: vi.fn(),
  openStatus: vi.fn(),
}))
vi.mock('./stores/credits', async (o) => ({ ...(await o()),
  useCredits: () => null,
  openBalance: vi.fn(),
}))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 0, by_source: {}, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
vi.mock('./lib/track', () => ({ track: vi.fn(), flush: vi.fn() }))
vi.mock('./lib/audio', async (o) => ({ ...(await o()), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { Shell } = await import('./components/chrome/Shell')
const { Guide } = await import('./components/guide/Guide')
const { useGuide } = await import('./hooks/useGuide')
const { default: fr } = await import('./locales/fr/index.js')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const help = () => document.querySelector('.desk-rail__help')
const note = () => document.querySelector('.guide-callout--live')
const where = () => document.querySelector('[data-testid="where"]').textContent

// The Learn gate's screen, reduced to what its guide points at.
function LearnGate() {
  const guide = useGuide('learn', true)
  return (
    <main id="main-content">
      <div className="plate" data-guide="learn.plate" style={{ height: 120 }} />
      {guide.open && <Guide gate="learn" onEnd={guide.onEnd} />}
    </main>
  )
}

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>
}

function mount(path) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route element={<Shell />}>
            <Route path="/learn" element={<LearnGate />} />
            <Route path="/learn/vocab" element={<main id="main-content"><input aria-label="field" /></main>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => { apiJson.mockClear() })

describe('Help on the rail', () => {
  it("stands at the masthead's end, naming the lit gate's tour", async () => {
    await mount('/learn')
    await settle()
    const btn = help()
    expect(btn).toBeTruthy()
    expect(btn.closest('.desk-rail__head').querySelector('.desk-rail__mast')).toBeTruthy()
    const gate = document.querySelector('[data-tab="learn"] .desk-gate__label').textContent
    expect(btn.getAttribute('aria-label')).toBe(`${fr.guideHelp} — ${fr.guideHelpTour(gate)}`)
    expect(btn.getAttribute('aria-keyshortcuts')).toBe('?')
    // A pill: the ? in its roundel, then the word, printed whole --
    // the accessible name opens with the word the learner reads.
    const mark = btn.querySelector('.desk-rail__help-mark')
    const label = btn.querySelector('.desk-rail__help-label')
    expect(mark.textContent).toBe('?')
    expect(label.textContent).toBe(fr.guideHelp)
    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth)
    const m = mark.getBoundingClientRect()
    expect(Math.round(m.width)).toBe(Math.round(m.height))
    expect(m.right).toBeLessThanOrEqual(label.getBoundingClientRect().left)
    // Inside the rail, its right edge on the pass's below, and clear of
    // the masthead's name.
    const r = btn.getBoundingClientRect()
    const pass = document.querySelector('.desk-pass').getBoundingClientRect()
    expect(r.right).toBeCloseTo(pass.right, 0)
    expect(r.left).toBeGreaterThan(document.querySelector('.desk-rail__name').getBoundingClientRect().right)
    // A stamped gate opens nothing by itself.
    expect(note()).toBeNull()
  })

  it("plays the gate's guide again in place, and posts no second stamp", async () => {
    await mount('/learn')
    await settle()
    help().click()
    await settle(400)
    expect(note()).toBeTruthy()
    expect(note().querySelector('.guide-callout__text').textContent).toBe(fr.guideLearnPlateDesk)
    expect(where()).toBe('/learn')
    note().querySelector('[data-action="guide-next"]').click()
    await settle()
    expect(note()).toBeNull()
    expect(apiJson).not.toHaveBeenCalled()
  })

  it('walks to the gate from a station behind it, and plays it there', async () => {
    await mount('/learn/vocab')
    await settle()
    help().click()
    await settle(400)
    expect(where()).toBe('/learn')
    expect(note()).toBeTruthy()
  })

  it('answers "?", but never from a field', async () => {
    await mount('/learn/vocab')
    await settle()
    const field = document.querySelector('input')
    field.focus()
    field.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    await settle()
    expect(where()).toBe('/learn/vocab')
    field.blur()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
    await settle(400)
    expect(where()).toBe('/learn')
    expect(note()).toBeTruthy()
  })
})
