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
// names). A written tour's scene (plan 187d) stands inside the screen
// too: the place's plate, the lines with their voices, the gate docked.
// Since plan 206 each stop is one card that takes the room between the
// track and the gate: no stop leaves the screen's middle empty.

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
vi.mock('./lib/reviews', () => ({ postReview: vi.fn(async () => ({})), staleCards: vi.fn(async () => []) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: TodayRun } = await import('./screens/TodayRun')

// The derived half alone (the written half is か's, below).
const TOUR = { ...tours.en, twists: [], scene: null, quiz: null }
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
    expect(tour.querySelector('.tour-leaf')).toBeTruthy()
    for (const el of tour.querySelectorAll('.tour-leaf, .tour__foot, .tour__track')) {
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

  it('draws each stop as one card down to the gate, the sentence leading it (plan 206)', async () => {
    const KA = tours.ka
    const screen = await mount([card({
      card_id: 'grammar_N5_か', raw_id: 'grammar_N5_か', grammar: 'か',
      lesson: { ...LESSON, examples: KA.look, tour: KA },
    })])
    await settle()
    const tour = () => screen.container.querySelector('.tour')
    const gate = () => tour().querySelector('.tour__foot .btn-depart')
    // Nothing between what the stop says and the gate: the body's last
    // block meets the docked foot, give or take the body's own gap.
    const filled = () => {
      const body = tour().querySelector('.tour__body')
      const last = body.lastElementChild.getBoundingClientRect()
      const foot = tour().querySelector('.tour__foot').getBoundingClientRect()
      expect(foot.top - last.bottom).toBeLessThanOrEqual(24)
      expect(tour().querySelector('.tour-leaf').getBoundingClientRect().top)
        .toBeGreaterThanOrEqual(tour().querySelector('.tour__track').getBoundingClientRect().bottom)
    }
    filled()
    gate().click()
    await settle(120)
    tour().querySelector(`[data-guess="${KA.guesses.findIndex(g => g.correct)}"]`).click()
    await settle(120)
    gate().click()
    await settle(120)
    // Found: the card turned to the point, the screen's shortest stop.
    expect(tour().dataset.stop).toBe('found')
    filled()
    expect(tour().querySelector('.tour-leaf--found .tour-pattern').textContent).toBe('か')
    gate().click()
    await settle(120)
    gate().click()
    await settle(120)
    tour().querySelector(`[data-choice="${KA.scene.ask.choices.findIndex(c => c.correct)}"]`).click()
    await settle(120)
    gate().click()
    await settle(120)
    gate().click()
    await settle(120)
    // A usage: its sentence centred in the card at --fs-title, the
    // readings under the card, all inside the phone.
    expect(tour().dataset.stop).toBe('twist')
    filled()
    const leaf = tour().querySelector('.tour-leaf').getBoundingClientRect()
    const jp = tour().querySelector('.tour-leaf__mid--spec .dict-ex__jp')
    expect(getComputedStyle(jp).fontSize).toBe('20px')
    // Centred: the ink, not the box (which is the card's width either way).
    const ink = document.createRange()
    ink.selectNodeContents(jp)
    const sentence = ink.getBoundingClientRect()
    expect(Math.abs((sentence.left - leaf.left) - (leaf.right - sentence.right))).toBeLessThanOrEqual(2)
    expect(tour().querySelector('.tour-guesses').getBoundingClientRect().top).toBeGreaterThanOrEqual(leaf.bottom)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
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

    // The point's sheet, at the results: the lesson's sheet.
    tour().querySelector('[data-action="lesson"]').click()
    await settle()
    expect(document.querySelector('.gl-sheet')).toBeTruthy()
    document.querySelector('.gl-sheet [aria-label="Close"]')?.click()
    await settle()

    gate().click()
    await settle()
    const post = apiJson.mock.calls.find(c => c[0] === '/api/grammar/tour')
    expect(post).toBeTruthy()
    expect(post[2].method).toBe('POST')
    expect(JSON.parse(post[2].body)).toEqual({
      raw_id: 'grammar_N5_〜てください', tries: 0, helped: false, quiz_right: null, quiz_total: null,
    })
    expect(screen.container.querySelector('.tour')).toBeNull()
    expect(screen.container.querySelector('.prompt-card')).toBeTruthy()
    const cached = JSON.parse(localStorage.getItem(sessionKey('today', 'all', 'en')))
    expect(cached[0].lesson_seen).toBe(true)
  }, 20000)

  // 飛ばす (plan 221): under the gate, inside the screen, the way past
  // the lesson to its card -- which records no tour.
  it('skips the tour for its card, recording nothing', async () => {
    const screen = await mount([card()])
    await settle()
    const tour = () => screen.container.querySelector('.tour')
    const skip = tour().querySelector('.tour__foot [data-action="skip"]')
    const box = skip.getBoundingClientRect()
    const gate = tour().querySelector('.tour__foot .btn-depart').getBoundingClientRect()
    expect(box.top).toBeGreaterThanOrEqual(gate.bottom)
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(box.height).toBeGreaterThanOrEqual(44)
    skip.click()
    await settle()
    expect(screen.container.querySelector('.tour')).toBeNull()
    expect(screen.container.querySelector('.prompt-card')).toBeTruthy()
    expect(apiJson.mock.calls.find(c => c[0] === '/api/grammar/tour')).toBeUndefined()
    const cached = JSON.parse(localStorage.getItem(sessionKey('today', 'all', 'en')))
    expect(cached[0].lesson_seen).toBe(true)
  }, 20000)

  it('keeps the lesson for a point with no tour', async () => {
    const screen = await mount([card({ lesson: { ...LESSON, tour: null } })])
    await settle()
    expect(screen.container.querySelector('.tour')).toBeNull()
    expect(screen.container.querySelector('.gl--gate')).toBeTruthy()
  }, 20000)

  it('draws a written tour’s scene inside the screen', async () => {
    const KA = tours.ka
    const screen = await mount([card({
      card_id: 'grammar_N5_か', raw_id: 'grammar_N5_か', grammar: 'か',
      lesson: { ...LESSON, examples: KA.look, tour: KA },
    })])
    await settle()
    const tour = () => screen.container.querySelector('.tour')
    const gate = () => tour().querySelector('.tour__foot .btn-depart')
    expect(tour().querySelectorAll('.tour__stop')).toHaveLength(6 + KA.twists.length)
    gate().click()
    await settle(120)
    tour().querySelector(`[data-guess="${KA.guesses.findIndex(g => g.correct)}"]`).click()
    await settle(120)
    gate().click()
    await settle(120)
    gate().click()
    await settle(120)
    expect(tour().dataset.stop).toBe('scene')
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    for (const el of tour().querySelectorAll('.tour-plate, .tour-line, .tour-speak, .tour-note')) {
      const box = el.getBoundingClientRect()
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(window.innerWidth)
    }
    // A line's voice is a thumb's target.
    const speak = tour().querySelector('.tour-line .tour-speak').getBoundingClientRect()
    expect(speak.width).toBeGreaterThanOrEqual(44)
    expect(speak.height).toBeGreaterThanOrEqual(44)
    // ... and its glyph at its own size, not squeezed by a button's padding.
    expect(tour().querySelector('.tour-line .tour-speak svg').getBoundingClientRect().width).toBe(20)
    // The place's edge is the line's, at 3px.
    expect(getComputedStyle(tour().querySelector('.tour-plate')).borderBottomWidth).toBe('3px')
    const g = gate().getBoundingClientRect()
    expect(g.bottom).toBeLessThanOrEqual(window.innerHeight)

    // Since plan 194 the usages follow the scene.
    gate().click()
    await settle(120)
    tour().querySelector(`[data-choice="${KA.scene.ask.choices.findIndex(c => c.correct)}"]`).click()
    await settle(120)
    gate().click()
    await settle(120)
    gate().click()
    await settle(120)
    for (const twist of KA.twists) {
      // The notion over its question stays inside a phone's width.
      const notion = tour().querySelector('.tour__notion').getBoundingClientRect()
      expect(notion.right).toBeLessThanOrEqual(window.innerWidth)
      tour().querySelector(`[data-choice="${twist.choices.findIndex(c => c.correct)}"]`).click()
      await settle(120)
      gate().click()
      await settle(120)
      gate().click()
      await settle(120)
    }
    expect(tour().dataset.stop).toBe('quiz')
  }, 20000)
})
