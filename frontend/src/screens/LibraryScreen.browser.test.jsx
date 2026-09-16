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

const TYPES = ['vocab', 'kanji']

let payload = () => ({
  results: DECKS, total: 2, page: 0, limit: 24, has_more: false, types: TYPES,
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

const settle = (ms = 400) => new Promise(r => setTimeout(r, ms))

// A controlled React input reads its value off the node, so the setter
// has to be the native one for React's own onChange to see the change.
function type(field, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

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
  payload = () => ({ results: DECKS, total: 2, page: 0, limit: 24, has_more: false, types: TYPES })
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
    expect(document.querySelector('.console__count').textContent).toContain('2')
  })

  it('records the visit without naming a deck', async () => {
    await library()
    expect(track).toHaveBeenCalledWith('library_view', { sort: 'new', results: 2, filtered: false })
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
    payload = () => ({ results: [], total: 0, page: 0, limit: 24, has_more: false, types: [] })
    await library()
    expect(cards()).toHaveLength(0)
    expect(document.querySelector('.empty').textContent).toContain('Rien de publié')
  })

  // ── The console (chips, field, count) ──

  it('draws a chip per structure the library holds, and no others', async () => {
    await library()
    const chips = [...document.querySelectorAll('.console__chips .chip')]
    // "All", then the two the answer reported -- never grammar, which
    // nobody has published: a filter that can only return nothing.
    expect(chips.map(c => c.textContent.replace(/[単漢]/g, '').trim()))
      .toEqual(['Tous', 'Vocabulaire', 'Kanji'])
  })

  it('draws no chip row when the library holds one structure', async () => {
    // "All" beside a lone "Vocabulary" is a choice between everything
    // and everything.
    payload = () => ({ results: [DECKS[0]], total: 1, page: 0, limit: 24, has_more: false, types: ['vocab'] })
    await library()
    expect(document.querySelector('.console__chips')).toBeNull()
    // The ordering stays: it is a choice whatever the shelf holds.
    expect(document.querySelectorAll('.seg__opt')).toHaveLength(2)
  })

  it('asks the server to narrow by structure, from page 0', async () => {
    await library()
    const kanji = [...document.querySelectorAll('.console__chips .chip')]
      .find(c => c.textContent.includes('Kanji'))
    kanji.click()
    await settle()
    expect(calls.at(-1)).toBe('/api/decks/library?sort=new&page=0&type=kanji')
  })

  it('searches the server once the typing stops, not once per keystroke', async () => {
    await library()
    const before = calls.length
    const field = document.querySelector('.console__field')

    type(field, 'ver')
    type(field, 'verb')
    // Mid-debounce: nothing has been asked yet.
    expect(calls.length).toBe(before)

    await settle()
    expect(calls.length).toBe(before + 1)
    expect(calls.at(-1)).toBe('/api/decks/library?sort=new&page=0&q=verb')
  })

  it('says a search found nothing rather than that nobody has published', async () => {
    await library()
    payload = () => ({ results: [], total: 0, page: 0, limit: 24, has_more: false, types: TYPES })
    type(document.querySelector('.console__field'), 'zzz')
    await settle()

    const empty = document.querySelector('.empty')
    expect(empty.textContent).toContain('Aucun deck ne correspond')
    expect(empty.textContent).not.toContain('Rien de publié')

    // And the way out of it puts the whole library back.
    payload = () => ({ results: DECKS, total: 2, page: 0, limit: 24, has_more: false, types: TYPES })
    empty.querySelector('button').click()
    await settle()
    expect(calls.at(-1)).toBe('/api/decks/library?sort=new&page=0')
    expect(cards()).toHaveLength(2)
  })

  it('tells the trail that the shelf was narrowed, never what was typed', async () => {
    await library()
    type(document.querySelector('.console__field'), 'verbes')
    await settle()

    const [name, props] = track.mock.calls.at(-1)
    expect(name).toBe('library_view')
    expect(props.filtered).toBe(true)
    expect(JSON.stringify(props)).not.toContain('verbes')
  })

  it('pages by appending, so the row you were reading stays put', async () => {
    payload = () => ({ results: [DECKS[0]], total: 2, page: 0, limit: 1, has_more: true, types: TYPES })
    await library()
    expect(cards()).toHaveLength(1)

    payload = () => ({ results: [DECKS[1]], total: 2, page: 1, limit: 1, has_more: false, types: TYPES })
    document.querySelector('.lib-shelf__more').click()
    await settle()

    expect(cards()).toHaveLength(2)
    expect(cards()[0].textContent).toContain('Verbes N3')
  })
})
