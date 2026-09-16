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
// The JMdict pool that forms the tail of the vocabulary collection:
// a vocab entry like any other, but with no card and no level — the
// endpoint serves it as type "vocab" with level null
// (routes/dictionary.py's _vocab_result).
const NOCARD = { type: 'vocab', kanji: '駅弁', kana: 'えきべん', meaning: 'station lunch box', level: null }
// A character that is a word on its own: the deck reads 山 as やま, and
// routes/dictionary.py sends that reading beside the character's own
// list (study/kanji_words.kanji_as_word).
const KANJI_WORD = {
  type: 'kanji', kanji: '山', kana: 'サン・セン・やま', word_reading: 'やま',
  meaning: 'mountain', level: 'N5', status: { status: 'new' },
}
// One that is not: 土 keeps its readings, and the pair is one from each
// register — the deck lists on readings first, so the first TWO are
// both on'yomi and would never say つち.
const KANJI_ALONE = {
  type: 'kanji', kanji: '土', kana: 'ド・ト・つち', meaning: 'soil',
  level: 'N5', status: { status: 'new' },
}
// A page of filler behind them, so the infinite-scroll sentinel sits
// below the fold: with it in view, the observer would page the moment
// the query changes (before the debounced search), which is the screen
// behaving as built for a full page, not what these cases pin.
const FILLER = Array.from({ length: 60 }, (_, i) => ({
  type: 'vocab', kanji: `語${i}`, kana: `ご${i}`, meaning: `word ${i}`, level: null,
}))
const RESULTS = [KANJI, VOCAB, NOCARD, KANJI_WORD, KANJI_ALONE, ...FILLER]

// ── The grammar collection ──
// A point as routes/dictionary.py's _grammar_result serves it: the
// pattern, its formation, the English gloss, its two sentences with
// their furigana, and the learner's record under the line's card id.
const GRAMMAR = {
  type: 'grammar', raw_id: 'grammar_N5_〜ました／〜ませんでした', level: 'N5',
  pattern: '〜ました／〜ませんでした', structure: 'verb ます-stem + ました／ませんでした',
  meaning: 'polite past: did / did not',
  examples: [
    { jp: '昨日、映画を見ました。', en: 'I watched a film yesterday.',
      furigana: [{ text: '昨日', reading: 'きのう' }, { text: '、' }, { text: '映画', reading: 'えいが' }, { text: 'を' }, { text: '見', reading: 'み' }, { text: 'ました。' }] },
    { jp: '朝ご飯を食べませんでした。', en: 'I did not eat breakfast.',
      furigana: [{ text: '朝', reading: 'あさ' }, { text: 'ご' }, { text: '飯', reading: 'はん' }, { text: 'を' }, { text: '食', reading: 'た' }, { text: 'べませんでした。' }] },
  ],
  status: { status: 'learning', total_reviews: 3, correct_reviews: 2, accuracy: 67, interval_days: 2, next_review: '2026-09-16T00:00:00Z', due: false },
}
const GRAMMAR_ROWS = [
  GRAMMAR,
  { type: 'grammar', raw_id: 'grammar_N5_です／だ', level: 'N5', pattern: 'です／だ', structure: 'Noun/な-adj + です・だ', meaning: 'the copula: is/am/are', examples: [], status: { status: 'not_started', total_reviews: 0 } },
  { type: 'grammar', raw_id: 'grammar_N3_〜ばかり', level: 'N3', pattern: '〜ばかり', structure: 'verb た-form + ばかり', meaning: 'just did', examples: [], status: { status: 'not_started', total_reviews: 0 } },
]

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

// apiJson answers the screen's one JSON call — useMining's deck list
// on mount, for the grammar plate's add roundel — with a grammar deck
// the picker can offer.
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(),
  apiJson: vi.fn(async () => ({ decks: [{ id: 7, type: 'grammar', name: '文法' }] })),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
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

async function renderScreen(at = '/dictionary') {
  const screen = await render(
    <LangProvider>
      <Probe />
      <MemoryRouter initialEntries={[at]}>
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
      // One real tile, so a test can actually PICK a radical. It was an
      // empty index, which made every "in radical mode" assertion stop
      // at the grid.
      if (p.startsWith('/api/dictionary/radicals')) {
        return { groups: [{ stroke_count: 3, radicals: [{ number: 85, char: '水', kanji_count: 12 }] }] }
      }
      if (p.startsWith('/api/dictionary?')) {
        const cat = new URLSearchParams(p.split('?')[1]).get('category')
        const rows = cat === 'hiragana' ? HIRAGANA : cat === 'katakana' ? KATAKANA
          : cat === 'grammar' ? GRAMMAR_ROWS : RESULTS
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

    // Five collections as chips, kanji on. Scoped to the collections
    // row: the console's SECOND row is the JLPT levels, and a bare
    // `.console__chips .chip` counts both.
    const chips = [...screen.container.querySelectorAll('.dict-collections .chip')]
    expect(chips.length).toBe(5)
    expect(chips[0].classList.contains('chip--on')).toBe(true)
    expect(chips[0].textContent).toBe(T.dictKanji)
    expect(lastQuery().get('category')).toBe('kanji')

    // The radical index is not a sixth collection: it is a toggle at the
    // trailing edge of the field, under the kanji collection alone, and
    // it is off on arrival. 部 is the whole of what it prints — the name
    // is there for a pointer and for a reader, which are the two the
    // glyph does not serve.
    const toggle = screen.container.querySelector('.console__index .console__toggle')
    expect(toggle).not.toBeNull()
    expect(toggle.textContent).toBe('部')
    expect(toggle.getAttribute('aria-label')).toBe(T.dictModeRadical)
    expect(toggle.title).toBe(T.dictModeRadical)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')

    door.querySelector('.anl-door__open').click()
    await settle(30)
    expect(screen.container.querySelector('.probe-analyzer')).not.toBeNull()
  })

  it('switches the collection from the chips and drops the radical index off kanji', async () => {
    const screen = await renderScreen()
    const chips = () => [...screen.container.querySelectorAll('.dict-collections .chip')]
    chips()[1].click()
    await settle(80)
    expect(lastQuery().get('category')).toBe('vocab')
    expect(chips().length).toBe(5)
    expect(chips()[1].classList.contains('chip--on')).toBe(true)
    expect(chips()[0].classList.contains('chip--on')).toBe(false)
    // A word spans several radicals, so the toggle goes with the
    // collection it reads — the field under the vocabulary carries none.
    expect(screen.container.querySelector('.console__toggle')).toBeNull()
  })

  // ── 文法 — the grammar collection ──
  it('offers grammar as the third collection, in the line\'s pine, with the levels under it', async () => {
    const screen = await renderScreen()
    const chips = () => [...screen.container.querySelectorAll('.dict-collections .chip')]
    expect(chips()[2].textContent).toBe(T.dictGrammar)
    expect(chips()[2].style.getPropertyValue('--tab-color')).toBe('var(--line-grammar)')

    chips()[2].click()
    await settle(80)
    expect(lastQuery().get('category')).toBe('grammar')
    expect(lastQuery().has('level')).toBe(false)
    // The second row: all, then N5 → N1, "all" on. The radical chip is
    // kanji's and is gone.
    const levels = [...screen.container.querySelectorAll('.dict-levels .chip')]
    expect(levels.map(c => c.textContent)).toEqual([T.dictLevelAll, 'N5', 'N4', 'N3', 'N2', 'N1'])
    expect(levels[0].classList.contains('chip--on')).toBe(true)
    expect(screen.container.querySelector('.console__toggle')).toBeNull()
    // The field stays — grammar is searched, not charted — with its own
    // placeholder.
    expect(screen.container.querySelector('.console__field').placeholder).toBe(T.dictionaryPlaceholderGrammar)

    levels[2].click()
    await settle(80)
    expect(lastQuery().get('category')).toBe('grammar')
    expect(lastQuery().get('level')).toBe('N4')
    expect(screen.container.querySelectorAll('.dict-levels .chip')[2].classList.contains('chip--on')).toBe(true)

    // Leaving the collection leaves the level behind with it: N5 in the
    // grammar and N5 in the kanji are different shelves.
    chips()[0].click()
    await settle(80)
    expect(lastQuery().has('level')).toBe(false)
    expect([...screen.container.querySelectorAll('.dict-levels .chip--on')]
      .map(c => c.textContent)).toEqual([T.dictLevelAll])
  })

  // ── The level, on the other two collections filed by it ──
  // Kanji and vocabulary got the row the grammar collection had alone.
  // A level there means THE APP'S OWN DECK at that level — the KANJIDIC
  // and JMdict pools behind those collections carry none — so the chip
  // is what turns 13,131 characters into the 103 a course teaches.
  it('narrows the kanji and the vocabulary by level too', async () => {
    const screen = await renderScreen()
    const chips = () => [...screen.container.querySelectorAll('.dict-collections .chip')]
    const levels = () => [...screen.container.querySelectorAll('.dict-levels .chip')]

    // Kanji is the collection the screen opens on, and the row is there.
    expect(levels().map(c => c.textContent))
      .toEqual([T.dictLevelAll, 'N5', 'N4', 'N3', 'N2', 'N1'])
    expect(lastQuery().has('level')).toBe(false)

    levels()[1].click()
    await settle(80)
    expect(lastQuery().get('category')).toBe('kanji')
    expect(lastQuery().get('level')).toBe('N5')

    // The vocabulary has its own, and arrives at it unnarrowed.
    chips()[1].click()
    await settle(80)
    expect(lastQuery().get('category')).toBe('vocab')
    expect(lastQuery().has('level')).toBe(false)
    levels()[3].click()
    await settle(80)
    expect(lastQuery().get('level')).toBe('N3')
  })

  it('takes the level off the radical index, which has no level to be on', async () => {
    const screen = await renderScreen()
    const levels = () => [...screen.container.querySelectorAll('.dict-levels .chip')]
    levels()[1].click()
    await settle(80)
    expect(lastQuery().get('level')).toBe('N5')

    // 部 — the radical index is served whole, deck and pool in stroke
    // order, so a level cannot cut it. The row goes with the mode.
    const radical = () => screen.container.querySelector('.console__toggle')
    radical().click()
    await settle(80)
    expect(screen.container.querySelector('.dict-levels')).toBeNull()
    expect(radical().getAttribute('aria-pressed')).toBe('true')

    // ...and still gone once a radical is PICKED and its characters are
    // on screen. A visible chip there would refetch without the radical
    // and silently drop it.
    const tile = screen.container.querySelector('.radical-tile')
    expect(tile, 'the index has to offer a radical for this to test anything').not.toBeNull()
    tile.click()
    await settle(80)
    expect(lastQuery().get('radical')).toBe('85')
    expect(screen.container.querySelector('.dict-levels')).toBeNull()

    // ...and coming back out of it, nothing is narrowed behind the
    // learner's back.
    radical().click()
    await settle(80)
    expect(lastQuery().has('level')).toBe(false)
    expect([...screen.container.querySelectorAll('.dict-levels .chip--on')]
      .map(c => c.textContent)).toEqual([T.dictLevelAll])
  })

  // ── 部 — the index, as a toggle in the field ──
  // It used to be a sixth chip in the collections row, where it read as
  // a sixth shelf rather than as a second way of reading the kanji. The
  // move put it inside the field, which means the field's row has to
  // survive the one screen that has nothing to type into — the index
  // itself — or the toggle would be the control you cannot reach to
  // switch off.
  it('keeps the toggle in the field\'s row while the index has nothing to type into', async () => {
    const screen = await renderScreen()
    const toggle = () => screen.container.querySelector('.console__toggle')
    const row = () => screen.container.querySelector('.console__index')

    toggle().click()
    await settle(80)
    // The grid is up, the field is gone with the search it would run...
    expect(screen.container.querySelector('.dict-radical-index')).not.toBeNull()
    expect(screen.container.querySelector('.console__field')).toBeNull()
    // ...and the row stays, holding the toggle alone.
    expect(row()).not.toBeNull()
    expect(row().classList.contains('console__index--bare')).toBe(true)
    expect(toggle().getAttribute('aria-pressed')).toBe('true')

    // Picking a radical brings the field back, to narrow its characters.
    screen.container.querySelector('.radical-tile').click()
    await settle(80)
    expect(screen.container.querySelector('.console__field')).not.toBeNull()
    expect(screen.container.querySelector('.console__field').placeholder)
      .toBe(T.dictionaryPlaceholderRadical)
    expect(toggle().getAttribute('aria-pressed')).toBe('true')

    // And the toggle is the way out, from either side of the index.
    toggle().click()
    await settle(80)
    expect(screen.container.querySelector('.dict-radical-index')).toBeNull()
    expect(toggle().getAttribute('aria-pressed')).toBe('false')
    expect(screen.container.querySelector('.console__field').placeholder)
      .toBe(T.dictionaryPlaceholder)
  })

  // A fixed chart is not searched and has no radical to be read by, so
  // the whole row goes — toggle included.
  it('takes the row away under a syllabary', async () => {
    const screen = await renderScreen()
    const chips = [...screen.container.querySelectorAll('.dict-collections .chip')]
    chips[3].click()
    await settle(80)
    expect(lastQuery().get('category')).toBe('hiragana')
    expect(screen.container.querySelector('.console__index')).toBeNull()
  })

  it('opens on the collection and the level its address names', async () => {
    const screen = await renderScreen('/dictionary?category=grammar&level=N3')
    const first = searches()[0]
    const q = new URLSearchParams(first.split('?')[1])
    expect(q.get('category')).toBe('grammar')
    expect(q.get('level')).toBe('N3')
    const chips = [...screen.container.querySelectorAll('.dict-collections .chip')]
    expect(chips[2].classList.contains('chip--on')).toBe(true)
    const on = [...screen.container.querySelectorAll('.dict-levels .chip--on')]
    expect(on.map(c => c.textContent)).toEqual(['N3'])
  })

  it('draws a grammar point as a card of its pattern over its whole gloss, and opens it on a plate of its own', async () => {
    const screen = await renderScreen('/dictionary?category=grammar')
    const cards = [...screen.container.querySelectorAll('.dict-grid .dict-entry-card')]
    expect(cards.length).toBe(GRAMMAR_ROWS.length)
    const card = cards[0]
    expect(card.classList.contains('dict-entry-card--grammar')).toBe(true)
    expect(card.classList.contains('dict-entry-card--learning')).toBe(true)
    expect(card.querySelector('.dict-level-badge').textContent).toBe('N5')
    expect(card.querySelector('.dict-entry-card__char').textContent).toBe(GRAMMAR.pattern)
    expect(card.querySelector('rt')).toBeNull()
    // The gloss is a phrase: printed whole, never cut at its first comma.
    expect(card.querySelector('.dict-entry-card__meaning').textContent).toBe(GRAMMAR.meaning)
    // A pattern may take two lines, so its divisor stops at eight.
    expect(card.style.getPropertyValue('--len')).toBe('8')
    expect(cards[1].style.getPropertyValue('--len')).toBe('4')

    card.click()
    await settle(60)
    const entry = screen.container.querySelector('.dict-entry')
    const plate = entry.querySelector('.dict-plate')
    // Structure over pattern over gloss; the level and the seal.
    expect(plate.querySelector('.dict-plate__structure').textContent).toBe(GRAMMAR.structure)
    expect(plate.querySelector('.dict-plate__word').textContent).toBe(GRAMMAR.pattern)
    expect(plate.querySelector('.dict-plate__word').classList.contains('dict-plate__word--long')).toBe(true)
    expect(plate.querySelector('.dict-plate__caption').textContent).toBe(GRAMMAR.meaning)
    expect(plate.querySelector('.dict-plate__level').textContent).toBe('N5')
    expect(plate.querySelector('.stage-mark').textContent).toBe(T.learning)
    expect(plate.querySelector('.dict-plate__yomi')).toBeNull()
    // No speaker — a pattern is not said — but the add roundel, then ✕.
    expect(plate.querySelector(`[aria-label="${T.listen}"]`)).toBeNull()
    const actions = [...plate.querySelectorAll('.dict-plate__actions .dict-plate__btn')]
    expect(actions.map(b => b.getAttribute('aria-label'))).toEqual([T.mineToDeck, T.close])
    // The body: formation, meaning, the two sentences with their ruby,
    // the record — and nothing drawn.
    const blocks = [...entry.querySelectorAll('.dict-block')].map(b => b.getAttribute('aria-label'))
    expect(blocks).toEqual([T.formation, T.meaning, T.examples, T.cardStats])
    expect(entry.querySelector('.dict-formation').textContent).toBe(GRAMMAR.structure)
    expect(entry.querySelectorAll('.dict-ex').length).toBe(2)
    expect(entry.querySelector('.dict-ex rt').textContent).toBe('きのう')
    expect(entry.querySelector('.dict-ex__tr').textContent).toBe(GRAMMAR.examples[0].en)
    expect(entry.querySelector('.dict-form')).toBeNull()
    expect(entry.querySelector('.dict-parts')).toBeNull()
    expect(entry.querySelector('.records').textContent).toContain('67')
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
    // The headword, and only the headword, in the specimen's slot — its
    // readings ride over it as furigana (below), so the ruby's own base
    // is what the eye reads.
    expect(cards[0].querySelector('.dict-entry-card__char ruby').firstChild.textContent).toBe('駅')
    // The reading rides ON the headword now, as furigana: the word's
    // own per-kanji alignment, and a kanji's first two readings over the
    // character. The line that printed it above the word is gone — on a
    // kana-only entry it printed the word twice.
    expect(screen.container.querySelector('.dict-entry-card__kana')).toBeNull()
    expect(cards[0].querySelector('.dict-entry-card__char rt').textContent).toBe('エキ・えき')
    expect(cards[1].querySelector('.dict-entry-card__char rt').textContent).toBe('でんしゃ')
    expect(cards[1].querySelector('.dict-entry-card__char ruby').textContent).toBe('電車でんしゃ')
    // Nothing to annotate, nothing annotated.
    expect(cards[2].querySelector('rt')).toBeNull()
    // A character that is a word is read as that word — not as its own
    // list of readings.
    expect(cards[3].querySelector('.dict-entry-card__char rt').textContent).toBe('やま')
    // One that is not takes one reading from each register, never the
    // first two of a list that starts with every on'yomi.
    expect(cards[4].querySelector('.dict-entry-card__char rt').textContent).toBe('ド・つち')
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
    // Each tile measures its own headword, so the word can be set to
    // fit the tile on one line (index.css, .dict-entry-card__char).
    for (const card of cards) {
      // The headword's own characters, not its furigana: the ruby is
      // set at a rung of its own and never enters the fit.
      const word = card.querySelector('.dict-entry-card__char').cloneNode(true)
      word.querySelectorAll('rt').forEach(rt => rt.remove())
      expect(card.style.getPropertyValue('--len')).toBe(String([...word.textContent].length))
    }
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
    // The readings sheet (the entry's own, over the dock): a gate per
    // register, standing open at 音 because that is where the deck's
    // order starts. うまや, which no word carries, is behind the other
    // gate, as a chip under the kun register's one band.
    const sheet = document.querySelector('.dict-sheet__scrim--over .dict-sheet[role="dialog"]')
    expect(sheet).not.toBeNull()
    const gates = [...sheet.querySelectorAll('.dict-gate')]
    expect(gates.map(g => g.getAttribute('aria-pressed'))).toEqual(['true', 'false'])
    expect(sheet.querySelector('.dict-rd__yomi').textContent).toBe('エキ')
    expect(sheet.querySelector('.dict-rest__chip')).toBeNull()
    gates[1].click()
    await settle(60)
    expect(sheet.querySelector('.dict-rd__yomi').textContent).toBe('えき')
    expect(sheet.querySelector('.dict-rest__chip').textContent).toBe('うまや')
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
