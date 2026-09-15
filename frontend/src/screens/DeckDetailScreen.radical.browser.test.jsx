import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import '../index.css'

// ── Filing a personal kanji card under its radical ──────────────
// A kanji card carries the Kangxi NUMBER, so the form has to show the
// glyphs. It showed all 214 of them at once: every stroke group
// stacked inside a 260px scroller, 18px glyphs in wrapped rows, a
// second scrolling surface inside a page that already scrolls.
//
// It asks the question the way the two indexes ask it now — the
// StrokeRail, then one stroke count's radicals — so there is one
// instrument for "which radical?" in the app rather than three.
//
// French, like every browser-lane test (vite.config.js forces it).

const DECK = { id: '1', name: 'Mes kanji', type: 'kanji', role: 'owner',
  visibility: 'private', withdrawn: false, followers: 0 }

const STRUCTURES = [{
  key: 'kanji',
  fields: [
    { key: 'kanji', required: true },
    { key: 'radical', required: true, picker: 'radical' },
  ],
}]

// Three stroke counts, so the rail has somewhere to walk to and an end
// to stop at.
const RADICALS = {
  groups: [
    { stroke_count: 1, radicals: [{ number: 1, char: '一', kanji_count: 17 }] },
    { stroke_count: 3, radicals: [
      { number: 30, char: '口', kanji_count: 66 },
      { number: 85, char: '氵', kanji_count: 123 },
    ] },
    { stroke_count: 7, radicals: [{ number: 149, char: '言', kanji_count: 40 }] },
  ],
}

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(async url => {
    const body = String(url).includes('/api/dictionary/radicals') ? RADICALS
      : String(url).includes('/cards') ? { cards: [] }
        : String(url).includes('/structures') ? { structures: STRUCTURES }
          : DECK
    return { ok: true, status: 200, json: async () => body }
  }),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('../lib/audio', async o => ({ ...(await o()), playUi: () => {}, playClick: () => {}, playAnnouncement: () => {} }))
vi.mock('../lib/track', () => ({ track: vi.fn(), EVENTS: {} }))
vi.mock('../stores/today', () => ({ useTodaySummary: () => ({ data: null }) }))

const { default: DeckDetailScreen } = await import('./DeckDetailScreen')
const { default: fr } = await import('../locales/fr/index.js')

const settle = (ms = 350) => new Promise(r => setTimeout(r, ms))

async function form() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn/decks/1']}>
        <Routes>
          <Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
  const all = sel => [...screen.container.querySelectorAll(sel)]
  // The form is behind the deck's own "add a card".
  all('.chip-row .chip').find(c => c.textContent.includes('Ajouter')).click()
  await settle(60)
  return { all, one: sel => screen.container.querySelector(sel) }
}

const openPicker = async s => { s.one('.deckdetail-form__radical-btn').click(); await settle(60) }
const cells = s => s.all('.radical-picker__cell').map(c => c.textContent)

beforeEach(() => {})

describe('the radical field', () => {
  it('asks the way the two indexes ask it, one stroke count at a time', async () => {
    const s = await form()
    expect(s.one('.deckdetail-form__placeholder').textContent).toBe(fr.pickRadical)
    expect(s.one('.radical-picker'), 'closed until the field is opened').toBeNull()

    await openPicker(s)
    // Every stroke count the endpoint knows is a key; the page under
    // them is one count's radicals, not all 214.
    expect(s.all('.stroke-rail__key .stroke-rail__n').map(n => n.textContent)).toEqual(['1', '3', '7'])
    expect(cells(s)).toEqual(['一'])
    expect(s.one('.stroke-rail__step--left').disabled, 'nothing before 1画').toBe(true)

    // The chevron walks it; a key jumps straight to one.
    s.one('.stroke-rail__step--right').click()
    await settle(60)
    expect(cells(s)).toEqual(['口', '氵'])
    s.all('.stroke-rail__key')[2].click()
    await settle(60)
    expect(cells(s)).toEqual(['言'])
    expect(s.one('.stroke-rail__step--right').disabled, 'nor after the last one').toBe(true)
  })

  it('stores the number, shows the glyph, and reopens where the choice was made', async () => {
    const s = await form()
    await openPicker(s)
    s.one('.stroke-rail__step--right').click()
    await settle(60)
    s.all('.radical-picker__cell')[1].click()   // 氵, radical 85
    await settle(60)

    // Chosen: the picker closes and the field prints the glyph and the
    // number it actually stores.
    expect(s.one('.radical-picker')).toBeNull()
    expect(s.one('.deckdetail-form__radical-btn').textContent).toBe('氵 · 85')

    await openPicker(s)
    expect(cells(s), 'reopens on 3画, where 氵 was chosen').toEqual(['口', '氵'])
    expect(s.one('.radical-picker__cell--on').textContent).toBe('氵')
  })
})
