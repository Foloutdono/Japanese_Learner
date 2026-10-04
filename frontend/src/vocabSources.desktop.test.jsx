import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
// The faces main.jsx loads: the gate's width is its label's, and the
// runner's fallback sets « Reprendre » narrower than Space Grotesk does.
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import './index.css'

// ── 机 — the vocabulary's sources, what you started first (plan 181) ──
// The owner's pick C of the canvas "Tsuji — the vocabulary's sources".
// Plan 137 hung the three sources as three equal plates the window's
// height; the page now opens on a strip of what the learner has started
// -- their own level, wider, its gate in a column of its own beside its
// words, then the stops with the most cards met -- over the three
// sources: JLPT's line with each level's first words and bar, the tiers
// as a grid of numbered cells, the themes in columns. Every door pushes.
// This is the narrowest desk (1100×800): one stop beside the lead. The
// phone keeps its three cards (deskfree.phone).

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
const tiers = n => ({ tiers: Array.from({ length: n }, (_, i) => ({
  tier: i + 1, start_rank: i * 200 + 1, end_rank: (i + 1) * 200, count: 200, sample: [`語${i + 1}`, '何'],
})) })
const THEMES = { themes: ['animals', 'birds', 'body_parts', 'buildings', 'clothing', 'colors', 'dishes', 'drinks', 'emotions', 'family', 'fruits', 'furniture']
  .map((key, i) => ({ key, count: 20 + i })) }
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch,
  apiJson: vi.fn(), apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
const answer = path => {
  if (path.startsWith('/api/frequency/vocab/tiers/started')) return { started: { 1: 18, 3: 4 } }
  if (path.startsWith('/api/frequency/vocab_jmdict/tiers/started')) return { started: {} }
  if (path.startsWith('/api/frequency/vocab/tiers')) return tiers(41)
  if (path.startsWith('/api/frequency/vocab_jmdict/tiers')) return tiers(300)
  if (path === '/api/themes') return THEMES
  return {}
}
apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => answer(path) }))
const SUMMARY = { level: 3, jlptLevel: 'N5', streak: 1 }
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => SUMMARY,
  useProfileSummaryState: () => ({ summary: SUMMARY, failed: false }),
}))
const STATS = { items: { vocab: {
  N5: { total: 674, learned: 12, started: 31, score: 0 },
  N4: { total: 642, learned: 0, started: 0, score: 0 },
  N3: { total: 1737, learned: 0, started: 0, score: 0 },
  N2: { total: 1765, learned: 0, started: 0, score: 0 },
  N1: { total: 3227, learned: 0, started: 0, score: 0 },
} } }
vi.mock('./stores/stats', () => ({ useStats: () => ({ data: STATS, failed: false }), refreshStats: vi.fn() }))
vi.mock('./stores/stationSamples', () => ({
  useStationSamples: () => ({ N5: { sample: ['何', '私', '来る'] }, N4: { sample: ['彼', '君'] } }),
}))
// The train door is App's; here the boarding commits at once.
vi.mock('./stores/boarding', async o => ({ ...(await o()), board: vi.fn(commit => commit()) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: VocabScreen } = await import('./screens/VocabScreen')

// Past the timer, the plates' staggered arrivals themselves: a plate a
// fraction of a pixel short of its place is a row out of line.
const settle = async (ms = 300) => {
  await new Promise(r => setTimeout(r, ms))
  await document.fonts.ready
  await Promise.all(document.getAnimations()
    .filter(a => a.effect?.getComputedTiming().iterations !== Infinity)
    .map(a => a.finished.catch(() => {})))
}
const where = { path: null, search: null, type: null }
function Probe() {
  const loc = useLocation()
  where.path = loc.pathname
  where.search = loc.search
  where.type = useNavigationType()
  return null
}
async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/learn/vocab']}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <Routes>
              <Route path="/learn/vocab" element={<VocabScreen session={null} />} />
              <Route path="/learn/vocab/*" element={<div className="elsewhere" />} />
            </Routes>
          </div>
        </div>
        <Probe />
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}
const $ = s => document.querySelector(s)
const strip = () => $('.desk-sources--resume > .desk-resume')
const lead = () => strip().querySelector('.desk-resume__card--lead')
const others = () => [...strip().querySelectorAll(':scope > a.desk-resume__card')]
const plates = () => [...document.querySelectorAll('.desk-sources__lower > .desk-source')]
const rows = plate => [...plate.querySelectorAll('.desk-source__rows > a')]
const cells = () => [...plates()[1].querySelectorAll('.desk-source__cells > a')]
const near = (a, b) => Math.abs(a - b) < 2
// The gate's breathing ring stands 9px out of its pill (index.css,
// btn-gate-breathe), and the reader's ripples as far: all of it inside
// the card.
const RING = 9
const gateInside = card => {
  const c = card.getBoundingClientRect()
  const g = card.querySelector('button.btn-depart--gate').getBoundingClientRect()
  return g.left - RING >= c.left && g.right + RING <= c.right && g.top - RING >= c.top && g.bottom + RING <= c.bottom
}

afterEach(() => {
  STATS.items.vocab.N4.started = 0
  SUMMARY.jlptLevel = 'N5'
})

describe('the vocabulary\'s sources on the desk (plan 181)', () => {
  it('lays the strip over three plates side by side, down to the window\'s foot and no further', async () => {
    await mount()
    const s = strip().getBoundingClientRect()
    const ps = plates().map(p => p.getBoundingClientRect())
    expect(ps).toHaveLength(3)
    expect(ps[0].top).toBeGreaterThan(s.bottom)
    expect(new Set(ps.map(p => Math.round(p.top))).size).toBe(1)
    expect(ps[1].left).toBeGreaterThan(ps[0].right)
    expect(ps[2].left).toBeGreaterThan(ps[1].right)
    for (const p of ps) {
      expect(p.bottom).toBeLessThanOrEqual(window.innerHeight)
      expect(p.bottom).toBeGreaterThan(window.innerHeight - 60)
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    // No plate under the strip prints its description: the strip and
    // the figures say what each is.
    expect(document.querySelector('.desk-sources__lower .desk-source__desc')).toBeNull()
    expect(document.querySelector('.bar__sub')).toBeNull()
  })

  it('leads with the learner\'s own level, wider, its first words and the gate that resumes it', async () => {
    await mount()
    const card = lead()
    expect(card.getBoundingClientRect().width).toBeGreaterThan(others()[0].getBoundingClientRect().width * 1.4)
    // The gate in a column of its own beside the words, its halo in the
    // card, the level's name whole.
    expect(card.classList.contains('desk-resume__card--split')).toBe(true)
    expect(gateInside(card)).toBe(true)
    const words = card.querySelector('.desk-resume__name').getBoundingClientRect()
    expect(card.querySelector('button.btn-depart--gate').getBoundingClientRect().left).toBeGreaterThan(words.right)
    const label = card.querySelector('.desk-resume__label')
    expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth)
    expect(card.querySelector('.desk-resume__cap').textContent).toBe('JLPT · Tu es ici')
    expect(card.querySelector('.desk-source__meter .desk-source__num').textContent).toBe('12/ 674')
    const name = card.querySelector('a.desk-resume__name')
    expect(name.getAttribute('href')).toBe('/learn/vocab/N5')
    expect(name.textContent).toBe('N5Niveau débutant')
    expect(card.querySelector('.desk-resume__sample').textContent).toBe('何 私 来る')
    expect(card.querySelector('.desk-resume__go .desk-source__num').textContent).toBe('31 commencées · 643 jamais vues')
    const met = card.querySelector('.desk-line__met')
    expect(parseFloat(met.style.width)).toBeCloseTo((100 * 31) / 674, 1)
    const gate = card.querySelector('button.btn-depart--gate')
    expect(gate.textContent).toContain('Reprendre')
    // The gate boards the level's first platform, the main flashcards.
    gate.click()
    await settle(50)
    expect(where.path).toBe('/learn/vocab/N5/vocab.flashcard.f2b')
  })

  it('follows with the stop the most cards are met in, a pushing door to its platforms', async () => {
    await mount()
    // One beside the lead on the narrowest desk (three on a wider one:
    // vocabSources.wide), the rest of the row its.
    expect($('.desk-sources--narrow')).not.toBeNull()
    const os = others()
    expect(os.map(o => o.getAttribute('href'))).toEqual(['/learn/vocab/tier/1?size=200'])
    expect(os[0].querySelector('.desk-resume__cap').textContent).toBe('Par fréquence')
    expect(os[0].querySelector('.desk-resume__name').textContent).toBe('1Mots 1–200')
    expect(os[0].querySelector('.desk-source__meter .desk-source__num').textContent).toBe('18/ 200')
    expect(os[0].querySelector('.desk-resume__sample').textContent).toBe('語1 何')
    // One row at one height, to the strip's end.
    const [a, b] = [lead(), os[0]].map(c => c.getBoundingClientRect())
    expect(near(a.top, b.top)).toBe(true)
    expect(near(a.height, b.height)).toBe(true)
    expect(near(b.right, strip().getBoundingClientRect().right)).toBe(true)
    os[0].click()
    await settle(50)
    expect(where.path).toBe('/learn/vocab/tier/1')
    expect(where.search).toBe('?size=200')
    expect(where.type).toBe('PUSH')
  })

  it('ranks another level with more met before a tier', async () => {
    STATS.items.vocab.N4.started = 40
    await mount()
    const os = others()
    expect(os.map(o => o.getAttribute('href'))).toEqual(['/learn/vocab/N4'])
    expect(os[0].querySelector('.desk-resume__cap').textContent).toBe('JLPT')
    expect(os[0].querySelector('.desk-resume__sample').textContent).toBe('彼 君')
  })

  it('offers somewhere to go on with nothing met: the level the learner chose, to start', async () => {
    SUMMARY.jlptLevel = 'N4'
    await mount()
    expect(lead().querySelector('a.desk-resume__name').getAttribute('href')).toBe('/learn/vocab/N4')
    expect(lead().querySelector('button.btn-depart--gate').textContent).toContain('Commencer')
    expect(lead().querySelector('.desk-resume__go .desk-source__num').textContent).toBe('642 jamais vues')
    // N5's 31 met cards are a stop of the strip now.
    expect(others()[0].getAttribute('href')).toBe('/learn/vocab/N5')
  })

  it('draws JLPT as a line of five rows sharing the plate, each with its first words and its bar', async () => {
    await mount()
    const [jlpt] = plates()
    const rs = rows(jlpt)
    expect(rs.map(r => r.getAttribute('href'))).toEqual(['N5', 'N4', 'N3', 'N2', 'N1'].map(l => `/learn/vocab/${l}`))
    const hs = rs.map(r => r.getBoundingClientRect().height)
    for (const h of hs) expect(near(h, hs[0])).toBe(true)
    expect(rs[0].getAttribute('aria-current')).toBe('location')
    expect(rs.every(r => r.querySelector('.desk-line__bar'))).toBe(true)
    expect(rs[0].querySelector('.desk-source__sample').textContent).toBe('何 私 来る')
    expect(rs[2].querySelector('.desk-source__sample')).toBeNull()
    expect(parseFloat(rs[0].querySelector('.desk-line__learned').style.width)).toBeCloseTo((100 * 12) / 674, 1)
    expect(jlpt.querySelector('.desk-source__cap')).toBeNull()
    expect(jlpt.querySelector('.desk-source__fig').textContent).toMatch(/12\s*\/\s*8045/)
    // One tab stop, walked with the arrows; a row pushes.
    expect(rs.filter(r => r.tabIndex === 0)).toHaveLength(1)
    rs[0].focus()
    rs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(rs[1])
    rs[1].click()
    await settle(50)
    expect(where.path).toBe('/learn/vocab/N4')
    expect(where.type).toBe('PUSH')
  })

  it('draws the tiers as a grid of numbered cells, the met ones lit, named and filled', async () => {
    await mount()
    const cs = cells()
    expect(cs).toHaveLength(41)
    const columns = getComputedStyle(cs[0].parentElement).gridTemplateColumns.split(' ').length
    expect(columns).toBeGreaterThanOrEqual(4)
    expect(cs[0].getAttribute('href')).toBe('/learn/vocab/tier/1?size=200')
    expect(cs[0].getAttribute('aria-label')).toBe('Palier 1 · Mots 1–200 · 18 commencées')
    expect(cs[0].classList.contains('desk-source__cell--met')).toBe(true)
    expect(cs[0].querySelector('.desk-source__cell-met').textContent).toBe('18')
    expect(parseFloat(cs[0].querySelector('.desk-source__cell-fill').style.width)).toBeCloseTo(9, 1)
    expect(cs[1].getAttribute('aria-label')).toBe('Palier 2 · Mots 201–400')
    expect(cs[1].querySelector('.desk-source__cell-met')).toBeNull()
    // Every cell a row's height and width at least: on the narrowest
    // desk the grid scrolls in its plate rather than crushing them.
    for (const c of cs) {
      const r = c.getBoundingClientRect()
      expect(r.height).toBeGreaterThanOrEqual(43)
      expect(r.width).toBeGreaterThanOrEqual(43)
    }
    const grid = cs[0].parentElement
    expect(grid.getBoundingClientRect().bottom).toBeLessThanOrEqual(plates()[1].getBoundingClientRect().bottom)
    // One tab stop, walked in two dimensions.
    expect(cs.filter(c => c.tabIndex === 0)).toHaveLength(1)
    cs[0].focus()
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(cs[1])
    cs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(cs[1 + columns])
  })

  it('cuts the tiers by the pool and the size, in the URL and every door; the strip keeps the deck\'s', async () => {
    await mount()
    const freq = plates()[1]
    const pool = [...freq.querySelectorAll('.desk-source__tools > .seg [role="radio"]')]
    pool[1].click()
    await settle()
    expect(where.search).toBe('?domain=jmdict')
    expect(cells()).toHaveLength(300)
    expect(cells()[0].getAttribute('href')).toBe('/learn/vocab/tier/1?size=200&domain=jmdict')
    const grid = cells()[0].parentElement
    expect(grid.scrollHeight).toBeGreaterThan(grid.clientHeight)
    expect(others().map(o => o.getAttribute('href'))).toEqual(['/learn/vocab/tier/1?size=200'])
    // The size under the pool, as wide as it, with no caption over it:
    // its name is the switch's label.
    const sizeRow = plates()[1].querySelector('.desk-source__size')
    expect(sizeRow.querySelector('.cap')).toBeNull()
    expect(sizeRow.querySelector('.seg').getAttribute('aria-label')).toBeTruthy()
    expect(Math.round(sizeRow.querySelector('.seg').getBoundingClientRect().width))
      .toBe(Math.round(plates()[1].querySelector('.desk-source__tools > .seg').getBoundingClientRect().width))
    const size = [...sizeRow.querySelectorAll('.seg [role="radio"]')].find(r => r.textContent === '500')
    size.click()
    await settle()
    expect(where.search).toBe('?size=500&domain=jmdict')
    expect(cells()[0].getAttribute('href')).toBe('/learn/vocab/tier/1?size=500&domain=jmdict')
    expect(others()[0].getAttribute('href')).toBe('/learn/vocab/tier/1?size=500')
  })

  it('lists the themes under their filter, each a link to its bands, in one column on the narrowest desk', async () => {
    await mount()
    const themes = plates()[2]
    const rs = rows(themes)
    expect(rs).toHaveLength(12)
    expect(rs[0].getAttribute('href')).toBe('/learn/vocab/theme/animals')
    const [a, b] = rs.map(r => r.getBoundingClientRect())
    expect(b.top).toBeGreaterThan(a.bottom - 1)
    expect(near(b.left, a.left)).toBe(true)
    // Each name whole.
    for (const r of rs) {
      const label = r.querySelector('.desk-source__label')
      expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth)
    }
    const input = themes.querySelector('input')
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setValue.call(input, 'fam')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(50)
    expect(rows(themes).map(r => r.getAttribute('href'))).toEqual(['/learn/vocab/theme/family'])
  })
})
