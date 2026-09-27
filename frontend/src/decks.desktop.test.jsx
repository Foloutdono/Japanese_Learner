import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the shelf beside the open deck (plan 154) ─────────────────
// The owner's pick B of four drawn layouts. On a phone the shelf is a
// page of decks and a deck is a screen of its own, whose ▶ Study opens a
// second screen of platforms. On the desk the shelf is a list and the
// open deck stands beside it: the bare shelf opens on its first deck,
// another row swaps the page in place, and the page is one column -- the
// head with Add and the ride (the deck's lanes of the day's queue, the
// one filled action), the platforms in a slot over the cards, the card
// form taking the slot while a card is written. The shelf's "new deck"
// form is a dialog. The phone's side is deskfree.phone.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
const today = vi.hoisted(() => ({ lanes: [] }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 0, by_source: {}, lanes: today.lanes, next_due: null }, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
const DECK = { id: 1, name: 'Voyage', type: 'standard', role: 'owner', card_count: 2 }
const METRO = { id: 2, name: 'Métro', type: 'standard', role: 'owner', card_count: 0 }
const CARDS = [
  { id: 11, origin: 'custom', front: '駅', kana: 'えき', back: 'gare', fields: { front: '駅', back: 'gare' } },
  { id: 12, origin: 'custom', front: '切符', kana: 'きっぷ', back: 'billet', fields: { front: '切符', back: 'billet' } },
]
const STRUCTURES = [{ key: 'standard', fields: [{ key: 'front', required: true }, { key: 'back', required: true }] }]
const json = body => ({ ok: true, status: 200, json: async () => body })
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => {
    if (path === '/api/decks') return json({ decks: [DECK, METRO] })
    if (path === '/api/decks/structures') return json({ structures: STRUCTURES })
    if (path === '/api/decks/1') return json(DECK)
    if (path === '/api/decks/1/cards') return json({ cards: CARDS })
    if (path === '/api/decks/1/modes') return json({ modes: ['vocab.flashcard.f2b', 'vocab.flashcard.b2f'] })
    if (path === '/api/decks/2') return json(METRO)
    if (path === '/api/decks/2/cards') return json({ cards: [] })
    if (path === '/api/decks/2/modes') return json({ modes: [] })
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
const here = { path: null, search: '', state: null }
function Probe() {
  const loc = useLocation()
  here.path = loc.pathname
  here.search = loc.search
  here.state = loc.state
  return null
}

function mount(entry, routes) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <div className="phone phone--desk">
          <div className="phone__content">{routes}</div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
}

// The app's two routes, both the shelf's screen (App.jsx).
const shelf = (
  <Routes>
    <Route path="/learn/decks" element={<DecksScreen session={{}} />} />
    <Route path="/learn/decks/:deck_id" element={<DecksScreen session={{}} />} />
  </Routes>
)
const deckAlone = <Routes><Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} /></Routes>
const shelfCalls = () => api.apiFetch.mock.calls.filter(([p, , o]) => p === '/api/decks' && !o?.method).length

describe('the shelf on the desk', () => {
  it('opens on its first deck, the list beside the page', async () => {
    await mount('/learn/decks', shelf)
    await settle(400)
    expect(here.path).toBe('/learn/decks/1')
    const list = $('.desk-split--decks > .desk-split__list')
    const page = $('.desk-split--decks > .desk-split__page')
    expect(list.getBoundingClientRect().right).toBeLessThanOrEqual(page.getBoundingClientRect().left)
    const rows = [...list.querySelectorAll('.deck-card')]
    expect(rows.map(r => r.getAttribute('aria-current'))).toEqual(['page', null])
    expect(page.querySelector('.deck-identity__name').textContent).toBe('Voyage')
    // The page is the shelf's: one bar, one <main>, no way up to a
    // shelf already on the screen.
    expect($$('main')).toHaveLength(1)
    expect($('.bar__aside .stage__leave, .desk-split__page .bar')).toBeNull()
    // The doors at the list's foot.
    expect(list.lastElementChild.classList.contains('decks-doors')).toBe(true)
  })

  it('swaps the deck in place, the shelf asked for once and its search kept', async () => {
    api.apiFetch.mockClear()
    await mount('/learn/decks/1', shelf)
    await settle(400)
    const field = $('.desk-split__list input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, 'r')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(60)
    const metro = $$('.desk-split__list .deck-card').find(r => /Métro/.test(r.textContent))
    metro.click()
    await settle(400)
    expect(here.path).toBe('/learn/decks/2')
    expect($('.desk-split__page .deck-identity__name').textContent).toBe('Métro')
    // The last deck's cards are gone with it.
    expect($('.desk-split__page .card-list')).toBeNull()
    expect(metro.getAttribute('aria-current')).toBe('page')
    expect($('.desk-split__list input').value).toBe('r')
    expect(shelfCalls()).toBe(1)
  })

  it('opens "new deck" as a dialog from the list\'s foot', async () => {
    await mount('/learn/decks/1', shelf)
    await settle(400)
    const door = $('.desk-split__list .decks-doors > :last-child')
    door.click()
    await settle(60)
    expect($('[role="dialog"] .form input')).not.toBeNull()
    expect(document.activeElement).toBe($('[role="dialog"] .form input'))
    expect($('main .form')).toBeNull()
    // The page beside the list holds the one filled action, so the
    // shelf's own door is a ghost.
    expect(door.classList.contains('chip')).toBe(true)
  })
})

describe('a deck on the desk', () => {
  it("draws an empty deck's note at the chips' width", async () => {
    await mount('/learn/decks/2', deckAlone)
    await settle()
    const empty = $('.deckdetail-empty').getBoundingClientRect()
    const chips = $('.chip-row').getBoundingClientRect()
    expect(Math.round(empty.width)).toBe(Math.round(chips.width))
    expect(Math.round(empty.left)).toBe(Math.round(chips.left))
  })

  it('stands its platforms over its cards, and boards from them', async () => {
    await mount('/learn/decks/1', deckAlone)
    await settle()
    expect($('.desk-side')).toBeNull()
    expect($('.deck-identity__study')).toBeNull()
    const slot = $('.desk-deck > .desk-deck__slot').getBoundingClientRect()
    const list = $('.desk-deck > .card-list').getBoundingClientRect()
    expect(slot.bottom).toBeLessThanOrEqual(list.top)
    expect(Math.round(slot.width)).toBe(Math.round(list.width))

    const platforms = $$('.desk-deck__study .platform-card')
    expect(platforms).toHaveLength(2)
    platforms[0].click()
    await settle(60)
    expect(here.path).toBe('/learn/decks/1/study/vocab.flashcard.f2b')
  })

  it('writes a card in the slot, over the list, from Add in its head', async () => {
    await mount('/learn/decks/1', deckAlone)
    await settle()
    const add = $('.deck-identity__acts .chip')
    expect($$('.chip-row .chip').some(c => c.textContent === add.textContent)).toBe(false)
    add.click()
    await settle(60)
    expect(add.getAttribute('aria-pressed')).toBe('true')
    expect($('.desk-deck__slot .deckdetail-form')).not.toBeNull()
    expect($('.desk-deck__study')).toBeNull()
    expect($('.desk-deck > .card-list')).not.toBeNull()
  })

  it('rides its lanes of the day\'s queue from its head, and comes back to it', async () => {
    today.lanes = [
      { id: 'p|1|vocab.flashcard.f2b', kind: 'personal', deck_id: 1, deck_name: 'Voyage', mode: 'vocab.flashcard.f2b', due: 2, new: 1 },
      { id: 'p|1|vocab.flashcard.b2f', kind: 'personal', deck_id: 1, deck_name: 'Voyage', mode: 'vocab.flashcard.b2f', due: 1, new: 0 },
      { id: 'p|9|vocab.flashcard.f2b', kind: 'personal', deck_id: 9, deck_name: 'Autre', mode: 'vocab.flashcard.f2b', due: 5, new: 0 },
      { id: 's|vocab|N5|vocab.flashcard.f2b', kind: 'section', source: 'vocab', deck: 'N5', mode: 'vocab.flashcard.f2b', due: 7, new: 0 },
    ]
    try {
      await mount('/learn/decks/1', shelf)
      await settle(400)
      const ride = $('.deck-identity__acts .btn-primary')
      expect(ride.textContent).toBe('Réviser 4 cartes ▶')
      expect($$('.btn-primary').filter(b => b.closest('main'))).toHaveLength(1)
      // The button says the figure the meta used to.
      expect($('.deck-identity__due')).toBeNull()
      ride.click()
      await settle(60)
      expect(here.path).toBe('/today/run')
      expect(decodeURIComponent(here.search)).toBe('?lanes=p|1|vocab.flashcard.f2b,p|1|vocab.flashcard.b2f')
      expect(here.state?.from).toBe('/learn/decks/1')
    } finally {
      today.lanes = []
    }
  })

  it('has no ride when nothing of it is due today', async () => {
    await mount('/learn/decks/1', deckAlone)
    await settle()
    expect($('.deck-identity__acts .btn-primary')).toBeNull()
  })
})

// ── plan 123 — a new deck lands on its page ──
// The desk kept the new deck's dialog because it ends on the deck it
// made, the first card's form open; beside the shelf since plan 154, so
// the shelf lists the new deck, open. The flag is spent on arrival, so
// Back and Forward onto the page do not open the form again.
describe('a new deck on the desk', () => {
  it('opens its page beside the shelf with the first card\'s form in the slot', async () => {
    const base = api.apiFetch.getMockImplementation()
    const NEW = { id: 3, name: 'Kanji du métro', type: 'standard' }
    api.apiFetch.mockImplementation(async (path, session, opts) => {
      if (path === '/api/decks' && opts?.method === 'POST') return json(NEW)
      if (path === '/api/decks/3') return json({ ...NEW, role: 'owner', card_count: 0 })
      if (path === '/api/decks/3/cards') return json({ cards: [] })
      if (path === '/api/decks/3/modes') return json({ modes: [] })
      return base(path, session, opts)
    })
    try {
      await mount('/learn/decks', shelf)
      await settle(400)
      $('.desk-split__list .decks-doors > :last-child').click()
      await settle(60)
      const field = $('[role="dialog"] .form input')
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, NEW.name)
      field.dispatchEvent(new Event('input', { bubbles: true }))
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await settle(500)
      expect(here.path).toBe('/learn/decks/3')
      expect($('[role="dialog"]')).toBeNull()
      expect($('.desk-deck__slot .deckdetail-form')).not.toBeNull()
      expect(here.state?.add).toBeUndefined()
      const open = $('.desk-split__list .deck-card[aria-current="page"]')
      expect(open.textContent).toMatch(NEW.name)
    } finally {
      api.apiFetch.mockImplementation(base)
    }
  })
})
