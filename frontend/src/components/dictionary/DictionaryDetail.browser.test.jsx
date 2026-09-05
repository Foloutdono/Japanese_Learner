import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { LangProvider } from '../../LangContext'
// The rules asserted below only exist once the real sheet is loaded —
// same explicit import every style-asserting browser test carries.
import '../../index.css'

// ── 見出し語 — the entry, as a plate ──────────────────────────
// The detail panel is the catalogue's plate at reading size: reading
// over headword over plain-language caption, 辞書's pigment as its
// stripe, and a body of blocks that name themselves. These tests pin
// the things DESIGN.md decides and a screenshot cannot: that the
// registers are there, that no block prints a heading, that every
// lattice divides its content, that the pigment is 辞書's wherever the
// panel opens, that the plate stays put while the body scrolls, and
// that the same panel is the whole screen on a phone and a column
// beside the catalogue on a desktop.

vi.mock('../../lib/audio', async o => ({ ...(await o()), speakJapanese: vi.fn(), playUi: vi.fn() }))
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
  apiJson: vi.fn(async () => ({})),
  apiJsonWithTimeout: vi.fn(async () => ({})),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))

// LangContext fetches the content maps on mount; the stroke sheet
// fetches its KanjiVG file. Both offline here — the sheet gets a
// two-stroke stand-in so the lattice's first cell holds a drawing.
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 109 109"><g stroke="#000" fill="none"><path d="M20,54 L89,54"/><path d="M54,20 L54,89"/></g></svg>'
globalThis.fetch = vi.fn(async url => ({
  ok: true, status: 200,
  json: async () => ({}),
  text: async () => (String(url).includes('kanjivg') ? SVG : ''),
}))

const { DictionaryDetail, DictionaryLookupSheet } = await import('./DictionaryDetail')
const { speakJapanese } = await import('../../lib/audio')
const { apiFetch } = await import('../../lib/api')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

// Resolve a token expression to the colour or length Chromium computes
// for it, so an assertion compares two computed values and never a
// hand-copied constant.
function probe(prop, expr, host = document.body) {
  const el = document.createElement('div')
  el.style[prop] = expr
  host.appendChild(el)
  const v = getComputedStyle(el)[prop]
  el.remove()
  return v
}

// ── Fixtures, shaped like routes/dictionary.py's payloads ──────
const KANJI = {
  type: 'kanji', kanji: '木', kana: 'モク・ボク・き・こ-', meaning: 'tree; wood',
  stroke_count: 4, radical: 75, level: 'N5', svg_url: '/kanjivg/06728.svg',
  status: {
    status: 'learning', total_reviews: 14, correct_reviews: 12, accuracy: 86,
    interval_days: 7, next_review: '2026-09-12T08:00:00Z', due: true,
  },
  vocab_examples: [
    { kanji: '木曜日', kana: 'もくようび', meaning: 'Thursday', level: 'N5',
      furigana: [{ text: '木', reading: 'もく' }, { text: '曜', reading: 'よう' }, { text: '日', reading: 'び' }] },
    { kanji: '木材', kana: 'もくざい', meaning: 'lumber, timber, wood', level: 'N2',
      furigana: [{ text: '木', reading: 'もく' }, { text: '材', reading: 'ざい' }] },
    { kanji: '木', kana: 'き', meaning: 'tree, shrub, bush', level: 'N5',
      furigana: [{ text: '木', reading: 'き' }] },
    { kanji: '植木', kana: 'うえき', meaning: 'garden shrubs, trees, potted plant', level: 'N1',
      furigana: [{ text: '植', reading: 'うえ' }, { text: '木', reading: 'き' }] },
  ],
}

const VOCAB = {
  type: 'vocab', kanji: '食べる', kana: 'たべる', meaning: 'to eat', level: 'N5',
  furigana: [{ text: '食', reading: 'た' }, { text: 'べる' }],
  senses: [
    { number: 1, glossary: 'to eat',
      tags: [{ code: 'v1', label: 'v1', tooltip: 'Ichidan verb' }, { code: 'vt', label: 'vt', tooltip: 'transitive verb' }] },
    { number: 2, glossary: 'to live on (e.g. a salary), to live off, to subsist on',
      tags: [{ code: 'v1', label: 'v1', tooltip: 'Ichidan verb' }] },
  ],
  examples: [
    { jp: '朝ご飯を食べました。', en: 'I ate breakfast.', sense_number: 1,
      segments: [{ text: '朝', reading: 'あさ' }, { text: 'ご' }, { text: '飯', reading: 'はん' }, { text: 'を' },
        { text: '食', reading: 'た', highlight: true }, { text: 'べました', highlight: true }, { text: '。' }] },
    { jp: '何を食べたい？', en: 'What do you want to eat?', sense_number: 7,
      segments: [{ text: '何', reading: 'なに' }, { text: 'を' }, { text: '食', reading: 'た', highlight: true }, { text: 'べたい？', highlight: true }] },
  ],
  status: { status: 'not_started', total_reviews: 0, correct_reviews: 0, accuracy: null, interval_days: null, next_review: null, due: false },
}

const KANA = {
  type: 'hiragana', kana: 'あ', romaji: 'a', meaning: 'a', level: 'Hiragana', group: 'vowels',
  svg_url: '/kanjivg/03042.svg',
  status: { status: 'mastered', total_reviews: 40, correct_reviews: 39, accuracy: 98, interval_days: 60, next_review: '2026-11-01T08:00:00Z', due: false },
}

// A JMdict-pool word: no level, kana-only headword, no alignment.
const JMDICT = {
  type: 'vocab', kanji: '', kana: 'お疲れ様でした', meaning: 'thank you for your hard work', level: null,
  furigana: [], senses: [{ number: 1, glossary: 'thank you for your hard work', tags: [{ code: 'exp', label: 'exp', tooltip: 'expression' }] }],
  examples: [],
  status: { status: 'not_started', total_reviews: 0, correct_reviews: 0, accuracy: null, interval_days: null, next_review: null, due: false },
}

const NAV = () => ({ onClose: vi.fn(), onRadicalClick: vi.fn(), onKanjiClick: vi.fn(), onVocabClick: vi.fn() })

// Rendered inside the dock the dictionary screen puts it in, so the
// shell's pigment and geometry are the real ones. `width` stands in
// for the dock's own flex basis at the widths where it is a column.
async function renderEntry(entry, handlers = NAV(), { width = 400 } = {}) {
  const screen = await render(
    <LangProvider>
      <aside className="dict-dock" style={width ? { width } : undefined}>
        <DictionaryDetail entry={entry} {...handlers} />
      </aside>
    </LangProvider>
  )
  await settle()
  return { screen, root: screen.container, ...handlers }
}

beforeEach(async () => {
  holdStill()
  localStorage.setItem('lang', 'en')
  document.documentElement.setAttribute('data-theme', 'dark')
  await page.viewport(1300, 900)
})
// Unmount between tests: with globals off, vitest-browser-react leaves
// every container in the page, and a page that grows a scrollbar is
// ten pixels narrower than the viewport the geometry below measures.
afterEach(async () => {
  await cleanup()
  vi.mocked(speakJapanese).mockClear()
})

// A ruby's base text without its annotation, so a highlighted 食べました
// is compared to what a reader sees, not to '食た'.
const baseText = el => [...el.querySelectorAll('rt')].reduce((s, rt) => s.replace(rt.textContent, ''), el.textContent)
// The viewport as laid out, which is what `position: fixed; inset: 0`
// spans: the sheet's `html { scrollbar-gutter: stable }` reserves a
// classic scrollbar's 10px in headless Chromium, and clientWidth does
// not subtract it. A phone's overlay scrollbar reserves nothing.
const vw = () => document.documentElement.getBoundingClientRect().width
const vh = () => window.innerHeight

// Geometry is read at rest: the shells arrive with a 260ms rise and
// the words a 150ms slide, and a rect taken mid-flight is not a layout.
const STILL = '*,*::before,*::after{animation:none!important;transition:none!important}'
function holdStill() {
  let st = document.getElementById('dict-test-still')
  if (!st) {
    st = document.createElement('style')
    st.id = 'dict-test-still'
    document.head.appendChild(st)
  }
  st.textContent = STILL
}

describe('the plate — three registers, a seal, a level, two ghosts', () => {
  it('sets a kanji as a specimen glyph with its 音/訓 readings above and its first gloss beneath', async () => {
    const { root } = await renderEntry(KANJI)
    const word = root.querySelector('.dict-plate__word')
    expect(word.tagName).toBe('H2')
    expect(word.textContent).toBe('木')
    expect(word.getAttribute('lang')).toBe('ja')
    // The lone character takes the specimen rung — the one above the nine.
    expect(getComputedStyle(word).fontSize).toBe(probe('fontSize', 'var(--fs-specimen-word)'))
    expect(getComputedStyle(word).fontFamily).toBe(probe('fontFamily', 'var(--font-jp)'))

    const readings = root.querySelector('.dict-plate__readings')
    const labels = [...readings.querySelectorAll('.reading-group__label')].map(el => el.textContent)
    expect(labels).toEqual(['音', '訓'])
    expect(readings.textContent).toContain('モク')
    expect(readings.textContent).toContain('き')

    const caption = root.querySelector('.dict-plate__caption')
    expect(caption.textContent).toBe('Tree')
    expect(getComputedStyle(caption).textTransform).toBe('uppercase')
    expect(getComputedStyle(caption).fontSize).toBe(probe('fontSize', 'var(--fs-sm)'))

    expect(root.querySelector('.dict-plate__level').textContent).toBe('N5')
    expect(root.querySelector('.dict-plate__marks .stage-badge--learning')).toBeTruthy()
  })

  it('reads a word through its furigana, at the display rung', async () => {
    const { root } = await renderEntry(VOCAB)
    const word = root.querySelector('.dict-plate__word')
    expect(word.querySelectorAll('ruby')).toHaveLength(1)
    expect(word.querySelector('rt').textContent).toBe('た')
    expect(getComputedStyle(word).fontSize).toBe(probe('fontSize', 'var(--fs-display)'))
    expect(root.querySelector('.dict-plate__caption').textContent).toBe('To eat')
    // Not yet studied: the unstruck seal, not a missing one.
    expect(root.querySelector('.dict-plate__marks .stage-badge--new')).toBeTruthy()
    // No kana line: the reading already rides on the word.
    expect(root.querySelector('.dict-plate__reading')).toBeNull()
  })

  it('gives a kana its romaji as the caption, no readings block and no level', async () => {
    const { root } = await renderEntry(KANA)
    expect(root.querySelector('.dict-plate__word').textContent).toBe('あ')
    expect(root.querySelector('.dict-plate__caption').textContent).toBe('a')
    expect(root.querySelector('.dict-plate__readings')).toBeNull()
    // "Hiragana" is the backend's level slot for kana, not a JLPT level.
    expect(root.querySelector('.dict-plate__level')).toBeNull()
    expect(root.querySelector('.stage-badge--mastered')).toBeTruthy()
  })

  it('steps a long expression down one rung and prints no level for a JMdict word', async () => {
    const { root } = await renderEntry(JMDICT)
    const word = root.querySelector('.dict-plate__word')
    expect(word.textContent).toBe('お疲れ様でした')
    expect(getComputedStyle(word).fontSize).toBe(probe('fontSize', 'var(--fs-heading)'))
    expect(root.querySelector('.dict-plate__level')).toBeNull()
  })

  it('shows a word its kana when the alignment came back empty', async () => {
    const { root } = await renderEntry({ ...VOCAB, furigana: [] })
    expect(root.querySelector('.dict-plate__word ruby')).toBeNull()
    expect(root.querySelector('.dict-plate__reading').textContent).toBe('たべる')
  })

  it('speaks the reading and closes from the two ghosts', async () => {
    const { root, onClose } = await renderEntry(KANJI)
    const [speak, close] = root.querySelectorAll('.dict-plate__btn')
    expect(speak.getAttribute('aria-label')).toBe('Listen')
    expect(close.getAttribute('aria-label')).toBe('Close')
    speak.click()
    expect(speakJapanese).toHaveBeenCalledWith(KANJI.kana)
    close.click()
    expect(onClose).toHaveBeenCalledTimes(1)
    // Ghosts: a ring and the ambient ink, never a filled disc.
    expect(getComputedStyle(speak).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(speak).borderTopWidth).toBe('1px')
  })
})

describe('the body — blocks that name themselves', () => {
  it('prints no heading below the plate; every block carries its name for a screen reader instead', async () => {
    for (const entry of [KANJI, VOCAB, KANA, JMDICT]) {
      const { root, screen } = await renderEntry(entry)
      expect(root.querySelectorAll('h1, h3, h4, h5, h6')).toHaveLength(0)
      expect(root.querySelectorAll('h2')).toHaveLength(1)
      const blocks = [...root.querySelectorAll('.dict-block')]
      expect(blocks.length).toBeGreaterThan(0)
      for (const b of blocks) expect(b.getAttribute('aria-label')).toBeTruthy()
      // None of the retired labels survive as text.
      expect(root.textContent).not.toMatch(/JMdict|Stroke order|Card stats|Made of these kanji|Used in these words/)
      await screen.unmount()
    }
  })

  it('lists a word\'s senses under tabular numerals in the entry ink, nests its sentences, and floats the orphan', async () => {
    const { root } = await renderEntry(VOCAB)
    const senses = root.querySelectorAll('.dict-sense')
    expect(senses).toHaveLength(2)
    expect([...root.querySelectorAll('.dict-senses .dict-sense__n')].map(n => n.textContent)).toEqual(['1', '2'])
    expect([...senses[0].querySelectorAll('.dict-tag')].map(t => t.textContent)).toEqual(['v1', 'vt'])
    expect(senses[0].querySelector('.dict-sense__gloss').textContent).toBe('To eat')
    // Sense 1's sentence sits under sense 1; the sentence for a sense
    // JMdict did not list floats to the examples block with its numeral.
    expect(senses[0].querySelectorAll('.dict-ex')).toHaveLength(1)
    expect(senses[1].querySelectorAll('.dict-ex')).toHaveLength(0)
    const flat = root.querySelector('.dict-examples')
    expect(flat.querySelectorAll('.dict-ex')).toHaveLength(1)
    expect(flat.querySelector('.dict-ex__n').textContent).toBe('7')
    expect(flat.querySelector('.dict-ex__tr').textContent).toBe('What do you want to eat?')
    // The headword is picked out of the sentence in the same ink as the numerals.
    const hls = [...senses[0].querySelectorAll('.dict-ex__hl')]
    expect(hls.map(baseText).join('')).toBe('食べました')
    const hl = hls[0]
    const n = root.querySelector('.dict-sense__n')
    const ink = probe('color', 'color-mix(in srgb, var(--line-jisho) 60%, var(--text-primary))')
    expect(getComputedStyle(n).color).toBe(ink)
    expect(getComputedStyle(hl).color).toBe(ink)
    expect(getComputedStyle(hl).backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })

  it('prints a kanji\'s gloss list as prose only when there is more than the caption already says', async () => {
    const { root, screen } = await renderEntry(KANJI)
    expect(root.querySelector('.dict-gloss').textContent).toBe('Tree·wood')
    await screen.unmount()
    const one = await renderEntry({ ...KANJI, meaning: 'tree' })
    expect(one.root.querySelector('.dict-gloss')).toBeNull()
    expect(one.root.querySelector('.dict-plate__caption').textContent).toBe('Tree')
  })

  it('lays the stroke sheet beside its stacked figures in one lattice that divides', async () => {
    const { root, onRadicalClick } = await renderEntry(KANJI)
    const form = root.querySelector('.dict-form')
    const sheet = form.querySelector('.dict-form__sheet')
    const figures = [...form.querySelectorAll('.record')]
    expect(figures).toHaveLength(2)
    expect(figures.map(f => f.querySelector('.record__value').textContent)).toEqual(['4画', '#75'])
    expect(figures.map(f => f.querySelector('.record__label').textContent)).toEqual(['strokes', 'Radical'])

    const s = sheet.getBoundingClientRect()
    const [a, b] = figures.map(f => f.getBoundingClientRect())
    // Sheet left, figures right, one under the other, the sheet as tall as both.
    expect(a.left).toBeGreaterThan(s.right - 1)
    expect(b.left).toBeCloseTo(a.left, 0)
    expect(b.top).toBeGreaterThan(a.bottom - 1)
    expect(s.top).toBeCloseTo(a.top, 0)
    expect(s.bottom).toBeCloseTo(b.bottom, 0)
    // Washi under the drawing, and a drawing in it.
    expect(getComputedStyle(sheet).backgroundColor).toBe(probe('backgroundColor', 'var(--paper)'))
    expect(sheet.querySelector('svg')).toBeTruthy()

    // The radical figure is a door.
    const door = form.querySelector('.record--door')
    expect(door.tagName).toBe('BUTTON')
    door.click()
    expect(onRadicalClick).toHaveBeenCalledWith(75)
  })

  it('gives a kana the sheet alone, full width, with nothing bare beside it', async () => {
    const { root } = await renderEntry(KANA)
    const form = root.querySelector('.dict-form')
    expect(form.querySelectorAll('.record')).toHaveLength(0)
    const sheet = form.querySelector('.dict-form__sheet')
    expect(sheet.getBoundingClientRect().width).toBeCloseTo(form.getBoundingClientRect().width - 2, 0)
  })

  it('opens a kanji\'s words from a ledger of doors, and a word\'s kanji from tiles', async () => {
    const kanji = await renderEntry(KANJI)
    const rows = kanji.root.querySelectorAll('.dict-word')
    expect(rows).toHaveLength(4)
    expect(rows[0].querySelector('.dict-word__jp').textContent).toBe('木もく曜よう日び')
    expect(rows[0].querySelector('.dict-word__gloss').textContent).toBe('Thursday')
    expect(rows[1].querySelector('.dict-word__gloss').textContent).toBe('Lumber')
    rows[0].click()
    expect(kanji.onVocabClick).toHaveBeenCalledWith('木曜日', 'もくようび')
    // Words before the record; the sheet before the words (a 漢和辞典's order).
    const order = [...kanji.root.querySelectorAll('.dict-block')].map(b => b.getAttribute('aria-label'))
    expect(order).toEqual(['Meaning', 'Stroke order', 'Used in these words', 'Card stats'])
    await kanji.screen.unmount()

    const vocab = await renderEntry(VOCAB)
    const tiles = vocab.root.querySelectorAll('.dict-part')
    expect([...tiles].map(t => t.textContent)).toEqual(['食'])
    tiles[0].click()
    expect(vocab.onKanjiClick).toHaveBeenCalledWith('食')
  })

  it('renders no doors at all when the caller cannot navigate (the sheet over a quiz)', async () => {
    const { root } = await renderEntry(KANJI, { onClose: vi.fn() })
    expect(root.querySelector('.dict-word')).toBeNull()
    expect(root.querySelector('.record--door')).toBeNull()
    // The stroke count stays: it is a fact, not a link.
    expect(root.querySelector('.dict-form .record__value').textContent).toBe('4画')
    expect(root.querySelector('.dict-form').querySelectorAll('.record')).toHaveLength(1)
  })

  it('prints the reader\'s record two by two, the due note above it, and nothing for a card never reviewed', async () => {
    const { root, screen } = await renderEntry(KANJI)
    const records = root.querySelector('.records')
    const cells = [...records.querySelectorAll('.record')]
    expect(cells).toHaveLength(4)
    expect(cells.map(c => c.querySelector('.record__value').textContent)).toEqual(['86%', '12/14', '7days', 'Sep 12'])
    expect(cells.map(c => c.querySelector('.record__label').textContent)).toEqual(['Accuracy', 'Reviews', 'Interval', 'Next review'])
    const [a, b, c, d] = cells.map(el => el.getBoundingClientRect())
    expect(b.top).toBeCloseTo(a.top, 0)
    expect(b.left).toBeGreaterThan(a.right - 1)
    expect(c.top).toBeGreaterThan(a.bottom - 1)
    expect(d.left).toBeCloseTo(b.left, 0)
    // Figures are the profile's own cell: display face, the heading rung.
    expect(getComputedStyle(cells[0].querySelector('.record__value')).fontSize).toBe(probe('fontSize', 'var(--fs-heading)'))
    const note = root.querySelector('.dict-block__note')
    expect(note.textContent).toContain('Due now')
    expect(note.getBoundingClientRect().bottom).toBeLessThanOrEqual(records.getBoundingClientRect().top + 1)
    await screen.unmount()

    const fresh = await renderEntry(VOCAB)
    expect(fresh.root.querySelector('.records')).toBeNull()
    expect(fresh.root.querySelector('.dict-block__note')).toBeNull()
  })
})

describe('the shells — one panel, a column, a modal, the whole screen', () => {
  it('wears 辞書\'s pigment from its shell, as a stripe and never a fill', async () => {
    const { root } = await renderEntry(KANJI)
    const stripe = root.querySelector('.dict-plate__stripe')
    expect(getComputedStyle(stripe).backgroundColor).toBe(probe('backgroundColor', 'var(--line-jisho)'))
    expect(getComputedStyle(stripe).height).toBe('3px')
    // Plate and body are the one card surface.
    const plate = root.querySelector('.dict-plate')
    expect(getComputedStyle(plate).backgroundColor).toBe(probe('backgroundColor', 'var(--surface)', root))
  })

  it('is a sticky column on a desktop, with no close slab', async () => {
    const { root } = await renderEntry(KANJI)
    const dock = root.querySelector('.dict-dock')
    expect(getComputedStyle(dock).position).toBe('sticky')
    expect(getComputedStyle(root.querySelector('.dict-entry__close')).display).toBe('none')
  })

  it('is a centred modal between the phone and the desktop', async () => {
    await page.viewport(900, 800)
    const { root } = await renderEntry(KANJI, NAV(), { width: null })
    const dock = root.querySelector('.dict-dock')
    expect(getComputedStyle(dock).position).toBe('fixed')
    const r = dock.getBoundingClientRect()
    expect(Math.round(r.width)).toBe(640)
    expect(Math.round(r.left + r.width / 2)).toBe(Math.round(vw() / 2))
    expect(getComputedStyle(root.querySelector('.dict-entry__close')).display).toBe('none')
  })

  it('is the whole screen on a phone, the plate staying put while the body scrolls, the close slab at the foot', async () => {
    await page.viewport(390, 700)
    const { root } = await renderEntry(KANJI, NAV(), { width: null })
    const dock = root.querySelector('.dict-dock')
    const r = dock.getBoundingClientRect()
    expect(getComputedStyle(dock).position).toBe('fixed')
    expect(Math.round(r.width)).toBe(vw())
    expect(Math.round(r.height)).toBe(vh())
    expect(getComputedStyle(dock).borderRadius).toBe('0px')

    const plate = root.querySelector('.dict-plate')
    expect(getComputedStyle(plate).position).toBe('sticky')
    expect(dock.scrollHeight).toBeGreaterThan(dock.clientHeight)
    dock.scrollTop = 250
    await settle()
    expect(plate.getBoundingClientRect().top).toBeCloseTo(r.top, 0)
    // The word is still readable over the scrolled body.
    expect(getComputedStyle(plate).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')

    const close = root.querySelector('.dict-entry__close')
    expect(getComputedStyle(close).display).not.toBe('none')
    dock.scrollTop = dock.scrollHeight
    await settle()
    expect(close.getBoundingClientRect().bottom).toBeLessThanOrEqual(r.bottom + 1)
  })

  it('keeps the lattices whole at phone width', async () => {
    await page.viewport(390, 844)
    const { root } = await renderEntry(KANJI, NAV(), { width: null })
    const [a, b, c, d] = [...root.querySelectorAll('.records .record')].map(el => el.getBoundingClientRect())
    expect(b.top).toBeCloseTo(a.top, 0)
    expect(c.top).toBeGreaterThan(a.bottom - 1)
    expect(d.top).toBeCloseTo(c.top, 0)
    const form = root.querySelector('.dict-form')
    const sheet = form.querySelector('.dict-form__sheet').getBoundingClientRect()
    const figs = [...form.querySelectorAll('.record')].map(f => f.getBoundingClientRect())
    expect(figs[0].left).toBeGreaterThan(sheet.right - 1)
    expect(figs[1].top).toBeGreaterThan(figs[0].bottom - 1)
  })
})

describe('the lookup sheet — the same panel, over a quiz', () => {
  it('fetches the term, opens as a dialog in the dictionary\'s pigment, and closes on Escape', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [KANJI] }) })
    const onClose = vi.fn()
    const screen = await render(
      <LangProvider>
        <button type="button" id="opener">open</button>
        <DictionaryLookupSheet term="木" category="kanji" session={{ access_token: 'tok' }} onClose={onClose} />
      </LangProvider>
    )
    await settle(120)
    const dialog = document.querySelector('.dict-sheet[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.querySelector('.dict-plate__word').textContent).toBe('木')
    // The shell injects the pigment here too — this portal sits under
    // <body>, outside any station header.
    const stripe = dialog.querySelector('.dict-plate__stripe')
    expect(getComputedStyle(stripe).backgroundColor).toBe(probe('backgroundColor', 'var(--line-jisho)'))
    // No dictionary underneath to jump around in: no doors.
    expect(dialog.querySelector('.dict-word')).toBeNull()
    expect(dialog.querySelector('.record--door')).toBeNull()
    // The ✕ is present on a desktop, where a modal has no slab.
    expect(getComputedStyle(dialog.querySelector('.dict-entry__close')).display).toBe('none')
    expect(dialog.querySelectorAll('.dict-plate__btn')).toHaveLength(2)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
    await screen.unmount()
  })

  it('takes the whole screen on a phone, rising as one sheet', async () => {
    await page.viewport(390, 844)
    vi.mocked(apiFetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [VOCAB] }) })
    const screen = await render(
      <LangProvider>
        <DictionaryLookupSheet term="食べる" category="vocab" session={{ access_token: 'tok' }} onClose={() => {}} />
      </LangProvider>
    )
    await settle(120)
    const dialog = document.querySelector('.dict-sheet[role="dialog"]')
    const r = dialog.getBoundingClientRect()
    expect(Math.round(r.width)).toBe(vw())
    expect(Math.round(r.height)).toBe(vh())
    expect(getComputedStyle(dialog).borderRadius).toBe('0px')
    expect(getComputedStyle(dialog.querySelector('.dict-entry__close')).display).not.toBe('none')
    await screen.unmount()
  })

  it('says so, and still closes, when the term is not in the dictionary', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [] }) })
    const onClose = vi.fn()
    const screen = await render(
      <LangProvider>
        <DictionaryLookupSheet term="ｘ" category="vocab" session={{ access_token: 'tok' }} onClose={onClose} />
      </LangProvider>
    )
    await settle(120)
    const dialog = document.querySelector('.dict-sheet[role="dialog"]')
    expect(dialog.textContent).toContain('Not available')
    dialog.querySelector('.btn-secondary').click()
    expect(onClose).toHaveBeenCalledTimes(1)
    await screen.unmount()
  })
})
