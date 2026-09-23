import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the library's shelf beside a deck; Browse beside the cards ──
// (plan 115). On a phone a published deck is a screen of its own, and
// the shelf is gone while it is read; on the desk the shelf stays — its
// search, its narrowing, its paging — and the open deck stands beside
// it, drawn from its shelf row at once. A deck's Browse opens in the
// deck page's own second column rather than over the page, the deck's
// platforms are asked for once, and an empty deck says so once. The
// phone's side is deskfree.phone.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
vi.mock('./lib/track', () => ({ track: vi.fn() }))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 0, by_source: {}, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))

const LISTED = [
  { id: 1, name: 'Voyage au Japon', type: 'vocab', card_count: 40, author: 'Mei', followers: 3, description: 'Les mots du train.' },
  { id: 2, name: 'Kanji du métro', type: 'kanji', card_count: 18, author: 'Haruto', followers: 0 },
  { id: 3, name: 'Cuisine', type: 'vocab', card_count: 25, author: 'Aiko', followers: 1 },
]
const full = d => ({ ...d, followed: false, preview: [{ id: 1, front: '駅', kana: 'えき', back: 'gare' }] })
let slowDeck = null
const apiJson = vi.fn()
const apiFetch = vi.fn()
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const wait = ms => new Promise(r => setTimeout(r, ms))
beforeEach(() => {
  slowDeck = null
  apiJson.mockReset()
  apiJson.mockImplementation(async url => {
    const u = String(url)
    if (u.startsWith('/api/decks/library?')) return { results: LISTED, total: LISTED.length, has_more: false, types: ['vocab', 'kanji'] }
    const m = u.match(/^\/api\/decks\/library\/(\d+)$/)
    if (m) {
      if (Number(m[1]) === slowDeck) await wait(600)
      return full(LISTED.find(d => d.id === Number(m[1])))
    }
    return {}
  })
})

const { default: LibraryScreen } = await import('./screens/LibraryScreen')
const { default: DeckDetailScreen } = await import('./screens/DeckDetailScreen')

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const where = { path: null, type: null }
function Probe() {
  where.path = useLocation().pathname
  where.type = useNavigationType()
  return null
}

function mountLibrary(entry) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <Routes>
              <Route path="/learn/decks/library" element={<LibraryScreen session={{}} />} />
              <Route path="/learn/decks/library/:deck_id" element={<LibraryScreen session={{}} />} />
            </Routes>
          </div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
}
const shelfCalls = () => apiJson.mock.calls.filter(([u]) => String(u).startsWith('/api/decks/library?')).length
const openName = () => $('.desk-split__list .lib-card[aria-current="page"] .platform-card__title')?.textContent

describe('the library on the desk', () => {
  it('opens the bare shelf on its first deck, beside it', async () => {
    await mountLibrary('/learn/decks/library')
    await settle(400)
    expect(where.path).toBe('/learn/decks/library/1')
    expect(where.type).toBe('REPLACE')
    expect(openName()).toBe('Voyage au Japon')
    const list = $('.desk-split--shelf .desk-split__list').getBoundingClientRect()
    const page = $('.desk-split--shelf .desk-split__page').getBoundingClientRect()
    expect(page.left).toBeGreaterThan(list.right)
    expect($('.desk-shelf-page .deck-identity__name').textContent).toBe('Voyage au Japon')
    expect($('.desk-shelf-page .card-row__jp').textContent).toBe('駅')
  })

  it('swaps the deck in place, the shelf asked for once and its search kept', async () => {
    await mountLibrary('/learn/decks/library/1')
    await settle(400)
    const field = $('.console input')
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(field, 'métro')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(500)
    const asked = shelfCalls()

    // Each deck a link to its page (plan 117), so it opens in a tab too.
    const cards = $$('.desk-split__list .lib-card')
    expect(cards.every(c => c.tagName === 'A')).toBe(true)
    expect(cards[2].getAttribute('href')).toBe('/learn/decks/library/3')
    cards[2].click()
    await settle()
    expect(where.path).toBe('/learn/decks/library/3')
    expect(where.type).toBe('REPLACE')
    expect(openName()).toBe('Cuisine')
    expect($('.desk-shelf-page .deck-identity__name').textContent).toBe('Cuisine')
    expect($('.console input').value).toBe('métro')
    expect(shelfCalls()).toBe(asked)
    expect($('[role="dialog"]')).toBeNull()
  })

  it('draws a deck from its shelf row at once; only the preview waits', async () => {
    slowDeck = 2
    await mountLibrary('/learn/decks/library/1')
    await settle(400)
    $$('.desk-split__list .lib-card')[1].click()
    await settle(100)
    expect($('.desk-shelf-page .deck-identity__name').textContent).toBe('Kanji du métro')
    expect($('.desk-shelf-page .deck-identity__study').disabled).toBe(true)
    expect($('.desk-shelf-page .card-row')).toBeNull()
    await settle(800)
    expect($('.desk-shelf-page .deck-identity__study').disabled).toBe(false)
    expect($('.desk-shelf-page .card-row')).not.toBeNull()
  })
})

// ── The deck's page ──
const DECK = { id: 5, name: 'Mes mots', type: 'vocab', role: 'owner', card_count: 2 }
const CARDS = [
  { id: 11, origin: 'app', front: '駅', kana: 'えき', back: 'station', fields: {} },
  { id: 12, origin: 'app', front: '電車', kana: 'でんしゃ', back: 'train', fields: {} },
]
const ok = body => ({ ok: true, status: 200, json: async () => body })
function deckApi(cards) {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async path => {
    const p = String(path)
    if (p === '/api/decks/structures') return ok({ structures: [{ key: 'vocab', fields: [] }] })
    if (p === '/api/decks/5') return ok({ ...DECK, card_count: cards.length })
    if (p === '/api/decks/5/cards') return ok({ cards })
    if (p === '/api/decks/5/modes') return ok({ modes: cards.length ? ['vocab.flashcard.f2b'] : [] })
    if (p.startsWith('/api/decks/5/browse')) return ok({ results: [{ raw_id: 'vocab_N5_水_みず', source: 'vocab', level: 'N5', front: '水', kana: 'みず', meaning: 'water', in_deck: false }] })
    return ok({})
  })
}
function mountDeck() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn/decks/5']}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <Routes><Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} /></Routes>
          </div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
}
const modeCalls = () => apiFetch.mock.calls.filter(([p]) => p === '/api/decks/5/modes').length

describe('a deck\'s Browse on the desk', () => {
  it('opens in the side, beside the cards it adds to, and gives the side back', async () => {
    deckApi(CARDS)
    await mountDeck()
    await settle(400)
    expect(modeCalls()).toBe(1)
    const browse = $$('.chip-row button').find(b => /browse|parcourir/i.test(b.textContent))
    browse.click()
    await settle(400)
    expect($('[role="dialog"]')).toBeNull()
    const dock = $('.desk-deck > .desk-side .desk-browse')
    expect(dock).not.toBeNull()
    expect(document.activeElement).toBe(dock.querySelector('.browse-search-input'))
    expect(dock.querySelector('.browse-result-row__front').textContent).toBe('水')
    // Stacked: the meaning under the entry, not beside it.
    const entry = dock.querySelector('.browse-result-row__entry').getBoundingClientRect()
    const meaning = dock.querySelector('.browse-result-row__meaning').getBoundingClientRect()
    expect(meaning.top).toBeGreaterThanOrEqual(entry.bottom - 1)
    expect($('.desk-deck__main .card-list')).not.toBeNull()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect($('.desk-browse')).toBeNull()
    expect($('.desk-deck__study .platform-card')).not.toBeNull()
  })

  it('says an empty deck is empty once, in the page', async () => {
    deckApi([])
    await mountDeck()
    await settle(400)
    expect($$('.empty')).toHaveLength(1)
    expect($('.desk-deck__main .empty')).not.toBeNull()
  })
})

// ── plan 120 — More opens in the side; only its deletion asks ──
// More is a list of what can be done to the deck (import, export, the
// library), not a question, so on the desk it takes the deck page's
// column the way Browse does, taking turns with it. Deleting the deck is
// still asked, in a dialog of its own, as the follower's two
// irreversibles are. The phone's side is deskfree.phone.
const moreChip = () => $$('.chip-row button').find(b => b.querySelector('.chip__dots'))
const escape = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))

describe('a deck\'s More on the desk', () => {
  it('opens in the side, pressed while it holds it, and gives the side back', async () => {
    deckApi(CARDS)
    await mountDeck()
    await settle(400)
    const more = moreChip()
    expect(more.hasAttribute('aria-haspopup')).toBe(false)
    more.focus()
    more.click()
    await settle()
    expect($('[role="dialog"]')).toBeNull()
    const dock = $('.desk-deck > .desk-side .desk-more')
    expect(dock).not.toBeNull()
    expect(more.getAttribute('aria-pressed')).toBe('true')
    expect($('.desk-deck > .desk-side').getAttribute('aria-label')).toBe(dock.querySelector('h2').textContent)
    // Import, Export and Publish, as the phone's sheet lists them, and
    // the deletion under them.
    expect(dock.querySelectorAll('.btn-secondary')).toHaveLength(3)
    expect(dock.querySelector('.btn-primary--danger')).not.toBeNull()
    expect($('.desk-deck__study')).toBeNull()
    expect($('.desk-deck__main .card-list')).not.toBeNull()

    dock.querySelector('.import-header__close').focus()
    escape()
    await settle()
    expect($('.desk-more')).toBeNull()
    expect(more.getAttribute('aria-pressed')).toBe('false')
    expect($('.desk-deck__study .platform-card')).not.toBeNull()
    expect(document.activeElement).toBe(more)
  })

  it('takes turns with Browse in the one column', async () => {
    deckApi(CARDS)
    await mountDeck()
    await settle(400)
    moreChip().click()
    await settle()
    $$('.chip-row button').find(b => /browse|parcourir/i.test(b.textContent)).click()
    await settle(400)
    expect($('.desk-more')).toBeNull()
    expect($('.desk-deck > .desk-side .desk-browse')).not.toBeNull()
    moreChip().click()
    await settle()
    expect($('.desk-browse')).toBeNull()
    expect($('.desk-deck > .desk-side .desk-more')).not.toBeNull()
  })

  it('asks before deleting the deck, in a dialog over the dock', async () => {
    deckApi(CARDS)
    await mountDeck()
    await settle(400)
    moreChip().click()
    await settle()
    $('.desk-more .btn-primary--danger').click()
    await settle()
    const dialog = $('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog.querySelector('.sheet__q')).not.toBeNull()
    expect(dialog.querySelector('.btn-primary--danger')).not.toBeNull()
    // Esc answers the question, not the dock under it.
    escape()
    await settle()
    expect($('[role="dialog"]')).toBeNull()
    expect($('.desk-more')).not.toBeNull()
    expect(apiFetch.mock.calls.some(([, , init]) => init?.method === 'DELETE')).toBe(false)
  })

  it('keeps a follower\'s "make it mine" a question', async () => {
    deckApi(CARDS)
    const answer = apiFetch.getMockImplementation()
    apiFetch.mockImplementation(async (path, ...rest) => (String(path) === '/api/decks/5'
      ? ok({ ...DECK, role: 'follower', author: 'Mei', card_count: CARDS.length })
      : answer(path, ...rest)))
    await mountDeck()
    await settle(400)
    expect(moreChip()).toBeUndefined()
    $$('.chip-row button')[0].click()
    await settle()
    expect($('[role="dialog"] .sheet__q')).not.toBeNull()
    expect($('.desk-side [class*="desk-more"]')).toBeNull()
  })
})
