import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── 教材's two doors at 390px ───────────────────────────────────
// The library is a door beside the one that creates a deck now,
// rather than a preview shelf under a grid that grows past it. The
// pair is why it is not in the bar's aside: measured here, the two
// come to 304px of a 348px row, so a bar carrying both leaves the
// name 44px and wraps it under them. What this lane pins is that the
// row they moved to holds them side by side, that they stay the same
// object at the same height, and that the bar keeps its one line.
//
// The lane runs in French, which is the wide case both ways —
// PARCOURIR against BROWSE, "Créer un deck" against "Create deck".

vi.mock('../lib/audio', async o => ({
  ...(await o()), playUi: vi.fn(), playClick: vi.fn(),
}))
vi.mock('../stores/today', () => ({ useTodaySummary: () => ({ data: null }) }))

const DECKS = [
  { id: 1, name: 'bababa', type: 'standard', card_count: 0 },
  { id: 2, name: 'aabab', type: 'grammar', card_count: 0 },
  { id: 3, name: 'baeva', type: 'kanji', card_count: 0 },
  { id: 4, name: 'ggaaga', type: 'vocab', card_count: 0 },
]

const { default: DecksScreen } = await import('./DecksScreen')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(url => {
    const path = String(url)
    // The shelf is the ONE request this screen makes now: the preview
    // of somebody else's decks left with the block that drew it.
    if (path.includes('/api/decks/library')) throw new Error(`unexpected library request: ${path}`)
    return Promise.resolve(new Response(JSON.stringify({ decks: DECKS }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }))
  })
})

async function shelf() {
  const seen = []
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn/decks']}>
        <Routes>
          <Route path="/learn/decks" element={<DecksScreen session={null} />} />
          <Route path="/learn/decks/library" element={<span data-testid="library" />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  return seen
}

const doors  = () => document.querySelector('.decks-doors')
const browse = () => [...document.querySelectorAll('.decks-doors .chip')]
  .find(c => c.textContent.trim().toUpperCase() === 'PARCOURIR')
const cancel = () => [...document.querySelectorAll('.decks-doors .chip')]
  .find(c => c.textContent.trim().toUpperCase() === 'ANNULER')
const create = () => document.querySelector('.decks-doors .console__action')

describe('the shelf’s bar on a phone', () => {
  it('carries both doors, and the library one goes to the library', async () => {
    await shelf()
    expect(browse()).toBeTruthy()
    expect(create()).toBeTruthy()
    browse().click()
    await settle()
    expect(document.querySelector('[data-testid="library"]')).toBeTruthy()
  })

  it('is a destination and not a filter, so it reports no pressed state', async () => {
    await shelf()
    expect(browse().hasAttribute('aria-pressed')).toBe(false)
    expect(create().hasAttribute('aria-pressed')).toBe(false)
  })

  it('sits the pair on one row, inside the viewport', async () => {
    await shelf()
    const b = browse().getBoundingClientRect()
    const c = create().getBoundingClientRect()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    expect(doors().getBoundingClientRect().right).toBeLessThanOrEqual(390)
    // Side by side, not stacked, and in that order.
    expect(b.top).toBe(c.top)
    expect(b.right).toBeLessThanOrEqual(c.left)
    // And they share the row rather than ending ragged: together they
    // are all but the gap between them.
    expect(b.width + c.width).toBeGreaterThan(doors().getBoundingClientRect().width - 12)
  })

  it('is the same object twice — one ghost, one filled, one height', async () => {
    await shelf()
    const b = browse().getBoundingClientRect()
    const c = create().getBoundingClientRect()
    expect(b.height).toBe(c.height)
    expect(b.height).toBeGreaterThanOrEqual(36)
    // The filled one is the create action; the library door is a ghost
    // (DESIGN.md: one screen, one filled action).
    const bg = getComputedStyle(browse()).backgroundColor
    expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(bg)
    expect(getComputedStyle(create()).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  it('leaves the bar to name the place, on one line', async () => {
    await shelf()
    const title = document.querySelector('.bar__title')
    expect(document.querySelector('.bar__aside')).toBeFalsy()
    expect(title.getBoundingClientRect().height).toBeLessThanOrEqual(34)
  })

  it('keeps the library door while the create form is open', async () => {
    await shelf()
    create().click()
    await settle()
    expect(document.querySelector('.form')).toBeTruthy()
    // Only the door that opened the form becomes the way out of it.
    expect(browse()).toBeTruthy()
    expect(cancel()).toBeTruthy()
    expect(create()).toBeFalsy()
  })

  it('draws no library shelf under the grid', async () => {
    await shelf()
    expect(document.querySelector('.lib-shelf')).toBeFalsy()
    expect(document.querySelector('.lib-card')).toBeFalsy()
  })
})

// ── A new deck on a filtered shelf (plan 123) ───────────────────
// Creating a deck closed the form but left the type chip and the
// query in force, so a Standard deck made under the Kanji chip was
// filtered out of the shelf it had just been added to.
describe('a deck made on a filtered shelf', () => {
  it('shows the new deck, with the filters cleared', async () => {
    const posted = []
    globalThis.fetch.mockImplementation((url, init) => {
      if (init?.method === 'POST') {
        posted.push(JSON.parse(init.body))
        return Promise.resolve(new Response(JSON.stringify({ id: 9, name: 'nouveau', type: 'standard' }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        }))
      }
      return Promise.resolve(new Response(JSON.stringify({ decks: DECKS }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }))
    })
    await shelf()
    const kanji = [...document.querySelectorAll('.console .chip')].find(c => c.textContent.includes('Kanji'))
    kanji.click()
    await settle()
    expect([...document.querySelectorAll('.deck-card .platform-card__title')].map(n => n.textContent)).toEqual(['baeva'])
    create().click()
    await settle()
    const field = document.querySelector('.form .field')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, 'nouveau')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    document.querySelector('.form .btn-primary').click()
    await settle(150)
    expect(posted).toEqual([{ name: 'nouveau', type: 'standard' }])
    const titles = [...document.querySelectorAll('.deck-card .platform-card__title')].map(n => n.textContent)
    expect(titles).toContain('nouveau')
    expect(titles).toHaveLength(5)
  })
})

// ── 歌 — a lyrics deck is made from its song (plan 263) ─────────
// Picked in the create form, the lyrics type turns the form's action
// into the import, which opens over the shelf with the name typed and
// posts no deck of its own: the deck is made once its song is read.
describe('a lyrics deck', () => {
  it('opens the import from the create form, with the name typed', async () => {
    const posted = []
    globalThis.fetch.mockImplementation((url, init) => {
      if (init?.method === 'POST') posted.push(String(url))
      return Promise.resolve(new Response(JSON.stringify({ decks: DECKS }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }))
    })
    await shelf()
    create().click()
    await settle()
    const field = document.querySelector('.form .field')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, '夜に駆ける')
    field.dispatchEvent(new Event('input', { bubbles: true }))
    const lyrics = [...document.querySelectorAll('.type-row')].find(r => r.textContent.includes('Paroles'))
    lyrics.click()
    await settle()
    const action = document.querySelector('.form .btn-primary')
    expect(action.textContent).toBe('Importer les paroles')
    action.click()
    await settle()
    expect(document.querySelector('.form')).toBeFalsy()
    const sheet = document.querySelector('[role="dialog"].lyr-sheet')
    expect(sheet).toBeTruthy()
    expect(sheet.querySelector('.seg')).toBeTruthy()
    expect(posted).toEqual([])
    // Inside the viewport, as every sheet on a phone.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
  })
})
