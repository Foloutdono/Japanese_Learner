import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { sessionKey } from './hooks/useCardSession'
import tours from './testing/grammarTour.json'
import './index.css'

// ── 発見 on a phone, in the day's queue (plan 187b) ─────────────
// A grammar point never met opens on its tour where it carries one, in
// the card's place: the track, the stop, the gate docked in the screen,
// nothing spilling sideways at 390px. The terminus records the tour and
// boards the card; the full lesson is a quiet way over its gate. A
// point with no tour keeps the lesson (the fallback study/grammar_tour.py
// names).

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
}))
vi.mock('./lib/reviews', () => ({ postReview: vi.fn(async () => ({})), staleCards: vi.fn(async () => []) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayRun } = await import('./screens/TodayRun')

const TOUR = tours.en
const LANE = { id: 's~grammar~N5~grammar.flashcard.f2b', kind: 'section', source: 'grammar', deck: 'N5', mode: 'grammar.flashcard.f2b' }
const LESSON = {
  register: 'polite',
  steps: [{ kind: 'rule', text: TOUR.rule }],
  compare: [],
  examples: TOUR.look,
}
const card = (over) => ({
  card_id: 'grammar_N5_〜てください', raw_id: 'grammar_N5_〜てください', source: 'grammar',
  mode: 'grammar.flashcard.f2b', direction: 'f2b', grammar: '〜てください',
  structure: 'verb て-form + ください', meaning: 'please do', stage: 'new', hints: {},
  review_preview: null, lesson: { ...LESSON, tour: TOUR }, lane: LANE, ...over,
})

const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))
const right = TOUR.guesses.findIndex(g => g.correct)

async function mount(cards) {
  let batch = 0
  apiJson.mockImplementation(async (url) => {
    if (String(url).startsWith('/api/today/cards')) {
      batch += 1
      return { cards: batch === 1 ? cards : [] }
    }
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

beforeEach(() => {
  // The app stamps the chrome on <html> (components/chrome/useChrome.js):
  // what the docked gate reads the run's floor through.
  document.documentElement.dataset.chrome = 'stage'
  apiJson.mockReset()
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('lang', 'en')
})
afterEach(() => {
  localStorage.removeItem('lang')
  delete document.documentElement.dataset.chrome
})

describe('the tour in the day’s queue, on a phone', () => {
  it('stands in the card’s place, inside the screen, its gate in reach', async () => {
    const screen = await mount([card()])
    await settle()
    const tour = screen.container.querySelector('.tour')
    expect(tour).toBeTruthy()
    expect(screen.container.querySelector('.gl--gate')).toBeNull()
    expect(screen.container.querySelector('.prompt-card')).toBeNull()
    expect(screen.container.querySelector('.rating-bar')).toBeNull()
    // Nothing runs off the side of a 390px phone.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    for (const el of tour.querySelectorAll('.tour-card, .tour__foot, .tour__track')) {
      const box = el.getBoundingClientRect()
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(window.innerWidth)
    }
    // The gate is the screen's: docked in view, at the gate's size.
    const gate = tour.querySelector('.tour__foot .btn-depart').getBoundingClientRect()
    expect(gate.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(gate.height).toBeGreaterThanOrEqual(56)
    // The track is the line's: the stop in hand ringed in its pigment.
    const here = getComputedStyle(tour.querySelector('.tour__stop--here'))
    const pine = getComputedStyle(tour).getPropertyValue('--line-color').trim()
    expect(pine).not.toBe('')
    expect(here.borderTopWidth).toBe('3px')
  }, 20000)

  it('records the tour at its terminus and boards the card', async () => {
    const screen = await mount([card()])
    await settle()
    const tour = () => screen.container.querySelector('.tour')
    const gate = () => tour().querySelector('.tour__foot .btn-depart')
    gate().click()
    await settle(120)
    tour().querySelector(`[data-guess="${right}"]`).click()
    await settle(120)
    gate().click()
    await settle(120)
    gate().click()
    await settle(120)
    expect(tour().dataset.stop).toBe('terminus')

    // The full lesson is a quiet way over the gate: the lesson's sheet.
    tour().querySelector('.tour__foot .brd__link').click()
    await settle()
    expect(document.querySelector('.gl-sheet')).toBeTruthy()
    document.querySelector('.gl-sheet [aria-label="Close"]')?.click()
    await settle()

    gate().click()
    await settle()
    const post = apiJson.mock.calls.find(c => c[0] === '/api/grammar/tour')
    expect(post).toBeTruthy()
    expect(post[2].method).toBe('POST')
    expect(JSON.parse(post[2].body)).toEqual({ raw_id: 'grammar_N5_〜てください', tries: 0, helped: false })
    expect(screen.container.querySelector('.tour')).toBeNull()
    expect(screen.container.querySelector('.prompt-card')).toBeTruthy()
    const cached = JSON.parse(localStorage.getItem(sessionKey('today', 'all')))
    expect(cached[0].lesson_seen).toBe(true)
  }, 20000)

  it('keeps the lesson for a point with no tour', async () => {
    const screen = await mount([card({ lesson: { ...LESSON, tour: null } })])
    await settle()
    expect(screen.container.querySelector('.tour')).toBeNull()
    expect(screen.container.querySelector('.gl--gate')).toBeTruthy()
  }, 20000)
})
