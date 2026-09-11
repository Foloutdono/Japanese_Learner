import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── The library screen ──────────────────────────────────────────
// What other learners published. Pinned on the real screen with
// lib/api mocked at its boundary, so what is asserted is the request
// the screen actually makes and the rows it draws from the answer.
//
// The browser lane runs in French (vite.config.js forces it), so the
// strings below are the French table's.

const calls = []

const DECKS = [
  { id: 7,  name: 'Verbes N3', description: 'Les irréguliers', type: 'vocab',
    card_count: 42, followers: 3, author: 'SwiftKitsune4821', followed: false },
  { id: 11, name: 'Kanji du quotidien', description: '', type: 'kanji',
    card_count: 12, followers: 0, author: 'QuietTanuki1207', followed: false },
]

let payload = () => ({
  results: DECKS, total: 2, page: 0, limit: 24, has_more: false,
})

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
  apiJson: vi.fn(async url => { calls.push(url); return payload() }),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()), playUi: () => {}, playClick: () => {}, playAnnouncement: () => {},
}))
vi.mock('../lib/track', () => ({ track: vi.fn(), EVENTS: {} }))

const { default: LibraryScreen } = await import('./LibraryScreen')
const { track } = await import('../lib/track')

const settle = (ms = 350) => new Promise(r => setTimeout(r, ms))

async function library() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn/decks/library']}>
        <Routes>
          <Route path="/learn/decks/library" element={<LibraryScreen session={{}} />} />
          <Route path="/learn/decks/library/:deck_id" element={<p>deck page</p>} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

const cards = () => [...document.querySelectorAll('.lib-card')]

beforeEach(() => {
  calls.length = 0
  payload = () => ({ results: DECKS, total: 2, page: 0, limit: 24, has_more: false })
})

describe('the library', () => {
  it('draws a card per published deck, with its author and followers', async () => {
    await library()
    expect(cards()).toHaveLength(2)

    const first = cards()[0]
    expect(first.textContent).toContain('Verbes N3')
    expect(first.textContent).toContain('par SwiftKitsune4821')
    expect(first.querySelector('.lib-card__follows').textContent).toBe('3 abonnés')
    expect(first.querySelector('.lib-card__blurb').textContent).toBe('Les irréguliers')
    expect(first.querySelector('.deck-card__fig').textContent).toBe('42')
  })

  it('says nothing about followers when nobody follows yet', async () => {
    await library()
    // A zero is not information here; the row is quieter without it.
    expect(cards()[1].querySelector('.lib-card__follows')).toBeNull()
  })

  it('asks for the newest first, and reports the tally', async () => {
    await library()
    expect(calls[0]).toBe('/api/decks/library?sort=new&page=0')
    expect(document.querySelector('.lib-controls__count').textContent).toContain('2')
  })

  it('records the visit without naming a deck', async () => {
    await library()
    expect(track).toHaveBeenCalledWith('library_view', { sort: 'new', results: 2 })
    // The one rule this feature could most easily break.
    const props = track.mock.calls[0][1]
    expect(JSON.stringify(props)).not.toContain('Verbes')
  })

  it('reorders without leaving the screen', async () => {
    await library()
    const [, followed] = [...document.querySelectorAll('.seg__opt')]
    expect(followed.textContent).toBe('Plus suivis')
    followed.click()
    await settle()
    expect(calls.at(-1)).toBe('/api/decks/library?sort=followed&page=0')
  })

  it('names the empty library rather than showing a bare screen', async () => {
    payload = () => ({ results: [], total: 0, page: 0, limit: 24, has_more: false })
    await library()
    expect(cards()).toHaveLength(0)
    expect(document.querySelector('.empty').textContent).toContain('Rien de publié')
  })

  it('pages by appending, so the row you were reading stays put', async () => {
    payload = () => ({ results: [DECKS[0]], total: 2, page: 0, limit: 1, has_more: true })
    await library()
    expect(cards()).toHaveLength(1)

    payload = () => ({ results: [DECKS[1]], total: 2, page: 1, limit: 1, has_more: false })
    document.querySelector('.lib-shelf__more').click()
    await settle()

    expect(cards()).toHaveLength(2)
    expect(cards()[0].textContent).toContain('Verbes N3')
  })
})
