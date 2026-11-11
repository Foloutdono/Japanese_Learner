import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { sessionKey } from './hooks/useCardSession'
import tours from './testing/glyphTour.json'
import { page } from 'vitest/browser'
import './index.css'

// ── 初見 on a phone (plan 216) ────────────────────────────────────
// A kana or a kanji never met opens on its tour in the card's place,
// in the day's queue and on its own line's run: the track, one card a
// stop, the board a square inside the screen, the gate docked in reach,
// nothing spilling sideways at 390px. The terminus records the tour and
// boards the card, once: a card the server says nothing about, or one
// already boarded, opens on the card.

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
vi.mock('./lib/reviews', () => ({ postReview: vi.fn(async () => ({})), staleCards: vi.fn(async () => []), reviewsSettled: vi.fn(async () => {}) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayRun } = await import('./screens/TodayRun')
const { default: KanaRun } = await import('./screens/KanaRun')

const LANE = { id: 's~kana~hiragana_basic~kana.flashcard.f2b', kind: 'section', source: 'kana', deck: 'hiragana_basic', mode: 'kana.flashcard.f2b' }
const kanaCard = (over) => ({
  card_id: 'kana_あ', source: 'kana', deck: 'hiragana_basic', mode: 'kana.flashcard.f2b',
  direction: 'f2b', kana: 'あ', romaji: 'a', sound: 'a', stage: 'new', hints: {},
  review_preview: null, progress: 0, lane: LANE, tutorial: true, glyph_tour: tours.kana, ...over,
})

const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))

function serve(cards, key) {
  let batch = 0
  apiJson.mockImplementation(async (url) => {
    if (String(url).startsWith(key)) {
      batch += 1
      return { cards: batch === 1 ? cards : [] }
    }
    return {}
  })
}

async function mountToday(cards) {
  serve(cards, '/api/today/cards')
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

async function mountKana(cards) {
  serve(cards, '/api/kana/cards')
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn/kana/hiragana_basic/kana.flashcard.f2b']}>
        <Routes>
          <Route path="/learn/kana/:set" element={<div className="gate-probe">platforms</div>} />
          <Route path="/learn/kana/:set/:mode" element={<KanaRun session={{ access_token: 'tok' }} />} />
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
  localStorage.clear()
  sessionStorage.clear()
  localStorage.setItem('lang', 'en')
})
afterEach(async () => {
  localStorage.removeItem('lang')
  delete document.documentElement.dataset.chrome
  await page.viewport(390, 844)
})

describe('a kana never met, in the day’s queue, on a phone', () => {
  it('stands in the card’s place, inside the screen, its gate in reach', async () => {
    const screen = await mountToday([kanaCard()])
    await settle()
    const tour = screen.container.querySelector('.tour--glyph')
    expect(tour).toBeTruthy()
    expect(screen.container.querySelector('.prompt-card')).toBeNull()
    expect(screen.container.querySelector('.rating-bar')).toBeNull()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    for (const el of tour.querySelectorAll('.tour-leaf, .tour__foot, .tour__track')) inside(el)
    const gate = tour.querySelector('.tour__foot .btn-depart').getBoundingClientRect()
    expect(gate.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(gate.height).toBeGreaterThanOrEqual(52)
    // The line is the run's, a kana's: not grammar's, which .tour names.
    const line = getComputedStyle(tour).getPropertyValue('--line-color').trim()
    const stage = getComputedStyle(screen.container.querySelector('.stage')).getPropertyValue('--line-color').trim()
    expect(line).toBe(stage)
  }, 20000)

  it('draws the board as a square inside the card, the gate still in reach', async () => {
    const screen = await mountToday([kanaCard()])
    await settle()
    const tour = () => screen.container.querySelector('.tour--glyph')
    tour().querySelector('.tour__foot .btn-depart').click()
    await settle()
    const board = tour().querySelector('.gt-board').getBoundingClientRect()
    const leaf = tour().querySelector('.tour-leaf').getBoundingClientRect()
    expect(Math.abs(board.width - board.height)).toBeLessThanOrEqual(1)
    expect(board.width).toBeGreaterThanOrEqual(200)
    expect(board.left).toBeGreaterThanOrEqual(leaf.left)
    expect(board.right).toBeLessThanOrEqual(leaf.right)
    // Its quiet way stands over the gate, never under it.
    const show = tour().querySelector('[data-action="show"]').getBoundingClientRect()
    const gate = tour().querySelector('.tour__foot .btn-depart').getBoundingClientRect()
    expect(show.bottom).toBeLessThanOrEqual(gate.top)
    expect(gate.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  }, 20000)

  it('gives the board the card, no head over it, on a short phone', async () => {
    // 360x640: under a head (the stroke's count, the instruction) the
    // board was 184px, under its 200px floor, and the screen scrolled.
    await page.viewport(360, 640)
    const screen = await mountToday([kanaCard()])
    await settle()
    const tour = () => screen.container.querySelector('.tour--glyph')
    tour().querySelector('.tour__foot .btn-depart').click()
    await settle()
    expect(tour().querySelector('.tour-leaf__head')).toBeNull()
    const board = tour().querySelector('.gt-board').getBoundingClientRect()
    const leaf = tour().querySelector('.tour-leaf').getBoundingClientRect()
    expect(board.width).toBeGreaterThanOrEqual(240)
    expect(board.top - leaf.top).toBeLessThanOrEqual(40)
    const gate = tour().querySelector('.tour__foot .btn-depart').getBoundingClientRect()
    expect(gate.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight)
  }, 20000)

  it('records the tour at its terminus and boards the card', async () => {
    const screen = await mountToday([kanaCard()])
    await settle()
    const tour = () => screen.container.querySelector('.tour--glyph')
    const gate = () => tour().querySelector('.tour__foot .btn-depart')
    gate().click()
    await settle(120)
    tour().querySelector('[data-action="show"]').click()
    await settle(120)
    gate().click()
    await settle(120)
    expect(tour().dataset.stop).toBe('use')
    gate().click()
    await settle()
    const post = apiJson.mock.calls.find(c => c[0] === '/api/glyph/tour')
    expect(post).toBeTruthy()
    expect(post[2].method).toBe('POST')
    expect(JSON.parse(post[2].body)).toEqual({ raw_id: 'kana_あ', misses: 0, shown: true })
    expect(screen.container.querySelector('.tour')).toBeNull()
    expect(screen.container.querySelector('.prompt-card')).toBeTruthy()
    const cached = JSON.parse(localStorage.getItem(sessionKey('today', 'all', 'en')))
    expect(cached[0].lesson_seen).toBe(true)
  }, 20000)

  it('opens on the card when the tour is not due', async () => {
    const screen = await mountToday([kanaCard({ tutorial: false, glyph_tour: undefined })])
    await settle()
    expect(screen.container.querySelector('.tour')).toBeNull()
    expect(screen.container.querySelector('.prompt-card')).toBeTruthy()
  }, 20000)
})

describe('a kana never met, on the kana line’s own run', () => {
  it('opens on its tour, and asks the server for its words in the learner’s language', async () => {
    const screen = await mountKana([kanaCard({ lane: undefined })])
    await settle()
    expect(screen.container.querySelector('.tour--glyph')).toBeTruthy()
    expect(screen.container.querySelector('.prompt-card')).toBeNull()
    const fetched = apiJson.mock.calls.find(c => String(c[0]).startsWith('/api/kana/cards'))
    expect(fetched[0]).toContain('lang=en')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  }, 20000)
})
