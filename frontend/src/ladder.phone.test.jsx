import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import ladder from './testing/grammarLadder.json'
import './index.css'

// ── 梯子 on a phone, in the day's queue (plans 187e, 194) ────────
// A grammar card on the ladder comes in the exercise its step asks: the
// point's line over the plate, the plate inside a 390px screen, Choisir's
// platforms and Construire's ticket a thumb's targets, the write's field
// and Check beside each other, and the run's own bar rates the card under
// the ladder's key once it is answered.

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
    if (String(url).startsWith('/api/grammar/build/check')) return ladder.checks.right
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
    expect(root.querySelector('.gl-line').getAttribute('aria-label')).toBe('This point: Build, step 2 of 4')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    for (const el of root.querySelectorAll('.gl-line, .gl-plate, .gl-band, .gl-ticket')) inside(el)
    for (const el of root.querySelectorAll('.gl-ticket__in, .gl-ticket__go')) {
      expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
    // No rating before the answer: the bar stands idle.
    expect(root.querySelector('.rating-bar').getAttribute('aria-hidden')).toBe('true')

    await screen.getByLabelText('Your answer').fill(ladder.checks.typed.right)
    await settle(120)
    root.querySelector('.gl-ticket__go').click()
    await settle()
    expect(root.querySelector('.gl-said--ok')).toBeTruthy()
    expect(root.querySelector('.rating-bar').getAttribute('aria-hidden')).toBe('false')
    root.querySelector('.rating-bar button').click()
    await settle()
    const sent = postReview.mock.calls.find(c => c[0] === '/api/today/review')
    expect(sent[2].mode).toBe('grammar.ladder')
    expect(sent[2].card_id).toBe(ladder.build.card_id)
  }, 20000)

  it('chooses inside the screen, the platforms a thumb’s targets', async () => {
    const screen = await mount([card(ladder.choose)])
    await settle()
    const root = screen.container
    expect(root.querySelector('.gl-line').getAttribute('aria-label')).toBe('This point: Choose, step 2 of 3')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    const plats = root.querySelectorAll('.mcq-list--plats .mcq-row')
    expect(plats.length).toBeGreaterThanOrEqual(2)
    for (const el of [...plats, root.querySelector('.gl-plate')]) inside(el)
    for (const el of plats) expect(el.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  }, 20000)

  it('writes inside the screen', async () => {
    const screen = await mount([card(ladder.write)])
    await settle()
    const root = screen.container
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    for (const el of root.querySelectorAll('.wrt-form .field, .wrt-form button, .wrt-word')) inside(el)
    expect(root.querySelector('.wrt-form button').getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  }, 20000)
})
