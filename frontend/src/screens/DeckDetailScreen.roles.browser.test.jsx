import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'

// ── A deck you follow is not a deck you own ─────────────────────
// The server refuses every write on a followed deck (403), so the
// screen must not offer one. What it offers instead is the one door
// out: make it mine.
//
// The withdrawn state is the other half — the author has deleted the
// deck and it is here on borrowed time, which the learner has to be
// told plainly or the deck simply disappears one day.
//
// French, like every browser-lane test (vite.config.js forces it).

const requests = []
let deckRow = {}

// What POST /detach answers with, and what GET /api/decks/99 answers
// with afterwards — the same deck, because the screen navigates to it
// and then loads it.
const COPY = { id: 99, name: 'Ma copie', type: 'standard', role: 'owner',
  visibility: 'private', withdrawn: false, followers: 0 }

const CARDS = () => ([
  { origin: 'custom', id: 9, front: '会議', back: 'réunion', kana: 'かいぎ', notes: '', fields: {} },
])

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(async (url, _session, opts) => {
    requests.push(`${opts?.method ?? 'GET'} ${url}`)
    const body = url.includes('/cards') ? { cards: CARDS() }
      : url.includes('/structures')
        ? { structures: [{ key: 'standard', fields: [{ key: 'front', required: true }, { key: 'back', required: true }] }] }
        : url.includes('/detach') ? COPY
          : /\/api\/decks\/99$/.test(url) ? COPY
            : deckRow
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
vi.mock('../lib/track', () => ({ track: vi.fn(), EVENTS: {} }))
vi.mock('../stores/today', () => ({ useTodaySummary: () => ({ data: null }) }))

const { default: DeckDetailScreen } = await import('./DeckDetailScreen')
const { track } = await import('../lib/track')

const settle = (ms = 350) => new Promise(r => setTimeout(r, ms))

async function deck(row) {
  deckRow = row
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

const chips = () => [...document.querySelectorAll('.chip-row .chip')].map(c => c.textContent)
const chip = label => [...document.querySelectorAll('.chip-row .chip')]
  .find(c => c.textContent.includes(label))
const sheetButton = label => [...document.querySelectorAll('.sheet button')]
  .find(b => b.textContent.includes(label))

const MINE = { id: '1', name: 'Mon paquet', type: 'standard', role: 'owner',
  visibility: 'private', withdrawn: false, followers: 0 }
const FOLLOWED = { id: '1', name: 'Leur paquet', type: 'standard', role: 'follower',
  visibility: 'public', withdrawn: false, followers: 4, author: 'SwiftKitsune4821' }

beforeEach(() => { requests.length = 0; track.mockClear() })

describe('a deck you own', () => {
  it('keeps every one of its actions', async () => {
    await deck(MINE)
    const labels = chips().join(' ')
    expect(labels).toContain('Ajouter')
    expect(chip('En faire le mien')).toBeUndefined()
  })

  it('offers publishing from the More sheet, not from the card', async () => {
    await deck(MINE)
    chip('···').click()
    await settle()
    expect(sheetButton('Publier dans la bibliothèque')).toBeDefined()
  })

  it('offers unpublishing once it is public', async () => {
    await deck({ ...MINE, visibility: 'public' })
    chip('···').click()
    await settle()
    expect(sheetButton('Retirer de la bibliothèque')).toBeDefined()
    expect(sheetButton('Publier dans la bibliothèque')).toBeUndefined()
  })

  it('names the followers before deleting a deck people follow', async () => {
    await deck({ ...MINE, visibility: 'public', followers: 4 })
    chip('···').click()
    await settle()
    sheetButton('Supprimer').click()
    await settle()
    const ask = document.querySelector('.sheet__q').textContent
    expect(ask).toContain('4 apprenants')
    expect(ask).toContain('délai')
  })
})

describe('a deck you follow', () => {
  it('offers the copy and the exit, and no writes at all', async () => {
    await deck(FOLLOWED)
    const labels = chips().join(' ')
    expect(labels).toContain('En faire le mien')
    expect(labels).toContain('Ne plus suivre')
    expect(labels).not.toContain('Ajouter')
    expect(labels).not.toContain('Parcourir')
  })

  it('does not let a row open the author’s card for editing', async () => {
    await deck(FOLLOWED)
    // The body is a div, not a button: nothing to press, nothing to
    // fail against a 403.
    expect(document.querySelector('.card-row__body').tagName).toBe('DIV')
    expect(document.querySelector('.card-row__remove')).toBeNull()
  })

  it('asks before making a copy, and says what is kept', async () => {
    await deck(FOLLOWED)
    chip('En faire le mien').click()
    await settle()
    expect(document.querySelector('.sheet__q').textContent).toContain('progression')

    sheetButton('En faire le mien').click()
    await settle()
    expect(requests).toContain('POST /api/decks/1/detach')
    expect(track).toHaveBeenCalledWith('deck_detach',
      expect.objectContaining({ structure: 'standard', withdrawn: false }))
  })

  it('lands on the copy as its owner, with nothing of the original left', async () => {
    // The regression this pins: the screen does NOT unmount when one
    // deck id becomes another, so after the copy it went on showing the
    // followed deck's author, its withdrawn warning and its follower
    // chips under the new deck's id — and left `busy` true and its own
    // confirm sheet standing, which made the next action on that screen
    // (publishing it) a dead button.
    await deck({ ...FOLLOWED, withdrawn: true })
    chip('En faire le mien').click()
    await settle()
    sheetButton('En faire le mien').click()
    await settle(600)

    expect(document.querySelectorAll('.sheet')).toHaveLength(0)
    expect(document.querySelector('.lib-warning')).toBeNull()
    const labels = chips().join(' ')
    expect(labels).toContain('Ajouter')
    expect(labels).not.toContain('En faire le mien')
    // ...and the owner's own actions are live again, not blocked by a
    // `busy` flag left over from the copy.
    chip('···').click()
    await settle()
    expect(sheetButton('Publier dans la bibliothèque')).toBeDefined()
  })

  it('promises the progress is kept when unfollowing', async () => {
    await deck(FOLLOWED)
    chip('Ne plus suivre').click()
    await settle()
    expect(document.querySelector('.sheet__q').textContent).toContain('conservée')
  })

  it('shows no warning while the deck is healthy', async () => {
    await deck(FOLLOWED)
    expect(document.querySelector('.lib-warning')).toBeNull()
  })
})

describe('a deck its author has deleted', () => {
  it('warns, and still lets you study and copy it', async () => {
    await deck({ ...FOLLOWED, withdrawn: true, visibility: 'private' })
    const warning = document.querySelector('.lib-warning')
    expect(warning).not.toBeNull()
    expect(warning.textContent).toContain('Retiré')
    expect(warning.textContent).toContain('supprimé')
    // The point of the grace period: the copy is still reachable.
    expect(chip('En faire le mien')).toBeDefined()
    expect(document.querySelector('.deck-identity__study')).not.toBeNull()
  })

  it('calls the exit Remove, because it is one', async () => {
    await deck({ ...FOLLOWED, withdrawn: true, visibility: 'private' })
    expect(chips().join(' ')).toContain('Retirer')
    chip('Retirer').click()
    await settle()
    expect(document.querySelector('.sheet__q').textContent).toContain('définitivement')
  })
})
