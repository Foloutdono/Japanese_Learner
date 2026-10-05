import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import tours from './testing/grammarTour.json'
import './index.css'

// ── 発見 on the short desk (plans 187f, 169) ─────────────────────
// At 1280×600, a laptop's window less its browser: the tour's stops
// stand whole in the left panel, the plate's three lines in the right
// once they are open, and the gate in the window at every stop -- the
// stop scrolls under it, nothing is cut. Fixture and mocks as in
// tour.desktop.

vi.mock('./lib/audio', async o => ({
  ...(await o()), playKana: vi.fn(), playClick: vi.fn(), playUi: vi.fn(), speakJapanese: vi.fn(),
  speakLine: vi.fn(async () => true), stopSpeaking: vi.fn(),
}))
vi.mock('./stores/credits', async o => ({
  ...(await o()),
  useCredits: () => ({ balance: 24, cap: 50, dailyRefill: 30, nextCreditAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 1, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
vi.mock('./lib/reviews', () => ({ postReview: vi.fn(async () => ({})), staleCards: vi.fn(async () => []) }))
const apiJson = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ total: 1, new: 1, learning: 0, mastered: 0, due_now: 0 }) })),
  apiJson,
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error { constructor(status) { super(); this.status = status } },
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayRun } = await import('./screens/TodayRun')

const KA = tours.ka
const LANE = { id: 's~grammar~N5~grammar.ladder', kind: 'section', source: 'grammar', deck: 'N5', mode: 'grammar.ladder' }
const CARD = {
  card_id: 'grammar_N5_か', raw_id: 'grammar_N5_か', mode: 'grammar.ladder', exercise: 'grammar.flashcard.f2b', rung: 0,
  direction: 'f2b', grammar: 'か', structure: 'sentence + か', meaning: 'question marker', stage: 'new',
  review_preview: null, hints: {}, source: 'grammar', lane: LANE,
  lesson: { register: 'polite', steps: [{ kind: 'rule', text: KA.rule }], compare: [], examples: KA.look, tour: KA },
}

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
const stop = () => $('.desk-run .tour--desk').dataset.stop

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('lang', 'en')
  apiJson.mockReset()
  let batch = 0
  apiJson.mockImplementation(async url => {
    if (!String(url).startsWith('/api/today/cards')) return {}
    batch += 1
    return { cards: batch === 1 ? [CARD] : [] }
  })
})
afterEach(() => { localStorage.removeItem('lang') })

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/today/run']}>
        <Routes>
          <Route path="/today" element={<div className="gate-probe">gate</div>} />
          <Route path="/today/run" element={<TodayRun session={{ access_token: 'tok' }} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('the tour on the short desk', () => {
  it('keeps the stops, the plate and the gate inside the window', async () => {
    await mount()
    await settle(400)
    const within = el => {
      const box = el.getBoundingClientRect()
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.bottom).toBeLessThanOrEqual(window.innerHeight)
    }
    const gate = () => $('.tour--desk .tour__foot .btn-depart')
    within($$('.tour-route__stop').at(-1))
    within(gate())

    key('Enter')
    await settle()
    key(String(KA.guesses.findIndex(g => g.correct) + 1))
    await settle()
    key('Enter')
    await settle()
    within(gate())
    key('Enter')
    await settle()
    key(String(KA.twist.choices.findIndex(c => c.correct) + 1))
    await settle()
    key('Enter')
    await settle()
    expect(stop()).toBe('twist')
    within(gate())
    // Every line of the plate open, and the last one in the window.
    expect($$('.tour-ledger__line--sealed')).toHaveLength(0)
    within($$('.tour-ledger__line').at(-1))
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)

    key('Enter')
    await settle()
    expect(stop()).toBe('scene')
    within(gate())
  }, 20000)
})
