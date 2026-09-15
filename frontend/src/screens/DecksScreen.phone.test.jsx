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
