import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { contentBox } from './testing/contentBox'
import './index.css'

// ── 机 — a station as two panes (plan 114) ───────────────────────
// On a phone a station is two screens: the stops, then one tap later the
// chosen stop's platforms. On the desk the stops stand upright beside
// the platforms (StationSplit): the bare list opens on the learner's own
// stop, another stop swaps the platforms in place by REPLACING the URL
// (so Back is not a walk through every stop looked at), and each
// platform carries its own figures. The phone's side is deskfree.phone.
//
// Each stop is a link to its stop's URL (plan 117): the click replaces
// the page in place, and the middle click or Ctrl/⌘-click opens it in a
// tab of its own (splitRows.desktop holds the look and the modifiers).

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })),
  apiJson: vi.fn(async () => ({ points: [], learned: 3, started: 5, total: 74, totals: {} })),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
const SUMMARY = { level: 12, jlptLevel: 'N4', streak: 3 }
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => SUMMARY,
  useProfileSummaryState: () => ({ summary: SUMMARY, failed: false }),
}))
const bucket = { total: 80, new: 40, learning: 20, mastered: 20, due_now: 7, reviews: 50, correct: 40 }
const STATS = {
  vocab: { N4: { 'vocab.flashcard.f2b': bucket, 'vocab.flashcard.b2f': { ...bucket, due_now: 0 } } },
  kana: { katakana_basic: { 'kana.flashcard.f2b': bucket } },
  items: {
    vocab: { N5: { total: 665, learned: 300, started: 400, score: 0.45 }, N4: { total: 632, learned: 50, started: 80, score: 0.08 } },
    kana: {
      hiragana_basic: { total: 46, learned: 46, started: 46, score: 1 },
      hiragana_combos: { total: 58, learned: 58, started: 58, score: 1 },
      katakana_basic: { total: 46, learned: 10, started: 20, score: 0.2 },
    },
  },
}
vi.mock('./stores/stats', () => ({ useStats: () => ({ data: STATS, failed: false }), refreshStats: vi.fn() }))
vi.mock('./exam/examService', () => ({
  listExams: async () => ['N5', 'N4', 'N3'].map(level => ({ id: `e-${level}`, level, kind: 'vocab', title: `${level} 語彙`, questionCount: 18, generated: true, revision: 1 })),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: VocabScreen } = await import('./screens/VocabScreen')
const { default: KanaScreen } = await import('./screens/KanaScreen')
const { default: GrammarScreen } = await import('./screens/GrammarScreen')
const { default: ExamScreen } = await import('./screens/ExamScreen')

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const where = { path: null, search: null, type: null }
function Probe() {
  const loc = useLocation()
  where.path = loc.pathname
  where.search = loc.search
  where.type = useNavigationType()
  return null
}

function mount(entry, routes) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[entry]}>
        <div className="phone phone--desk">
          <div className="phone__content"><Routes>{routes}</Routes></div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
}

const vocabRoutes = (
  <>
    <Route path="/learn/vocab/levels" element={<VocabScreen session={null} />} />
    <Route path="/learn/vocab/:level" element={<VocabScreen session={null} />} />
  </>
)
const openStop = () => document.querySelector('.desk-split__list .route-stop[aria-current="page"] .route-stop__code')?.textContent

describe('a level\'s platforms on the desk', () => {
  it('opens the bare line on the learner\'s own stop, replacing it', async () => {
    await mount('/learn/vocab/levels', vocabRoutes)
    await settle()
    expect(where.path).toBe('/learn/vocab/N4')
    expect(where.type).toBe('REPLACE')
  })

  it('stands the line beside the platforms, the open stop marked', async () => {
    await mount('/learn/vocab/N4', vocabRoutes)
    await settle()
    const list = document.querySelector('.desk-split__list')
    const page = document.querySelector('.desk-split__page')
    expect(list.querySelectorAll('.route-stop')).toHaveLength(5)
    expect(openStop()).toBe('N4')
    expect(list.querySelector('.desk-stop--open')).not.toBeNull()
    expect(page.querySelectorAll('.platform-card').length).toBeGreaterThan(2)
    const l = contentBox(list)
    const p = page.getBoundingClientRect()
    expect(Math.round(l.top)).toBe(Math.round(p.top))
    expect(p.left).toBeGreaterThan(l.right)
    expect(Math.round(l.width)).toBe(360)
    // Upright: a list, not the page-wide line.
    const [a, b] = [...list.querySelectorAll('.route-stop')].map(el => el.getBoundingClientRect())
    expect(b.top).toBeGreaterThan(a.bottom - 1)
  })

  it('swaps the platforms in place when another stop is chosen', async () => {
    await mount('/learn/vocab/N4', vocabRoutes)
    await settle()
    const stops = [...document.querySelectorAll('.desk-split__list .route-stop')]
    expect(stops.every(s => s.tagName === 'A')).toBe(true)
    expect(stops.map(s => s.getAttribute('href'))).toEqual(['N5', 'N4', 'N3', 'N2', 'N1'].map(l => `/learn/vocab/${l}`))
    stops.find(s => s.textContent.includes('N5')).click()
    await settle()
    expect(where.path).toBe('/learn/vocab/N5')
    expect(where.type).toBe('REPLACE')
    expect(openStop()).toBe('N5')
  })

  it('prints each platform\'s own figures: due, and mastered over total', async () => {
    await mount('/learn/vocab/N4', vocabRoutes)
    await settle()
    const figs = [...document.querySelectorAll('.desk-split__page .desk-mode-fig')]
    expect(figs.length).toBeGreaterThanOrEqual(2)
    expect(figs[0].querySelector('.desk-mode-fig__due').textContent).toMatch(/^7/)
    expect(figs[0].querySelector('.desk-mode-fig__count').textContent).toMatch(/20\s*\/\s*80/)
    expect(figs[1].querySelector('.desk-mode-fig__due')).toBeNull()
    // The composition bar is drawn, not collapsed.
    expect(figs[0].querySelector('.composition').getBoundingClientRect().height).toBeGreaterThan(0)
  })
})

// The list's wheel hands on at its ends (plan 123): `contain` held a
// wheel turned over a short list, so the page beside it would not
// scroll from there.
describe('a split\'s list and the wheel', () => {
  it('hands the wheel on to the page at its ends', async () => {
    await mount('/learn/vocab/N4', vocabRoutes)
    await settle()
    const list = document.querySelector('.desk-split__list')
    expect(getComputedStyle(list).overscrollBehaviorY).toBe('auto')
  })
})

describe('the other stations on the desk', () => {
  it('opens kana on the set the figures say they are on', async () => {
    await mount('/learn/kana', (
      <>
        <Route path="/learn/kana" element={<KanaScreen />} />
        <Route path="/learn/kana/:set" element={<KanaScreen />} />
      </>
    ))
    await settle()
    expect(where.path).toBe('/learn/kana/katakana_basic')
    const open = document.querySelector('.desk-split__list .route-stop[aria-current="page"]')
    expect(open.tagName).toBe('A')
    expect(open.getAttribute('href')).toBe('/learn/kana/katakana_basic')
  })

  it('opens grammar on the learner\'s level, its points door beside the line', async () => {
    await mount('/learn/grammar', (
      <>
        <Route path="/learn/grammar" element={<GrammarScreen session={null} />} />
        <Route path="/learn/grammar/:level" element={<GrammarScreen session={null} />} />
      </>
    ))
    await settle()
    expect(where.path).toBe('/learn/grammar/N4')
    expect(document.querySelector('.desk-split__page .gl-points-door')).not.toBeNull()
    const n3 = [...document.querySelectorAll('.desk-split__list .route-stop')].find(s => s.textContent.includes('N3'))
    expect(n3.getAttribute('href')).toBe('/learn/grammar/N3')
    n3.click()
    await settle()
    expect(where.path).toBe('/learn/grammar/N3')
    expect(where.type).toBe('REPLACE')
  })

  it('opens the mock exams on the learner\'s grade, and swaps grades in the URL', async () => {
    await mount('/practice/exam', <Route path="/practice/exam" element={<ExamScreen session={null} />} />)
    await settle()
    expect(where.search).toBe('?level=N4')
    expect(document.querySelector('.desk-split__page .platform-card__title')).not.toBeNull()
    const n3 = [...document.querySelectorAll('.desk-split__list .route-stop')].find(s => s.textContent.includes('N3'))
    expect(n3.tagName).toBe('A')
    expect(n3.getAttribute('href')).toBe('/practice/exam?level=N3')
    n3.click()
    await settle()
    expect(where.search).toBe('?level=N3')
    expect(where.type).toBe('REPLACE')
    expect(openStop()).toBe('N3')
  })
})
