import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the kanji's sources as plates (the owner's pick B) ───────────
// /learn/kanji on the desk was three cards across the top of an empty
// window. It takes the vocabulary's plates, laid for what the kanji
// have: JLPT at its own height over the frequency tiers in one column,
// and the radicals as the index's glyph tiles on the wider plate beside
// them. Every row and tile pushes. The phone keeps its three cards
// (deskfree.phone).

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
const tiers = n => ({ tiers: Array.from({ length: n }, (_, i) => ({ tier: i + 1, start_rank: i * 200 + 1, end_rank: (i + 1) * 200, count: 200 })) })
const R = (number, glyph, meaning, stroke_count, count, learned = 0) => ({ number, char: glyph, glyph, stroke_count, meaning, count, learned, started: learned })
const GROUPS = [
  { stroke_count: 3, radicals: [R(30, '口', 'bouche', 3, 112, 9), R(32, '土', 'terre', 3, 64, 3), R(85, '氵', 'eau', 3, 123, 10)] },
  { stroke_count: 4, radicals: [R(75, '木', 'arbre', 4, 131, 8), R(72, '日', 'soleil', 4, 96, 9)] },
]
const apiFetch = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch,
  apiJson: vi.fn(), apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))
const answer = path => {
  if (path.startsWith('/api/frequency/kanji/tiers/started')) return { started: { 1: 44 } }
  if (path.startsWith('/api/frequency/kanji/tiers')) return tiers(11)
  if (path.startsWith('/api/kanji/radicals')) return { groups: GROUPS }
  return {}
}
apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => answer(path) }))
const SUMMARY = { level: 3, jlptLevel: 'N5', streak: 1 }
vi.mock('./stores/profileSummary', async o => ({ ...(await o()),
  useProfileSummary: () => SUMMARY,
  useProfileSummaryState: () => ({ summary: SUMMARY, failed: false }),
}))
const K = (total, learned = 0, started = 0) => ({ total, learned, started, score: 0 })
const STATS = { items: { kanji: { N5: K(79, 22, 41), N4: K(166, 3, 9), N3: K(367), N2: K(367), N1: K(1232) } } }
vi.mock('./stores/stats', () => ({ useStats: () => ({ data: STATS, failed: false }), refreshStats: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: KanjiScreen } = await import('./screens/KanjiScreen')

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
      <MemoryRouter initialEntries={['/learn/kanji']}>
        <div className="phone phone--desk">
          <div className="phone__content">
            <Routes>
              <Route path="/learn/kanji" element={<KanjiScreen session={null} />} />
              <Route path="/learn/kanji/*" element={<div className="elsewhere" />} />
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
const rows = plate => [...plate.querySelectorAll('.desk-source__rows > a')]
const jlpt = () => $('.desk-sources__col > .desk-source--compact')
const freq = () => $('.desk-sources__col > .desk-source:not(.desk-source--compact)')
const radicals = () => $('.desk-sources > .desk-source--radicals')

describe("the kanji's sources on the desk", () => {
  it('stands the two lines in a column beside the radicals, down to the window\'s foot', async () => {
    await mount()
    const j = jlpt().getBoundingClientRect()
    const f = freq().getBoundingClientRect()
    const r = radicals().getBoundingClientRect()
    expect(f.top).toBeGreaterThan(j.bottom)
    expect(Math.round(f.left)).toBe(Math.round(j.left))
    expect(r.left).toBeGreaterThan(j.right)
    expect(r.width).toBeGreaterThan(j.width)
    expect(Math.round(r.top)).toBe(Math.round(j.top))
    for (const p of [f, r]) {
      expect(p.bottom).toBeLessThanOrEqual(window.innerHeight)
      expect(p.bottom).toBeGreaterThan(window.innerHeight - 60)
    }
    expect($('.platform-card')).toBeNull()
  })

  it('draws JLPT at its own height, each level a push to its stop', async () => {
    await mount()
    const rs = rows(jlpt())
    expect(rs.map(r => r.getAttribute('href'))).toEqual(['N5', 'N4', 'N3', 'N2', 'N1'].map(l => `/learn/kanji/${l}`))
    expect(rs[0].getAttribute('aria-current')).toBe('location')
    expect(jlpt().querySelector('.desk-source__fig').textContent).toMatch(/25\s*\/\s*2211/)
    rs[1].click()
    await settle()
    expect(where.path).toBe('/learn/kanji/N4')
    expect(where.type).toBe('PUSH')
  })

  it('lists the tiers under their size alone, with no pool to choose', async () => {
    await mount()
    expect(freq().querySelector('.desk-source__tools > .seg')).toBeNull()
    const rs = rows(freq())
    expect(rs).toHaveLength(11)
    expect(rs[0].getAttribute('href')).toBe('/learn/kanji/tier/1?size=200')
    expect(rs[0].textContent).toContain('44')
    const size = [...freq().querySelectorAll('.desk-source__size [role="radio"]')].find(r => r.textContent === '500')
    size.click()
    await settle()
    expect(where.search).toBe('?size=500')
    expect(rows(freq())[0].getAttribute('href')).toBe('/learn/kanji/tier/1?size=500')
  })

  it('opens a radical from its tile by pushing, its stroke page kept in the URL', async () => {
    await mount()
    const tiles = () => [...radicals().querySelectorAll('a.radical-tile')]
    expect(tiles().map(a => a.getAttribute('href'))).toEqual(['/learn/kanji/radical/85', '/learn/kanji/radical/30', '/learn/kanji/radical/32'])
    const four = [...radicals().querySelectorAll('.stroke-rail__key')].find(k => k.textContent === '4')
    four.click()
    await settle()
    expect(where.search).toBe('?stroke=4')
    expect(tiles().map(a => a.getAttribute('href'))).toEqual(['/learn/kanji/radical/75', '/learn/kanji/radical/72'])
    tiles()[0].click()
    await settle()
    expect(where.path).toBe('/learn/kanji/radical/75')
    expect(where.type).toBe('PUSH')
  })
})
