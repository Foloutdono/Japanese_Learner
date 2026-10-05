import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import ladder from './testing/grammarLadder.json'
import './index.css'

// ── 梯子 on a phone, in the day's queue (plan 187e) ─────────────
// A grammar card on the ladder comes in the exercise its rung asks: the
// strip over it names the rung, the build's pieces and gaps stand inside
// a 390px screen and are a thumb's targets, the write's field and Check
// fit beside each other, and the run's own bar rates the card under the
// ladder's key once it is answered.

const apiJson = vi.fn()
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 1, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
vi.mock('./stores/credits', async (o) => ({
  ...(await o()),
  useCredits: () => ({ balance: 24, cap: 50, dailyRefill: 30, nextCreditAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('./lib/audio', async (o) => ({
  ...(await o()), playKana: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(),
  playClick: vi.fn(), playUi: vi.fn(), playSfx: vi.fn(), speakJapanese: vi.fn(),
  speakLine: vi.fn(async () => true), stopSpeaking: vi.fn(),
}))
const postReview = vi.fn(async () => ({}))
vi.mock('./lib/reviews', () => ({ postReview: (...a) => postReview(...a), staleCards: vi.fn(async () => []) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayRun } = await import('./screens/TodayRun')

const LANE = { id: 's~grammar~N5~grammar.ladder', kind: 'section', source: 'grammar', deck: 'N5', mode: 'grammar.ladder' }
const card = over => ({ ...over, source: 'grammar', lane: LANE, stage: 'learning', lesson: null })
const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))

async function mount(cards) {
  let batch = 0
  apiJson.mockImplementation(async (url) => {
    if (String(url).startsWith('/api/today/cards')) {
      batch += 1
      return { cards: batch === 1 ? cards : [] }
    }
    if (url === '/api/composition/check') return { found: true, japanese: null }
    return {}
  })
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

function inside(el) {
  const box = el.getBoundingClientRect()
  expect(box.left).toBeGreaterThanOrEqual(0)
  expect(box.right).toBeLessThanOrEqual(window.innerWidth)
}

beforeEach(() => {
  document.documentElement.dataset.chrome = 'stage'
  apiJson.mockReset()
  postReview.mockClear()
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('lang', 'en')
})
afterEach(() => {
  localStorage.removeItem('lang')
  delete document.documentElement.dataset.chrome
})

describe('the ladder in the day’s queue, on a phone', () => {
  it('builds inside the screen, then rates under the ladder’s key', async () => {
    const screen = await mount([card(ladder.build)])
    await settle()
    const root = screen.container
    expect(root.querySelector('.lad-strip__rung--here').textContent).toBe('Build')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    for (const el of root.querySelectorAll('.bld-piece, .bld-slot, .lad-strip')) inside(el)
    for (const el of root.querySelectorAll('.bld-piece, .bld-slot')) {
      expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
    // No rating before the answer: the bar stands idle.
    expect(root.querySelector('.rating-bar').getAttribute('aria-hidden')).toBe('true')

    const B = ladder.build.build
    for (const id of B.answer) {
      root.querySelector(`[data-piece="${id}"]`).click()
      await settle(120)
    }
    expect(root.querySelector('.bld-said--ok')).toBeTruthy()
    expect(root.querySelector('.rating-bar').getAttribute('aria-hidden')).toBe('false')
    root.querySelector('.rating-bar button').click()
    await settle()
    const sent = postReview.mock.calls.find(c => c[0] === '/api/today/review')
    expect(sent[2].mode).toBe('grammar.ladder')
    expect(sent[2].card_id).toBe(ladder.build.card_id)
  }, 20000)

  it('writes inside the screen', async () => {
    const screen = await mount([card(ladder.write)])
    await settle()
    const root = screen.container
    expect(root.querySelector('.lad-strip__rung--here').textContent).toBe('Write')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    for (const el of root.querySelectorAll('.wrt-form .field, .wrt-form button, .wrt-word')) inside(el)
    expect(root.querySelector('.wrt-form button').getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  }, 20000)
})
