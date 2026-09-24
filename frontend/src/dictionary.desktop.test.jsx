import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the dictionary's dock on the desk (plan 114) ────────────
// On a phone the entry is a sheet that is opened and closed. On the desk
// the dock is the catalogue's standing companion: open from the first
// frame on the page's first row, following every collection and search,
// with no ✕ — and a door in the entry opens INTO the dock (the lookup
// sheet's own body), so nothing is covered and the catalogue never
// moves. ←/→ walk the dock along the tiles. The phone's half is
// deskfree.phone.test.jsx and DictionaryScreen.browser.test.

const KANJI = {
  type: 'kanji', kanji: '駅', kana: 'エキ・えき', meaning: 'station', level: 'N5',
  status: { status: 'learning' },
  readings: [{ reading: 'エキ', words: [{ kanji: '駅員', kana: 'えきいん', meaning: 'station staff' }] }],
  vocab_examples: [{ kanji: '駅員', kana: 'えきいん', meaning: 'station staff' }],
}
const VOCAB = {
  type: 'vocab', kanji: '電車', kana: 'でんしゃ', meaning: 'electric train', level: 'N5',
  status: { status: 'new' }, furigana: [{ text: '電車', reading: 'でんしゃ' }],
  kanji_parts: [{ char: '電', reading: 'でん', meaning: 'electricity' }],
  senses: [], examples: [],
}
const BY_TERM = {
  '電': { type: 'kanji', kanji: '電', kana: 'デン', meaning: 'electricity', level: 'N5', status: { status: 'new' } },
}
const ROWS = [KANJI, VOCAB, { type: 'kanji', kanji: '山', kana: 'サン・やま', meaning: 'mountain', level: 'N5', status: { status: 'new' } }]

vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: vi.fn(async () => ({ decks: [] })),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn(), speakJapanese: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: DictionaryScreen } = await import('./screens/DictionaryScreen')
const { apiFetch } = await import('./lib/api')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async path => ({
    ok: true, status: 200,
    json: async () => {
      const p = String(path)
      if (p.startsWith('/api/dictionary/radicals')) return { groups: [] }
      if (p.startsWith('/api/dictionary?')) {
        const term = new URLSearchParams(p.split('?')[1]).get('q')
        if (term && BY_TERM[term]) return { results: [BY_TERM[term]], total: 1, has_more: false }
        return { results: ROWS, total: ROWS.length, has_more: false }
      }
      return {}
    },
  }))
})

async function mount(entry = '/dictionary') {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <Routes><Route path="/dictionary" element={<DictionaryScreen session={{}} />} /></Routes>
          </div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(250)
  return screen
}

const headword = () => {
  const w = document.querySelector('.dict-dock .dict-plate__word')?.cloneNode(true)
  w?.querySelectorAll('rt').forEach(rt => rt.remove())
  return w?.textContent
}

describe('the dock on the desk', () => {
  it('is open from the first frame, on the page\'s first row, beside the catalogue', async () => {
    await mount()
    const dock = document.querySelector('.dict-dock')
    expect(dock).not.toBeNull()
    expect(headword()).toBe('駅')
    const grid = document.querySelector('.dict-grid').getBoundingClientRect()
    expect(dock.getBoundingClientRect().left).toBeGreaterThan(grid.right - 1)
    expect(Math.round(dock.getBoundingClientRect().width)).toBe(360)
    // A standing companion, not a panel that was opened: nothing closes it.
    const labels = [...dock.querySelectorAll('button')].map(b => b.getAttribute('aria-label'))
    expect(labels.filter(l => /fermer|close/i.test(l ?? ''))).toEqual([])
  })

  it('shows the tile that is chosen', async () => {
    await mount()
    ;[...document.querySelectorAll('.dict-entry-card')].find(c => c.textContent.includes('電車')).click()
    await settle()
    expect(headword()).toBe('電車')
  })

  it('opens a door INTO the dock, and steps back out of it', async () => {
    await mount()
    ;[...document.querySelectorAll('.dict-entry-card')].find(c => c.textContent.includes('電車')).click()
    await settle()
    document.querySelector('.dict-dock .dict-word').click()
    await settle(250)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(headword()).toBe('電')
    // Escape steps out of the door, back to the entry it was opened from.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(headword()).toBe('電車')
    // And never empties the dock.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(headword()).toBe('電車')
  })

  it('walks the tiles with ← and →', async () => {
    await mount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await settle()
    expect(headword()).toBe('電車')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await settle()
    expect(headword()).toBe('山')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    await settle()
    expect(headword()).toBe('電車')
  })

  it('walks nothing under a dialog, nor on the browser\'s Back chord (plan 123)', async () => {
    await mount()
    const dialog = document.createElement('div')
    dialog.setAttribute('aria-modal', 'true')
    document.body.appendChild(dialog)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    await settle()
    dialog.remove()
    expect(headword()).toBe('駅')
    const back = new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true, cancelable: true })
    window.dispatchEvent(back)
    await settle()
    expect(back.defaultPrevented).toBe(false)
    expect(headword()).toBe('駅')
  })
})

describe('the search key', () => {
  it('lands in the field when the rail\'s "/" brought the learner here', async () => {
    await mount({ pathname: '/dictionary', state: { focusSearch: true } })
    expect(document.activeElement?.tagName).toBe('INPUT')
    expect(document.activeElement.closest('.dictionary')).not.toBeNull()
  })

  it('does not take the focus on an ordinary arrival', async () => {
    await mount()
    expect(document.activeElement?.tagName).not.toBe('INPUT')
  })
})

// ── plan 120 — every reading, in the entry's own place ──
// On a phone "+N" opens the kanji's readings in a sheet over the entry.
// On the desk the entry stands in a column, and a door in it opens in
// that column: the list takes the entry's place, and ✕ or Esc steps
// back to the entry with the focus on the door again. Inside a lookup
// that is itself a dialog, the same holds and Esc peels only the list.
// The phone's side is deskfree.phone.
describe('the readings on the desk', () => {
  const escape = () => (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
  )

  it('open in the dock, in the entry\'s place, and step back to it', async () => {
    await mount()
    const door = document.querySelector('.dict-dock .dict-plate__more')
    expect(door.hasAttribute('aria-haspopup')).toBe(false)
    door.click()
    await settle()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    const list = document.querySelector('.dict-dock .desk-readings')
    expect(list).not.toBeNull()
    expect(list.getAttribute('aria-label')).toContain('駅')
    expect(list.querySelector('.dict-readings__glyph').textContent).toBe('駅')
    expect(list.querySelector('.dict-rd__yomi').textContent).toBe('エキ')
    expect(document.querySelector('.dict-dock .dict-plate__word')).toBeNull()
    expect(document.activeElement).toBe(list.querySelector('.dict-plate__btn'))
    // The catalogue is untouched beside it.
    expect(document.querySelectorAll('.dict-grid .dict-entry-card').length).toBe(3)

    escape()
    await settle()
    expect(document.querySelector('.desk-readings')).toBeNull()
    expect(document.querySelector('.dict-dock .dict-plate__word').textContent).toBe('駅')
    expect(document.activeElement).toBe(document.querySelector('.dict-dock .dict-plate__more'))
  })

  it('open in a lookup dialog\'s own place, and Esc peels only the list', async () => {
    const { DictionaryLookupSheet } = await import('./components/dictionary/DictionaryDetail')
    const onClose = vi.fn()
    await render(
      <LangProvider>
        <DictionaryLookupSheet term="駅" category="kanji" session={{}} onClose={onClose} />
      </LangProvider>
    )
    await settle(250)
    const dialog = document.querySelector('.dict-sheet[role="dialog"]')
    dialog.querySelector('.dict-plate__more').click()
    await settle()
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(dialog.querySelector('.desk-readings .dict-readings')).not.toBeNull()

    escape()
    await settle()
    expect(onClose).not.toHaveBeenCalled()
    expect(dialog.querySelector('.desk-readings')).toBeNull()
    expect(dialog.querySelector('.dict-plate__word').textContent).toBe('駅')

    escape()
    await settle()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// ── plan 123, P15 — the catalogue walked as a grid ──
// One tab stop, the open tile; the arrows walk the grid as the eye
// reads it and open the tile they land on, so the ring and the dock
// agree; ↓ from the search field steps in on the open tile.
describe('the catalogue walked by key (plan 123)', () => {
  const tiles = () => [...document.querySelectorAll('.dict-grid > .dict-entry-card')]
  it('is one tab stop, walked by row and column, the dock following', async () => {
    await mount()
    expect(tiles().filter(t => t.tabIndex === 0)).toEqual([tiles()[0]])
    expect(tiles()[0].getAttribute('aria-current')).toBe('true')
    const search = document.querySelector('.dict-search input, input[type="search"], .console input')
    search.focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(tiles()[0])
    await userEvent.keyboard('{ArrowRight}')
    await settle()
    // One tile, not two: the page's own ←/→ did not walk it again.
    expect(document.activeElement).toBe(tiles()[1])
    expect(headword()).toBe('電車')
    const columns = getComputedStyle(document.querySelector('.dict-grid')).gridTemplateColumns.split(' ').length
    await userEvent.keyboard('{Home}')
    await settle()
    expect(document.activeElement).toBe(tiles()[0])
    await userEvent.keyboard('{ArrowDown}')
    await settle()
    expect(document.activeElement).toBe(tiles()[Math.min(columns, tiles().length - 1)])
    expect(tiles().filter(t => t.tabIndex === 0)).toEqual([document.activeElement])
  })
})


// ── plan 123, P18 — the focus and the scroll through a door ──
// A door in the dock unmounts with the entry it belongs to: the focus
// fell to the page's body and the entry came back at its top. The door
// has the focus again on the way back, the entry scrolled where it was.
describe('a door in the dock, and back', () => {
  it('gives the focus back to the door, and the entry its scroll', async () => {
    await mount()
    ;[...document.querySelectorAll('.dict-entry-card')].find(c => c.textContent.includes('電車')).click()
    await settle()
    const dock = document.querySelector('.dict-dock')
    // Short enough to scroll, whatever the entry holds.
    dock.style.maxHeight = '160px'
    dock.scrollTop = 60
    await settle(60)
    const read = dock.scrollTop
    expect(read).toBeGreaterThan(0)
    dock.querySelector('.dict-word').focus({ preventScroll: true })
    await userEvent.keyboard('{Enter}')
    await settle(250)
    expect(headword()).toBe('電')
    expect(dock.contains(document.activeElement)).toBe(true)
    await userEvent.keyboard('{Escape}')
    await settle()
    expect(headword()).toBe('電車')
    expect(document.activeElement).toBe(dock.querySelector('.dict-word'))
    expect(dock.scrollTop).toBe(read)
  })
})
