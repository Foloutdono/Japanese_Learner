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
    // --desk-entry-w since plan 128, and level with the analyser's door.
    const width = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--desk-entry-w'))
    expect(Math.round(dock.getBoundingClientRect().width)).toBe(width)
    expect(Math.round(dock.getBoundingClientRect().top)).toBe(Math.round(document.querySelector('.anl-door').getBoundingClientRect().top))
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


// ── plan 128 — the catalogue and its entry, two columns ──
// The entry stood in the results, under the analyser's door and the
// console, at the side column's 360px: its foot hung some 230px below
// the window, so the page scrolled before the entry could. It stands
// beside the whole catalogue now, from the page's top, at
// --desk-entry-w; a character's entry reads whole in the window, and
// its plate is laid across. A word or a grammar point keeps the plate
// stacked -- 〜てください, laid across, wrapped its own pattern and set
// its structure line a character a line. The phone's side is
// deskfree.phone.
describe('the catalogue and its entry (plan 128)', () => {
  const word = (kanji, kana, meaning, furigana) => ({ kanji, kana, meaning, level: 'N5', furigana })
  const DO = {
    type: 'kanji', kanji: '土', kana: 'ド・ト・つち', word_reading: 'つち', meaning: 'sol; terre; terrain; Turquie', level: 'N5',
    stroke_count: 3, radical: 32, radical_glyph: '土', radical_name: 'つち', svg_url: '/kanjivg/0571f.svg',
    status: { status: 'learning', total_reviews: 12, correct_reviews: 10, accuracy: 83, due: false, interval_days: 6, next_review: '2026-09-28T09:00:00+00:00' },
    app_card: { source: 'kanji', level: 'N5', raw_id: 'kanji_N5_土' },
    vocab_examples: [
      word('土曜日', 'どようび', 'samedi', [{ text: '土', reading: 'ど' }, { text: '曜', reading: 'よう' }, { text: '日', reading: 'び' }]),
      word('土地', 'とち', 'parcelle de terrain', [{ text: '土', reading: 'と' }, { text: '地', reading: 'ち' }]),
      word('土', 'つち', 'terre, sol', [{ text: '土', reading: 'つち' }]),
      word('土曜', 'どよう', 'samedi', [{ text: '土', reading: 'ど' }, { text: '曜', reading: 'よう' }]),
    ],
    readings: [{ reading: 'ド', words: [] }, { reading: 'ト', words: [] }, { reading: 'つち', words: [] }],
  }
  const POINT = {
    type: 'grammar', raw_id: 'grammar_N5_〜てください', level: 'N5', pattern: '〜てください',
    structure: 'verb て-form + ください', meaning: 'faites..., s\'il vous plaît', status: { status: 'new' },
    steps: [], compare: [], examples: [],
  }
  const serve = rows => apiFetch.mockImplementation(async path => ({
    ok: true, status: 200,
    json: async () => (String(path).startsWith('/api/dictionary/radicals')
      ? { groups: [{ stroke_count: 1, radicals: [{ number: 1, char: '一', kanji_count: 32 }] }] }
      : { results: rows, total: rows.length, has_more: false }),
  }))

  it('stands beside the whole catalogue from the page\'s top, and never past the window', async () => {
    serve([DO, KANJI])
    await mount()
    const dock = document.querySelector('.dict-dock').getBoundingClientRect()
    for (const part of ['.anl-door', '.console', '.dict-grid']) {
      expect(document.querySelector(`.desk-dict__main ${part}`).getBoundingClientRect().right).toBeLessThan(dock.left)
    }
    expect(dock.bottom).toBeLessThanOrEqual(innerHeight)
  })

  it('reads a character\'s entry whole: the plate, the sheet, the words and the record', async () => {
    serve([DO, KANJI])
    await mount()
    const dock = document.querySelector('.dict-dock')
    expect(dock.querySelectorAll('.dict-word')).toHaveLength(4)
    expect(dock.querySelector('.records')).not.toBeNull()
    expect(dock.scrollHeight).toBeLessThanOrEqual(dock.clientHeight)
    expect(dock.getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight)
  })

  it('lays a character\'s plate across, and keeps a word\'s and a grammar point\'s stacked', async () => {
    serve([DO, VOCAB, POINT])
    await mount()
    const plate = () => document.querySelector('.dict-dock .dict-plate')
    expect(getComputedStyle(plate()).display).toBe('grid')
    // The glyph at the left, its readings beside it.
    const glyph = plate().querySelector('.dict-plate__word').getBoundingClientRect()
    expect(plate().querySelector('.dict-plate__readings').getBoundingClientRect().left).toBeGreaterThan(glyph.right)

    ;[...document.querySelectorAll('.dict-entry-card')].find(c => c.textContent.includes('電車')).click()
    await settle()
    expect(getComputedStyle(plate()).display).toBe('flex')

    ;[...document.querySelectorAll('.dict-entry-card')].find(c => c.textContent.includes('てください')).click()
    await settle()
    expect(getComputedStyle(plate()).display).toBe('flex')
    // The pattern on one line, and its structure a line across the plate.
    const pattern = plate().querySelector('.dict-plate__word')
    expect(pattern.getBoundingClientRect().height).toBeLessThan(2 * parseFloat(getComputedStyle(pattern).fontSize))
    expect(plate().querySelector('.dict-plate__structure').getBoundingClientRect().height)
      .toBeLessThan(2 * parseFloat(getComputedStyle(plate().querySelector('.dict-plate__structure')).lineHeight))
  })

  it('holds its column under a search, and gives the width up to the radical index', async () => {
    serve([DO, KANJI])
    await mount()
    const columns = () => getComputedStyle(document.querySelector('.desk-dict')).gridTemplateColumns.split(' ').length
    const input = document.querySelector('.console input')
    input.focus()
    await userEvent.fill(input, 'z')
    // The entry is gone while the page loads; its column is not.
    expect(document.querySelector('.dict-dock')).toBeNull()
    expect(columns()).toBe(2)
    await settle(600)
    await userEvent.fill(input, '')
    await settle(600)

    document.querySelector('.console__toggle').click()
    await settle()
    expect(document.querySelector('.desk-dict--bare')).not.toBeNull()
    expect(document.querySelector('.dict-dock')).toBeNull()
    expect(columns()).toBe(1)
    expect(Math.round(document.querySelector('.desk-dict__main').getBoundingClientRect().width))
      .toBe(Math.round(document.querySelector('.desk-dict').getBoundingClientRect().width))
  })
})

// ── plan 128 — the grammar page ──
// The grammar collection turns the split round: its points one to a row
// in the side column, the entry across the rest of the canvas, its
// plate laid left with the marks beside the pattern (over it, for a
// long one, which beside them broke across two lines on this lane), the
// learner's record under the stripe, the lesson in one column here and
// two on a wider desk (dictionary.wide). Points: the catalogue's own
// payloads for は, 〜てください and 〜なければなりません.
describe('the grammar page (plan 128)', () => {
  const token = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  const serveGrammar = async () => {
    const { default: POINTS } = await import('./testing/grammarPoints.json')
    apiFetch.mockImplementation(async () => ({
      ok: true, status: 200, json: async () => ({ results: POINTS, total: POINTS.length, has_more: false }),
    }))
  }
  const open = pattern => [...document.querySelectorAll('.dict-entry-card')]
    .find(c => c.querySelector('.dict-entry-card__char').textContent.trim() === pattern).click()
  const plate = () => document.querySelector('.dict-dock .dict-plate')
  const box = sel => document.querySelector(sel).getBoundingClientRect()

  it('lists the points in the side column and gives the entry the rest', async () => {
    await serveGrammar()
    await mount('/dictionary?category=grammar')
    expect(document.querySelector('.desk-dict--page')).not.toBeNull()
    // At most the side column, and the entry never narrower than the
    // kanji's: on this lane, the narrowest desk, the list gives.
    expect(Math.round(box('.desk-dict__main').width)).toBeLessThanOrEqual(token('--desk-side-w'))
    expect(Math.round(box('.dict-dock').width)).toBeGreaterThanOrEqual(token('--desk-entry-w'))
    expect(getComputedStyle(document.querySelector('.dict-grid')).gridTemplateColumns.split(' ')).toHaveLength(1)
    const dock = box('.dict-dock')
    expect(dock.left).toBeGreaterThan(box('.desk-dict__main').right)
    expect(Math.round(dock.right)).toBe(Math.round(box('.desk-dict').right))
    expect(Math.round(dock.top)).toBe(Math.round(box('.anl-door').top))
    expect(dock.bottom).toBeLessThanOrEqual(innerHeight)
    // A row: the pattern over its gloss, the level at the right.
    const row = document.querySelector('.dict-entry-card')
    expect(row.querySelector('.dict-entry-card__meaning').getBoundingClientRect().top)
      .toBeGreaterThanOrEqual(row.querySelector('.dict-entry-card__char').getBoundingClientRect().bottom - 1)
    expect(row.querySelector('.dict-level-badge').getBoundingClientRect().left)
      .toBeGreaterThan(row.querySelector('.dict-entry-card__meaning').getBoundingClientRect().right - 1)

    // The kanji keep the entry's column (A).
    ;[...document.querySelectorAll('.console .chip')].find(c => /kanji/i.test(c.textContent)).click()
    await settle(300)
    expect(document.querySelector('.desk-dict--page')).toBeNull()
  })

  it('lays the plate left, the marks beside a pattern and over a long one', async () => {
    await serveGrammar()
    await mount('/dictionary?category=grammar')
    open('〜てください')
    await settle()
    const stack = plate().querySelector('.dict-plate__stack').getBoundingClientRect()
    expect(plate().querySelector('.dict-plate__row').getBoundingClientRect().left).toBeGreaterThan(stack.right - 1)
    const word = plate().querySelector('.dict-plate__word')
    expect(word.getBoundingClientRect().left - plate().getBoundingClientRect().left).toBeLessThan(2 * token('--sp-5'))
    expect(word.getBoundingClientRect().height).toBeLessThan(2 * parseFloat(getComputedStyle(word).fontSize))

    open('〜なければなりません')
    await settle()
    const long = plate().querySelector('.dict-plate__word')
    expect(plate().querySelector('.dict-plate__row').getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(long.getBoundingClientRect().top)
    expect(long.getBoundingClientRect().height).toBeLessThan(2 * parseFloat(getComputedStyle(long).fontSize))
  })

  it('sets the learner\'s record under the stripe, before the lesson', async () => {
    await serveGrammar()
    await mount('/dictionary?category=grammar')
    open('〜てください')
    await settle()
    const record = document.querySelector('.dict-dock .records').getBoundingClientRect()
    expect(record.top).toBeGreaterThan(plate().querySelector('.dict-plate__stripe').getBoundingClientRect().bottom - 1)
    expect(record.bottom).toBeLessThanOrEqual(document.querySelector('.dict-dock .gl-body').getBoundingClientRect().top + 1)
    expect(getComputedStyle(document.querySelector('.dict-dock .records')).gridTemplateColumns.split(' ')).toHaveLength(4)
  })
})
