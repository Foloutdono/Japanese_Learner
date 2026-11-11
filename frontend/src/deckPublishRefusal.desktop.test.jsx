import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import fr from './locales/fr/index.js'
import './index.css'

// The library's refusal on the desk (plan 310): More is a column there,
// in the gate's place, and draws the rows the phone's sheet does, the
// refusal with them; the refused card opens in the side's card dock,
// saying so. The phone's side is deckPublishRefusal.phone.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
vi.mock('./lib/track', () => ({ track: vi.fn(), countUse: vi.fn() }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 0, by_source: {}, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
const DECK = { id: 1, name: 'Voyage', type: 'standard', role: 'owner', visibility: 'private', card_count: 2 }
const CARDS = [
  { id: 11, origin: 'custom', front: '駅', back: 'gare', state: 'new', fields: { front: '駅', back: 'gare' } },
  { id: 14, origin: 'custom', front: '改札', back: 'portillon', state: 'new', fields: { front: '改札', back: 'portillon' } },
]
const STRUCTURES = [{ key: 'standard', fields: [{ key: 'front', required: true }, { key: 'back', required: true }] }]
const json = (body, status = 200) => ({ ok: status < 300, status, json: async () => body })
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async (path, _s, opts = {}) => {
    if (opts.method === 'POST' && path === '/api/decks/1/publish') {
      return json({ detail: { code: 'content_refused', message: 'content_refused', field: 'card', card_id: 14 } }, 422)
    }
    if (path === '/api/decks/structures') return json({ structures: STRUCTURES })
    if (path === '/api/decks/1') return json(DECK)
    if (path === '/api/decks/1/cards') return json({ cards: CARDS })
    if (path === '/api/decks/1/modes') return json({ modes: ['standard.flashcard.f2b'] })
    return json({})
  }),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue(json({}))

const { default: DeckDetailScreen } = await import('./screens/DeckDetailScreen')
const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

describe('a refused publish, on the desk', () => {
  it('says why in the More column, and opens the card in the side saying so', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/decks/1']}>
          <Routes><Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    $(`[aria-label="${fr.deckMore}"]`).click()
    await settle(150)
    const column = $('.desk-more')
    expect(column).not.toBeNull()
    $$('.desk-more .more-row').find(b => b.textContent.includes(fr.libraryPublish)).click()
    await settle(200)
    expect(column.querySelector('.sheet__q--danger').textContent).toBe(fr.libraryRefusedCard('改札'))

    $$('.desk-more button').find(b => b.textContent.trim() === fr.libraryOpenCard).click()
    await settle(200)
    expect($('.desk-more')).toBeNull()
    const dock = $('.desk-cardform')
    expect(dock).not.toBeNull()
    expect(dock.querySelector('.deckdetail-form__refused').textContent).toBe(fr.cardRefused)
    expect(dock.querySelector('input').value).toBe('改札')
  })
})
