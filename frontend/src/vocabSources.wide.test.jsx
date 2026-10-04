import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the vocabulary's sources on a 1,440px window (plan 181) ─────
// The page as the owner drew it (pick C): the lead and four stops in
// the strip, the 41 tiers whole in their plate, seven or more cells to
// a row, and the themes in two columns. The narrowest desk's version is
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

afterEach(() => {
  STATS.items.vocab.N4.started = 0
  STARTED = MET
})

describe('the vocabulary\'s sources on a wide desk (plan 181)', () => {
  it('fills the strip with four stops beside the lead, the most met first, the gate inside its card', async () => {
    STATS.items.vocab.N4.started = 40
    await mount()
    expect($('.desk-sources--narrow')).toBeNull()
    expect(others().map(o => o.getAttribute('href'))).toEqual([
      '/learn/vocab/N4', '/learn/vocab/tier/1?size=200', '/learn/vocab/tier/5?size=200', '/learn/vocab/tier/3?size=200',
    ])
    const card = lead().getBoundingClientRect()
    const gate = lead().querySelector('button.btn-depart--gate').getBoundingClientRect()
    expect(gate.left).toBeGreaterThanOrEqual(card.left)
    expect(gate.right).toBeLessThanOrEqual(card.right)
    expect(gate.bottom).toBeLessThanOrEqual(card.bottom)
    const band = $('.desk-resume').getBoundingClientRect()
    expect(others().at(-1).getBoundingClientRect().right).toBeGreaterThan(band.right - 2)
  })

  it('keeps an empty place empty: a lead with less beside it is no wider', async () => {
    STARTED = { 1: 18 }
    await mount()
    expect(others()).toHaveLength(1)
    const width = lead().getBoundingClientRect().width
    expect(others()[0].getBoundingClientRect().width).toBeLessThan(width)
    expect($('.desk-resume').getBoundingClientRect().right - others().at(-1).getBoundingClientRect().right).toBeGreaterThan(100)
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
