import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import cards from './testing/grammarLadder.json'
import './index.css'

// ── 梯子 on the desk (plan 195) ─────────────────────────────────
// A Choisir card on the run's three panels, as its owner's window
// showed it: the sentence and its hole, the forms as tiles under it,
// the rating bar once one is taken -- long forms and a wrong pick's note
// included -- and the walk upright at the left. None of the three
// scrolls: the card gives down to what the tiles and the bar leave, the
// tiles stay two by two however long a form is, and under 850px of
// window the answer sheet gives way once the answer is in. The walk
// carries no group headings: every stop is named by its own step.
// Mirrored by ladder.short.test.jsx at 600px.

vi.mock('./lib/audio', async o => ({
  ...(await o()), playKana: vi.fn(), playClick: vi.fn(), playUi: vi.fn(), playFlip: vi.fn(), speakJapanese: vi.fn(),
  speakLine: vi.fn(async () => true), stopSpeaking: vi.fn(),
}))
vi.mock('./stores/credits', async o => ({
  ...(await o()),
  useCredits: () => ({ balance: 24, cap: 50, dailyRefill: 30, nextCreditAt: null, plan: 'free', unlimited: false, enforced: false }),
}))
vi.mock('./lib/reviews', () => ({ postReview: vi.fn(async () => ({})), staleCards: vi.fn(async () => []) }))
const apiJson = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ total: 10, new: 1, learning: 0, mastered: 0, due_now: 0 }) })),
  apiJson, apiJsonWithTimeout: vi.fn(async () => ({})), apiUpload: vi.fn(),
  ApiError: class ApiError extends Error { constructor(status) { super(); this.status = status } },
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
const { default: GrammarRun } = await import('./screens/GrammarRun')

const settle = (ms = 300) => new Promise(r => setTimeout(r, ms))

// 〜ます／〜ません with the longest forms the catalogue has, and a note
// on the form a wrong pick takes that runs to three lines.
const CARD = {
  ...cards.choose,
  grammar: '〜ます／〜ません', meaning: 'Present/future, polite',
  contrast: {
    ...cards.choose.contrast,
    jp: 'おさけは飲＿＿＿。', tr: 'I do not drink alcohol.',
    furigana: [{ text: 'おさけは' }, { text: '飲', reading: 'の' }, { text: 'み' }, { text: '＿＿＿', blank: true }, { text: '。' }],
    choices: ['〜ました／〜ませんでした', '〜ましょう', '〜あまり〜ない', '〜ます／〜ません'],
    answer: '〜ます／〜ません',
    why: { '〜ました／〜ませんでした': 'ます／ません is the present and the future, polite; ました／ませんでした says it already happened, so it cannot be about what you do not drink as a rule.' },
  },
}

beforeEach(() => {
  localStorage.clear(); localStorage.setItem('lang', 'en')
  apiJson.mockReset()
  let batch = 0
  apiJson.mockImplementation(async url => (String(url).startsWith('/api/grammar/cards') ? { cards: ++batch === 1 ? [CARD] : [] } : {}))
})
afterEach(() => { localStorage.removeItem('lang') })

/** Every element that scrolls its own content on this page. */
function scrollers() {
  return [...document.querySelectorAll('*')]
    .filter(el => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 1)
    .map(el => `${el.className} ${el.scrollHeight}>${el.clientHeight}`)
}

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn/grammar/N5/grammar.ladder']}>
        <Routes><Route path="/learn/grammar/:level/:mode" element={<GrammarRun session={{ access_token: 'tok' }} />} /></Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(500)
}

describe('the ladder’s Choisir on the desk', () => {
  it('walks its steps with no group heading over them', async () => {
    await mount()
    const names = [...document.querySelectorAll('.gl-map__stop .gl-map__name')].map(n => n.textContent)
    expect(names).toEqual(['Tutorial', 'Choose 1', 'Choose 2', 'Choose 3', 'Build 1', 'Build 2', 'Build 3', 'Build 4', 'Mastered'])
    expect(document.querySelector('.gl-map__group')).toBeNull()
  })

  // Plan 198: the card panel says what each rating does to the point, on
  // the stop in hand, where it drew four tiles; the walk and its outcomes
  // stand whole in the panel at the window's height.
  it('says what each rating does on the stop in hand, whole in its panel', async () => {
    await mount()
    const panel = document.querySelector('.desk-run__left > .desk-card')
    expect(panel.querySelector('.desk-verdict')).toBeNull()
    const stop = panel.querySelector('.gl-map__stop[aria-current="step"]')
    // Choose 2: a miss asks it again, a pass climbs to Choose 3.
    const rows = [...stop.querySelectorAll('.gl-out')]
    expect(rows.map(r => [...r.querySelectorAll('.desk-kbd')].map(k => k.textContent))).toEqual([['4'], ['3', '2', '1']])
    const box = panel.getBoundingClientRect()
    rows.forEach(r => expect(r.getBoundingClientRect().bottom).toBeLessThanOrEqual(stop.getBoundingClientRect().bottom + 1))
    ;[...panel.querySelectorAll('.gl-map__stop')].forEach(s => {
      expect(s.getBoundingClientRect().top).toBeGreaterThanOrEqual(box.top)
      expect(s.getBoundingClientRect().bottom).toBeLessThanOrEqual(panel.querySelector('.desk-rhythm').getBoundingClientRect().top + 1)
    })
    expect(panel.scrollHeight).toBeLessThanOrEqual(panel.clientHeight + 1)
  })

  it('stands on no scroll bar before the answer', async () => {
    await mount()
    expect(scrollers()).toEqual([])
  })

  it('stands on none after a right pick, the tiles two by two', async () => {
    await mount()
    document.querySelector('.gl-tile[data-choice="3"]').click()
    await settle(800)
    expect(document.querySelector('.rating-bar')).toBeTruthy()
    expect(scrollers()).toEqual([])
    const tiles = [...document.querySelectorAll('.gl-tile')]
    if (tiles.length && tiles[0].offsetParent) {
      expect(tiles[0].getBoundingClientRect().top).toBe(tiles[1].getBoundingClientRect().top)
    }
  })

  it('stands on none after a wrong pick and its note', async () => {
    await mount()
    document.querySelector('.gl-tile[data-choice="0"]').click()
    await settle(800)
    expect(document.querySelector('.gl-back__why')).toBeTruthy()
    expect(document.querySelector('.rating-bar')).toBeTruthy()
    expect(scrollers()).toEqual([])
  })
})
