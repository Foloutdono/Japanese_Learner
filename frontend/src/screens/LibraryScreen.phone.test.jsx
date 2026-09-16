import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── The library's console at 390px ──────────────────────────────
// The screen's controls are the shared console now, and this lane is
// where the new combination has to hold: chips on one line, the
// ordering on the trailing edge of the next, and the field under both
// with the tally pinned right. Nothing here is a new object — the
// console, the chips and the Seg are all drawn elsewhere — but this is
// the first place they are drawn TOGETHER, which is the width at which
// that either works or does not.
//
// The lane runs in French, the wide case both ways (PLUS SUIVIS
// against MOST FOLLOWED, "Chercher dans la bibliothèque…" against
// "Search the library…").

vi.mock('../lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playClick: vi.fn(),
}))
vi.mock('../lib/track', () => ({ track: vi.fn(), EVENTS: {} }))

const DECKS = [
  { id: 7,  name: 'Verbes irréguliers N3', description: 'Les verbes que les listes rangent mal',
    type: 'vocab', card_count: 128, followers: 12, author: 'SwiftKitsune4821' },
  { id: 11, name: 'Kanji du quotidien', description: '', type: 'kanji',
    card_count: 12, followers: 0, author: 'QuietTanuki1207' },
]

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
  apiJson: vi.fn(async () => ({
    results: DECKS, total: 2, page: 0, limit: 24, has_more: false,
    types: ['kanji', 'vocab', 'grammar'],
  })),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))

const { default: LibraryScreen } = await import('./LibraryScreen')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))

beforeEach(() => { document.documentElement.scrollTop = 0 })

async function library() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn/decks/library']}>
        <Routes>
          <Route path="/learn/decks/library" element={<LibraryScreen session={{}} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

const console_ = () => document.querySelector('.console')
const chips    = () => document.querySelector('.console__chips')
const seg      = () => document.querySelector('.seg')
const index    = () => document.querySelector('.console__index')

describe('the library’s console on a phone', () => {
  it('fits the viewport, with nothing pushed off the side', async () => {
    await library()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    for (const el of [console_(), chips(), seg(), index()]) {
      const box = el.getBoundingClientRect()
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(390)
    }
  })

  it('stacks its three parts in reading order: what, how it is ordered, what you ask', async () => {
    await library()
    const c = chips().getBoundingClientRect()
    const s = seg().getBoundingClientRect()
    const f = index().getBoundingClientRect()
    // The Seg leaves the chips their own line rather than sharing one
    // and cutting a chip in half.
    expect(s.top).toBeGreaterThanOrEqual(c.bottom)
    expect(f.top).toBeGreaterThanOrEqual(s.bottom)
    // And it rides the trailing edge, where a lone action rides row 1's.
    expect(390 - s.right).toBeLessThan(s.left)
  })

  it('keeps the field wide enough to read what is typed in it', async () => {
    await library()
    // The count is meta and the field is the control: whatever else
    // shares row 2, at least half of it stays typing room.
    const field = document.querySelector('.console__field')
    expect(field.getBoundingClientRect().width)
      .toBeGreaterThan(index().getBoundingClientRect().width / 2)
    expect(document.querySelector('.console__count').textContent).toContain('2')
  })

  it('is one thumb’s worth of height per control', async () => {
    await library()
    // The console's own family sizes: a chip and a Seg option are the
    // same instrument at the same rung, and row 2 clears 44.
    expect(document.querySelector('.chip').getBoundingClientRect().height)
      .toBeGreaterThanOrEqual(36)
    expect(index().getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
  })
})
