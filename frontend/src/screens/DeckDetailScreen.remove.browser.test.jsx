import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── Taking one card out of a deck ───────────────────────────────
// Every row carries a remove, and what it does depends on what the row
// IS. A browsed-in card is a link into the app's own kanji/vocab/
// grammar decks: removing it loses nothing the app does not still
// hold, and Browse puts it back in two taps, so it goes on the tap. A
// hand-written card is the learner's own text with no undo behind it,
// so it asks first — in the sheet, named — the way the deck's own
// deletion asks.
//
// Pinned on the real screen with lib/api mocked at its boundary, so
// what is asserted is the request that reaches the server (or, for the
// cancel, the one that does not).

const deletes = []

const CARDS = () => ([
  { origin: 'app', source: 'vocab', level: 'N5', raw_id: 'a', front: '毎月', kana: 'まいげつ', back: 'chaque mois' },
  { origin: 'custom', id: 9, front: 'Word', back: 'Patatra', kana: 'caca', notes: '', fields: {} },
])

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(async (url, _session, opts) => {
    if (opts?.method === 'DELETE') deletes.push(url)
    const body = url.includes('/cards') ? { cards: CARDS() }
      : url.includes('/structures') ? { structures: [{ key: 'vocab', fields: [{ key: 'word', required: true }] }] }
        : { id: '1', name: 'test', type: 'vocab' }
    return { ok: true, status: 200, json: async () => body }
  }),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()), playUi: () => {}, playClick: () => {}, playAnnouncement: () => {},
}))
vi.mock('../stores/today', () => ({ useTodaySummary: () => ({ data: null }) }))

const { default: DeckDetailScreen } = await import('./DeckDetailScreen')

const settle = (ms = 350) => new Promise(r => setTimeout(r, ms))

async function deck() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn/decks/1']}>
        <Routes>
          <Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

// The two rows in order: the browsed-in one, then the hand-written one.
const removes = () => [...document.querySelectorAll('.card-row__remove')]
const sheet = () => document.querySelector('.sheet')

beforeEach(() => { deletes.length = 0 })

describe('the row remove', () => {
  it('asks before deleting a hand-written card, and names it', async () => {
    await deck()
    removes()[1].click()
    await settle()

    expect(sheet()).toBeTruthy()
    // "this card" needs something to point at.
    expect(sheet().querySelector('.sheet__jp').textContent).toBe('Word')
    expect(deletes).toEqual([])
  })

  it('deletes nothing when the ask is cancelled', async () => {
    await deck()
    removes()[1].click()
    await settle()
    sheet().querySelector('.btn-secondary').click()
    await settle()

    expect(sheet()).toBeNull()
    expect(deletes).toEqual([])
  })

  it('deletes the card once the ask is answered', async () => {
    await deck()
    removes()[1].click()
    await settle()
    sheet().querySelector('.btn-primary--danger').click()
    await settle()

    expect(deletes).toEqual(['/api/decks/1/cards/9'])
    expect(sheet()).toBeNull()
  })

  it('takes a browsed-in card out on the tap, with nothing to answer', async () => {
    await deck()
    removes()[0].click()
    await settle()

    expect(sheet()).toBeNull()
    expect(deletes).toEqual(['/api/decks/1/cards/app?source=vocab&raw_id=a'])
  })
})
