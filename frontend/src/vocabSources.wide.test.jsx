import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
// The faces main.jsx loads: the gate's width is its label's.
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import './index.css'

// ── 机 — the vocabulary's sources on a 1,440px window (plan 267) ─────
// The page as the owner drew it (pick C3): the five doors and the gate
// on one row, the 41 tiers whole in their band, twenty or so doors to a
// row, and the themes six to a row. The narrowest desk's version is
// vocabSources.desktop's; a short window's, vocabSources.short's.

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
  // The shared answers (lib/cachedJson, plan 211) ask through apiJson.
  apiJson: async (...a) => (await apiFetch(...a)).json(),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
const MET = { 1: 18, 3: 4, 5: 9, 7: 2 }
let STARTED = MET
const answer = path => {
  if (path.startsWith('/api/frequency/vocab/tiers/started')) return { started: STARTED }
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
const { forgetCachedJson } = await import('./lib/cachedJson')
// Each case asks with its own answers: none is kept across (plan 211).
afterEach(() => { forgetCachedJson() })

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
const doors = () => [...document.querySelectorAll('.desk-linedoors__line .route-stop')]
const gateCell = () => $('.desk-linedoors__gate')
const tierBand = () => $('.desk-band--tiers')
const themeBand = () => $('.desk-band--themes')
const cells = () => [...tierBand().querySelectorAll('.desk-source__cells > a')]
const themes = () => [...themeBand().querySelectorAll('.desk-source__rows > a')]
const near = (a, b) => Math.abs(a - b) < 2
const box = el => el.getBoundingClientRect()
// The gate's reader ripples as far as 9px out of its pill: all of it
// inside its door.
const RING = 9
const gateInside = () => {
  const c = box(gateCell())
  const g = box(gateCell().querySelector('button.btn-depart--gate'))
  return g.left - RING >= c.left && g.right + RING <= c.right && g.top - RING >= c.top && g.bottom + RING <= c.bottom
}

afterEach(() => { STARTED = MET })

describe('the vocabulary\'s sources on a wide desk (plan 267)', () => {
  it('stands the gate as the line\'s last door, beside the five, the air round it in its door', async () => {
    await mount()
    const ds = doors().map(box)
    const g = box(gateCell())
    expect(near(g.top, ds[0].top)).toBe(true)
    expect(g.left).toBeGreaterThanOrEqual(ds[4].right - 1)
    expect(gateInside()).toBe(true)
    // Each level's name whole, the doors one height.
    for (const d of doors()) {
      const name = d.querySelector('.route-stop__jp')
      expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth + 1)
      expect(near(box(d).height, ds[0].height)).toBe(true)
    }
  })

  it('draws the 41 tiers whole, a score of doors to a row, and the themes six across', async () => {
    await mount()
    const cs = cells()
    const grid = cs[0].parentElement
    expect(getComputedStyle(grid).gridTemplateColumns.split(' ').length).toBeGreaterThanOrEqual(16)
    expect(grid.scrollHeight).toBeLessThanOrEqual(grid.clientHeight + 1)
    expect(cs[4].classList.contains('desk-source__cell--met')).toBe(true)
    const rs = themes().map(box)
    const firstRow = rs.filter(r => near(r.top, rs[0].top))
    expect(firstRow.length).toBeGreaterThanOrEqual(5)
    expect(box(themeBand()).bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight + 1)
  })

  it('leaves a tier nobody opened unlit', async () => {
    STARTED = {}
    await mount()
    expect(cells().some(c => c.classList.contains('desk-source__cell--met'))).toBe(false)
  })
})
