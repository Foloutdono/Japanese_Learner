import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the shelf and its deck held to the window (plan 154) ──────
// The deck's page beside the shelf is the window's height: its head,
// its gate and its row of tools stay on it and only the cards under
// them scroll, so the ride is on the screen however many cards the deck
// holds, and nothing leaves the page's right edge. Where the page is
// narrow or short the gate keeps its switch, its count and its button
// (plan 179). The shelf's list, too: its
// rows scroll between the console and the two doors. This is the narrow desk,
// 1100px: the page beside a column is narrow.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({
    data: {
      total: 12, by_source: {}, next_due: null,
      lanes: [
        { id: 'p|1|a', kind: 'personal', deck_id: 1, deck_name: 'Verbes', mode: 'vocab.flashcard.f2b', due: 7, new: 0 },
        { id: 'p|1|b', kind: 'personal', deck_id: 1, deck_name: 'Verbes', mode: 'vocab.flashcard.b2f', due: 3, new: 0 },
        { id: 'p|1|c', kind: 'personal', deck_id: 1, deck_name: 'Verbes', mode: 'vocab.word_reading', due: 2, new: 0 },
      ],
    },
    failed: false,
  }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
const WORDS = [
  ['起きる', 'おきる', 'se lever, se réveiller'], ['洗う', 'あらう', 'laver'],
  ['着る', 'きる', 'porter (un vêtement du haut)'], ['コンビニエンスストア', 'こんびにえんすすとあ', 'supérette ouverte tard, vingt-quatre heures sur vingt-quatre'],
  ['片付ける', 'かたづける', 'ranger'], ['払う', 'はらう', 'payer'],
]
const STATES = ['due', 'new', 'learning', 'mastered']
const CARDS = Array.from({ length: 30 }, (_, i) => {
  const [front, kana, back] = WORDS[i % WORDS.length]
  return { id: 100 + i, origin: 'custom', front, kana, back, state: STATES[i % 4], fields: {} }
})
const DECKS = [
  { id: 1, name: 'Verbes du quotidien', type: 'vocab', role: 'owner', card_count: 30 },
  ...Array.from({ length: 24 }, (_, i) => ({ id: 10 + i, name: `Deck ${i} — un nom assez long pour la colonne`, type: 'kanji', role: 'owner', card_count: i })),
]
const json = body => ({ ok: true, status: 200, json: async () => body })
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => {
    if (path === '/api/decks') return json({ decks: DECKS })
    if (path === '/api/decks/structures') return json({ structures: [{ key: 'vocab', fields: [{ key: 'front', required: true }] }] })
    if (path === '/api/decks/1') return json(DECKS[0])
    if (path === '/api/decks/1/cards') return json({ cards: CARDS })
    if (path === '/api/decks/1/modes') return json({ modes: ['vocab.flashcard.f2b', 'vocab.flashcard.b2f', 'vocab.word_reading'] })
    return json({})
  }),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue(json({}))

const { default: DecksScreen } = await import('./screens/DecksScreen')

const settle = (ms = 400) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn/decks/1']}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <Routes>
              <Route path="/learn/decks" element={<DecksScreen session={{}} />} />
              <Route path="/learn/decks/:deck_id" element={<DecksScreen session={{}} />} />
            </Routes>
          </div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
}

/** Every card listed, then what must still be on the window. */
async function expectHeld() {
  $('.dk-all').click()
  await settle(200)
  expect($$('.dk-card')).toHaveLength(30)
  const bottom = window.innerHeight
  const go = $('.dk-gate .btn-depart--gate').getBoundingClientRect()
  expect(go.bottom).toBeLessThanOrEqual(bottom)
  expect(go.top).toBeGreaterThanOrEqual(0)
  expect($('.dk-head').getBoundingClientRect().top).toBeGreaterThanOrEqual(0)
  // The cards scroll in the page, not the page in the window.
  const scroller = $('.dk-scroll')
  expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
  // The list's doors under its rows, which scroll between them.
  expect($('.desk-split__list .decks-doors').getBoundingClientRect().bottom).toBeLessThanOrEqual(bottom)
  const rows = $('.shelf-rows')
  expect(rows.scrollHeight).toBeGreaterThan(rows.clientHeight)
  // Nothing past the page's right edge.
  // (The scroller's own box keeps a focus gutter past the page's edge,
  // as the desk's scrolling columns do; what it holds does not.)
  const right = $('.desk-split__page').getBoundingClientRect().right
  for (const el of $$('.desk-deck *')) {
    if (el === scroller) continue
    expect(el.getBoundingClientRect().right, el.className).toBeLessThanOrEqual(right + 0.5)
  }
  for (const card of $$('.dk-card')) expect(card.scrollWidth).toBeLessThanOrEqual(card.clientWidth)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
}

describe('a deck beside the shelf on the narrow desk', () => {
  it('keeps its gate on the window, compact, and its tools on one line', async () => {
    await mount()
    await settle()
    // The switch, the count and the gate; no line, no figures.
    expect($$('.dk-gate [role="radio"]').map(c => c.textContent)).toEqual(['Aujourd’hui', 'Mot → sens', 'Sens → mot', 'Lecture'])
    expect($('.dk-gate__desc')).toBeNull()
    expect($('.dk-figs')).toBeNull()
    // The count over the gate, the gate across the panel.
    const count = $('.dk-gate__count').getBoundingClientRect()
    const gate = $('.dk-gate .btn-depart--gate').getBoundingClientRect()
    expect(gate.top).toBeGreaterThanOrEqual(count.bottom)
    expect($('.dk-gate__count').scrollHeight).toBeLessThan(2 * parseFloat(getComputedStyle($('.dk-gate__count > span')).lineHeight) || 60)
    // Add its short word, the quieter tools their icons, the row one line.
    const tools = $$('.dk-tools .dk-tool')
    expect(tools.map(c => [c.textContent, c.getAttribute('aria-label')])).toEqual([['Ajouter', null], ['', 'Importer'], ['', 'Exporter'], ['', 'Sélectionner']])
    expect(new Set(tools.map(c => Math.round(c.getBoundingClientRect().top))).size).toBe(1)
    // A reading under its word.
    const card = $('.dk-card')
    expect(card.querySelector('.dk-card__kana').getBoundingClientRect().top).toBeGreaterThanOrEqual(card.querySelector('.dk-card__jp').getBoundingClientRect().bottom - 1)
    await expectHeld()
  })
})
