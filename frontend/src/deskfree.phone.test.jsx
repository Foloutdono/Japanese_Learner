import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from './LangContext'
import ModeSelector from './components/selection/ModeSelector'
import { RouteStops } from './components/selection/RouteStops'
import './index.css'

// ── 机 — nothing of the desk's second round reaches a phone (plan 114) ──
// The desk's layouts are written in one media block that a phone never
// matches (src/desk.css.test.js) and rendered only when hooks/useDesk
// says so. This file is the phone's side of each of them, one block per
// phase: at 390px every screen the desk re-lays keeps the phone's own
// arrangement. The existing phone contracts are not edited; these are
// additions.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
// iOS Safari, for plan 120's install row: off by default, as headless
// Chromium is, so nothing else here meets that row.
const install = vi.hoisted(() => ({ ios: false }))
vi.mock('./stores/installPrompt', async o => ({ ...(await o()), isIosSafari: () => install.ios }))
// The statistics' two payloads (P4); nothing else here fetches.
const STATS = {
  kana: { hiragana_basic: { 'kana.flashcard.f2b': { total: 46, new: 0, learning: 6, mastered: 40, reviews: 200, correct: 180 } } },
  vocab: { N5: { 'vocab.flashcard.f2b': { total: 665, new: 465, learning: 80, mastered: 120, reviews: 900, correct: 700 } } },
}
const REPORT = {
  days: [0, 7, 14].map(ago => {
    const d = new Date()
    d.setDate(d.getDate() - ago)
    return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, reviews: 40, good: 32 }
  }),
  strength: [{ days: 0, count: 20 }, { days: 12, count: 30 }],
  weakest: Array.from({ length: 12 }, (_, i) => ({
    card_id: `c${i}`, raw_id: `vocab_N5_語${i}_ご`, category: 'vocab', key: 'N5', mode: 'vocab.flashcard.f2b', accuracy: 40, lapses: 3,
  })),
}
// And the deck pages' (P7): a deck, its cards, their shapes, its modes.
const DECK = { id: 1, name: 'Voyage', type: 'standard', role: 'owner', card_count: 1 }
const deckAnswer = path => ({
  '/api/decks': { decks: [DECK] },
  '/api/decks/structures': { structures: [{ key: 'standard', fields: [{ key: 'front', required: true }, { key: 'back', required: true }] }] },
  '/api/decks/1': DECK,
  '/api/decks/1/cards': { cards: [{ id: 11, origin: 'custom', front: '駅', back: 'gare', fields: {} }] },
  '/api/decks/1/modes': { modes: ['vocab.flashcard.f2b'] },
}[path] ?? {})
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch,
  apiJson: vi.fn(),
  apiJsonWithTimeout: vi.fn(async path => (path === '/api/stats' ? STATS : REPORT)),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))

describe('the canvas and the lattices (P1)', () => {
  it('keeps the phone\'s column and its upright route', async () => {
    const stops = ['N5', 'N4', 'N3'].map(k => ({ key: k, code: k, name: k, total: 10, learned: 1 }))
    await render(
      <LangProvider>
        <div className="phone">
          <div className="phone__content">
            <main className="learn"><RouteStops stops={stops} here="N4" onSelect={() => {}} /></main>
          </div>
        </div>
      </LangProvider>
    )
    await settle()
    expect(getComputedStyle(document.querySelector('.phone__content')).maxWidth).toBe('none')
    expect(getComputedStyle(document.querySelector('.route')).flexDirection).toBe('column')
    const [a, b] = [...document.querySelectorAll('.route-stop')].map(el => el.getBoundingClientRect())
    expect(b.top).toBeGreaterThan(a.bottom)
  })

  it('keeps the platforms one to a row, the odd one not spanning', async () => {
    await render(
      <LangProvider>
        <main className="learn">
          <ModeSelector modes={[1, 2, 3].map(i => ({ key: `m${i}`, label: `M${i}` }))} onSelect={() => {}} />
        </main>
      </LangProvider>
    )
    await settle()
    const slots = [...document.querySelectorAll('.platform-slot')]
    expect(getComputedStyle(slots[2]).gridColumnStart).toBe('auto')
    const [a, b] = slots.map(el => el.getBoundingClientRect())
    expect(b.top).toBeGreaterThan(a.bottom - 1)
  })
})

describe('the gates (P2)', () => {
  it('keeps the Learn plate\'s three-stop foot', async () => {
    const { Plate, StopsFoot } = await import('./components/station/LinePlate')
    const stops = ['N5', 'N4', 'N3', 'N2', 'N1'].map((k, i) => ({ key: k, label: k, jp: false, score: i === 0 ? 0.4 : 0 }))
    await render(
      <LangProvider>
        <main className="learn">
          <div className="plates">
            <Plate section={{ path: '/learn/vocab', title: 'Vocab', color: 'var(--line-vocab)' }} foot={<StopsFoot stops={stops} />} />
          </div>
        </main>
      </LangProvider>
    )
    await settle()
    expect(document.querySelector('.plate__foot--stops')).not.toBeNull()
    expect(document.querySelector('.desk-line')).toBeNull()
  })
})

describe('the stations (P3)', () => {
  it('draws no split and marks no stop open', async () => {
    const { RouteStops } = await import('./components/selection/RouteStops')
    const stops = ['N5', 'N4'].map(k => ({ key: k, code: k, name: k }))
    await render(
      <LangProvider>
        <main className="learn"><RouteStops stops={stops} here="N4" onSelect={() => {}} /></main>
      </LangProvider>
    )
    await settle()
    expect(document.querySelector('.desk-split, .desk-stop--open, [aria-current="page"]')).toBeNull()
    expect(document.querySelector('[aria-current="location"]')).not.toBeNull()
  })
})

describe('the statistics (P4)', () => {
  it('keeps the phone\'s column: the plates stacked, no desk class, no sheet', async () => {
    const { MemoryRouter } = await import('react-router-dom')
    const { default: StatsScreen } = await import('./screens/StatsScreen')
    await render(
      <LangProvider>
        <MemoryRouter>
          <div className="phone"><div className="phone__content"><StatsScreen session={null} /></div></div>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(250)
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
    expect(getComputedStyle(document.querySelector('.rep-plates')).display).toBe('flex')
    const [a, b] = [...document.querySelectorAll('.rep-plate')].map(p => p.getBoundingClientRect())
    expect(b.top).toBeGreaterThan(a.bottom)
    expect(getComputedStyle(document.querySelector('.rep-strip')).gridTemplateColumns.split(' ')).toHaveLength(2)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('the runs (P5)', () => {
  it('stands no side, docks nothing and keeps the 🔍', async () => {
    const { MemoryRouter } = await import('react-router-dom')
    const { StudyStage } = await import('./components/study/StudyStage')
    const { SessionPanel } = await import('./components/study/SessionPanel')
    const { Flashcard } = await import('./components/study/QuizComponents')
    const { peekEntry } = await import('./stores/deskEntry')
    const { default: t } = await import('./locales/fr/index.js')
    await render(
      <LangProvider>
        <MemoryRouter>
          <StudyStage where="Kanji" onLeave={() => {}} leaveLabel="Kanji" pass={false} side={<SessionPanel />}>
            <Flashcard t={t} resetKey="a" front={<span>山</span>} back={<span>mountain</span>} dictTerm="山" dictCategory="kanji" session={{ access_token: 't' }} />
          </StudyStage>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await settle()
    expect(document.querySelector('.screen').className).toBe('screen')
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
    expect(document.querySelectorAll('.reveal-action-btn')).toHaveLength(2)
    expect(peekEntry()).toBeNull()
  })
})

describe('the header (P6)', () => {
  it('keeps every way out as the pill in the bar\'s corner', async () => {
    const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom')
    const { Bar, Leave } = await import('./components/chrome/Bar')
    let path = null
    const Probe = () => { path = useLocation().pathname; return null }
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/vocab/N5']}>
          <Routes>
            <Route path="*" element={<><Bar code="TG" title="Vocab" sub="N5" aside={<Leave to="/learn/vocab">Sources</Leave>} /><Probe /></>} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
    expect(document.querySelector('.bar__aside > .stage__leave')).not.toBeNull()
    expect(document.querySelector('.bar__names--stacked')).not.toBeNull()
    document.querySelector('.stage__leave').click()
    await settle()
    expect(path).toBe('/learn/vocab')
  })
})

describe('the decks (P7)', () => {
  it('keeps ▶ Study, the form in the page and fetches no platforms', async () => {
    apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => deckAnswer(path) }))
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { default: DeckDetailScreen } = await import('./screens/DeckDetailScreen')
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/decks/1']}>
          <Routes><Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(250)
    expect(document.querySelector('.deck-identity__study')).not.toBeNull()
    document.querySelector('.chip-row button').click()
    await settle()
    expect(document.querySelector('main.learn > .deckdetail-form')).not.toBeNull()
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
    expect(apiFetch.mock.calls.some(([p]) => p === '/api/decks/1/modes')).toBe(false)
  })

  it('opens "new deck" in the page, its door turned into the way out', async () => {
    apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => deckAnswer(path) }))
    const { MemoryRouter } = await import('react-router-dom')
    const { default: DecksScreen } = await import('./screens/DecksScreen')
    await render(
      <LangProvider>
        <MemoryRouter><DecksScreen session={{}} /></MemoryRouter>
      </LangProvider>
    )
    await settle(250)
    const before = document.querySelector('.decks-doors > :last-child').textContent
    document.querySelector('.decks-doors > :last-child').click()
    await settle()
    expect(document.querySelector('main.learn > .form')).not.toBeNull()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.querySelector('.decks-doors > :last-child').textContent).not.toBe(before)
  })
})

// ── plan 115, P3 — the second screens a phone keeps ──
// On the desk a grammar level's points stand beside the open lesson, a
// theme's bands and the tiers beside the open one's platforms, and the
// deck's platform screen gives way to the deck's page. A phone keeps
// every one of them a screen of its own: the index opens each point in
// its sheet, the lists stay lists with no stop marked open and nothing
// figured, and nothing redirects.
describe('the folded stations (plan 115, P3)', () => {
  const POINTS = [
    { raw_id: 'grammar_N4_a', pattern: '〜ために', meaning: 'in order to', stage: 'mastered' },
    { raw_id: 'grammar_N4_b', pattern: '〜ように', meaning: 'so that', stage: 'new' },
  ]
  const TIERS = { tiers: [1, 2, 3].map(n => ({ tier: n, start_rank: (n - 1) * 200 + 1, end_rank: n * 200, count: 200 })) }
  const THEMES = { themes: [{ key: 'animaux', levels: [{ level: 'basic', count: 24 }, { level: 'medium', count: 30 }] }] }
  const answer = path => (String(path).includes('/tiers') ? TIERS : String(path).startsWith('/api/themes') ? THEMES : deckAnswer(path))

  async function mount(entry, routes) {
    const { MemoryRouter, Routes, useLocation } = await import('react-router-dom')
    const seen = { path: null }
    function Probe() { seen.path = useLocation().pathname + useLocation().search; return null }
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={[entry]}><Routes>{routes}</Routes><Probe /></MemoryRouter>
      </LangProvider>
    )
    await settle(300)
    return seen
  }

  it('keeps the grammar index a list, each point opening its sheet', async () => {
    const { apiJson } = await import('./lib/api')
    apiJson.mockImplementation(async url => (String(url).startsWith('/api/grammar/points')
      ? { points: POINTS, learned: 1, started: 1, total: 2, totals: {} }
      : { ...POINTS[1], level: 'N4', steps: [], compare: [], examples: [], status: { status: 'new' } }))
    const { Route } = await import('react-router-dom')
    const { default: GrammarScreen } = await import('./screens/GrammarScreen')
    const seen = await mount('/learn/grammar/N4?index=1', <Route path="/learn/grammar/:level" element={<GrammarScreen session={{}} />} />)
    expect(seen.path).toBe('/learn/grammar/N4?index=1')
    expect(document.querySelectorAll('.gl-index__row')).toHaveLength(2)
    expect(document.querySelector('[aria-current="page"]')).toBeNull()
    expect(document.querySelector('.desk-lesson, .desk-split')).toBeNull()
    document.querySelectorAll('.gl-index__row')[1].click()
    await settle(250)
    expect(document.querySelector('[role="dialog"] article.gl')).not.toBeNull()
    apiJson.mockReset()
  })

  it('keeps the tiers, a tier\'s platforms and a theme\'s bands each a screen', async () => {
    apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => answer(path) }))
    const { Route } = await import('react-router-dom')
    const { default: VocabScreen } = await import('./screens/VocabScreen')
    const routes = (
      <>
        <Route path="/learn/vocab/tiers" element={<VocabScreen session={{}} />} />
        <Route path="/learn/vocab/tier/:tier" element={<VocabScreen session={{}} />} />
        <Route path="/learn/vocab/theme/:theme" element={<VocabScreen session={{}} />} />
      </>
    )
    let seen = await mount('/learn/vocab/tiers', routes)
    expect(seen.path).toBe('/learn/vocab/tiers')
    expect([...document.querySelectorAll('.platform-card__no')].map(n => n.textContent)).toEqual(['1', '2', '3'])
    expect(document.querySelector('[aria-current="page"], .desk-stop--open')).toBeNull()
    document.body.innerHTML = ''

    seen = await mount('/learn/vocab/tier/2?size=200', routes)
    expect(seen.path).toBe('/learn/vocab/tier/2?size=200')
    expect(document.querySelector('.desk-split, .desk-mode-fig')).toBeNull()
    expect(apiFetch.mock.calls.some(([p]) => String(p).includes('/stats'))).toBe(false)
    document.body.innerHTML = ''

    seen = await mount('/learn/vocab/theme/animaux', routes)
    expect(seen.path).toBe('/learn/vocab/theme/animaux')
    expect(document.querySelectorAll('.route-stop')).toHaveLength(4)
    expect(document.querySelector('[aria-current="page"]')).toBeNull()
  })

  it('keeps a deck\'s platform screen', async () => {
    apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => deckAnswer(path) }))
    const { Route } = await import('react-router-dom')
    const { default: StudyScreen } = await import('./screens/StudyScreen')
    const seen = await mount('/learn/decks/1/study', (
      <>
        <Route path="/learn/decks/:deck_id/study" element={<StudyScreen session={{}} />} />
        <Route path="/learn/decks/:deck_id" element={<p className="probe-deck">deck</p>} />
      </>
    ))
    expect(seen.path).toBe('/learn/decks/1/study')
    expect(document.querySelector('.probe-deck')).toBeNull()
  })
})

// ── plan 115, P4 — the mock exam a phone keeps ──
// On the desk the answer sheet stands in the run's side, a reading
// passage beside its questions, the keys are named, and the review is a
// list beside its page. A phone keeps its own paper (plan 171): the
// cover first, then the page over the dock of answer tiles, the passage
// scrolling in the page, no key names, the answer sheet in a sheet, and
// the review's rows opening under themselves with both ways on at the
// foot.
describe('the mock exam (plan 115, P4)', () => {
  const choices = (...texts) => texts.map((textJp, i) => ({ id: `c${i + 1}`, textJp }))
  const PAPER = {
    id: 'e1', level: 'N4', revision: 3, title: 'N4 Reading',
    sections: [{
      id: 'reading', label: 'Reading', labelJp: '読解', timeLimitMin: 25,
      mondai: [{ id: 'm2', number: 1, type: 'reading-passage', instructionsJp: 'よんでください。', passages: [{
        id: 'p1', textJp: 'わたしは毎朝七時に起きます。',
        questions: [
          { id: 'r1', promptJp: '何時に起きますか。', answer: 'c2', choices: choices('六時', '七時') },
          { id: 'r2', promptJp: 'だれですか。', answer: 'c1', choices: choices('わたし', 'あなた') },
        ],
      }] }],
    }],
  }

  it('keeps the cover, the dock, the passage in its page and no key names', async () => {
    localStorage.clear()
    apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => PAPER }))
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { default: ExamRunner } = await import('./screens/ExamRunner')
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/practice/exam/e1']}>
          <Routes><Route path="/practice/exam/:examId" element={<ExamRunner session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(300)
    expect(document.querySelector('.exam-cover')).not.toBeNull()
    expect(document.querySelector('[role="timer"]')).toBeNull()
    document.querySelector('.exam-cover__go').click()
    await settle(250)
    expect(document.querySelector('.exam-dock .exam-tiles')).not.toBeNull()
    expect(document.querySelector('.exam-run__head [role="timer"]')).not.toBeNull()
    expect(document.querySelector('.exam-page .exam-ask__scroll .exam-passage__text')).not.toBeNull()
    expect(document.querySelector('.exam-sheetbar, .exam-meta, .exam-card')).toBeNull()
    expect(document.querySelector('[class*="desk-"], [aria-keyshortcuts]')).toBeNull()
    document.querySelector('.exam-run__sheet').click()
    await settle(250)
    expect(document.querySelector('[role="dialog"] .exam-parts .exam-sheet__grid')).not.toBeNull()
  })

  it('keeps the review opening each row under itself', async () => {
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { default: ExamResult } = await import('./screens/ExamResult')
    const review = [
      { id: 'r1', sectionId: 'reading', given: 'c1', answer: 'c2', isCorrect: false },
      { id: 'r2', sectionId: 'reading', given: 'c1', answer: 'c1', isCorrect: true },
    ]
    const summary = { attemptId: 9, revision: 3, review, perSection: { reading: { correct: 1, total: 2, pct: 50 } } }
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={[{ pathname: '/practice/exam/e1/results', state: { summary, exam: PAPER } }]}>
          <Routes><Route path="/practice/exam/:examId/results" element={<ExamResult session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(200)
    const rows = document.querySelectorAll('.exam-miss')
    expect(rows).toHaveLength(1)
    expect(rows[0].getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('[aria-current="page"], .desk-split, .exam-card')).toBeNull()
    expect(document.querySelectorAll('.exam-res__part')).toHaveLength(1)
    rows[0].click()
    await settle()
    expect(document.querySelector('.exam-review-row__detail .mcq-row--correct')).not.toBeNull()
    expect(document.querySelectorAll('.btn-row button')).toHaveLength(2)
  })
})

// ── plan 115, P5 — the library and Browse a phone keeps ──
// On the desk a published deck stands beside the shelf and Browse docks
// in the deck page's side. A phone keeps the shelf and the deck two
// screens (the same route component, deciding), and Browse its overlay.
describe('the library and Browse (plan 115, P5)', () => {
  const LISTED = [{ id: 7, name: 'Cuisine', type: 'vocab', card_count: 25, author: 'Aiko', followers: 1 }]

  it('keeps the shelf and a published deck two screens', async () => {
    const { apiJson } = await import('./lib/api')
    apiJson.mockImplementation(async url => (String(url).startsWith('/api/decks/library?')
      ? { results: LISTED, total: 1, has_more: false, types: ['vocab'] }
      : { ...LISTED[0], followed: false, preview: [{ id: 1, front: '寿司', back: 'sushi' }] }))
    const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom')
    const { default: LibraryScreen } = await import('./screens/LibraryScreen')
    const seen = { path: null }
    function Probe() { seen.path = useLocation().pathname; return null }
    const routes = (
      <Routes>
        <Route path="/learn/decks/library" element={<LibraryScreen session={{}} />} />
        <Route path="/learn/decks/library/:deck_id" element={<LibraryScreen session={{}} />} />
      </Routes>
    )
    await render(<LangProvider><MemoryRouter initialEntries={['/learn/decks/library']}>{routes}<Probe /></MemoryRouter></LangProvider>)
    await settle(300)
    expect(seen.path).toBe('/learn/decks/library')
    expect(document.querySelector('.lib-card[aria-current], .desk-split')).toBeNull()
    document.querySelector('.lib-card').click()
    await settle(300)
    expect(seen.path).toBe('/learn/decks/library/7')
    expect(document.querySelector('.lib-card')).toBeNull()
    expect(document.querySelector('main.learn > .deck-identity .deck-identity__name').textContent).toBe('Cuisine')
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
    apiJson.mockReset()
  })

  it('keeps Browse an overlay over the deck page', async () => {
    const vocab = { ...DECK, type: 'vocab' }
    apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => (path === '/api/decks/1' ? vocab : String(path).includes('/browse') ? { results: [] } : deckAnswer(path)) }))
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { default: DeckDetailScreen } = await import('./screens/DeckDetailScreen')
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/decks/1']}>
          <Routes><Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(250)
    ;[...document.querySelectorAll('.chip-row button')].find(b => /browse|parcourir/i.test(b.textContent)).click()
    await settle(250)
    expect(document.querySelector('.import-overlay [role="dialog"].browse-modal')).not.toBeNull()
    expect(document.querySelector('.desk-browse')).toBeNull()
  })
})

// ── plan 115, P6 — the analyser and the dictionary a phone keeps ──
// On the desk the analyser's result carries its dictionary in a column,
// its way back is a crumb, its intake stands beside its history, and the
// dictionary offers to analyse a sentence it has no entry for. A phone
// keeps the sheet over the stage, the way back in the head, the history
// under the intake, the legend, and a plain "no results".
describe('the analyser and the dictionary (plan 115, P6)', () => {
  const tok = (surface, kanji, kana) => ({
    surface, pos: 'noun', furigana: [{ text: surface }], kanji_matches: [],
    vocab_match: { entry: { kanji, kana, meaning: 'station' }, stats: { status: 'learning' }, level: 'N5', raw_id: `vocab_N5_${kanji}_${kana}` },
  })
  const SENTENCES = [{ text: '駅で待つ', grammar: [], unknown_count: 0, available: true, level: 'N5', off_deck_count: 0, tokens: [tok('駅', '駅', 'えき')] }]
  const type = (el, text) => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, text)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  it('keeps the sheet, the head\'s way back and the passages under the line', async () => {
    const { apiJson } = await import('./lib/api')
    apiJson.mockImplementation(async url => (String(url).startsWith('/api/phrase/analyze') ? { sentences: SENTENCES, truncated: 0 } : {}))
    apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ results: [{ type: 'vocab', kanji: '駅', kana: 'えき', meaning: 'station', senses: [], examples: [], status: { status: 'new' } }], total: 1 }) }))
    const { MemoryRouter } = await import('react-router-dom')
    const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')
    await render(<LangProvider><MemoryRouter initialEntries={['/dictionary/analyzer']}><AnalyzerScreen session={{}} /></MemoryRouter></LangProvider>)
    await settle(100)
    expect(document.querySelector('.desk-intake, .desk-side')).toBeNull()
    // Plan 136: the line over the passages, rows rather than the desk's
    // cards, no console to search, no segmented control.
    expect(document.querySelector('main > .anl-entry')).not.toBeNull()
    expect(document.querySelector('main > .anl-shelf')).not.toBeNull()
    expect(document.querySelector('.anl-card, .anl-shelf__grid, .anl-shelf .console, .anl-sources')).toBeNull()
    expect(document.querySelector('.anl-action .desk-kbd, [aria-keyshortcuts]')).toBeNull()
    type(document.querySelector('textarea'), '駅で待つ')
    document.querySelector('.anl-action').click()
    await settle(300)
    expect(document.querySelector('.anl-m__head .stage__leave')).not.toBeNull()
    expect(document.querySelector('.desk-crumb, .anl-desk')).toBeNull()
    // The phone's drawing (plan 134), with no colour legend and no key
    // map; a word tapped on the subtitles opens its card in the sheet.
    expect(document.querySelector('.anl-m .anl-m__subs')).not.toBeNull()
    expect(document.querySelector('.anl-legend, .anl-kbd, .anl-stage')).toBeNull()
    document.querySelector('.anl-m__subs .tok').click()
    await settle(250)
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    apiJson.mockReset()
  })

  it('keeps "no results" plain for a sentence the dictionary cannot find', async () => {
    const { apiJson } = await import('./lib/api')
    apiJson.mockImplementation(async () => ({ decks: [] }))
    apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ results: [], total: 0, has_more: false, groups: [] }) }))
    const { MemoryRouter } = await import('react-router-dom')
    const { default: DictionaryScreen } = await import('./screens/DictionaryScreen')
    await render(<LangProvider><MemoryRouter initialEntries={['/dictionary']}><DictionaryScreen session={{}} /></MemoryRouter></LangProvider>)
    await settle(200)
    type(document.querySelector('.dictionary input:not([type]), .dictionary input[type="text"], .dictionary input[type="search"]'), '駅で待つ')
    await settle(700)
    expect(document.querySelector('.empty')).not.toBeNull()
    expect(document.querySelector('.empty__action')).toBeNull()
    apiJson.mockReset()
  })
})

// ── plan 115, P7 — the run a phone keeps ──
// On the desk a run's card and choices stand side by side from the top
// of the window, the unused choices keep their place once answered, and
// the panel lists the misses at the end. A phone keeps its stage a
// column and collapses the unused choices, as ever.
describe('a run (plan 115, P7)', () => {
  it('keeps the stage a column and collapses the unused choices', async () => {
    const { MemoryRouter } = await import('react-router-dom')
    const { StudyStage } = await import('./components/study/StudyStage')
    const { MCQGrid } = await import('./components/study/QuizComponents')
    const { CardTransition } = await import('./components/study/CardTransition')
    const { default: PromptCard } = await import('./components/study/PromptCard')
    const { SessionPanel } = await import('./components/study/SessionPanel')
    await render(
      <LangProvider>
        <MemoryRouter>
          <StudyStage where="Kanji" onLeave={() => {}} leaveLabel="Kanji" pass={false} side={<SessionPanel done />}>
            <CardTransition className="specimen-card-stage" cardKey="k"><PromptCard><span>駅</span></PromptCard></CardTransition>
            <MCQGrid choices={['gare', 'eau', 'feu', 'arbre']} correct="gare" selected="eau" answered onAnswer={() => {}} />
          </StudyStage>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(500)
    expect(getComputedStyle(document.querySelector('.stage')).display).toBe('flex')
    const filler = document.querySelector('.mcq-row--filler')
    expect(getComputedStyle(filler).maxHeight).toBe('0px')
    expect(document.querySelector('.desk-run, .desk-run__side, .desk-misses')).toBeNull()
  })
})

// ── plan 115, P8 — the keys and doors a phone does without ──
// On the desk Enter departs and takes a run's last action, Esc leaves a
// run, C shows the choices, a route is walked by arrow, and the profile
// shows both rankings. A phone prints no key, answers none of them, and
// keeps its one board behind the toggle.
describe('the keys and the boards (plan 115, P8)', () => {
  const press = (key, init = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))

  it('answers no Esc, Enter or C, and prints no cap', async () => {
    const { MemoryRouter } = await import('react-router-dom')
    const { StudyStage } = await import('./components/study/StudyStage')
    const { DoneMessage } = await import('./components/study/QuizComponents')
    const { default: HintBar } = await import('./components/study/HintBar')
    const onLeave = vi.fn()
    const onBack = vi.fn()
    const onToggle = vi.fn()
    await render(
      <LangProvider>
        <MemoryRouter>
          <StudyStage where="Kanji" onLeave={onLeave} leaveLabel="Kanji" pass={false}>
            <HintBar available={['indice_1']} active={[]} onToggle={onToggle} />
            <DoneMessage onBack={onBack} />
          </StudyStage>
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    press('Escape'); press('Enter'); press('c')
    await settle()
    expect(onLeave).not.toHaveBeenCalled()
    expect(onBack).not.toHaveBeenCalled()
    expect(onToggle).not.toHaveBeenCalled()
    expect(document.querySelector('.desk-kbd, [aria-keyshortcuts]')).toBeNull()
  })

  it('keeps a route one tab stop per row and the ranking behind its toggle', async () => {
    const { Banzuke } = await import('./components/profile/Banzuke')
    const { default: t } = await import('./locales/fr/index.js')
    const board = { entries: [{ rank: 1, username: 'a', xp: 100 }], me: null }
    await render(
      <LangProvider>
        <RouteStops stops={[{ key: 'N5', code: 'N5', name: 'a' }, { key: 'N4', code: 'N4', name: 'b' }]} onSelect={() => {}} />
        <Banzuke all={board} week={board} t={t} both={false} />
      </LangProvider>
    )
    await settle()
    expect([...document.querySelectorAll('.route-stop')].every(r => !r.hasAttribute('tabindex'))).toBe(true)
    expect(document.querySelectorAll('.banzuke')).toHaveLength(1)
    expect(document.querySelector('.bz__seg')).not.toBeNull()
  })
})

// ── plan 166 — the gate a phone keeps ──
// On the desk the gate is plan 135's bands, head and fare foot
// (today.wide.test.jsx). A phone draws the day in one gesture: one
// card, the gate under it with no key printed, and the switches in a
// sheet -- a column there, one lane to a row across the whole of it.
describe('the gate on a phone (plan 166)', () => {
  it('keeps the switches in a sheet, one lane to a row, and prints no key', async () => {
    apiFetch.mockImplementation(async () => ({
      ok: true, status: 200, json: async () => ({ balance: 50, cap: 200, unlimited: false, enforced: false }),
    }))
    const { default: GateCard } = await import('./components/station/GateCard')
    const lane = (source, deck, mode, due) => ({ id: `${source}:${deck}:${mode}`, kind: 'section', source, deck, mode, due, new: 0 })
    const lanes = [
      lane('kana', 'hiragana_basic', 'kana.flashcard.f2b', 18),
      lane('vocab', 'N5', 'vocab.flashcard.f2b', 30),
      lane('vocab', 'N5', 'vocab.word_reading', 12),
      lane('kanji', 'N5', 'kanji.flashcard.f2b', 14),
      lane('kanji', 'N5', 'kanji.readings', 6),
      lane('grammar', 'N5', 'grammar.flashcard.f2b', 5),
    ]
    await render(
      <LangProvider>
        <main className="today">
          <GateCard today={{ total: lanes.reduce((n, l) => n + l.due, 0), lanes, by_source: {}, next_due: null }} />
        </main>
      </LangProvider>
    )
    await settle()
    expect(document.querySelector('.gate-card--one')).not.toBeNull()
    expect(document.querySelector('.lane')).toBeNull()
    expect(document.querySelector('.gate-one .desk-kbd, .gate-one [aria-keyshortcuts]')).toBeNull()
    document.querySelector('.gate-one__services').click()
    await settle()
    const box = document.querySelector('.gate-sheet__lines')
    const rows = [...box.querySelectorAll('.lane')].map(el => el.getBoundingClientRect())
    expect(rows).toHaveLength(6)
    rows.forEach((r, i) => {
      expect(Math.round(r.width)).toBe(box.clientWidth)
      if (i === 0) return
      expect(r.top).toBeGreaterThanOrEqual(rows[i - 1].bottom)
      expect(Math.round(r.left)).toBe(Math.round(rows[0].left))
    })
    // Plan 135's gate is the desk's: no bands and no fare foot.
    expect(document.querySelector('.gate-card--desk, .gate-band, .gate-card__fare')).toBeNull()
  })
})

// ── plan 117 — a split's rows stay buttons below the line ──
// On the desk the rows of a split's list are links (components/selection/
// SplitRow), so a stop, a band, a tier, a point, a deck or a question
// opens in a new tab too. A phone has no split: every one of those rows
// stays the button it was — the same element, the same attributes —
// and a tap still pushes the next screen (or, for the review, opens the
// question under its row). Each screen is mounted at the width it
// decides on, so nothing here passes a phone the desk's URL.
describe('the split\'s rows (plan 117)', () => {
  const POINTS = [
    { raw_id: 'grammar_N4_a', pattern: '〜ために', meaning: 'in order to', stage: 'mastered' },
    { raw_id: 'grammar_N4_b', pattern: '〜ように', meaning: 'so that', stage: 'new' },
  ]
  const TIERS = { tiers: [1, 2, 3].map(n => ({ tier: n, start_rank: (n - 1) * 200 + 1, end_rank: n * 200, count: 200 })) }
  const THEMES = { themes: [{ key: 'animaux', levels: [{ level: 'basic', count: 24 }, { level: 'medium', count: 30 }] }] }
  const LISTED = [{ id: 7, name: 'Cuisine', type: 'vocab', card_count: 25, author: 'Aiko', followers: 1 }]

  async function mount(entry, routes) {
    const { MemoryRouter, Routes, useLocation, useNavigationType } = await import('react-router-dom')
    const seen = { path: null, type: null }
    function Probe() {
      const loc = useLocation()
      seen.path = loc.pathname + loc.search
      seen.type = useNavigationType()
      return null
    }
    document.body.innerHTML = ''
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={[entry]}><Routes>{routes}</Routes><Probe /></MemoryRouter>
      </LangProvider>
    )
    await settle(300)
    return seen
  }

  // Every row a `<button type="button">` carrying only what it always
  // carried, and no link anywhere in the lists.
  const ALLOWED = ['type', 'class', 'aria-current', 'aria-expanded', 'style']
  function buttonsOnly(sel) {
    const rows = [...document.querySelectorAll(sel)]
    expect(rows.length, sel).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.tagName, sel).toBe('BUTTON')
      expect(r.getAttribute('type'), sel).toBe('button')
      expect([...r.attributes].map(a => a.name).filter(n => !ALLOWED.includes(n)), sel).toEqual([])
    }
    expect(document.querySelector('.route a, .gl-index a, .platform-grid > a, .exam-review a')).toBeNull()
    return rows
  }

  it('keeps the JLPT line, the kana sets and the exam\'s grades buttons that push', async () => {
    const { Route } = await import('react-router-dom')
    const { default: VocabScreen } = await import('./screens/VocabScreen')
    const { default: KanaScreen } = await import('./screens/KanaScreen')
    const { default: ExamScreen } = await import('./screens/ExamScreen')
    let seen = await mount('/learn/vocab/levels', (
      <>
        <Route path="/learn/vocab/levels" element={<VocabScreen session={{}} />} />
        <Route path="/learn/vocab/:level" element={<p className="probe-level">level</p>} />
      </>
    ))
    buttonsOnly('.route-stop').find(s => s.textContent.includes('N5')).click()
    await settle()
    expect(seen.path).toBe('/learn/vocab/N5')
    expect(seen.type).toBe('PUSH')

    seen = await mount('/learn/kana', <Route path="/learn/kana" element={<KanaScreen />} />)
    expect(seen.path).toBe('/learn/kana')
    buttonsOnly('.route-stop')

    // The grades show once there are papers to sit: on a phone a band of
    // radios over the papers (plan 171), every one a button, no link.
    const paper = (level, kind) => ({ id: `e-${level}-${kind}`, level, kind, title: `${level} ${kind}`, questionCount: 18, generated: true, revision: 1 })
    apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => (path === '/api/exams' ? [paper('N5', 'vocab'), paper('N5', 'grammar'), paper('N4', 'vocab')] : {}) }))
    seen = await mount('/practice/exam', <Route path="/practice/exam" element={<ExamScreen session={{}} />} />)
    expect(seen.path).toBe('/practice/exam')
    expect(document.querySelector('.learn a:not(.skip-link)')).toBeNull()
    const grades = [...document.querySelectorAll('.seg__opt')]
    expect(grades.map(g => g.textContent)).toEqual(['N5', 'N4', 'N3', 'N2', 'N1'])
    for (const b of [...grades, ...document.querySelectorAll('.exam-st__row')]) expect(b.tagName).toBe('BUTTON')
    grades[1].click()
    await settle()
    expect(seen.path).toBe('/practice/exam?level=N4')
    apiFetch.mockReset()
  })

  it('keeps a theme\'s bands and the tiers buttons', async () => {
    apiFetch.mockImplementation(async path => ({
      ok: true, status: 200,
      json: async () => (String(path).includes('/tiers') ? TIERS : String(path).startsWith('/api/themes') ? THEMES : {}),
    }))
    const { Route } = await import('react-router-dom')
    const { default: VocabScreen } = await import('./screens/VocabScreen')
    const routes = (
      <>
        <Route path="/learn/vocab/tiers" element={<VocabScreen session={{}} />} />
        <Route path="/learn/vocab/theme/:theme" element={<VocabScreen session={{}} />} />
        <Route path="/learn/vocab/*" element={<p className="probe-next">next</p>} />
      </>
    )
    let seen = await mount('/learn/vocab/theme/animaux', routes)
    buttonsOnly('.route-stop')[1].click()
    await settle()
    expect(seen.path).toBe('/learn/vocab/theme/animaux/level/medium')
    expect(seen.type).toBe('PUSH')

    seen = await mount('/learn/vocab/tiers', routes)
    buttonsOnly('.tier-picker .platform-card')[1].click()
    await settle()
    expect(seen.path).toMatch(/^\/learn\/vocab\/tier\/2\?/)
    expect(seen.type).toBe('PUSH')
    apiFetch.mockReset()
  })

  it('keeps the grammar index buttons that open a sheet, the URL unchanged but for the point', async () => {
    const { apiJson } = await import('./lib/api')
    apiJson.mockImplementation(async url => (String(url).startsWith('/api/grammar/points')
      ? { points: POINTS, learned: 1, started: 1, total: 2, totals: {} }
      : { ...POINTS[1], level: 'N4', steps: [], compare: [], examples: [], status: { status: 'new' } }))
    const { Route } = await import('react-router-dom')
    const { default: GrammarScreen } = await import('./screens/GrammarScreen')
    await mount('/learn/grammar/N4?index=1', <Route path="/learn/grammar/:level" element={<GrammarScreen session={{}} />} />)
    buttonsOnly('.gl-index__row')[1].click()
    await settle(250)
    expect(document.querySelector('[role="dialog"] article.gl')).not.toBeNull()
    apiJson.mockReset()
  })

  it('keeps the library\'s shelf buttons that push a deck\'s page', async () => {
    const { apiJson } = await import('./lib/api')
    apiJson.mockImplementation(async url => (String(url).startsWith('/api/decks/library?')
      ? { results: LISTED, total: 1, has_more: false, types: ['vocab'] }
      : { ...LISTED[0], followed: false, preview: [] }))
    const { Route } = await import('react-router-dom')
    const { default: LibraryScreen } = await import('./screens/LibraryScreen')
    const seen = await mount('/learn/decks/library', (
      <>
        <Route path="/learn/decks/library" element={<LibraryScreen session={{}} />} />
        <Route path="/learn/decks/library/:deck_id" element={<LibraryScreen session={{}} />} />
      </>
    ))
    buttonsOnly('.lib-card')[0].click()
    await settle(300)
    expect(seen.path).toBe('/learn/decks/library/7')
    expect(seen.type).toBe('PUSH')
    apiJson.mockReset()
  })

  it('keeps the exam review\'s rows buttons that open under themselves, naming no question in the URL', async () => {
    const { Route } = await import('react-router-dom')
    const { default: ExamResult } = await import('./screens/ExamResult')
    const choices = (...texts) => texts.map((textJp, i) => ({ id: `c${i + 1}`, textJp }))
    const PAPER = {
      id: 'e1', level: 'N4', revision: 3, title: 'N4 Reading',
      sections: [{
        id: 'reading', label: 'Reading', labelJp: '読解', timeLimitMin: 25,
        mondai: [{ id: 'm1', number: 1, type: 'mcq-text', instructionsJp: 'えらんでください。',
          questions: [{ id: 'q1', promptJp: '毎朝、駅まで＿＿＿歩きます。', answer: 'c1', choices: choices('ゆっくり', 'はやく') }] }],
      }],
    }
    const summary = {
      attemptId: 9, revision: 3,
      review: [{ id: 'q1', sectionId: 'reading', given: 'c2', answer: 'c1', isCorrect: false }],
      perSection: { reading: { correct: 0, total: 1, pct: 0 } },
    }
    const seen = await mount(
      { pathname: '/practice/exam/e1/results', search: '?attempt=9', state: { summary, exam: PAPER } },
      <Route path="/practice/exam/:examId/results" element={<ExamResult session={{}} />} />,
    )
    const [row] = buttonsOnly('.exam-miss')
    expect(row.getAttribute('aria-expanded')).toBe('false')
    row.click()
    await settle()
    expect(row.getAttribute('aria-expanded')).toBe('true')
    expect(seen.path).toBe('/practice/exam/e1/results?attempt=9')
  })
})

// ── plan 118 — a radical's page a phone keeps ──
// On the desk a radical's page stands the index beside the lesson and
// its platforms, the open radical in gold and each platform figured,
// the family's door swaps the index for the family, and the bare index
// opens on a radical. A phone keeps its two screens: the lesson with
// its platforms, and the family in the lesson's place behind the door,
// the way back the bar's ‹ — no index fetched, no figure, nothing
// marked, nothing redirected.
describe('a radical\'s page (plan 118)', () => {
  const GROUPS = [{ stroke_count: 4, radicals: [
    { number: 61, char: '心', glyph: '心', stroke_count: 4, meaning: 'cœur', count: 40, learned: 2, started: 2 },
    { number: 85, char: '水', glyph: '水', stroke_count: 4, meaning: 'eau', count: 123, learned: 10, started: 10 },
  ] }]
  const WATER = {
    number: 85, glyph: '水', char: '水', meaning: 'eau', stroke_count: 4, forms: ['水'], names_ja: ['みず'],
    position: 'hen', svg_url: null, total: 1, learned: 0, started: 0,
    levels: [{ level: 'N5', kanji: [{ card_id: 'kanji_N5_水', kanji: '水', kana: 'みず', meaning: 'eau', stroke_count: 4, stage: 'new' }] }],
  }

  async function mount(entry) {
    const { MemoryRouter, Routes, Route, useLocation } = await import('react-router-dom')
    const { default: KanjiScreen } = await import('./screens/KanjiScreen')
    const seen = { path: null }
    function Probe() { seen.path = useLocation().pathname + useLocation().search; return null }
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/learn/kanji/radicals" element={<KanjiScreen session={{}} />} />
            <Route path="/learn/kanji/radical/:radical" element={<KanjiScreen session={{}} />} />
          </Routes>
          <Probe />
        </MemoryRouter>
      </LangProvider>
    )
    await settle(300)
    return seen
  }

  it('keeps the lesson and the family two screens, with no index beside them', async () => {
    const { apiJson } = await import('./lib/api')
    apiJson.mockImplementation(async url => (String(url).startsWith('/api/kanji/radical/85') ? WATER : {}))
    apiFetch.mockReset()
    apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => (String(path).startsWith('/api/kanji/radicals') ? { groups: GROUPS } : {}) }))
    const seen = await mount('/learn/kanji/radical/85')
    expect(seen.path).toBe('/learn/kanji/radical/85')
    expect(document.querySelector('.desk-split, .radical-tile, .desk-mode-fig, [aria-current="page"]')).toBeNull()
    const door = document.querySelector('.rad-door')
    expect(door.hasAttribute('aria-expanded')).toBe(false)
    expect(getComputedStyle(door.querySelector('.rad-door__chev')).display).not.toBe('none')
    expect(document.querySelector('.bar__aside .stage__leave').textContent).toBe('Radicaux')
    expect(apiFetch.mock.calls.some(([p]) => /^\/api\/kanji\/(radicals|stats)/.test(String(p)))).toBe(false)

    door.click()
    await settle()
    expect(seen.path).toBe('/learn/kanji/radical/85?family=1')
    expect(document.querySelector('.rad-plate, .platform-card')).toBeNull()
    expect(document.querySelectorAll('.rad-family .rad-kanji')).toHaveLength(1)
    expect(document.querySelector('.bar__aside .stage__leave').textContent).toBe('Le radical')
    apiJson.mockReset()
  })

  it('keeps the bare index its own page', async () => {
    apiFetch.mockReset()
    apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => (String(path).startsWith('/api/kanji/radicals') ? { groups: GROUPS } : {}) }))
    const seen = await mount('/learn/kanji/radicals?stroke=4')
    expect(seen.path).toBe('/learn/kanji/radicals?stroke=4')
    expect(document.querySelectorAll('.radical-tile')).toHaveLength(2)
    expect(document.querySelector('[aria-current="page"], .desk-split')).toBeNull()
  })
})

// ── plan 119 — the browse a phone keeps ──
// On the desk a fast review stands the revealed card's entry beside the
// card (no tally: a browse rates nothing). A phone keeps the browse a
// single column, docks nothing, and keeps the 🔍 that opens the entry in
// a sheet.
describe('the browse (plan 119)', () => {
  it('stands no side, docks nothing and keeps the 🔍', async () => {
    const cards = [
      { card_id: 'vocab_N5_駅_えき', kanji: '駅', kana: 'えき', meaning: 'gare', stage: 'mastered' },
      { card_id: 'vocab_N5_川_かわ', kanji: '川', kana: 'かわ', meaning: 'rivière', stage: 'learning' },
    ]
    apiFetch.mockImplementation(async path => ({
      ok: true, status: 200,
      json: async () => (String(path).startsWith('/api/vocab/review-cards') ? { cards } : {}),
    }))
    apiFetch.mockClear()
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { default: VocabRun } = await import('./screens/VocabRun')
    const { peekEntry } = await import('./stores/deskEntry')
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/vocab/N5/fast_review']}>
          <Routes><Route path="/learn/vocab/:level/:mode" element={<VocabRun session={{ access_token: 't' }} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(300)
    expect(document.querySelector('.review-deck__counter').textContent).toBe('1 / 2')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await settle()
    expect(document.querySelector('.screen').className).toBe('screen')
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
    expect(document.querySelectorAll('.reveal-action-btn')).toHaveLength(2)
    expect(peekEntry()).toBeNull()
    expect(apiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/api/dictionary'), expect.anything())
  })
})

// ── plan 120 — the doors a phone keeps as sheets ──
// On the desk a door that does not interrupt opens in the page's own
// column: a deck's More in its side (its deletion still asked, in a
// dialog), a gate lesson's rival in the run's side, the grab's
// walkthrough beside the intake, a kanji's readings in the entry's
// place, the iOS install steps in the settings page. A phone keeps every
// one of them the sheet it was, and draws none of the desk's.
describe('the doors (plan 120)', () => {
  it('keeps a deck\'s More a sheet, its deletion asked inside it', async () => {
    apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => deckAnswer(path) }))
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { default: DeckDetailScreen } = await import('./screens/DeckDetailScreen')
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/decks/1']}>
          <Routes><Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(250)
    const more = [...document.querySelectorAll('.chip-row button')].find(b => b.querySelector('.chip__dots'))
    expect(more.getAttribute('aria-haspopup')).toBe('dialog')
    more.click()
    await settle()
    const sheet = document.querySelector('.scrim [role="dialog"]')
    expect(sheet).not.toBeNull()
    // More's rows (plan 178): import, export and the library, then the
    // deletion a list of its own, in the danger's ink and not a fill.
    expect([...sheet.querySelectorAll('.more-list')].map(l => l.querySelectorAll('.more-row').length)).toEqual([3, 1])
    expect(sheet.querySelector('.btn-primary--danger')).toBeNull()
    sheet.querySelector('.more-row--danger').click()
    await settle()
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(sheet.querySelector('.sheet__q')).not.toBeNull()
    // The question fills, in the panel's ink.
    const ask = sheet.querySelector('.btn-primary--danger')
    expect(getComputedStyle(ask).color).toBe(getComputedStyle(document.documentElement).getPropertyValue('--text-on-panel').trim().replace(/^#(..)(..)(..)$/, (_, r, g, b) => `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`))
    expect(sheet.querySelector('.more-row--danger')).toBeNull()
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
  })

  it('keeps a gate lesson\'s rival a sheet over the run', async () => {
    const { apiJson } = await import('./lib/api')
    const lesson = {
      register: 'polite', steps: [{ kind: 'rule', text: 'A polite request.' }], examples: [],
      compare: [{ pattern: '〜ないでください', raw_id: 'grammar_N5_〜ないでください', level: 'N5', meaning: 'please do not', text: 'the negative' }],
    }
    const card = {
      card_id: 'grammar_N5_〜てください', raw_id: 'grammar_N5_〜てください', mode: 'grammar.flashcard.f2b', direction: 'f2b',
      grammar: '〜てください', structure: 'verb て-form + ください', meaning: 'please do', register: 'polite',
      stage: 'new', review_preview: null, hints: {}, lesson,
    }
    localStorage.clear()
    apiJson.mockImplementation(async url => {
      const u = String(url)
      if (u.startsWith('/api/grammar/cards')) return { cards: [card], pace: null }
      if (u.startsWith('/api/grammar/point')) return { raw_id: 'grammar_N5_〜ないでください', level: 'N5', pattern: '〜ないでください', structure: 'x', meaning: 'please do not', steps: [], compare: [], examples: [] }
      return {}
    })
    apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ total: 1, new: 1, learning: 0, mastered: 0, due_now: 0 }) }))
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { default: GrammarRun } = await import('./screens/GrammarRun')
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/grammar/N5/grammar.flashcard.f2b']}>
          <Routes><Route path="/learn/grammar/:level/:mode" element={<GrammarRun session={{ access_token: 't' }} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(400)
    document.querySelector('.gl--gate .gl-door').click()
    await settle(300)
    expect(document.querySelector('.gl-sheet[role="dialog"]')).not.toBeNull()
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
    apiJson.mockReset()
  })

  it('keeps the grab\'s walkthrough a dialog, from the video sheet', async () => {
    const { apiJson } = await import('./lib/api')
    apiJson.mockImplementation(async () => ({}))
    const { MemoryRouter } = await import('react-router-dom')
    const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')
    await render(<LangProvider><MemoryRouter initialEntries={['/dictionary/analyzer?intake=video']}><AnalyzerScreen session={{}} /></MemoryRouter></LangProvider>)
    await settle(100)
    // The door's video: a sheet over the passages (plan 136).
    expect(document.querySelector('.sheet[role="dialog"] #anl-panel-video')).not.toBeNull()
    const door = document.querySelector('#anl-panel-video .anl-grab__tutorial')
    expect(door.getAttribute('aria-haspopup')).toBe('dialog')
    door.click()
    await settle()
    expect(document.querySelector('[role="dialog"].anl-tut')).not.toBeNull()
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
    apiJson.mockReset()
  })

  it('keeps a kanji\'s readings a sheet over the entry', async () => {
    const { DictionaryDetail } = await import('./components/dictionary/DictionaryDetail')
    const kanji = {
      type: 'kanji', kanji: '駅', kana: 'エキ・えき', meaning: 'station', level: 'N5', status: { status: 'learning' },
      readings: [{ reading: 'エキ', words: [{ kanji: '駅員', kana: 'えきいん', meaning: 'station staff' }] }],
      vocab_examples: [{ kanji: '駅員', kana: 'えきいん', meaning: 'station staff' }],
    }
    await render(<LangProvider><aside className="dict-dock"><DictionaryDetail entry={kanji} /></aside></LangProvider>)
    await settle()
    const door = document.querySelector('.dict-plate__more')
    expect(door.getAttribute('aria-haspopup')).toBe('dialog')
    door.click()
    await settle()
    expect(document.querySelector('.dict-sheet__scrim--over .dict-sheet[role="dialog"] .dict-readings')).not.toBeNull()
    expect(document.querySelector('.dict-dock .dict-plate__word').textContent).toBe('駅')
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
  })

  it('keeps the iOS install steps a sheet over the page', async () => {
    install.ios = true
    try {
      const { MemoryRouter } = await import('react-router-dom')
      const { DisplayPage } = await import('./components/settings/DisplayPage')
      await render(<LangProvider><MemoryRouter><DisplayPage /></MemoryRouter></LangProvider>)
      await settle()
      const button = [...document.querySelectorAll('.slip__act')].pop()
      expect(button.hasAttribute('aria-expanded')).toBe(false)
      button.click()
      await settle()
      expect(document.querySelector('[role="dialog"].install-sheet')).not.toBeNull()
      expect(document.querySelector('[class*="desk-"]')).toBeNull()
    } finally {
      install.ios = false
    }
  })
})

// ── plan 123, P1 — the keys that misfired on the desk ──
// Every fix is a listener that only the desk installs: the docked
// entry's Esc lives in the run's side, which a phone never mounts; the
// level-up's pass takes Esc only at a desk; the pointer tracker behind the
// page's Enter is installed by EnterKey, which listens only on the desk.
describe('the desk\'s key fixes (plan 123, P1)', () => {
  it('leave the level-up\'s pass to its clock on a phone', async () => {
    const { XpToast } = await import('./components/rewards/XpToast')
    await render(
      <LangProvider>
        <XpToast toast={{ id: 'p1', amount: 20, leveledUp: true, newLevel: 13 }} />
      </LangProvider>
    )
    await new Promise(r => setTimeout(r, 150))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await new Promise(r => setTimeout(r, 100))
    expect(document.querySelector('.levelup--leaving')).toBeNull()
    expect(document.documentElement.hasAttribute('data-levelup')).toBe(true)
  })
})

// ── plan 123, P3 to P5 — the stage, the foot, the columns, the board ──
// Every rule of both is in the 机 block. On a phone a run's stage keeps
// its own inset -- the level bar is its floor, with nothing under the
// foot -- a state card fills
// its column and the ticket gate covers the whole screen, chrome or not.
describe('the stage and the columns (plan 123, P3–P5)', () => {
  it('keeps a run\'s stage on the level bar, nothing under its foot', async () => {
    document.documentElement.dataset.chrome = 'stage'
    try {
      const screen = await render(
        <div className="screen">
          <div className="stage"><p>card</p><div className="stage__foot"><button type="button">Next</button></div></div>
        </div>
      )
      expect(getComputedStyle(screen.container.querySelector('.stage')).paddingBottom).toBe('0px')
    } finally {
      delete document.documentElement.dataset.chrome
    }
  })

  it('bounds a state card by nothing', async () => {
    const screen = await render(
      <main className="today">
        <div className="empty"><p>Nothing yet</p></div>
      </main>
    )
    expect(getComputedStyle(screen.container.querySelector('.empty')).maxWidth).toBe('none')
  })

  // P5: the workspace's inset and the level-up docked in a run's column
  // (plans 142, 173) key on .desk-run, which a phone never renders: the
  // learner's card hangs at the top, centred at --levelup-w, over the
  // stage, which no longer steps down under it.
  it('hangs the level-up\'s card at the top of a run, the stage staying put', async () => {
    const { XpToast } = await import('./components/rewards/XpToast')
    document.documentElement.dataset.chrome = 'stage'
    try {
      const screen = await render(
        <LangProvider>
          <div className="screen">
            <main className="stage"><p>card</p></main>
            <XpToast toast={{ id: 'p5', amount: 20, leveledUp: true, newLevel: 13 }} />
          </div>
        </LangProvider>
      )
      await new Promise(r => setTimeout(r, 600))
      const root = getComputedStyle(document.documentElement)
      const px = name => parseFloat(root.getPropertyValue(name))
      const card = document.querySelector('.levelup').getBoundingClientRect()
      const w = px('--levelup-w')
      expect(Math.round(card.width)).toBe(w)
      // Centred on the window less html's reserved scrollbar gutter.
      expect(Math.round(card.left + card.width / 2)).toBe(Math.round(document.body.getBoundingClientRect().width / 2))
      expect(Math.round(card.top)).toBe(px('--sp-4'))
      // The learner's card, face up at the card's proportions, its old
      // level struck for the new one.
      const face = document.querySelector('.levelup .pcard').getBoundingClientRect()
      expect(face.height).toBeCloseTo(face.width * 172 / 272, 0)
      expect(document.querySelector('.levelup__was').textContent).toBe('12')
      expect(document.querySelector('.levelup__now').textContent).toBe('13')
      // The stage does not step down: its top is what it is with no card.
      const stage = screen.container.querySelector('.stage')
      const under = getComputedStyle(stage).paddingTop
      expect(document.documentElement.hasAttribute('data-levelup')).toBe(true)
      document.documentElement.removeAttribute('data-levelup')
      expect(getComputedStyle(stage).paddingTop).toBe(under)
    } finally {
      delete document.documentElement.dataset.chrome
    }
  })

  it('covers the whole screen with the ticket gate', async () => {
    document.documentElement.dataset.chrome = 'shell'
    try {
      const screen = await render(<div className="gate"><span>改札</span></div>)
      expect(screen.container.querySelector('.gate').getBoundingClientRect().left).toBe(0)
    } finally {
      delete document.documentElement.dataset.chrome
    }
  })
})

// ── plan 123, P14 — the kept dialogs stay a phone's sheets ──
// The desk opens a confirm on its way out, sets the actions in a row
// and draws a ✕ where the body has no way out; a phone's sheet opens
// on its first control, stacks its actions under the thumb, and is
// pushed down to close.
describe('the kept dialogs (plan 123, P14)', () => {
  it('keep the phone\'s first control, stacked actions and no ✕', async () => {
    const { Sheet } = await import('./components/chrome/Sheet')
    await render(
      <LangProvider>
        <Sheet open onClose={() => {}} jp="Voyage" cap="Delete" initialFocus=".btn-secondary" dismiss>
          <button type="button" className="btn-primary">Delete</button>
          <button type="button" className="btn-secondary">Cancel</button>
        </Sheet>
      </LangProvider>
    )
    await settle(300)
    expect(document.activeElement.textContent).toBe('Delete')
    expect(document.querySelector('.desk-sheet__close')).toBeNull()
    expect(getComputedStyle(document.querySelector('.sheet')).flexDirection).toBe('column')
    const [a, b] = [...document.querySelectorAll('.sheet button')].map(el => el.getBoundingClientRect())
    expect(b.top).toBeGreaterThanOrEqual(a.bottom)
  })
})

// ── plan 123, P15 — a phone's lists are walked by the thumb ──
describe('the lists beside a page (plan 123, P15)', () => {
  it('leave every row its own tab stop, and the arrows alone', async () => {
    const { default: GrammarIndex } = await import('./components/selection/GrammarIndex')
    const points = ['a', 'b', 'c'].map(k => ({ raw_id: `g_${k}`, pattern: k, meaning: k, stage: 'new' }))
    await render(<LangProvider><GrammarIndex points={points} onOpen={() => {}} /></LangProvider>)
    await settle()
    const rows = [...document.querySelectorAll('.gl-index__row')]
    expect(rows.every(r => !r.hasAttribute('tabindex'))).toBe(true)
    rows[0].focus()
    rows[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(rows[0])
  })
})

// ── plan 123, P16 — a phone's places stay buttons ──
// On the desk Settings' pages, the shelf's decks and its library door, a
// radical page's tiles, a bar's way up, the profile's halls and lines
// are links. A phone keeps every one the button it was, and a tap still
// pushes the next screen -- Settings' list and its page are two screens
// there, so Back from a page is the list.
describe('the places (plan 123, P16)', () => {
  async function mount(entry, element) {
    const { MemoryRouter, Routes, Route, useLocation, useNavigationType } = await import('react-router-dom')
    const seen = { path: null, type: null }
    function Probe() {
      seen.path = useLocation().pathname
      seen.type = useNavigationType()
      return null
    }
    document.body.innerHTML = ''
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={[entry]}><Routes><Route path="*" element={element} /></Routes><Probe /></MemoryRouter>
      </LangProvider>
    )
    await settle(300)
    return seen
  }
  const buttons = sel => {
    const all = [...document.querySelectorAll(sel)]
    expect(all.length, sel).toBeGreaterThan(0)
    expect(all.map(b => b.tagName), sel).toEqual(all.map(() => 'BUTTON'))
    expect(all.every(b => !b.hasAttribute('href') && !b.hasAttribute('tabindex')), sel).toBe(true)
    return all
  }

  it('keeps Settings\' rows buttons with their ›, a tap pushing the page', async () => {
    const { default: SettingsScreen } = await import('./screens/SettingsScreen')
    const seen = await mount('/profile/settings', <SettingsScreen session={{ access_token: 't', user: { email: 'a@b.c' } }} />)
    const rows = buttons('.stg-row[data-page]')
    // The card's doors too (plans 139, 173): a field keeps its ›.
    buttons('.pcard-slot--settings .stg-door')
    expect(document.querySelectorAll('.pcb__field .pcb__chev')).toHaveLength(3)
    expect(document.querySelector('main a')).toBeNull()
    expect(getComputedStyle(rows[0].querySelector('.stg-row__chev')).display).not.toBe('none')
    rows.find(r => r.dataset.page === 'display').click()
    await settle()
    expect([seen.path, seen.type]).toEqual(['/profile/settings/display', 'PUSH'])
  })

  it('keeps the shelf\'s decks and its library door buttons', async () => {
    apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => deckAnswer(path) }))
    const { default: DecksScreen } = await import('./screens/DecksScreen')
    const seen = await mount('/learn/decks', <DecksScreen session={{}} />)
    buttons('.decks-doors > .chip')
    const [card] = buttons('.platform-grid > .deck-card')
    expect(document.querySelector('main a')).toBeNull()
    card.click()
    await settle()
    expect([seen.path, seen.type]).toEqual(['/learn/decks/1', 'PUSH'])
  })

  it('keeps the way up, the halls and the lines buttons', async () => {
    const { Bar, Leave } = await import('./components/chrome/Bar')
    const { ProfileDoors } = await import('./components/profile/ProfileBlocks')
    const { LineLedger } = await import('./components/profile/LineLedger')
    const { default: fr } = await import('./locales/fr/index.js')
    await mount('/profile', (
      <main className="profile">
        <Bar title="Thèmes" aside={<Leave to="/learn/vocab/themes">Thèmes</Leave>} />
        <ProfileDoors t={fr} navigate={() => {}} />
        <LineLedger stats={null} t={fr} navigate={() => {}} />
      </main>
    ))
    buttons('.stage__leave')
    buttons('.record--door')
    buttons('.pf-line')
    expect(document.querySelector('main a')).toBeNull()
  })

  it('keeps a radical page\'s tiles buttons', async () => {
    const { RadicalTile } = await import('./components/dictionary/RadicalIndex')
    await mount('/learn/kanji/radicals', (
      <div className="radical-page__grid">
        <RadicalTile glyph="亻" sub="personne" count={10} learned={3} started onPick={() => {}} />
      </div>
    ))
    buttons('.radical-tile')
  })
})

// ── plan 125 — 作文, the composition run a phone keeps ──
// On the desk the run stands the point's lesson beside the field and
// the sentence's breakdown once rated (composition.desktop.test). A
// phone keeps its single column: a door on the card opens the lesson
// as a sheet, the breakdown is a toggle under the review, and neither
// a column nor a lesson fetch happens unasked.
describe('the composition run (plan 125)', () => {
  it('keeps the phone\'s column, its lesson door and no column', async () => {
    const { apiJson } = await import('./lib/api')
    const POINT = { raw_id: 'grammar_N4_〜ながら', level: 'N4', pattern: '〜ながら', structure: 'V-ます + ながら', meaning: 'en faisant', register: null, stage: 'new' }
    apiJson.mockImplementation(async url => {
      const u = String(url)
      if (u.startsWith('/api/composition/batch')) return { level: 'N4', points: [POINT] }
      if (u === '/api/composition/check') return { found: true }
      if (u.startsWith('/api/grammar/point')) {
        return { ...POINT, steps: [{ kind: 'rule', text: 'Deux actions en même temps.' }], compare: [], examples: [], status: { status: 'not_started' } }
      }
      return {}
    })
    apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ review: null, analysis: 'Bien.' }) }))
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { default: CompositionRun } = await import('./screens/CompositionRun')
    document.body.innerHTML = ''
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/practice/composition/N4']}>
          <Routes><Route path="/practice/composition/:level" element={<CompositionRun session={null} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(300)
    expect(document.querySelector('.screen').className).toBe('screen')
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
    expect(document.querySelector('.desk-run__side')).toBeNull()
    // The lesson is behind a door on the card, and nothing fetched it.
    const door = document.querySelector('.stage .prose__breakdown button')
    expect(door.textContent).toBe('Leçon')
    expect(apiJson.mock.calls.some(c => String(c[0]).startsWith('/api/grammar/point'))).toBe(false)
    door.click()
    await settle(200)
    expect(document.querySelector('.dict-sheet')).not.toBeNull()
    expect(apiJson.mock.calls.some(c => String(c[0]).startsWith('/api/grammar/point'))).toBe(true)
    apiJson.mockReset()
    apiFetch.mockReset()
  })
})

// ── plan 123, P17 — a phone's radio groups are tapped ──
// On the desk a radio group is one tab stop walked with the arrows; a
// phone's keeps a stop per radio, no tabindex written, and leaves the
// arrows to the page.
describe('the radio groups (plan 123, P17)', () => {
  it('keep a stop per radio and leave the arrows alone', async () => {
    const { Seg, ConsoleBand } = await import('./components/chrome/Console')
    const opts = ['a', 'b', 'c'].map(k => ({ key: k, label: k }))
    const onChange = vi.fn()
    document.body.innerHTML = ''
    await render(
      <LangProvider>
        <Seg options={opts} value="b" onChange={onChange} label="seg" />
        <ConsoleBand options={opts} value="b" onChange={onChange} label="band" />
      </LangProvider>
    )
    await settle()
    const radios = [...document.querySelectorAll('[role="radio"]')]
    expect(radios).toHaveLength(6)
    expect(radios.every(r => !r.hasAttribute('tabindex'))).toBe(true)
    const heard = vi.fn()
    const listen = e => heard(e.key)
    window.addEventListener('keydown', listen)
    try {
      for (const r of [radios[1], radios[4]]) {
        r.focus()
        r.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
        expect(document.activeElement).toBe(r)
      }
      expect(onChange).not.toHaveBeenCalled()
      expect(heard).toHaveBeenCalledTimes(2)
    } finally {
      window.removeEventListener('keydown', listen)
    }
  })
})

// ── plan 123, P18 — a phone's doors are its own ──
// On the desk the column's docks take and give back the focus, close on
// the entry's roundel, release on a second press, and hold the card form
// with its draft; Browse's rows are one stop walked with ↑/↓. A phone
// keeps the form in the page under its label (Add pressed again clears
// it, as it did), and Browse its overlay with its footer Close and a tab
// stop on every row it can tick.
describe('the column\'s doors (plan 123, P18)', () => {
  async function mountDeck(answer) {
    apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => answer(path) }))
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { default: DeckDetailScreen } = await import('./screens/DeckDetailScreen')
    document.body.innerHTML = ''
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/decks/1']}>
          <Routes><Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(250)
  }

  it('keeps the form in the page under its label, Add clearing it', async () => {
    await mountDeck(deckAnswer)
    const add = () => document.querySelector('.chip-row button')
    add().click()
    await settle()
    const form = document.querySelector('main.learn > .deckdetail-form')
    expect(form.querySelector('.form__label')).not.toBeNull()
    expect(document.querySelector('.desk-dock, .dict-plate__btn')).toBeNull()
    const input = form.querySelector('input')
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, '犬')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(50)
    add().click()
    await settle()
    expect(document.querySelector('main.learn > .deckdetail-form input').value).toBe('')
  })

  it('keeps Browse\'s footer Close and a tab stop on every row it can tick', async () => {
    const results = ['水', '火', '木'].map((w, i) => ({ raw_id: `v${i}`, source: 'vocab', level: 'N5', front: w, kana: w, meaning: w, in_deck: false }))
    await mountDeck(path => (path === '/api/decks/1' ? { ...DECK, type: 'vocab' } : String(path).includes('/browse') ? { results } : deckAnswer(path)))
    ;[...document.querySelectorAll('.chip-row button')].find(b => /browse|parcourir/i.test(b.textContent)).click()
    await settle(300)
    const modal = document.querySelector('.browse-modal')
    expect(modal.querySelector('.import-footer__cancel')).not.toBeNull()
    expect(modal.querySelector('.import-header__close')).not.toBeNull()
    expect([...modal.querySelectorAll('.browse-result-row')].map(r => r.tabIndex)).toEqual([0, 0, 0])
    expect(document.activeElement.classList.contains('browse-search-input')).toBe(false)
  })
})

// ── plan 123, P19 — a phone's pointer, copy and names ──
// On the desk a paste or a drop takes a picture into the cropper, a copy
// leaves ruby readings out, and icon-only figures carry a title. A
// phone keeps each as it was: no paste taken, the readings selectable,
// no title written.
describe('the pointer and the copy (plan 123, P19)', () => {
  it('takes no paste into the photo intake, and draws the two tiles bare', async () => {
    const { ImageInput } = await import('./components/analysis/ImageInput')
    const { default: fr } = await import('./locales/fr/index.js')
    document.body.innerHTML = ''
    await render(<LangProvider><ImageInput t={fr} session={null} onTextReady={() => {}} /></LangProvider>)
    await settle()
    expect(document.querySelector('.desk-photo, .intake-btn .desk-kbd, .intake-btn[aria-keyshortcuts]')).toBeNull()
    const data = new DataTransfer()
    data.items.add(new File([new Uint8Array([137, 80, 78, 71])], 'shot.png', { type: 'image/png' }))
    document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    await settle()
    expect(document.querySelector('.analysis-cropper')).toBeNull()
  })

  it('keeps the readings selectable and writes no title on the icon-only figures', async () => {
    const { ConsoleIndex } = await import('./components/chrome/Console')
    document.body.innerHTML = ''
    await render(
      <LangProvider>
        <span className="furigana-word"><ruby>日本<rt>にほん</rt></ruby></span>
        <ConsoleIndex value="駅" onChange={() => {}} onClear={() => {}} clearLabel="Effacer" />
      </LangProvider>
    )
    await settle()
    expect(getComputedStyle(document.querySelector('.furigana-word rt')).userSelect).not.toBe('none')
    expect(document.querySelector('.console__clear').hasAttribute('title')).toBe(false)
  })
})

// ── plan 124 — the console a phone does without ──
// On the desk a card run's floor is the console: the rating tiles' row
// fixed above the level bar, and this run's three figures on the bar
// beside the fare. A phone's level bar is the strip it always was, with
// no figures on it, and its rating bar docks in the stage as before.
// Plan 174 gave the phone its own console (components/study/RunConsole.jsx,
// the owner's pick "console C refined"): a run with a tally draws the
// run's meter under the head and the level on the floor, in place of
// the level strip. The contract below is that one's.
describe('the console (plans 124, 174)', () => {
  it('keeps the desk\'s console off, the run\'s meter under the head, the level on the floor and the rating bar docked', async () => {
    const { MemoryRouter } = await import('react-router-dom')
    const { StudyStage } = await import('./components/study/StudyStage')
    const { CardTransition } = await import('./components/study/CardTransition')
    const { default: PromptCard } = await import('./components/study/PromptCard')
    const { default: RatingBar } = await import('./components/study/RatingBar')
    const { SessionPanel } = await import('./components/study/SessionPanel')
    await render(
      <LangProvider>
        <MemoryRouter>
          <StudyStage where="Kanji" onLeave={() => {}} leaveLabel="Kanji" pass={false} records side={<SessionPanel />}>
            <CardTransition className="specimen-card-stage" cardKey="k"><PromptCard><span>駅</span></PromptCard></CardTransition>
            <RatingBar active onRate={() => {}} />
          </StudyStage>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(500)
    expect(document.querySelector('.desk-run--console, .desk-tally, .desk-run__side')).toBeNull()
    expect(document.querySelector('.lvlbar')).toBeNull()
    const floor = document.querySelector('.screen > .run-floor')
    expect(floor.getBoundingClientRect().height).toBe(60)
    expect(floor.querySelector('.run-floor__track').getAttribute('role')).toBe('progressbar')
    // The meter follows the head, inside the stage.
    expect(document.querySelector('.stage__head + .run-meter')).not.toBeNull()
    expect(getComputedStyle(document.querySelector('.rating-bar')).position).toBe('sticky')
  })
})

// ── plan 126 — the three panels a phone does without ──
// On the desk a card run stands on three panels: this run and the card
// panel at the left, the card's details sealed at the right, the tiles
// unlit before the reveal. A phone draws none of it: no left column, no
// sealed panel, the tap hint under the glyph, the idle bar unseen and
// its buttons not disabled, the level strip on the floor.
describe('the three panels (plan 126)', () => {
  it('draws neither column, keeps the tap hint and the idle bar unseen', async () => {
    const { MemoryRouter } = await import('react-router-dom')
    const { StudyStage } = await import('./components/study/StudyStage')
    const { CardPanel } = await import('./components/study/CardPanel')
    const { Flashcard } = await import('./components/study/QuizComponents')
    const { default: RatingBar } = await import('./components/study/RatingBar')
    const { SessionPanel } = await import('./components/study/SessionPanel')
    const card = { card_id: 'k', stage: 'learning', review_preview: { 1: { due_in: 180 }, 4: { due_in: 600 } } }
    await render(
      <LangProvider>
        <MemoryRouter>
          <StudyStage where="Kanji" onLeave={() => {}} leaveLabel="Kanji" pass={false} records side={<SessionPanel />} panel={<CardPanel card={card} />} progress={{ total: 3, new: 1, learning: 1, mastered: 1 }} remaining={3}>
            <Flashcard t={{ tapToReveal: 'Touche pour révéler' }} resetKey="k" front={<span>駅</span>} back={<span>station</span>} />
            <RatingBar active={false} onRate={() => {}} />
          </StudyStage>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(500)
    expect(document.querySelector('.desk-run--panels, .desk-run__left, .desk-session, .desk-card, .desk-sealed, .desk-run__side')).toBeNull()
    expect(document.querySelector('.flashcard__hint').textContent).toBe('Touche pour révéler')
    const bar = document.querySelector('.rating-bar')
    expect(bar.classList.contains('rating-bar--idle')).toBe(true)
    expect(bar.classList.contains('rating-bar--unlit')).toBe(false)
    expect([...document.querySelectorAll('.rating-bar__btn')].some(b => b.disabled)).toBe(false)
    // The count left rides the meter since plan 174, its length the
    // three left and no rating yet.
    expect(document.querySelector('.today-remaining')).toBeNull()
    expect(document.querySelectorAll('.run-meter__s')).toHaveLength(3)
    expect(document.querySelector('.run-meter__n').textContent).toBe('0/ 3')
    expect(document.querySelector('.screen > .run-floor')).not.toBeNull()
  })
})

// ── plans 127, 173 — the holder at the rail's foot, which a phone does without ──
// On the desk the HUD's doors stand on the case of the holder the
// learner's card is carried in, at the rail's foot
// (components/chrome/DeskPass.jsx). A phone keeps its HUD: the station
// panel and the card as one strip (帯), no holder, no card's edge, no
// caption under the balance, and no pointer's names.
describe('the rail\'s holder (plans 127, 173)', () => {
  it('leaves the phone\'s HUD its panel and its strip, and no holder', async () => {
    const { MemoryRouter } = await import('react-router-dom')
    const { Hud } = await import('./components/chrome/Hud')
    await render(
      <LangProvider>
        <MemoryRouter>
          <Hud />
        </MemoryRouter>
      </LangProvider>
    )
    await settle()
    const inner = document.querySelector('.hud__inner')
    const strip = inner.querySelector(':scope > .hstrip')
    expect(strip).not.toBeNull()
    expect(document.querySelector('[class*="desk-"], .pcard')).toBeNull()
    expect(strip.querySelector('em')).toBeNull()
    // The pointer's names are the desk's alone.
    expect(strip.querySelector('.hstrip__lv').hasAttribute('title')).toBe(false)
    expect(strip.querySelector('.hstrip__bal').hasAttribute('title')).toBe(false)
  })
})

// ── plan 128 — the dictionary's two columns a phone does without ──
// On the desk the catalogue is one column and the entry stands beside
// all of it from the page's top. A phone keeps the catalogue as it was:
// no columns, nothing opened on arrival, and a tapped tile's entry in
// the results' own dock, the sheet it has always been.
describe('the dictionary\'s columns (plan 128)', () => {
  it('draws no columns, and opens the entry in the results\' own dock', async () => {
    const { apiJson } = await import('./lib/api')
    apiJson.mockImplementation(async () => ({ decks: [] }))
    const rows = [
      { type: 'kanji', kanji: '土', kana: 'ド・つち', meaning: 'sol', level: 'N5', status: { status: 'new' } },
      { type: 'kanji', kanji: '山', kana: 'サン・やま', meaning: 'montagne', level: 'N5', status: { status: 'new' } },
    ]
    apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ results: rows, total: 2, has_more: false, groups: [] }) }))
    const { MemoryRouter } = await import('react-router-dom')
    const { default: DictionaryScreen } = await import('./screens/DictionaryScreen')
    await render(<LangProvider><MemoryRouter initialEntries={['/dictionary']}><DictionaryScreen session={{}} /></MemoryRouter></LangProvider>)
    await settle(250)
    expect(document.querySelector('.desk-dict, .desk-dict__main')).toBeNull()
    expect(document.querySelector('.dict-dock')).toBeNull()
    document.querySelector('.dict-entry-card').click()
    await settle(250)
    const dock = document.querySelector('.dict-dock')
    expect(dock.parentElement.classList.contains('dict-layout')).toBe(true)
    expect(getComputedStyle(dock).position).toBe('fixed')
    // The plate stands stacked, as ever: no desk rule reaches it.
    expect(getComputedStyle(dock.querySelector('.dict-plate')).display).toBe('flex')
    apiJson.mockReset()
  })
})

// ── plan 128 — the kana charts a phone keeps ──
// On the desk the charts stand three across, unmarked, each cell marked
// with the learner's stage. A phone keeps its two columns in teaching
// order, every chart under its mark, and its cells as they were.
describe('the kana charts (plan 128)', () => {
  it('keeps two columns, every chart marked, no stage on a cell', async () => {
    const { apiJson } = await import('./lib/api')
    apiJson.mockImplementation(async () => ({ decks: [] }))
    const { default: KANA } = await import('./testing/kanaRows.json')
    apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ results: KANA.hiragana, total: KANA.hiragana.length, has_more: false, groups: [] }) }))
    const { MemoryRouter } = await import('react-router-dom')
    const { default: DictionaryScreen } = await import('./screens/DictionaryScreen')
    await render(<LangProvider><MemoryRouter initialEntries={['/dictionary?category=hiragana']}><DictionaryScreen session={{}} /></MemoryRouter></LangProvider>)
    await settle(300)
    const cols = [...document.querySelectorAll('.syllabary-col')]
    expect(cols).toHaveLength(2)
    expect(cols.map(c => c.querySelectorAll('.syllabary-table').length)).toEqual([2, 2])
    expect(document.querySelectorAll('.syllabary-table-wrap > .dict-mark')).toHaveLength(4)
    expect(document.querySelector('.syllabary-cell--mastered, .syllabary-cell--learning')).toBeNull()
    expect(document.querySelector('.desk-dict')).toBeNull()
    apiJson.mockReset()
  })
})

// ── plan 129 — the run's lines, which a phone never draws ──
// On the desk a practice run stands on three panels: this run and its
// lines at the left, the breakdown sealed at the right until the grade,
// the keys listed in the lines rather than on the controls. A phone keeps
// its one column: the score in the head's pill, the level strip on the
// floor, the breakdown behind its toggle, and no cap anywhere.
describe('the run\'s lines (plan 129)', () => {
  it('draws no column, keeps the head\'s score and the breakdown\'s toggle', async () => {
    const { apiJson } = await import('./lib/api')
    const PHRASE = { phrase: '山へ行きます。', romaji: 'yama e ikimasu', translation: 'I go to the mountain.', translation_lang: 'en', display_seconds: 30 }
    apiFetch.mockImplementation(async url => {
      const u = String(url)
      if (u.startsWith('/api/reading/batch')) return { ok: true, status: 200, json: async () => ({ phrases: [PHRASE, { ...PHRASE, phrase: '駅で会いました。' }] }) }
      if (u === '/api/phrase/analyze') {
        return { ok: true, status: 200, json: async () => ({ text: PHRASE.phrase, available: true, grammar: [], tokens: [{ surface: '山', reading: 'やま', meaning: 'mountain', pos: 'noun', furigana: [{ text: '山', reading: 'やま' }] }] }) }
      }
      return { ok: true, status: 200, json: async () => ({ xp_earned: 7 }) }
    })
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { default: ReadingRun } = await import('./screens/ReadingRun')
    document.body.innerHTML = ''
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/practice/reading/level/N5']}>
          <Routes><Route path="/practice/reading/level/:level" element={<ReadingRun session={null} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(300)
    document.querySelector('.clip-player__play').click()
    await settle(20)
    const input = document.querySelector('form.stage__foot input')
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setValue.call(input, 'yama')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(20)
    document.querySelector('form.stage__foot').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle(200)
    const seals = document.querySelectorAll('.rating-bar__btn')
    seals[seals.length - 1].click()
    await settle(300)
    expect(document.querySelector('.screen').className).toBe('screen')
    expect(document.querySelector('[class*="desk-"]')).toBeNull()
    // The head's score rides the meter since plan 174, a segment for the
    // one sentence rated, in its verdict's ink.
    expect(document.querySelector('.stage__head .today-remaining')).toBeNull()
    expect(document.querySelector('.run-meter__n').textContent).toBe('1 / 1')
    expect(document.querySelector('.run-meter__s--done.run-meter__s--q4')).not.toBeNull()
    expect(document.querySelector('.screen > .run-floor')).not.toBeNull()
    expect(document.querySelector('.stage .prose__breakdown button')).not.toBeNull()
    expect(document.querySelector('kbd')).toBeNull()
    apiJson.mockReset()
    apiFetch.mockReset()
  })
})

// ── plan 130 — the gates a phone keeps ──
// On the desk the plates take the window, Learn's line stands upright
// and Practice's plates hold their specimens (plan 165; the grades'
// rows before it). A phone keeps its column: the chip row of five on
// every platform, and no request for a record or a sample it has
// nowhere to print.
describe('the gates taking the window (plan 130)', () => {
  it('keeps Practice\'s chip row and never asks for the record', async () => {
    apiFetch.mockReset()
    apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({}) }))
    const { MemoryRouter } = await import('react-router-dom')
    const { default: PracticeScreen } = await import('./screens/PracticeScreen')
    await render(<LangProvider><MemoryRouter initialEntries={['/practice']}><PracticeScreen /></MemoryRouter></LangProvider>)
    await settle(250)
    const feet = [...document.querySelectorAll('.plate__foot--dests')]
    expect(feet).toHaveLength(6)
    for (const foot of feet) expect(foot.querySelectorAll('.chip')).toHaveLength(5)
    // Nor the desk's specimens (plan 165): no body in the plate's head,
    // and no request for the samples it would draw from.
    expect(document.querySelector('.plate__body, .prc-spec')).toBeNull()
    expect(apiFetch.mock.calls.some(([path]) => path === '/api/practice/record')).toBe(false)
    expect(apiFetch.mock.calls.some(([path]) => path.startsWith('/api/station/'))).toBe(false)
    // The column is the phone's, one plate to a row.
    const plates = [...document.querySelectorAll('.practice > .plates > .plate')].map(p => p.getBoundingClientRect())
    expect(new Set(plates.map(p => Math.round(p.left))).size).toBe(1)
  })
})

// ── plan 137 — the stations a phone keeps ──
// On the desk a line's split fills the window (its stops with their
// samples and bars, its platforms with their wells, the fast review at
// the foot) and Vocabulary's sources hang as three plates. A phone
// keeps its screens: the three source cards, then a level's platforms
// one under another with the fast review among them, the bar naming
// the level, and no request for the tiers' figures.
describe('the stations filled (plan 137)', () => {
  it('keeps the three source cards, and asks for no tier figures', async () => {
    apiFetch.mockReset()
    apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({}) }))
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { default: VocabScreen } = await import('./screens/VocabScreen')
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/vocab']}>
          <Routes><Route path="/learn/vocab" element={<VocabScreen session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(250)
    expect(document.querySelectorAll('.learn > .platform-grid .platform-card')).toHaveLength(3)
    expect(document.querySelector('.desk-sources, .desk-source')).toBeNull()
    expect(apiFetch.mock.calls.some(([path]) => String(path).includes('/tiers'))).toBe(false)
  })

  it('keeps a level\'s platforms one under another, the fast review among them and no wells', async () => {
    const { MemoryRouter, Routes, Route } = await import('react-router-dom')
    const { default: VocabScreen } = await import('./screens/VocabScreen')
    await render(
      <LangProvider>
        <MemoryRouter initialEntries={['/learn/vocab/N5']}>
          <Routes><Route path="/learn/vocab/:level" element={<VocabScreen session={{}} />} /></Routes>
        </MemoryRouter>
      </LangProvider>
    )
    await settle(250)
    const cards = [...document.querySelectorAll('.learn > .platform-grid .platform-card')]
    expect(cards.length).toBe(4)
    expect(cards.at(-1).textContent).toContain('Révision rapide')
    expect(document.querySelector('.bar__sub').textContent).toMatch(/^N5/)
    expect(document.querySelector('.desk-platforms, .desk-spec, .desk-split__foot, .desk-stop__sample, .desk-stop__bar')).toBeNull()
  })

  it('keeps a route\'s rows as they were, whatever samples a stop carries', async () => {
    const stops = ['N5', 'N4'].map(k => ({ key: k, code: k, name: k, total: 10, learned: 1, started: 3, sample: '何 私' }))
    await render(
      <LangProvider>
        <main className="learn"><RouteStops stops={stops} here="N5" onSelect={() => {}} /></main>
      </LangProvider>
    )
    await settle()
    expect(document.querySelector('.desk-stop__sample, .desk-stop__bar')).toBeNull()
    expect(document.querySelectorAll('.route-stop')).toHaveLength(2)
  })
})

// ── plan 159 — the practice stations a phone keeps ──
// On the desk a practice station is a line's split filled: the source a
// switch at the list's head, the stops with a sentence and a record,
// the open stop's page, and the mock exam's papers as rows with a
// specimen each. A phone keeps its screens -- reading's three source
// cards, the grades across, the papers as cards -- and asks for none of
// what only the desk prints; the learner's own cards, a page of the
// desk's, send a phone back to the sources. The exam's papers are the
// phone's own since plan 171: the next paper as a card over the others.
describe('the practice stations filled (plan 159)', () => {
  const practiceRoutes = async () => {
    const { Routes, Route } = await import('react-router-dom')
    const { default: SentenceStation } = await import('./screens/SentenceStation')
    const { default: ExamScreen } = await import('./screens/ExamScreen')
    return (
      <Routes>
        {['/practice/reading', '/practice/reading/levels', '/practice/reading/cards'].map(path => (
          <Route key={path} path={path} element={<SentenceStation session={{}} base="/practice/reading" />} />
        ))}
        <Route path="/practice/exam" element={<ExamScreen session={{}} />} />
      </Routes>
    )
  }
  const asked = part => apiFetch.mock.calls.some(([path]) => String(path).includes(part))

  it('keeps reading\'s three source cards, and asks for no stop and no samples', async () => {
    apiFetch.mockReset()
    apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({}) }))
    const { MemoryRouter } = await import('react-router-dom')
    const routes = await practiceRoutes()
    await render(<LangProvider><MemoryRouter initialEntries={['/practice/reading']}>{routes}</MemoryRouter></LangProvider>)
    await settle(250)
    expect(document.querySelectorAll('.learn > .platform-grid .platform-card')).toHaveLength(3)
    expect(document.querySelector('.desk-split, .prc-page, .prc-sources')).toBeNull()
    expect(asked('/api/practice/stop')).toBe(false)
    expect(asked('/api/station/reading')).toBe(false)
  })

  it('keeps the grades as they were: no sample, no record, no page', async () => {
    const { MemoryRouter } = await import('react-router-dom')
    const routes = await practiceRoutes()
    await render(<LangProvider><MemoryRouter initialEntries={['/practice/reading/levels']}>{routes}</MemoryRouter></LangProvider>)
    await settle(250)
    expect(document.querySelectorAll('.learn > .route .route-stop')).toHaveLength(5)
    expect(document.querySelector('.desk-stop__sample, .route-stop__note, .prc-page')).toBeNull()
  })

  it('sends the desk\'s own-cards page back to the sources', async () => {
    const { MemoryRouter, useLocation } = await import('react-router-dom')
    const routes = await practiceRoutes()
    const at = { path: null }
    function Where() { at.path = useLocation().pathname; return null }
    await render(<LangProvider><MemoryRouter initialEntries={['/practice/reading/cards']}>{routes}<Where /></MemoryRouter></LangProvider>)
    await settle(250)
    expect(at.path).toBe('/practice/reading')
    expect(document.querySelectorAll('.learn > .platform-grid .platform-card')).toHaveLength(3)
  })

  it('keeps the exam\'s papers its own, and asks for no record and no specimen', async () => {
    apiFetch.mockReset()
    apiFetch.mockImplementation(async path => ({
      ok: true,
      status: 200,
      json: async () => (String(path).startsWith('/api/exams')
        ? [{ id: 'n5-vocab-01', level: 'N5', kind: 'vocab', title: 'N5 語彙', questionCount: 18, generated: true, revision: 1, minutes: 17, mondai: ['漢字読み'], last: null }]
        : {}),
    }))
    const { MemoryRouter } = await import('react-router-dom')
    const routes = await practiceRoutes()
    await render(<LangProvider><MemoryRouter initialEntries={['/practice/exam?level=N5']}>{routes}</MemoryRouter></LangProvider>)
    await settle(250)
    expect(document.querySelectorAll('.exam-st__hero')).toHaveLength(1)
    expect(document.querySelector('.prc-paper, .prc-papers, .desk-split')).toBeNull()
    expect(asked('/api/practice/record')).toBe(false)
    expect(asked('/api/station/exam')).toBe(false)
  })
})
