import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider, useLang } from '../LangContext'
import '../index.css'

// The dictionary at its route (plan 073): the bar, the analyzer's door,
// the console of collections, the catalogue of cards and the entry on
// its plate — the real screen over a mocked API.

const KANJI = {
  type: 'kanji', kanji: '駅', kana: 'エキ・えき・うまや', meaning: 'station', level: 'N5',
  status: { status: 'mastered', total_reviews: 14, correct_reviews: 13, accuracy: 92, interval_days: 21, next_review: '2026-09-20T00:00:00Z', due: false },
  stroke_count: 14, radical: 187,
  // Every reading with the words that use it (study/kanji_words.py):
  // うまや has none and prints as a chip in the sheet's kun register.
  readings: [
    { reading: 'エキ', words: [{ kanji: '駅員', kana: 'えきいん', meaning: 'station staff' }] },
    { reading: 'えき', words: [{ kanji: '駅前', kana: 'えきまえ', meaning: 'in front of the station' }] },
    { reading: 'うまや', words: [] },
  ],
  vocab_examples: [
    { kanji: '駅員', kana: 'えきいん', meaning: 'station staff' },
    { kanji: '駅前', kana: 'えきまえ', meaning: 'in front of the station' },
  ],
}
const VOCAB = {
  type: 'vocab', kanji: '電車', kana: 'でんしゃ', meaning: 'electric train', level: 'N5',
  status: { status: 'new' },
  furigana: [{ text: '電車', reading: 'でんしゃ' }],
  senses: [], examples: [{ jp: '電車で行く。', en: 'Go by train.', sense_number: null }],
}
// The JMdict pool: no card, no level.
const NOCARD = { type: 'jmdict', kanji: '駅弁', kana: 'えきべん', meaning: 'station lunch box', level: null }
// A page of filler behind them, so the infinite-scroll sentinel sits
// below the fold: with it in view, the observer would page the moment
// the query changes (before the debounced search), which is the screen
// behaving as built for a full page, not what these cases pin.
const FILLER = Array.from({ length: 60 }, (_, i) => ({
  type: 'jmdict', kanji: `語${i}`, kana: `ご${i}`, meaning: `word ${i}`, level: null,
}))
const RESULTS = [KANJI, VOCAB, NOCARD, ...FILLER]

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(), apiJson: vi.fn(), apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('../lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), speakJapanese: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: DictionaryScreen } = await import('./DictionaryScreen')
const { apiFetch } = await import('../lib/api')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

// The locale's own strings, read from the provider rather than
// imported, so the cases hold in whichever language the lane runs.
let T
function Probe() {
  T = useLang().t
  return null
}

// Where the router ended up, for the door's four ways in.
let WHERE = null
function Where() {
  WHERE = useLocation()
  return null
}

async function renderScreen() {
  const screen = await render(
    <LangProvider>
      <Probe />
      <MemoryRouter initialEntries={['/dictionary']}>
        <Where />
        <Routes>
          <Route path="/dictionary" element={<DictionaryScreen session={{}} />} />
          <Route path="/dictionary/analyzer" element={<div className="probe-analyzer" />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle(80)
  return screen
}

const searches = () => apiFetch.mock.calls.map(([path]) => String(path)).filter(p => p.startsWith('/api/dictionary?'))
const lastQuery = () => new URLSearchParams(searches().at(-1).split('?')[1])

function typeInto(el, text) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(el, text)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

beforeEach(() => {
  apiFetch.mockReset()
  apiFetch.mockImplementation(async path => ({
    ok: true, status: 200,
    json: async () => {
      const p = String(path)
      if (p.startsWith('/api/dictionary/radicals')) return { groups: [] }
      if (p.startsWith('/api/dictionary?')) return { results: RESULTS, total: RESULTS.length, has_more: false }
      return {}
    },
  }))
})

describe('the dictionary screen', () => {
  it("opens on the bar, the analyzer's door and the console of collections", async () => {
    const screen = await renderScreen()
    expect(screen.container.querySelector('.bar__title').textContent).toBe(T.dictionaryTitle)

    // The door names the analyzer and its three intakes, and opens it.
    // The row is a container of buttons, not a button: its three
    // intakes each open a platform of their own (below).
    const door = screen.container.querySelector('.anl-door')
    expect(door.querySelector('.anl-door__title').textContent).toBe(T.analyzerTitle)
    expect(door.querySelectorAll('.anl-door__intake').length).toBe(3)

    // Five collections as chips, kanji on; the radical index is a sixth
    // chip that only exists under the kanji collection.
    const chips = [...screen.container.querySelectorAll('.console__chips .chip')]
    expect(chips.length).toBe(6)
    expect(chips[0].classList.contains('chip--on')).toBe(true)
    expect(chips[0].textContent).toBe(T.dictKanji)
    expect(lastQuery().get('category')).toBe('kanji')

    door.querySelector('.anl-door__open').click()
    await settle(30)
    expect(screen.container.querySelector('.probe-analyzer')).not.toBeNull()
  })

  it('switches the collection from the chips and drops the radical index off kanji', async () => {
    const screen = await renderScreen()
    const chips = () => [...screen.container.querySelectorAll('.console__chips .chip')]
    chips()[1].click()
    await settle(80)
    expect(lastQuery().get('category')).toBe('vocab')
    expect(chips().length).toBe(5)
    expect(chips()[1].classList.contains('chip--on')).toBe(true)
    expect(chips()[0].classList.contains('chip--on')).toBe(false)
  })

  it('the catalogue: a card per entry with its level and its stage, the count in the console', async () => {
    const screen = await renderScreen()
    const cards = [...screen.container.querySelectorAll('.dict-grid .dict-entry-card')]
    expect(cards.length).toBe(RESULTS.length)
    expect(cards[0].querySelector('.dict-level-badge').textContent).toBe('N5')
    expect(cards[0].querySelector('.stage-mark').textContent).toBe(T.mastered)
    expect(cards[0].querySelector('.dict-entry-card__char').textContent).toBe('駅')
    expect(cards[1].querySelector('.stage-mark').textContent).toBe(T.new)
    expect(cards[1].querySelector('.dict-entry-card__kana').textContent).toBe('でんしゃ')
    // No card and no level: the JMdict entry prints neither mark.
    expect(cards[2].querySelector('.stage-mark')).toBeNull()
    expect(cards[2].querySelector('.dict-level-badge')).toBeNull()
    expect(screen.container.querySelector('.console__count').textContent).toBe(T.dictionaryResults(RESULTS.length))
  })

  it('a card opens the entry on its plate; the readings door opens the sheet; ‹ closes the entry', async () => {
    const screen = await renderScreen()
    screen.container.querySelectorAll('.dict-entry-card')[0].click()
    await settle(60)
    const entry = screen.container.querySelector('.dict-entry')
    expect(entry).not.toBeNull()
    const plate = entry.querySelector('.dict-plate')
    expect(plate.querySelector('.dict-plate__word').textContent).toBe('駅')
    expect(plate.querySelector('.dict-plate__level').textContent).toBe('N5')
    expect(plate.querySelector('.stage-mark').textContent).toBe(T.mastered)
    expect(plate.querySelector('.dict-plate__caption').textContent).toMatch(/^station$/i)
    // One on and one kun reading on the plate, and the door to the rest.
    const yomi = [...plate.querySelectorAll('.dict-plate__yomi')]
    expect(yomi.length).toBe(2)
    expect(yomi[0].textContent).toBe('音エキ')
    expect(yomi[1].textContent).toBe('訓えき')
    const more = plate.querySelector('.dict-plate__more')
    expect(more.textContent).toContain('+1')
    // The body: the words that use it, the form, the record.
    expect(entry.querySelectorAll('.dict-word').length).toBe(2)
    expect(entry.querySelector('.dict-form')).not.toBeNull()
    expect(entry.querySelector('.records')).not.toBeNull()
    expect(entry.querySelector('.records').textContent).toContain('92')

    more.click()
    await settle(60)
    // The readings sheet (the entry's own, over the dock): the on
    // register and the kun register; うまや, which no word carries,
    // sits in the kun register as a chip.
    const sheet = document.querySelector('.dict-sheet__scrim--over .dict-sheet[role="dialog"]')
    expect(sheet).not.toBeNull()
    expect(sheet.querySelectorAll('.dict-register').length).toBe(2)
    expect(sheet.querySelector('.dict-register__chip').textContent).toBe('うまや')
    document.querySelector('.dict-sheet__scrim--over').click()
    await settle(60)
    expect(document.querySelector('.dict-sheet__scrim--over')).toBeNull()
    expect(screen.container.querySelector('.dict-entry')).not.toBeNull()

    plate.querySelector(`.dict-plate__btn[aria-label="${T.close}"]`).click()
    await settle(60)
    expect(screen.container.querySelector('.dict-entry')).toBeNull()
  })

  it('typing in the index searches after the pause; the clear empties it', async () => {
    const screen = await renderScreen()
    const before = searches().length
    const field = screen.container.querySelector('.console__field')
    typeInto(field, 'えき')
    await settle(100)
    expect(searches().length, 'the search waits for the pause').toBe(before)
    await settle(350)
    expect(searches().length).toBe(before + 1)
    expect(lastQuery().get('q')).toBe('えき')
    expect(screen.container.querySelector('.console__field').value).toBe('えき')

    screen.container.querySelector('.console__clear').click()
    await settle(400)
    expect(screen.container.querySelector('.console__field').value).toBe('')
    expect(lastQuery().get('q')).toBe('')
  })

  // ── The analyzer's door, and the three doors on it ──
  // The intakes were decorations inside the row's own button: three
  // <svg> tags with no `fill` and no `stroke`, so the browser filled
  // each closed path black and dropped every line — an empty ring, a
  // black blob, half a camcorder. They are the platforms behind the
  // door, so they are buttons that open it standing on one.
  it('draws its three platforms as glyphs, and opens the analyzer plainly', async () => {
    const screen = await renderScreen()
    const door = screen.container.querySelector('.anl-door')
    const intakes = [...door.querySelectorAll('.anl-door__intake')]
    expect(intakes.map(b => b.dataset.intake)).toEqual(['text', 'photo', 'video'])
    for (const intake of intakes) {
      expect(intake.tagName).toBe('BUTTON')
      expect(intake.getAttribute('aria-label').length).toBeGreaterThan(0)
      // Stroked, never filled — the whole of the bug, in two attributes.
      const glyph = intake.querySelector('svg')
      expect(glyph.getAttribute('fill')).toBe('none')
      expect(glyph.getAttribute('stroke')).toBe('currentColor')
      expect(glyph.getBoundingClientRect().width).toBeGreaterThan(0)
    }
    // The row itself is still one press, to the analyzer as it opens.
    door.querySelector('.anl-door__open').click()
    await settle(60)
    expect(WHERE.pathname + WHERE.search).toBe('/dictionary/analyzer')
  })

  it.each(['photo', 'video', 'text'])('opens the analyzer standing on %s', async key => {
    const screen = await renderScreen()
    screen.container.querySelector(`[data-intake="${key}"]`).click()
    await settle(60)
    expect(WHERE.pathname + WHERE.search).toBe(`/dictionary/analyzer?intake=${key}`)
  })
})
