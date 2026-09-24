import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — a deck as list and platforms (plan 114) ───────────────────
// On a phone a deck's page ends in ▶ Study, which opens a second screen
// of platforms, and its add-card form opens in the page between the
// chips and the list. On the desk the platforms stand beside the cards
// from the start and board directly, and the form takes their place
// while a card is written. The shelf's "new deck" form is a dialog.
// The phone's side is deskfree.phone.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 0, by_source: {}, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
const DECK = { id: 1, name: 'Voyage', type: 'standard', role: 'owner', card_count: 2 }
const CARDS = [
  { id: 11, origin: 'custom', front: '駅', kana: 'えき', back: 'gare', fields: { front: '駅', back: 'gare' } },
  { id: 12, origin: 'custom', front: '切符', kana: 'きっぷ', back: 'billet', fields: { front: '切符', back: 'billet' } },
]
const STRUCTURES = [{ key: 'standard', fields: [{ key: 'front', required: true }, { key: 'back', required: true }] }]
const json = body => ({ ok: true, status: 200, json: async () => body })
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => {
    if (path === '/api/decks') return json({ decks: [DECK] })
    if (path === '/api/decks/structures') return json({ structures: STRUCTURES })
    if (path === '/api/decks/1') return json(DECK)
    if (path === '/api/decks/1/cards') return json({ cards: CARDS })
    if (path === '/api/decks/1/modes') return json({ modes: ['vocab.flashcard.f2b', 'vocab.flashcard.b2f'] })
    return json({})
  }),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue(json({}))

const { default: DeckDetailScreen } = await import('./screens/DeckDetailScreen')
const api = await import('./lib/api')
const { default: DecksScreen } = await import('./screens/DecksScreen')

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
let path = null
const here = { state: null }
function Probe() { const loc = useLocation(); path = loc.pathname; here.state = loc.state; return null }

function mount(entry, element) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <Routes><Route path="*" element={element} /></Routes>
          </div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
}

describe('a deck on the desk', () => {
  it('stands its platforms beside its cards, and boards from them', async () => {
    await mount('/learn/decks/1', <Routes><Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} /></Routes>)
    await settle()
    const main = $('.desk-deck__main').getBoundingClientRect()
    const side = $('.desk-deck > .desk-side').getBoundingClientRect()
    expect(side.left).toBeGreaterThan(main.right)
    expect(side.width).toBe(360)
    expect($('.desk-deck__main .card-list')).not.toBeNull()
    expect($('.deck-identity__study')).toBeNull()

    const platforms = $$('.desk-deck__study .platform-card')
    expect(platforms).toHaveLength(2)
    // One column, at the side's width — never the grid's 440px minimum.
    expect(platforms[0].getBoundingClientRect().right).toBeLessThanOrEqual(side.right + 0.5)
    platforms[0].click()
    await settle(60)
    expect(path).toBe('/learn/decks/1/study/vocab.flashcard.f2b')
  })

  it('writes a card in the second column, beside the list', async () => {
    await mount('/learn/decks/1', <Routes><Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} /></Routes>)
    await settle()
    $$('.chip-row button')[0].click()
    await settle(60)
    expect($('.desk-deck > .desk-side .deckdetail-form')).not.toBeNull()
    expect($('.desk-deck__main .deckdetail-form')).toBeNull()
    expect($('.desk-deck__study')).toBeNull()
    expect($('.desk-deck__main .card-list')).not.toBeNull()
  })
})

describe('the shelf on the desk', () => {
  it('opens "new deck" as a dialog and keeps its door', async () => {
    await mount('/learn/decks', <DecksScreen session={{}} />)
    await settle()
    const door = $('.decks-doors > :last-child')
    door.click()
    await settle(60)
    expect($('[role="dialog"] .form input')).not.toBeNull()
    expect(document.activeElement).toBe($('[role="dialog"] .form input'))
    expect($('main .form')).toBeNull()
    expect($('.decks-doors > :last-child').textContent).toBe(door.textContent)
  })
})

// ── plan 123 — a new deck lands on its page ──
// The desk kept the new deck's dialog because it ends by leaving the
// shelf for the deck it made; it now does, the first card's form open
// in the side. The flag is spent on arrival, so Back and Forward onto
// the page do not open the form again.
describe('a new deck on the desk', () => {
  it('opens its page with the first card\'s form in the side', async () => {
    const base = api.apiFetch.getMockImplementation()
    const NEW = { id: 2, name: 'Kanji du métro', type: 'standard' }
    api.apiFetch.mockImplementation(async (path, session, opts) => {
      if (path === '/api/decks' && opts?.method === 'POST') return json(NEW)
      if (path === '/api/decks/2') return json({ ...NEW, role: 'owner', card_count: 0 })
      if (path === '/api/decks/2/cards') return json({ cards: [] })
      if (path === '/api/decks/2/modes') return json({ modes: [] })
      return base(path, session, opts)
    })
    try {
      await mount('/learn/decks', (
        <Routes>
          <Route path="/learn/decks" element={<DecksScreen session={{}} />} />
          <Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} />
        </Routes>
      ))
      await settle()
      $('.decks-doors > :last-child').click()
      await settle(60)
      const field = $('[role="dialog"] .form input')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, NEW.name)
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await settle(500)
      expect(path).toBe('/learn/decks/2')
      expect($('[role="dialog"]')).toBeNull()
      expect($('.desk-side .deckdetail-form')).not.toBeNull()
      expect(here.state?.add).toBeUndefined()
    } finally {
      api.apiFetch.mockImplementation(base)
    }
  })
})

