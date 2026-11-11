import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the kanji's sources: the doors over two plates (plan 267) ──
// The owner's pick C1 of the canvas "Tsuji — the sources and the line,
// redrawn". JLPT is the page's head, its five levels as doors and the
// gate that resumes the learner's level as the line's last; under it
// the tiers as rows under their size, and the radicals' tiles under the
// stroke rail, which stands in the plate's head. Every door, row and
// tile pushes. The phone keeps its three cards (deskfree.phone).

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
  // The shared answers (lib/cachedJson, plan 211) ask through apiJson.
  apiJson: async (...a) => (await apiFetch(...a)).json(),
  apiJsonWithTimeout: vi.fn(), apiUpload: vi.fn(),
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
// The train door is App's; here the boarding commits at once.
vi.mock('./stores/boarding', async o => ({ ...(await o()), board: vi.fn(commit => commit()) }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: KanjiScreen } = await import('./screens/KanjiScreen')
const { forgetCachedJson } = await import('./lib/cachedJson')
// Each case asks with its own answers: none is kept across (plan 211).
afterEach(() => { forgetCachedJson() })

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
const doors = () => [...document.querySelectorAll('.desk-linedoors__line .route-stop')]
const rows = plate => [...plate.querySelectorAll('.desk-source__rows > a')]
const lower = () => [...document.querySelectorAll('.desk-sources__lower > .desk-source')]
const freq = () => lower()[0]
const radicals = () => $('.desk-sources__lower > .desk-source--radicals')

describe("the kanji's sources on the desk (plan 267)", () => {
  it('heads the page with the doors, and stands the two plates under them down to the window\'s foot', async () => {
    await mount()
    const d = $('.desk-linedoors').getBoundingClientRect()
    const [f, r] = lower().map(p => p.getBoundingClientRect())
    expect(f.top).toBeGreaterThan(d.bottom)
    expect(Math.round(r.top)).toBe(Math.round(f.top))
    expect(r.left).toBeGreaterThan(f.right)
    expect(r.width).toBeGreaterThan(f.width)
    for (const p of [f, r]) {
      expect(p.bottom).toBeLessThanOrEqual(window.innerHeight)
      expect(p.bottom).toBeGreaterThan(window.innerHeight - 60)
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    expect($('.platform-card')).toBeNull()
    expect($('.desk-source__desc')).toBeNull()
  })

  it('draws JLPT as five doors, the learner\'s own captioned, each a push to its stop', async () => {
    await mount()
    const ds = doors()
    expect(ds.map(r => r.getAttribute('href'))).toEqual(['N5', 'N4', 'N3', 'N2', 'N1'].map(l => `/learn/kanji/${l}`))
    const boxes = ds.map(r => r.getBoundingClientRect())
    for (const b of boxes) expect(Math.abs(b.top - boxes[0].top)).toBeLessThan(2)
    expect(ds[0].getAttribute('aria-current')).toBe('location')
    expect(ds[0].querySelector('.route-stop__here').textContent).toBe('Tu es ici')
    expect(ds[1].querySelector('.route-stop__here')).toBeNull()
    expect(ds[0].querySelector('.route-stop__fig').textContent).toMatch(/22\s*\/\s*79/)
    expect(parseFloat(ds[0].querySelector('.desk-line__met').style.width)).toBeCloseTo((100 * 41) / 79, 0)
    ds[1].click()
    await settle()
    expect(where.path).toBe('/learn/kanji/N4')
    expect(where.type).toBe('PUSH')
  })

  it('boards the learner\'s level from the gate at the line\'s end', async () => {
    await mount()
    const gate = $('.desk-linedoors__gate button.btn-depart--gate')
    expect(gate.textContent).toContain('Reprendre N5')
    expect($('.desk-linedoors__gate .desk-source__num').textContent).toBe('38 jamais vues')
    gate.click()
    await settle(50)
    expect(where.path).toMatch(/^\/learn\/kanji\/N5\/kanji\./)
  })

  it('lists the tiers under their size alone, each with its range, its bar and its count', async () => {
    await mount()
    expect(freq().querySelector('.desk-source__head .desk-source__size')).not.toBeNull()
    expect(freq().querySelectorAll('.seg')).toHaveLength(1)
    const rs = rows(freq())
    expect(rs).toHaveLength(11)
    expect(rs[0].getAttribute('href')).toBe('/learn/kanji/tier/1?size=200')
    expect(rs[0].querySelector('.desk-source__label').textContent).toBe('1–200')
    expect(rs[0].querySelector('.desk-source__num').textContent).toBe('44')
    expect(parseFloat(rs[0].querySelector('.desk-line__met').style.width)).toBeCloseTo(22, 1)
    expect(rs[1].querySelector('.desk-source__num').textContent).toBe('')
    const size = [...freq().querySelectorAll('.desk-source__size [role="radio"]')].find(r => r.textContent === '500')
    size.click()
    await settle()
    expect(where.search).toBe('?size=500')
    expect(rows(freq())[0].getAttribute('href')).toBe('/learn/kanji/tier/1?size=500')
  })

  it('stands the stroke rail in the radicals\' head, every count in view, the tiles packed under it', async () => {
    await mount()
    const head = radicals().querySelector('.desk-source__head').getBoundingClientRect()
    const rail = radicals().querySelector('.stroke-rail').getBoundingClientRect()
    expect(Math.abs((rail.top + rail.height / 2) - (head.top + head.height / 2))).toBeLessThan(4)
    expect(rail.left).toBeGreaterThan(head.right - 1)
    const track = radicals().querySelector('.stroke-rail__track')
    expect(track.scrollWidth).toBeLessThanOrEqual(track.clientWidth)
    const tiles = () => [...radicals().querySelectorAll('a.radical-tile')]
    const [first] = tiles().map(t => t.getBoundingClientRect())
    const stripe = radicals().querySelector('.desk-source__stripe').getBoundingClientRect()
    expect(first.top).toBeGreaterThan(stripe.bottom)
    expect(first.left - radicals().getBoundingClientRect().left).toBeLessThan(40)
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
