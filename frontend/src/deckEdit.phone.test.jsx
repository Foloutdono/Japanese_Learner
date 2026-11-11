import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// A deck's card editor on a phone: the form opens over the list, so a
// card pressed far down it carries the page up to its editor, which
// lands under the HUD rather than behind it, and holds the card's
// Delete. The desk's side is decks.desktop.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
vi.mock('./stores/today', () => ({
  useTodaySummary: () => ({ data: { total: 0, by_source: {}, lanes: [], next_due: null }, failed: false }),
  refreshToday: vi.fn(), seedTodaySummary: vi.fn(),
}))
const DECK = { id: 1, name: 'Voyage', type: 'standard', role: 'owner', card_count: 30 }
const CARDS = Array.from({ length: 30 }, (_, i) => ({
  id: 100 + i, origin: 'custom', front: `駅${i}`, kana: 'えき', back: `gare ${i}`, state: 'new',
  fields: { front: `駅${i}`, back: `gare ${i}` },
}))
const STRUCTURES = [{ key: 'standard', fields: [{ key: 'front', required: true }, { key: 'back', required: true }] }]
const json = body => ({ ok: true, status: 200, json: async () => body })
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async path => {
    if (path === '/api/decks/structures') return json({ structures: STRUCTURES })
    if (path === '/api/decks/1') return json(DECK)
    if (path === '/api/decks/1/cards') return json({ cards: CARDS })
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

describe('a card\'s editor on a phone', () => {
  it('carries the page up to the form a card far down the list opens, its Delete in it', async () => {
    const scrolled = vi.spyOn(Element.prototype, 'scrollIntoView')
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/decks/1']}>
          <div className="phone">
            <div className="phone__content">
              <Routes><Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} /></Routes>
            </div>
          </div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    expect($('.deckdetail-form')).toBeNull()
    $$('.card-list .card-row__body').at(-1).click()
    await settle(60)
    const form = $('.deckdetail-form')
    expect(form).not.toBeNull()
    expect(scrolled.mock.contexts.at(-1)).toBe(form)
    expect(scrolled.mock.calls.at(-1)[0]).toMatchObject({ block: 'start' })
    // Under the HUD, not behind it.
    expect(parseFloat(getComputedStyle(form).scrollMarginTop)).toBeGreaterThanOrEqual(48)
    expect(form.querySelector('.btn-secondary--danger')?.textContent.trim()).toBe('Supprimer')
    scrolled.mockRestore()
  })
})
