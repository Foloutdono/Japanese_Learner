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

// ── A syllabary, as the endpoint serves one ──
// `group` is what the chart lays out on (backend/content/kana_data.py):
// the gojūon rows, the voiced rows, one group per yōon base kana, one
// per borrowed-sound base kana, and the long vowels — by first vowel in
// hiragana, all together in katakana, because the two spell length
// differently.
const kana = (group, pairs) =>
  pairs.split(' ').map(p => {
    const [k, romaji] = p.split('/')
    return { type: 'hiragana', kana: k, romaji, meaning: '', level: 'N5', group }
  })

const HIRAGANA = [
  ...kana('vowels', 'あ/a い/i う/u え/e お/o'),
  ...kana('k', 'か/ka き/ki く/ku け/ke こ/ko'),
  ...kana('n_solo', 'ん/n'),
  ...kana('g', 'が/ga ぎ/gi ぐ/gu げ/ge ご/go'),
  ...kana('k_combo', 'きゃ/kya きゅ/kyu きょ/kyo'),
  ...kana('z_combo', 'じゃ/ja じゅ/ju じょ/jo'),
  ...kana('a_long', 'ああ/aa あい/ai'),
  ...kana('i_long', 'いい/ii'),
  ...kana('u_long', 'うう/uu'),
  ...kana('e_long', 'えい/ei ええ/ee'),
  ...kana('o_long', 'おい/oi おう/ou おお/oo'),
]

const KATAKANA = [
  ...kana('vowels', 'ア/a イ/i ウ/u エ/e オ/o'),
  ...kana('k', 'カ/ka キ/ki ク/ku ケ/ke コ/ko'),
  ...kana('n_solo', 'ン/n'),
  ...kana('g', 'ガ/ga ギ/gi グ/gu ゲ/ge ゴ/go'),
  ...kana('k_combo', 'キャ/kya キュ/kyu キョ/kyo'),
  ...kana('f_foreign', 'ファ/fa フィ/fi フェ/fe フォ/fo'),
  ...kana('ti_foreign', 'ティ/ti'),
  ...kana('v_foreign', 'ヴァ/va ヴィ/vi ヴ/vu ヴェ/ve ヴォ/vo'),
  ...kana('long', 'アー/aa イー/ii ウー/uu エー/ee オー/oo'),
]

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

// ── Reading a chart back ──
// The table is one flat grid of cells and holes — no heads down the
// side, none across the top — so a row is `cols` nodes from the start.
const chartsOf = screen => [...screen.container.querySelectorAll('.syllabary-table[role="group"]')]
const marksOf = screen => [...screen.container.querySelectorAll('.dict-mark__jp')].map(m => m.textContent)
const namesOf = screen => [...screen.container.querySelectorAll('.dict-mark__name')].map(m => m.textContent)
const cellsOf = chart => [...chart.querySelectorAll('.syllabary-cell')].map(c => c.textContent)
const colCount = chart =>
  chart.classList.contains('syllabary-table--narrow') ? 3 : 5
/** One row of a chart, holes as null — `n` counting from the first. */
const rowOf = (chart, n) => {
  const cols = colCount(chart)
  return [...chart.children].slice(cols * n, cols * (n + 1))
    .map(el => (el.classList.contains('syllabary-gap') ? null : el.textContent))
}

async function openSyllabary(screen, label) {
  ;[...screen.container.querySelectorAll('.chip')].find(c => c.textContent === label).click()
  await settle(120)
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
      if (p.startsWith('/api/dictionary?')) {
        const cat = new URLSearchParams(p.split('?')[1]).get('category')
        const rows = cat === 'hiragana' ? HIRAGANA : cat === 'katakana' ? KATAKANA : RESULTS
        return { results: rows, total: rows.length, has_more: false }
      }
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

  // The stage is the card's bottom edge now, not a word over the
  // specimen (owner's ruling, from six rendered directions — see
  // .dict-entry-card in index.css). The word stays where a screen
  // reader can reach it, and the plate still prints it in full.
  it('the catalogue: a card per entry with its level and its stage, the count in the console', async () => {
    const screen = await renderScreen()
    const cards = [...screen.container.querySelectorAll('.dict-grid .dict-entry-card')]
    expect(cards.length).toBe(RESULTS.length)
    expect(cards[0].querySelector('.dict-level-badge').textContent).toBe('N5')
    expect(cards[0].querySelector('.dict-entry-card__char').textContent).toBe('駅')
    expect(cards[1].querySelector('.dict-entry-card__kana').textContent).toBe('でんしゃ')
    // Nothing is printed over the specimen any more.
    expect(screen.container.querySelector('.dict-grid .stage-mark')).toBeNull()
    // The stage rides on the card itself, and on the word only a
    // reader hears.
    expect(cards[0].classList.contains('dict-entry-card--mastered')).toBe(true)
    expect(cards[0].querySelector('.sr-only').textContent).toBe(T.mastered)
    expect(cards[1].classList.contains('dict-entry-card--new')).toBe(true)
    expect(cards[1].querySelector('.sr-only').textContent).toBe(T.new)
    // No card and no level: the JMdict entry prints neither mark, and
    // its edge stays the card's own hairline.
    expect([...cards[2].classList].some(c => c.startsWith('dict-entry-card--'))).toBe(false)
    expect(cards[2].querySelector('.sr-only')).toBeNull()
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

  // ── Two blocks that name themselves ──
  // The syllabary charts and the radical index's stroke groups each
  // carried a paired SectionHeader — the Japanese term, its French
  // twin, a rule — over an object that already says what it is. They
  // carry the stamp book's kind of mark now: the name, a hairline, and
  // the tally as data.
  it('marks the syllabary and the radical groups instead of heading them', async () => {
    const screen = await renderScreen()
    // Hiragana: the charts, each marked, no heading anywhere.
    await openSyllabary(screen, T.dictHiragana)
    expect(screen.container.querySelector('.section-header')).toBeNull()
    expect(marksOf(screen)).toEqual(['五十音', '長音', '濁音', '拗音'])
    // The term and its twin: 五十音 is not a name a learner can act on,
    // so the mark prints both and the grid still answers to the twin.
    expect(namesOf(screen))
      .toEqual([T.syllabaryMain, T.syllabaryLong, T.syllabaryVoiced, T.syllabaryYoon])
    const charts = chartsOf(screen)
    expect(charts.map(c => c.getAttribute('aria-label')))
      .toEqual([T.syllabaryMain, T.syllabaryLong, T.syllabaryVoiced, T.syllabaryYoon])
  })

  // ── The rows and columns name themselves ──
  // あ行 か行 さ行 ran down the side of every chart and あ い う え お
  // across the top, each saying what the first cell of its row or
  // column already says — a column and a row of type wrapped around
  // every table on the screen.
  it('draws the charts as cells alone, with no rows or columns named', async () => {
    const screen = await renderScreen()
    await openSyllabary(screen, T.dictHiragana)
    expect(screen.container.querySelector('.syllabary-head')).toBeNull()
    // The first row IS the vowels, in the columns the heads used to name.
    expect(rowOf(chartsOf(screen)[0], 0)).toEqual(['あa', 'いi', 'うu', 'えe', 'おo'])
    // ん belonged to no column and had a 撥音 row of its own; it is the
    // last cell of the table now, still inside it.
    expect(cellsOf(chartsOf(screen)[0]).at(-1)).toBe('んn')
  })

  // ── The three charts the screen used to drop ──
  // The endpoint has always served きゃ and ファ, and serves えい now
  // too, but the chart laid out 五十音 and 濁音 and silently dropped
  // every other group — a third of a syllabary reachable from nowhere
  // on the one screen built to show it.
  it('lays out the yōon, the long vowels and the borrowed sounds', async () => {
    const screen = await renderScreen()
    await openSyllabary(screen, T.dictKatakana)
    // 外来音 is katakana's alone; hiragana's chart above has four.
    expect(marksOf(screen)).toEqual(['五十音', '長音', '濁音', '拗音', '外来音'])

    // 拗音 is three columns wide, not five: や ゆ よ are the only kana
    // that follow, so there is no い or え column to leave empty.
    const yoon = chartsOf(screen)[3]
    expect(yoon.classList.contains('syllabary-table--narrow')).toBe(true)
    expect(rowOf(yoon, 0)).toEqual(['キャkya', 'キュkyu', 'キョkyo'])

    // 外来音 rows are one base kana each, so ファ and ヴァ cannot
    // collide in the a column the way one "foreign" row made them.
    const foreign = chartsOf(screen)[4]
    expect(rowOf(foreign, 0)).toEqual(['ファfa', 'フィfi', null, 'フェfe', 'フォfo'])
    expect(rowOf(foreign, 1)).toEqual([null, 'ティti', null, null, null])
    expect(cellsOf(foreign)).toEqual(['ファfa', 'フィfi', 'フェfe', 'フォfo', 'ティti',
                                      'ヴァva', 'ヴィvi', 'ヴvu', 'ヴェve', 'ヴォvo'])

    // Katakana writes every long vowel with the one bar, so its 長音 is
    // a single row of five.
    const long = chartsOf(screen)[1]
    expect(cellsOf(long)).toEqual(['アーaa', 'イーii', 'ウーuu', 'エーee', 'オーoo'])
  })

  // Hiragana holds a vowel with a second kana instead, so its 長音 is a
  // matrix: the row is the first kana, the column the second. えい is
  // え's い — the whole point of the chart, and the reason it is not a
  // list.
  it("puts each long vowel under the kana that spells it", async () => {
    const screen = await renderScreen()
    await openSyllabary(screen, T.dictHiragana)
    const long = chartsOf(screen)[1]
    // え's row: nothing in あ, えい under い, ええ under え, holes after.
    expect(rowOf(long, 3)).toEqual([null, 'えいei', null, 'ええee', null])
    expect(rowOf(long, 4)).toEqual([null, 'おいoi', 'おうou', null, 'おおoo'])
  })

  // Every new cell is an entry like any other: it opens the same dock.
  it('opens a combination the way it opens あ', async () => {
    const screen = await renderScreen()
    await openSyllabary(screen, T.dictHiragana)
    const kya = [...chartsOf(screen)[3].querySelectorAll('.syllabary-cell')]
      .find(c => c.textContent.startsWith('きゃ'))
    kya.click()
    await settle(80)
    expect(screen.container.querySelector('.dict-dock').textContent).toContain('きゃ')
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
