import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── The run (plan 070) ────────────────────────────────────────
// /today/run on the stage: ‹ Gate, where the card in hand is from, the
// remaining pill, the pass; the review posted under the card's OWN
// mode; and, once the queue is empty, back to the gate with the
// figures for the finish.

const apiJson = vi.fn()
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
const summaryRef = { current: null }
vi.mock('../stores/today', () => ({
  useTodaySummary: () => ({ data: summaryRef.current, failed: false }),
  refreshToday: vi.fn(),
  seedTodaySummary: vi.fn(),
}))
vi.mock('../stores/credits', async (o) => ({
  ...(await o()),
  useCredits: () => ({ balance: 24, cap: 50, dailyRefill: 30, refillAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('../lib/audio', async (o) => ({
  ...(await o()), playKana: vi.fn(), playCorrect: vi.fn(), playWrong: vi.fn(),
  playClick: vi.fn(), playUi: vi.fn(), playSfx: vi.fn(), speakJapanese: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayRun } = await import('./TodayRun')

const LANE = { id: 's~kana~hiragana_basic~kana.flashcard.f2b', kind: 'section', source: 'kana', deck: 'hiragana_basic', mode: 'kana.flashcard.f2b', due: 1 }
const CARD = {
  card_id: 'kana_no', kana: 'の', romaji: 'no', source: 'kana', deck: 'hiragana_basic',
  mode: 'kana.flashcard.f2b', direction: 'f2b', stage: 'learning',
  hints: {}, review_preview: { 4: { xp_earned: 3 } }, lane: LANE,
}

function Gate() {
  const { state } = useLocation()
  return <div className="gate-probe">{state?.run ? `cleared ${state.run.cleared} xp ${state.run.xp}` : 'gate'}</div>
}

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))

function mount(entry = '/today/run') {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/today" element={<Gate />} />
          <Route path="/today/run" element={<TodayRun session={{ access_token: 'tok' }} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

beforeEach(() => {
  apiJson.mockReset()
  localStorage.clear()
  summaryRef.current = { total: 1, lanes: [LANE], next_due: null }
})

describe('TodayRun', () => {
  it('runs on the stage, posts the review under the card\'s mode, and hands the figures back to the gate', async () => {
    let batch = 0
    apiJson.mockImplementation(async (url) => {
      if (String(url).startsWith('/api/today/cards')) {
        batch += 1
        return { cards: batch === 1 ? [CARD] : [] }
      }
      if (String(url) === '/api/today/review') return { credits: { balance: 23 }, xp_earned: 3 }
      return {}
    })

    const screen = await mount()
    await settle(300)

    // The stage, not a screen with a bar: ‹ Gate, the lane in the gate's
    // words, the mode under it, the pill, the pass.
    const stage = screen.container.querySelector('main.stage')
    expect(stage, `no stage — page: ${screen.container.textContent.slice(0, 300)}`).toBeTruthy()
    expect(document.querySelector('.hud')).toBeNull()
    expect(stage.querySelector('.stage__leave').textContent).toContain('Portique')
    expect(stage.querySelector('.stage__where-jp').textContent).toContain('Hiragana')
    expect(stage.querySelector('.today-remaining').textContent).toBe('1')
    expect(stage.querySelector('.hud__pass')).toBeTruthy()
    expect(stage.querySelector('.prompt-card')).toBeTruthy()

    // Reveal and rate.
    stage.querySelector('.flashcard').click()
    await settle(80)
    const correct = [...stage.querySelectorAll('.rating-bar__btn')].find(b => b.textContent.includes('Correct'))
    expect(correct).toBeTruthy()
    correct.click()
    await settle(600)

    const review = apiJson.mock.calls.find(c => c[0] === '/api/today/review')
    expect(review).toBeTruthy()
    expect(JSON.parse(review[2].body)).toMatchObject({ card_id: 'kana_no', mode: 'kana.flashcard.f2b', quality: 4 })

    // The next batch is empty: the run is over and the gate prints it.
    await settle(1200)
    expect(screen.container.querySelector('.gate-probe')?.textContent).toBe('cleared 1 xp 3')
  }, 20000)

  it('a failed first fetch stays on the stage with the retry, never a finish', async () => {
    apiJson.mockImplementation(async () => { throw new Error('down') })
    const screen = await mount()
    await settle(400)
    expect(screen.container.querySelector('main.stage')).toBeTruthy()
    expect(screen.container.querySelector('.empty--error')).toBeTruthy()
    expect(screen.container.querySelector('.gate-probe')).toBeNull()
  })
})
