import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
// The faces main.jsx loads: the gate's width is its label's.
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import './index.css'

// ── 机 — the vocabulary's sources on a 1,440px window (plan 183) ─────
// The page as the owner drew it (pick C): the lead, its gate in a column
// of its own beside its words, and three stops in the strip, the row
// shared by as many as were started; the 41 tiers whole in their plate,
// seven or more cells to a row, and the themes in two columns. The
// narrowest desk's version is vocabSources.desktop's; a short window's,
// vocabSources.short's.

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
// The gate's breathing ring stands 9px out of its pill, and the reader's
// ripples as far: all of it inside the card.
const RING = 9
const gateInside = card => {
  const c = card.getBoundingClientRect()
  const g = card.querySelector('button.btn-depart--gate').getBoundingClientRect()
  return g.left - RING >= c.left && g.right + RING <= c.right && g.top - RING >= c.top && g.bottom + RING <= c.bottom
}

afterEach(() => {
  STATS.items.vocab.N4.started = 0
  STARTED = MET
})

describe('the vocabulary\'s sources on a wide desk (plan 183)', () => {
  it('fills the strip with three stops beside the lead, the most met first, the gate and its halo in its card', async () => {
    STATS.items.vocab.N4.started = 40
    await mount()
    expect($('.desk-sources--narrow')).toBeNull()
    expect(others().map(o => o.getAttribute('href'))).toEqual([
      '/learn/vocab/N4', '/learn/vocab/tier/1?size=200', '/learn/vocab/tier/5?size=200',
    ])
    const card = lead()
    expect(card.classList.contains('desk-resume__card--split')).toBe(true)
    expect(gateInside(card)).toBe(true)
    // The gate beside the words, so the strip is a row of words high, not
    // the words and the gate under them.
    const words = card.querySelector('.desk-resume__name').getBoundingClientRect()
    const gate = card.querySelector('button.btn-depart--gate').getBoundingClientRect()
    expect(gate.left).toBeGreaterThan(words.right)
    expect(card.getBoundingClientRect().height).toBeLessThan(200)
    const band = $('.desk-resume').getBoundingClientRect()
    expect(others().at(-1).getBoundingClientRect().right).toBeGreaterThan(band.right - 2)
    for (const o of others()) {
      const label = o.querySelector('.desk-resume__label')
      expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth)
    }
  })

  it('shares the row among what was started: one stop takes the rest of it, none leaves the lead the whole', async () => {
    STARTED = { 1: 18 }
    await mount()
    expect(others()).toHaveLength(1)
    const band = $('.desk-resume').getBoundingClientRect()
    expect(others()[0].getBoundingClientRect().width).toBeLessThan(lead().getBoundingClientRect().width)
    expect(near(others()[0].getBoundingClientRect().right, band.right)).toBe(true)
    expect(gateInside(lead())).toBe(true)
  })

  it('leaves the lead the whole row when nothing else is started', async () => {
    STARTED = {}
    await mount()
    expect(others()).toHaveLength(0)
    const band = $('.desk-resume').getBoundingClientRect()
    expect(near(lead().getBoundingClientRect().width, band.width)).toBe(true)
    expect(lead().classList.contains('desk-resume__card--split')).toBe(true)
    expect(gateInside(lead())).toBe(true)
  })

  it('draws the 41 tiers whole, seven or more to a row, and the themes in two columns', async () => {
    await mount()
    const cs = cells()
    const grid = cs[0].parentElement
    expect(getComputedStyle(grid).gridTemplateColumns.split(' ').length).toBeGreaterThanOrEqual(7)
    expect(grid.scrollHeight).toBeLessThanOrEqual(grid.clientHeight + 1)
    const [a, b, c] = rows(plates()[2]).map(r => r.getBoundingClientRect())
    expect(near(a.top, b.top)).toBe(true)
    expect(b.left).toBeGreaterThan(a.right)
    expect(near(c.left, a.left)).toBe(true)
    for (const p of plates()) expect(p.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
  })
})
