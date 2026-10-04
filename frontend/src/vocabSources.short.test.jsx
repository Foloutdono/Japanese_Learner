import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
// The faces main.jsx loads: the gate's width is its label's.
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import './index.css'

// ── 低 — the vocabulary's sources on a laptop's short window (plan 181) ──
// A 600px window (plan 169): the first words give way, the strip's and
// the line's, and the page shows whole -- the strip, the three plates to
// the window's foot, JLPT's five rows each a row's height at least, the
// gate and its halo in its card.

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
const plates = () => [...document.querySelectorAll('.desk-sources__lower > .desk-source')]
// The gate's breathing ring stands 9px out of its pill, and the reader's
// ripples as far: all of it inside the card.
const RING = 9
const gateInside = card => {
  const c = card.getBoundingClientRect()
  const g = card.querySelector('button.btn-depart--gate').getBoundingClientRect()
  return g.left - RING >= c.left && g.right + RING <= c.right && g.top - RING >= c.top && g.bottom + RING <= c.bottom
}
const rows = plate => [...plate.querySelectorAll('.desk-source__rows > a')]

afterEach(() => { STATS.items.vocab.N4.started = 0 })

describe('the vocabulary\'s sources on a short desk (plan 181)', () => {
  it('shows the page whole: no first words, the plates down to the foot and no further', async () => {
    await mount()
    expect(getComputedStyle(lead().querySelector('.desk-resume__sample')).display).toBe('none')
    expect(getComputedStyle(plates()[0].querySelector('.desk-source__sample')).display).toBe('none')
    for (const p of plates()) {
      const r = p.getBoundingClientRect()
      expect(r.bottom).toBeLessThanOrEqual(window.innerHeight)
      expect(r.bottom).toBeGreaterThan(window.innerHeight - 60)
    }
    for (const r of rows(plates()[0])) expect(r.getBoundingClientRect().height).toBeGreaterThanOrEqual(43)
    expect(gateInside(lead())).toBe(true)
  })
})
