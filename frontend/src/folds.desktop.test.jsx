import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the stations fold their second screens (plan 114) ─────────
// Plan 113 set a line's stops beside a stop's platforms. The lines it
// left as two screens fold the same way here: a grammar level's points
// beside the open point's lesson (one click or ←/→ a point, no sheet),
// a theme's bands and the frequency tiers beside the open one's
// platforms, figured from the stats route each run opens on — and the
// deck's own platform screen, whose platforms already stand on the
// deck's page, gives way to it. The phone's side is deskfree.phone.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
const apiFetch = vi.fn()
const apiJson = vi.fn()
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: (...a) => apiFetch(...a),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
vi.mock('./stores/boarding', () => ({ board: commit => commit() }))
const SUMMARY = { level: 12, jlptLevel: 'N4', streak: 3 }
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => SUMMARY,
  useProfileSummaryState: () => ({ summary: SUMMARY, failed: false }),
}))
vi.mock('./stores/stats', () => ({ useStats: () => ({ data: { items: {} }, failed: false }), refreshStats: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: GrammarScreen } = await import('./screens/GrammarScreen')
const { default: VocabScreen } = await import('./screens/VocabScreen')
const { default: KanjiScreen } = await import('./screens/KanjiScreen')
const { default: StudyScreen } = await import('./screens/StudyScreen')

const POINTS = [
  { raw_id: 'grammar_N4_a', pattern: '〜ために', meaning: 'in order to', stage: 'mastered' },
  { raw_id: 'grammar_N4_b', pattern: '〜ように', meaning: 'so that', stage: 'learning' },
  { raw_id: 'grammar_N4_c', pattern: '〜そうだ', meaning: 'looks like', stage: 'new' },
]
const lesson = p => ({ ...p, level: 'N4', structure: 'verb + ' + p.pattern, steps: [], compare: [], examples: [], status: { status: 'new' } })
const BUCKET = { total: 60, new: 30, learning: 18, mastered: 12, due_now: 5 }
const ok = body => ({ ok: true, status: 200, json: async () => body })

beforeEach(() => {
  apiJson.mockReset()
  apiJson.mockImplementation(async url => {
    const u = String(url)
    if (u.startsWith('/api/grammar/points')) return { points: POINTS, learned: 1, started: 2, total: 3, totals: {} }
    if (u.startsWith('/api/grammar/point?')) {
      const id = new URLSearchParams(u.split('?')[1]).get('id')
      return lesson(POINTS.find(p => p.raw_id === id))
    }
    return {}
  })
  apiFetch.mockReset()
  apiFetch.mockImplementation(async url => {
    const u = String(url)
    if (u.startsWith('/api/frequency/') && u.includes('/tiers')) {
      const size = Number(new URLSearchParams(u.split('?')[1]).get('tier_size'))
      const n = Math.ceil(2000 / size)
      return ok({ tiers: Array.from({ length: n }, (_, i) => ({ tier: i + 1, start_rank: i * size + 1, end_rank: Math.min(2000, (i + 1) * size), count: size })) })
    }
    if (u.startsWith('/api/frequency/') && u.includes('/stats')) return ok(BUCKET)
    if (u.startsWith('/api/themes')) return ok({ themes: [{ key: 'animaux', levels: [{ level: 'basic', count: 24 }, { level: 'medium', count: 30 }, { level: 'advanced', count: 30 }, { level: 'expert', count: 12 }] }] })
    if (u.startsWith('/api/vocab/theme/')) return ok({ ...BUCKET, due_now: 0 })
    return ok({})
  })
})

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const press = key => window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
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

const grammarRoutes = <Route path="/learn/grammar/:level" element={<GrammarScreen session={null} />} />
const pointOf = () => new URLSearchParams(where.search).get('point')

describe('a grammar level\'s points beside the lesson', () => {
  it('opens the bare index on the first point not yet mastered, replacing it', async () => {
    await mount('/learn/grammar/N4?index=1', grammarRoutes)
    await settle()
    expect(where.type).toBe('REPLACE')
    expect(pointOf()).toBe('grammar_N4_b')
    const open = $$('.desk-split__list .gl-index__row[aria-current="page"]')
    expect(open).toHaveLength(1)
    expect(open[0].textContent).toContain('〜ように')
    expect($('.desk-split__page .desk-lesson article.gl h2').textContent).toBe('〜ように')
    expect($('[role="dialog"]')).toBeNull()
    expect($('.dict-sheet__scrim')).toBeNull()
  })

  it('opens a point asked for from the level page beside the index', async () => {
    await mount('/learn/grammar/N4?point=grammar_N4_c', grammarRoutes)
    await settle()
    expect(where.search).toBe('?index=1&point=grammar_N4_c')
    expect($('.desk-lesson h2').textContent).toBe('〜そうだ')
  })

  it('walks the points with one click or ←/→, in place', async () => {
    await mount('/learn/grammar/N4?index=1&point=grammar_N4_a', grammarRoutes)
    await settle()
    $$('.desk-split__list .gl-index__row')[2].click()
    await settle()
    expect(where.type).toBe('REPLACE')
    expect(pointOf()).toBe('grammar_N4_c')
    expect($('.desk-lesson h2').textContent).toBe('〜そうだ')
    press('ArrowLeft')
    await settle()
    expect(pointOf()).toBe('grammar_N4_b')
    expect($('.desk-lesson h2').textContent).toBe('〜ように')
    press('ArrowRight'); await settle(60)
    press('ArrowRight'); await settle()
    // The walk stops at the end of the line.
    expect(pointOf()).toBe('grammar_N4_c')
  })

  it('stands the lesson on the card\'s surface, the open row in gold', async () => {
    await mount('/learn/grammar/N4?index=1&point=grammar_N4_b', grammarRoutes)
    await settle()
    const card = $('.desk-lesson').getBoundingClientRect()
    expect(Math.round(card.width)).toBeLessThanOrEqual(640)
    const open = getComputedStyle($('.gl-index__row[aria-current="page"]'))
    expect(open.boxShadow).not.toBe('none')
    // The way out is the level's page.
    expect($('.desk-crumb')?.textContent ?? $('.bar').textContent).toContain('N4')
  })
})

const vocabRoutes = (
  <>
    <Route path="/learn/vocab/tiers" element={<VocabScreen session={null} />} />
    <Route path="/learn/vocab/tier/:tier" element={<VocabScreen session={null} />} />
    <Route path="/learn/vocab/theme/:theme" element={<VocabScreen session={null} />} />
    <Route path="/learn/vocab/theme/:theme/level/:themeLevel" element={<VocabScreen session={null} />} />
    <Route path="/learn/vocab/themes" element={<p className="probe-themes">themes</p>} />
  </>
)
const openTier = () => $('.desk-split__list .platform-card[aria-current="page"] .platform-card__no')?.textContent

describe('the frequency tiers beside a tier\'s platforms', () => {
  it('opens the bare list on its first tier, replacing it', async () => {
    await mount('/learn/vocab/tiers?size=500', vocabRoutes)
    await settle()
    expect(where.path).toBe('/learn/vocab/tier/1')
    expect(where.search).toBe('?size=500')
    expect(where.type).toBe('REPLACE')
  })

  it('stands the tiers upright beside the platforms, each figured', async () => {
    await mount('/learn/vocab/tier/3?size=200', vocabRoutes)
    await settle(400)
    expect(openTier()).toBe('3')
    const rows = $$('.desk-split__list .platform-card')
    expect(rows).toHaveLength(10)
    // One to a row, no ▶.
    expect(rows[1].getBoundingClientRect().top).toBeGreaterThan(rows[0].getBoundingClientRect().bottom - 1)
    expect(getComputedStyle(rows[0].querySelector('.platform-card__go')).display).toBe('none')
    const figs = $$('.desk-split__page .desk-mode-fig')
    expect(figs.length).toBeGreaterThanOrEqual(2)
    expect(figs[0].querySelector('.desk-mode-fig__due').textContent).toMatch(/^5/)
    expect(figs[0].querySelector('.desk-mode-fig__count').textContent).toMatch(/12\s*\/\s*60/)
    const stats = apiFetch.mock.calls.map(([u]) => String(u)).filter(u => u.includes('/stats'))
    expect(stats.every(u => u.startsWith('/api/frequency/vocab/stats?tier=3&tier_size=200&mode='))).toBe(true)
  })

  it('swaps tiers in place, and keeps the learner\'s place across a size', async () => {
    await mount('/learn/vocab/tier/3?size=200', vocabRoutes)
    await settle(400)
    $$('.desk-split__list .platform-card')[5].click()
    await settle()
    expect(where.path).toBe('/learn/vocab/tier/6')
    expect(where.type).toBe('REPLACE')
    expect(openTier()).toBe('6')
    // Tier 6 of 200 (1001–1200) is tier 3 of 500 (1001–1500).
    ;[...$$('.tier-picker__size button')].find(b => b.textContent === '500').click()
    await settle(400)
    expect(where.path).toBe('/learn/vocab/tier/3')
    expect(where.search).toBe('?size=500')
    expect(openTier()).toBe('3')
  })

  it('opens another pool on its first tier', async () => {
    await mount('/learn/vocab/tier/4?size=200', vocabRoutes)
    await settle(400)
    const seg = $('.desk-split__list > .seg, .desk-split__list > [role="radiogroup"], .desk-split__list > [role="group"]')
    ;[...seg.querySelectorAll('button')].at(-1).click()
    await settle()
    expect(where.path).toBe('/learn/vocab/tier/1')
    expect(where.search).toBe('?size=200&domain=jmdict')
  })

  it('folds the kanji tiers the same way', async () => {
    await mount('/learn/kanji/tier/2?size=200', (
      <Route path="/learn/kanji/tier/:tier" element={<KanjiScreen session={null} />} />
    ))
    await settle(400)
    expect(openTier()).toBe('2')
    expect($('.desk-split__page .desk-mode-fig')).not.toBeNull()
    const stats = apiFetch.mock.calls.map(([u]) => String(u)).filter(u => u.includes('/stats'))
    expect(stats.every(u => u.startsWith('/api/frequency/kanji/stats?tier=2&tier_size=200&mode='))).toBe(true)
  })
})

describe('a theme\'s bands beside a band\'s platforms', () => {
  it('opens the theme on its first band, replacing it', async () => {
    await mount('/learn/vocab/theme/animaux', vocabRoutes)
    await settle()
    expect(where.path).toBe('/learn/vocab/theme/animaux/level/basic')
    expect(where.type).toBe('REPLACE')
  })

  it('stands the bands beside the platforms, each figured, and swaps in place', async () => {
    await mount('/learn/vocab/theme/animaux/level/basic', vocabRoutes)
    await settle(400)
    const stops = $$('.desk-split__list .route-stop')
    expect(stops).toHaveLength(4)
    expect($('.desk-split__list .route-stop[aria-current="page"] .route-stop__code').textContent).toBe('基本')
    expect($('.desk-split__page .desk-mode-fig__count').textContent).toMatch(/12\s*\/\s*60/)
    const stats = apiFetch.mock.calls.map(([u]) => String(u)).filter(u => u.includes('/stats'))
    expect(stats.every(u => u.startsWith('/api/vocab/theme/animaux/stats?level=basic&mode='))).toBe(true)
    stops[2].click()
    await settle()
    expect(where.path).toBe('/learn/vocab/theme/animaux/level/advanced')
    expect(where.type).toBe('REPLACE')
  })
})

describe('a deck\'s platforms', () => {
  it('stand on the deck\'s own page: its platform screen gives way to it', async () => {
    await mount('/learn/decks/d1/study', (
      <>
        <Route path="/learn/decks/:deck_id/study" element={<StudyScreen session={null} />} />
        <Route path="/learn/decks/:deck_id" element={<p className="probe-deck">deck</p>} />
      </>
    ))
    await settle()
    expect(where.path).toBe('/learn/decks/d1')
    expect(where.type).toBe('REPLACE')
    expect($('.probe-deck')).not.toBeNull()
  })
})
