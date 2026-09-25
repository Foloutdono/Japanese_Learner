import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 棚 — the shelf and the library beside the lines (plan 131) ──────
// The Learn gate on the desk: the learner's decks, each a door with what
// it is due, over the library's head of list — a row opens the deck's
// preview in the panel's place (three cards as tiles, Follow, the way
// back), Follow puts it on the shelf, and the search opens the library
// on its answer. The layout itself is gates.desktop.

const SHELF = [
  { id: 11, name: 'Verbes du quotidien', type: 'vocab', card_count: 48, role: 'owner', visibility: 'private' },
  { id: 12, name: 'Kanji de la cuisine', type: 'kanji', card_count: 32, role: 'owner', visibility: 'public' },
]
const FOLLOWED = { id: 21, name: 'Genki I', type: 'vocab', card_count: 312, role: 'follower', author: 'mika' }
const LIBRARY = [
  { id: 21, name: 'Genki I', type: 'vocab', card_count: 312, author: 'mika', followers: 1240 },
  { id: 22, name: 'Onomatopées', type: 'standard', card_count: 96, author: 'lucie', followers: 412, description: 'Les sons du quotidien.' },
]
let followed = false
const apiJson = vi.fn()
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playAnnouncement: vi.fn(), playClick: vi.fn() }))
vi.mock('./lib/track', () => ({ track: vi.fn() }))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 5, by_source: { personal: 5 }, lanes: [{ kind: 'personal', deck_id: 11, due: 5 }] }, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
vi.mock('./stores/profileSummary', async o => ({ ...(await o()), useProfileSummary: () => ({ jlptLevel: 'N5' }) }))
vi.mock('./hooks/useGuide', () => ({ useGuide: () => ({ open: false, onEnd() {} }) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

beforeEach(() => {
  followed = false
  apiJson.mockReset()
  apiJson.mockImplementation(async (url, _s, init) => {
    const u = String(url)
    if (u === '/api/decks') return { decks: followed ? [...SHELF, FOLLOWED] : SHELF }
    if (u.startsWith('/api/decks/library?')) return { results: followed ? LIBRARY.slice(1) : LIBRARY }
    if (u === '/api/decks/21/subscribe' && init?.method === 'POST') { followed = true; return { ok: true } }
    const m = u.match(/^\/api\/decks\/library\/(\d+)$/)
    if (m) {
      const deck = LIBRARY.find(d => d.id === Number(m[1]))
      return { ...deck, followed: false, preview: [
        { id: 1, front: 'ぽかぽか', back: 'doux et chaud' },
        { id: 2, front: 'ざあざあ', back: 'pluie battante' },
        { id: 3, front: 'ぺこぺこ', back: 'affamé' },
        { id: 4, front: 'どきどき', back: 'le cœur qui bat' },
      ] }
    }
    return {}
  })
})

const { default: LearnScreen } = await import('./screens/LearnScreen')

const settle = (ms = 400) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const seen = { path: null }
function Probe() {
  const { pathname, search } = useLocation()
  seen.path = pathname + search
  return null
}
function mount() {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn']}>
        <div className="phone phone--desk">
          <div className="phone__content"><LearnScreen session={{}} /></div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
}
const libraryNames = () => $$('.gate-panel--library .gate-row__name').map(e => e.textContent)

describe('the shelf beside the lines', () => {
  it('lists every deck as a door, with what it is due and what it is', async () => {
    await mount()
    await settle()
    const rows = $$('.gate-panel--shelf .gate-row')
    expect(rows.map(r => r.querySelector('.gate-row__name').textContent)).toEqual(['Verbes du quotidien', 'Kanji de la cuisine'])
    expect(rows[0].getAttribute('href')).toBe('/learn/decks/11')
    expect(rows[0].querySelector('.plate__due').textContent).toMatch(/^5/)
    expect(rows[1].querySelector('.gate-row__mine').textContent).toBe('publié')
    expect($('.gate-panel--shelf .plate__meta').textContent).toBe('2 decks · 80 cartes')
  })
})

describe('the library beside the shelf', () => {
  it('opens a row as its preview, three cards as tiles, and goes back to the list', async () => {
    await mount()
    await settle()
    expect(libraryNames()).toEqual(['Genki I', 'Onomatopées'])
    $$('.gate-panel--library .gate-row__open')[1].click()
    await settle()
    expect($('.gate-panel--library .deck-preview__name').textContent).toBe('Onomatopées')
    expect($$('.gate-panel--library .deck-sample__jp').map(e => e.textContent)).toEqual(['ぽかぽか', 'ざあざあ', 'ぺこぺこ'])
    expect($('.gate-panel--library .deck-preview__blurb').textContent).toBe('Les sons du quotidien.')
    expect($('.gate-panel--library .deck-preview__actions a').getAttribute('href')).toBe('/learn/decks/library/22')
    $('.gate-panel--library .deck-preview__top button').click()
    await settle(100)
    expect($('.gate-panel--library .deck-preview')).toBeNull()
    expect(libraryNames()).toEqual(['Genki I', 'Onomatopées'])
  })

  it('follows in place: the deck joins the shelf and leaves the list', async () => {
    await mount()
    await settle()
    $('.gate-panel--library .gate-follow').click()
    await settle()
    expect(apiJson.mock.calls.some(([u, , i]) => u === '/api/decks/21/subscribe' && i?.method === 'POST')).toBe(true)
    expect($$('.gate-panel--shelf .gate-row__name').map(e => e.textContent)).toContain('Genki I')
    expect(libraryNames()).toEqual(['Onomatopées'])
  })

  it('asks the other ordering, and opens the library on a search', async () => {
    await mount()
    await settle()
    const [followedFirst, newest] = $$('.gate-panel--library .gate-seg > button')
    expect(followedFirst.getAttribute('aria-pressed')).toBe('true')
    newest.click()
    await settle()
    expect(apiJson.mock.calls.some(([u]) => String(u).startsWith('/api/decks/library?sort=new'))).toBe(true)
    const field = $('.gate-panel--library input[type="search"]')
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(field, 'métro')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(100)
    field.form.requestSubmit()
    await settle(100)
    expect(seen.path).toBe('/learn/decks/library?q=m%C3%A9tro')
  })
})
