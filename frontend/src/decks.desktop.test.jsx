import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the shelf beside the open deck (plan 154) ─────────────────
// The owner's pick B of four drawn layouts, as drawn. On a phone the
// shelf is a page of decks and a deck is a screen of its own, whose
// ▶ Study opens a second screen of platforms. On the desk the shelf is a
// list -- the index field over glyph chips, a row per deck, the two doors
// at its foot -- and the open deck stands beside it: the bare shelf opens
// on its first deck, another row swaps the page in place. The page: the
// head with Edit and More, the four figures, the modes as cards, the
// first six cards as a table with their states and the way to all of
// them, and at the foot Add cards beside the one filled action (the
// deck's lanes of the day's queue, or its first mode). The card form
// takes the modes' place while a card is written; the shelf's "new
// deck" form is a dialog. The phone's side is deskfree.phone.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
const today = vi.hoisted(() => ({ lanes: [] }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 0, by_source: {}, lanes: today.lanes, next_due: null }, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
const DECK = { id: 1, name: 'Voyage', type: 'standard', role: 'owner', card_count: 7 }
const METRO = { id: 2, name: 'Métro', type: 'standard', role: 'owner', card_count: 0 }
const CARDS = [
  { id: 11, origin: 'custom', front: '駅', kana: 'えき', back: 'gare', state: 'due', fields: { front: '駅', back: 'gare' } },
  { id: 12, origin: 'custom', front: '切符', kana: 'きっぷ', back: 'billet', state: 'new', fields: { front: '切符', back: 'billet' } },
  { id: 13, origin: 'custom', front: '電車', kana: 'でんしゃ', back: 'train', state: 'learning', fields: { front: '電車', back: 'train' } },
  { id: 14, origin: 'custom', front: '改札', kana: 'かいさつ', back: 'portillon', state: 'mastered', fields: { front: '改札', back: 'portillon' } },
  { id: 15, origin: 'custom', front: '地下鉄', kana: 'ちかてつ', back: 'métro', state: 'new', fields: { front: '地下鉄', back: 'métro' } },
  { id: 16, origin: 'custom', front: '乗る', kana: 'のる', back: 'monter', state: 'learning', fields: { front: '乗る', back: 'monter' } },
  { id: 17, origin: 'custom', front: '降りる', kana: 'おりる', back: 'descendre', state: 'new', fields: { front: '降りる', back: 'descendre' } },
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
    // The index field over the types as glyph chips, each with its count.
    const console_ = list.querySelector('.shelf-console')
    expect(console_.firstElementChild.classList.contains('console__index')).toBe(true)
    expect(console_.querySelector('.console__count').textContent).toBe('2')
    expect(console_.querySelector('.console__chips .chip:not(:first-child)').textContent).toBe('札2')
    // A row per deck: its name and cards, the open one marked.
    const rows = [...list.querySelectorAll('.shelf-row')]
    expect(rows.map(r => r.getAttribute('aria-current'))).toEqual(['page', null])
    expect(rows[0].querySelector('.shelf-row__name').textContent).toBe('Voyage')
    expect(rows[0].querySelector('.shelf-row__sub').textContent).toBe('7 cartes')
    expect(page.querySelector('.dk-head__name').textContent).toBe('Voyage')
    // The page is the shelf's: one bar, one <main>.
    expect($$('main')).toHaveLength(1)
    // The doors at the list's foot, New deck first.
    expect(list.lastElementChild.classList.contains('decks-doors')).toBe(true)
    expect(list.lastElementChild.firstElementChild.classList.contains('decks-doors__create')).toBe(true)
  })

  it('swaps the deck in place, the shelf asked for once and its search kept', async () => {
    api.apiFetch.mockClear()
    await mount('/learn/decks/1', shelf)
    await settle(400)
    const field = $('.desk-split__list input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, 'r')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(60)
    const metro = $$('.desk-split__list .shelf-row').find(r => /Métro/.test(r.textContent))
    metro.click()
    await settle(400)
    expect(here.path).toBe('/learn/decks/2')
    expect($('.desk-split__page .dk-head__name').textContent).toBe('Métro')
    // The last deck's cards and modes are gone with it.
    expect($('.desk-split__page .dk-cards')).toBeNull()
    expect($('.desk-split__page .dk-modes')).toBeNull()
    expect(metro.getAttribute('aria-current')).toBe('page')
    expect($('.desk-split__list input').value).toBe('r')
    expect(shelfCalls()).toBe(1)
  })

  it('opens "new deck" as a dialog from the list\'s foot', async () => {
    await mount('/learn/decks/1', shelf)
    await settle(400)
    $('.decks-doors__create').click()
    await settle(60)
    expect($('[role="dialog"] .form input')).not.toBeNull()
    expect(document.activeElement).toBe($('[role="dialog"] .form input'))
    expect($('main .form')).toBeNull()
  })
})

describe('a deck on the desk', () => {
  it("draws an empty deck's note across the page", async () => {
    await mount('/learn/decks/2', deckAlone)
    await settle()
    const empty = $('.deckdetail-empty').getBoundingClientRect()
    const head = $('.dk-head').getBoundingClientRect()
    expect(Math.round(empty.width)).toBe(Math.round(head.width))
    expect($('.dk-figs')).toBeNull()
  })

  it('names itself in its head, with Edit and More', async () => {
    await mount('/learn/decks/1', deckAlone)
    await settle()
    expect($('.dk-head__cap').textContent).toBe('Standard · 7 cartes')
    const [edit, more] = $$('.dk-head > .chip')
    expect(edit.textContent).toBe('Modifier')
    expect(more.getAttribute('aria-label')).toBe('Plus')
    edit.click()
    await settle(60)
    // Edit is the selection: every card, each with its tick.
    expect(edit.getAttribute('aria-pressed')).toBe('true')
    expect($('.select-console')).not.toBeNull()
    expect($$('.dk-card .card-row__tick')).toHaveLength(7)
  })

  it('counts its cards as four figures, by state', async () => {
    await mount('/learn/decks/1', deckAlone)
    await settle()
    const figs = $$('.dk-fig').map(f => [f.querySelector('.dk-fig__cap').textContent, f.querySelector('.dk-fig__n').textContent])
    expect(figs).toEqual([['À réviser', '1'], ['Nouvelles', '3'], ['En cours', '2'], ['Maîtrisées', '1']])
    // Four across on a page this wide, or two by two: never three and one.
    const tops = new Set($$('.dk-fig').map(f => Math.round(f.getBoundingClientRect().top)))
    expect([1, 2]).toContain(tops.size)
    if (tops.size === 2) expect($$('.dk-fig').filter(f => Math.round(f.getBoundingClientRect().top) === [...tops][0])).toHaveLength(2)
  })

  it('stands its modes as cards over its cards, and boards from them', async () => {
    await mount('/learn/decks/1', deckAlone)
    await settle()
    expect($('.desk-side')).toBeNull()
    expect($('.deck-identity')).toBeNull()
    const slot = $('.desk-deck > .desk-deck__slot').getBoundingClientRect()
    const list = $('.desk-deck > .dk-cards').getBoundingClientRect()
    expect(slot.bottom).toBeLessThanOrEqual(list.top)
    const modes = $$('.dk-modes .dk-mode')
    expect(modes.map(m => m.querySelector('.dk-mode__name').textContent)).toEqual(['Mot → sens', 'Sens → mot'])
    modes[0].click()
    await settle(60)
    expect(here.path).toBe('/learn/decks/1/study/vocab.flashcard.f2b')
  })

  it('lists its first six cards with their states, then all of them', async () => {
    await mount('/learn/decks/1', deckAlone)
    await settle()
    const rows = () => $$('.dk-cards > .dk-card')
    expect(rows()).toHaveLength(6)
    expect([...rows()[0].children].map(c => c.textContent)).toEqual(['駅', 'えき', 'gare', 'À réviser'])
    // One grid for the table: the columns line up down it.
    const lefts = rows().map(r => Math.round(r.querySelector('.dk-card__gloss').getBoundingClientRect().left))
    expect(new Set(lefts).size).toBe(1)
    const all = $('.dk-all')
    expect(all.textContent).toBe('Les 7 cartes ▶')
    all.click()
    await settle(60)
    expect(rows()).toHaveLength(7)
    expect($('.dk-all')).toBeNull()
  })

  it('writes a card in the modes\' place, from Add cards at its foot', async () => {
    await mount('/learn/decks/1', deckAlone)
    await settle()
    const add = $('.dk-foot .chip')
    expect(add.textContent).toBe('Ajouter des cartes')
    add.click()
    await settle(60)
    expect(add.getAttribute('aria-pressed')).toBe('true')
    expect($('.desk-deck__slot .deckdetail-form')).not.toBeNull()
    expect($('.dk-modes')).toBeNull()
    expect($('.desk-deck > .dk-cards')).not.toBeNull()
  })

  it('rides its lanes of the day\'s queue from its foot, and comes back to it', async () => {
    today.lanes = [
      { id: 'p|1|vocab.flashcard.f2b', kind: 'personal', deck_id: 1, deck_name: 'Voyage', mode: 'vocab.flashcard.f2b', due: 2, new: 1 },
      { id: 'p|1|vocab.flashcard.b2f', kind: 'personal', deck_id: 1, deck_name: 'Voyage', mode: 'vocab.flashcard.b2f', due: 1, new: 0 },
      { id: 'p|9|vocab.flashcard.f2b', kind: 'personal', deck_id: 9, deck_name: 'Autre', mode: 'vocab.flashcard.f2b', due: 5, new: 0 },
      { id: 's|vocab|N5|vocab.flashcard.f2b', kind: 'section', source: 'vocab', deck: 'N5', mode: 'vocab.flashcard.f2b', due: 7, new: 0 },
    ]
    try {
      await mount('/learn/decks/1', shelf)
      await settle(400)
      // Each mode card with what the queue holds for it.
      expect($$('.dk-mode').map(m => m.querySelector('.dk-mode__due')?.textContent ?? null)).toEqual(['3', '1'])
      const ride = $('.dk-foot .btn-primary')
      expect(ride.textContent).toBe('Réviser 4 cartes ▶')
      expect($$('.btn-primary').filter(b => b.closest('main'))).toHaveLength(1)
      // The shelf's row says it too.
      expect($('.shelf-row[aria-current="page"] .shelf-row__due').firstChild.textContent).toBe('3')
      ride.click()
      await settle(60)
      expect(here.path).toBe('/today/run')
      expect(decodeURIComponent(here.search)).toBe('?lanes=p|1|vocab.flashcard.f2b,p|1|vocab.flashcard.b2f')
      expect(here.state?.from).toBe('/learn/decks/1')
    } finally {
      today.lanes = []
    }
  })

  it('boards its first mode when nothing of it is due today', async () => {
    await mount('/learn/decks/1', deckAlone)
    await settle()
    const go = $('.dk-foot .btn-primary')
    expect(go.textContent).toBe('Étudier ▶')
    go.click()
    await settle(60)
    expect(here.path).toBe('/learn/decks/1/study/vocab.flashcard.f2b')
  })
})

// ── plan 123 — a new deck lands on its page ──
// The desk kept the new deck's dialog because it ends on the deck it
// made, the first card's form open; beside the shelf since plan 154, so
// the shelf lists the new deck, open. The flag is spent on arrival, so
// Back and Forward onto the page do not open the form again.
describe('a new deck on the desk', () => {
  it('opens its page beside the shelf with the first card\'s form in the modes\' place', async () => {
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
      $('.decks-doors__create').click()
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
      const open = $('.desk-split__list .shelf-row[aria-current="page"]')
      expect(open.textContent).toMatch(NEW.name)
    } finally {
      api.apiFetch.mockImplementation(base)
    }
  })
})
