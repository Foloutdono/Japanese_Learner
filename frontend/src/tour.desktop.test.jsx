import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import tours from './testing/grammarTour.json'
import './index.css'

// ── 発見 on the desk (plan 187f) ────────────────────────────────
// A point never met opens on its tour on the run's three panels (the
// owner's pick F, boards 11 and 12): the stop in the middle with no
// track of its own; at the left the point over its stops, each
// saying how it went -- a miss in the wrong ink while the guess is in
// hand, the tries once it is passed; at the right the plate, its lines
// sealed until each is found and the examples at the terminus. The run
// is ridden from the keyboard alone -- Enter for the gate, a digit for a
// tile -- and no key is printed anywhere on the three. The fixture is
// か's tour as the backend serves it (study/grammar_tour.py), in English.

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
const { default: GrammarRun } = await import('./screens/GrammarRun')

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
const route = name => $(`.tour-route__stop[data-stop="${name}"]`)
// A twist per notion (plan 189), each a stop of its own.
const twistAt = () => Number($('.desk-run .tour--desk').dataset.twist)
const routeTwist = i => $(`.tour-route__stop[data-twist="${i}"]`)

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('lang', 'en')
  apiJson.mockReset()
  let batch = 0
  apiJson.mockImplementation(async url => {
    if (String(url).startsWith('/api/grammar/cards')) {
      batch += 1
      return { cards: batch === 1 ? [CARD] : [] }
    }
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

describe('the tour on the desk’s three panels', () => {
  it('stands the stops at the left, the stop in the middle and the plate at the right', async () => {
    await mount()
    await settle(400)
    expect($('.desk-run--panels')).not.toBeNull()
    expect(stop()).toBe('look')
    // The track is the left panel's, not the stop's.
    expect($('.tour--desk .tour__track')).toBeNull()

    const left = $('.desk-run__left .tour-route')
    expect(left.querySelector('.tour-route__pattern').textContent).toBe('か')
    expect($$('.tour-route__stop').map(s => s.querySelector('.tour-route__name').textContent))
      .toEqual(['Look', 'Guess', 'Found', ...KA.twists.map(tw => tw.notion), KA.scene.place_caption, 'Terminus'])
    expect(route('look').getAttribute('aria-current')).toBe('step')

    const right = $('.desk-run__side .tour-ledger')
    expect(right.querySelector('.tour-ledger__pattern').textContent).toBe('か')
    // The rule, a line per twist under its notion, the neighbour.
    expect(right.querySelectorAll('.tour-ledger__line')).toHaveLength(KA.twists.length + 2)
    expect(right.querySelectorAll('.tour-ledger__line--sealed')).toHaveLength(KA.twists.length + 2)
    expect(right.querySelector('.tour-ledger__later')).toBeTruthy()

    // The three columns stand side by side, inside the window.
    const boxes = ['.desk-run__left', '.desk-run--panels > .stage', '.desk-run__side'].map(s => $(s).getBoundingClientRect())
    expect(boxes[0].right).toBeLessThanOrEqual(boxes[1].left)
    expect(boxes[1].right).toBeLessThanOrEqual(boxes[2].left)
    expect(boxes[2].right).toBeLessThanOrEqual(window.innerWidth)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    // No key is printed on any of the three.
    expect($('.desk-run .desk-kbd')).toBeNull()
  })

  it('is ridden from the keyboard, each stop saying how it went and the plate filling in', async () => {
    await mount()
    await settle(400)
    key('Enter')
    await settle()
    expect(stop()).toBe('guess')
    expect(route('look').querySelector('.tour-route__res--ok')).toBeTruthy()

    // A wrong guess by its digit, checked by Enter: a miss in the wrong
    // ink while the guess is still in hand.
    const wrong = KA.guesses.findIndex(g => !g.correct && g.answer)
    key(String(wrong + 1))
    await settle()
    expect($(`[data-guess="${wrong}"]`).getAttribute('aria-checked')).toBe('true')
    key('Enter')
    await settle()
    const res = route('guess').querySelector('.tour-route__res')
    expect(res.textContent).toBe('1 miss')
    expect(res.classList.contains('tour-route__res--no')).toBe(true)

    key(String(KA.guesses.findIndex(g => g.correct) + 1))
    await settle()
    key('Enter')
    await settle()
    expect(stop()).toBe('found')
    // Passed, the tries are said in the plain ink.
    expect(route('guess').querySelector('.tour-route__res').classList.contains('tour-route__res--no')).toBe(false)
    // The rule is found: the plate's first line opens.
    const lines = () => $$('.tour-ledger__line')
    expect(lines()[0].classList.contains('tour-ledger__line--sealed')).toBe(false)
    expect(lines()[1].classList.contains('tour-ledger__line--sealed')).toBe(true)

    key('Enter')
    await settle()
    for (const [i, twist] of KA.twists.entries()) {
      expect(stop()).toBe('twist')
      expect(twistAt()).toBe(i)
      expect(routeTwist(i).getAttribute('aria-current')).toBe('step')
      key(String(twist.choices.findIndex(c => c.correct) + 1))
      await settle()
      key('Enter')
      await settle()
      expect(routeTwist(i).querySelector('.tour-route__res--ok')).toBeTruthy()
      // The twist's line opens under its notion.
      expect(lines()[i + 1].classList.contains('tour-ledger__line--sealed')).toBe(false)
      expect(lines()[i + 1].querySelector('.tour-ledger__notion').textContent).toBe(twist.notion)
      key('Enter')
      await settle()
    }
    // The last twist answered, the neighbour opens too.
    expect(lines().every(l => !l.classList.contains('tour-ledger__line--sealed'))).toBe(true)

    expect(stop()).toBe('scene')
    expect(route('scene').getAttribute('aria-current')).toBe('step')
    key('Enter')
    await settle()
    key(String(KA.scene.ask.choices.findIndex(c => c.correct) + 1))
    await settle()
    key('Enter')
    await settle()
    expect(route('scene').querySelector('.tour-route__res--ok')).toBeTruthy()
    key('Enter')
    await settle()

    expect(stop()).toBe('terminus')
    // The examples open at the terminus.
    expect($('.tour-ledger__later')).toBeNull()
    expect($$('.tour-ledger__examples .dict-ex')).toHaveLength(KA.look.length - 1)

    key('Enter')
    await settle(400)
    const post = apiJson.mock.calls.find(c => c[0] === '/api/grammar/tour')
    expect(JSON.parse(post[2].body)).toEqual({ raw_id: 'grammar_N5_か', tries: 1, helped: false })
    // Boarded: the card, and the run's own panels back.
    expect($('.tour')).toBeNull()
    expect($('.tour-route')).toBeNull()
    expect($('.tour-ledger')).toBeNull()
    expect($('.prompt-card')).toBeTruthy()
  }, 20000)

  it('leaves Enter to a field and to the control the keyboard is on', async () => {
    await mount()
    await settle(400)
    key('Enter')
    await settle()
    // Tabbed onto a guess: Enter is the guess's own, not the gate's.
    const guess = $('[data-guess="0"]')
    guess.focus()
    guess.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await settle()
    expect(stop()).toBe('guess')
  })

  it('stands on the grammar station’s own run too', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/grammar/N5/grammar.ladder']}>
          <Routes>
            <Route path="/learn/grammar/:level/:mode" element={<GrammarRun session={{ access_token: 'tok' }} />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(400)
    expect(stop()).toBe('look')
    expect($('.desk-run__left .tour-route')).not.toBeNull()
    expect($('.desk-run__side .tour-ledger')).not.toBeNull()
    key('Enter')
    await settle()
    expect(stop()).toBe('guess')
    expect(route('guess').getAttribute('aria-current')).toBe('step')
  })
})
