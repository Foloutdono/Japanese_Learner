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
  it('keeps the phone\'s column, its scaled chart and its two sheets', async () => {
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
    expect(document.querySelector('.rep-line__svg').getAttribute('viewBox')).toBe('0 0 326 96')
    expect(document.querySelectorAll('.trouble__row')).toHaveLength(6)
    expect(document.querySelector('.trouble__more')).not.toBeNull()
    expect(document.querySelector('[aria-expanded]')).toBeNull()

    document.querySelector('.rep-line-row').click()
    await settle()
    expect(document.querySelector('[role="dialog"] .rep-lines--sheet')).not.toBeNull()
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
// list beside its page. A phone keeps the sheet bar and its sheet, the
// passage inside the question's card, no key names, and the review's
// rows opening under themselves with both ways on at the foot.
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

  it('keeps the sheet bar, the passage in its card and no key names', async () => {
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
    expect(document.querySelector('.exam-sheetbar')).not.toBeNull()
    expect(document.querySelector('.exam-meta [role="timer"]')).not.toBeNull()
    expect(document.querySelector('.exam-card .exam-passage .exam-passage__text')).not.toBeNull()
    expect(document.querySelector('[class*="desk-"], [aria-keyshortcuts]')).toBeNull()
    document.querySelector('.exam-sheetbar__open').click()
    await settle(250)
    expect(document.querySelector('[role="dialog"] .exam-sheet__grid')).not.toBeNull()
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
    const rows = document.querySelectorAll('.exam-review-row')
    expect(rows).toHaveLength(1)
    expect(rows[0].getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('[aria-current="page"], .desk-split, .exam-card')).toBeNull()
    rows[0].click()
    await settle()
    expect(document.querySelector('.exam-review-row__detail .mcq-row--correct')).not.toBeNull()
    expect(document.querySelectorAll('.btn-row button')).toHaveLength(2)
    expect(document.querySelector('p.hint')).not.toBeNull()
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

  it('keeps the sheet, the head\'s way back, the legend and the history under the intake', async () => {
    const { apiJson } = await import('./lib/api')
    apiJson.mockImplementation(async url => (String(url).startsWith('/api/phrase/analyze') ? { sentences: SENTENCES, truncated: 0 } : {}))
    apiFetch.mockImplementation(async () => ({ ok: true, status: 200, json: async () => ({ results: [{ type: 'vocab', kanji: '駅', kana: 'えき', meaning: 'station', senses: [], examples: [], status: { status: 'new' } }], total: 1 }) }))
    const { MemoryRouter } = await import('react-router-dom')
    const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')
    await render(<LangProvider><MemoryRouter initialEntries={['/dictionary/analyzer']}><AnalyzerScreen session={{}} /></MemoryRouter></LangProvider>)
    await settle(100)
    expect(document.querySelector('.desk-intake, .desk-side')).toBeNull()
    expect(document.querySelector('main > .anl-history')).not.toBeNull()
    expect(document.querySelector('.anl-action .desk-kbd, [aria-keyshortcuts]')).toBeNull()
    type(document.querySelector('textarea'), '駅で待つ')
    document.querySelector('.anl-action').click()
    await settle(300)
    expect(document.querySelector('.anl-head .stage__leave')).not.toBeNull()
    expect(document.querySelector('.desk-crumb, .desk-anl-dock')).toBeNull()
    expect(document.querySelector('.anl-kbd')).not.toBeNull()
    document.querySelector('.token-card__surface--door').click()
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

// ── plan 116 — the browse a phone keeps ──
// On the desk a fast review stands the revealed card's entry beside the
// card (no tally: a browse rates nothing). A phone keeps the browse a
// single column, docks nothing, and keeps the 🔍 that opens the entry in
// a sheet.
describe('the browse (plan 116)', () => {
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
    expect(sheet.querySelectorAll('.btn-secondary').length).toBeGreaterThan(0)
    sheet.querySelector('.btn-primary--danger').click()
    await settle()
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(sheet.querySelector('.sheet__q')).not.toBeNull()
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

  it('keeps the grab\'s walkthrough a dialog over the intake', async () => {
    const { apiJson } = await import('./lib/api')
    apiJson.mockImplementation(async () => ({}))
    const { MemoryRouter } = await import('react-router-dom')
    const { default: AnalyzerScreen } = await import('./screens/AnalyzerScreen')
    await render(<LangProvider><MemoryRouter initialEntries={['/dictionary/analyzer']}><AnalyzerScreen session={{}} /></MemoryRouter></LangProvider>)
    await settle(100)
    document.querySelectorAll('.anl-sources .seg__opt')[2].click()
    await settle()
    const door = document.querySelector('.anl-grab__tutorial')
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
