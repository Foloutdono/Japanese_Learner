import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import fr from './locales/fr/index.js'
import './index.css'

// Blocking a deck's author on the desk (plan 310, the owner's pick C):
// the pane beside the library's shelf is the same page, so its corner
// carries the same ··· and the block asks and goes back the same way.
// The phone's side is deckBlockAuthor.phone.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
vi.mock('./lib/track', () => ({ track: vi.fn(), countUse: vi.fn() }))
const DECK = { id: 7, name: 'Le vocabulaire du train', type: 'standard', card_count: 42, author: 'Tifa',
  followers: 12, followed: false, role: 'visitor', description: '',
  preview: [{ id: 1, front: '駅', kana: 'えき', back: 'gare' }] }
const posts = []
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async (path, _s, opts = {}) => {
    if (opts.method) posts.push([opts.method, path, opts.body])
    if (path === '/api/decks/library/7') return DECK
    return { status: 'blocked' }
  }),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))

const { PublicDeckPane } = await import('./components/decks/PublicDeckPage')
const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

describe('the library\'s deck pane, on the desk', () => {
  it('opens ··· beside the shelf, and blocks after asking', async () => {
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/decks/library/7']}>
          <Routes>
            <Route path="/learn/decks/library/:deck_id"
              element={<PublicDeckPane deckId="7" listed={null} session={{}} />} />
            <Route path="/learn/decks/library" element={<p id="landed">library</p>} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    $('.deck-identity__more').click()
    await settle(150)
    const rows = $$('.more-row').map(b => b.querySelector('.more-row__label').textContent)
    expect(rows).toEqual([fr.libraryReportDeck, fr.libraryBlockAuthor('Tifa')])
    $$('.more-row')[1].click()
    await settle(100)
    expect($('.sheet__q').textContent).toBe(fr.libraryBlockConfirm('Tifa'))
    $$('button').find(b => b.textContent.trim() === fr.pvpBlock).click()
    await settle(200)
    expect(posts).toContainEqual(['POST', '/api/pvp/blocks', JSON.stringify({ username: 'Tifa' })])
    expect($('#landed')).not.toBeNull()
  })
})
