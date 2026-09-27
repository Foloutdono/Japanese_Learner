import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 机 — the vocabulary's sources as three plates (plan 137) ─────────
// The owner's pick S2 of the station screens canvas. /learn/vocab on
// the desk was three cards across the top of an empty window, each
// opening a list of its own; now each source hangs as a plate the
// window's height with its whole list on it — JLPT's levels as a line,
// the tiers under their pool and size, the themes under their filter —
// and every row is a link that pushes to its stop's platforms. The
// phone keeps its three cards (deskfree.phone).

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playUi: vi.fn(), playClick: vi.fn(), playAnnouncement: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn(),
}))
const tiers = n => ({ tiers: Array.from({ length: n }, (_, i) => ({ tier: i + 1, start_rank: i * 200 + 1, end_rank: (i + 1) * 200, count: 200 })) })
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
  if (path.startsWith('/api/frequency/vocab_jmdict/tiers')) return tiers(60)
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
const plates = () => [...document.querySelectorAll('.desk-sources > .desk-source')]
const rows = plate => [...plate.querySelectorAll('.desk-source__rows > a')]

describe('the vocabulary\'s sources on the desk (plan 137)', () => {
  it('hangs three plates side by side, down to the window\'s foot and no further', async () => {
    await mount()
    const ps = plates().map(p => p.getBoundingClientRect())
    expect(ps).toHaveLength(3)
    expect(new Set(ps.map(p => Math.round(p.top))).size).toBe(1)
    expect(ps[1].left).toBeGreaterThan(ps[0].right)
    expect(ps[2].left).toBeGreaterThan(ps[1].right)
    for (const p of ps) {
      expect(p.bottom).toBeLessThanOrEqual(window.innerHeight)
      expect(p.bottom).toBeGreaterThan(window.innerHeight - 60)
    }
    expect(document.querySelector('.bar__sub')).toBeNull()
    expect(document.querySelector('.platform-card')).toBeNull()
  })

  it('draws JLPT as a line of five rows sharing the plate, the learner\'s own marked', async () => {
    await mount()
    const [jlpt] = plates()
    const rs = rows(jlpt)
    expect(rs.map(r => r.getAttribute('href'))).toEqual(['N5', 'N4', 'N3', 'N2', 'N1'].map(l => `/learn/vocab/${l}`))
    const hs = rs.map(r => r.getBoundingClientRect().height)
    for (const h of hs) expect(Math.abs(h - hs[0])).toBeLessThan(2)
    expect(rs[0].getAttribute('aria-current')).toBe('location')
    expect(rs[0].textContent).toContain('31 commencées')
    expect(jlpt.querySelector('.desk-source__fig').textContent).toMatch(/12\s*\/\s*8045/)
  })

  it('opens a stop by pushing, so Back comes back to the plates', async () => {
    await mount()
    rows(plates()[0])[1].click()
    await settle()
    expect(where.path).toBe('/learn/vocab/N4')
    expect(where.type).toBe('PUSH')
  })

  it('walks a plate\'s rows with the arrows, one tab stop a plate', async () => {
    await mount()
    const rs = rows(plates()[0])
    expect(rs.filter(r => r.tabIndex === 0)).toHaveLength(1)
    rs[0].focus()
    rs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(rs[1])
  })

  it('lists the tiers under their pool and size, each with the cards met in it, scrolling in the plate', async () => {
    await mount()
    const freq = plates()[1]
    const rs = rows(freq)
    expect(rs).toHaveLength(41)
    expect(rs[0].getAttribute('href')).toBe('/learn/vocab/tier/1?size=200')
    expect(rs[0].querySelector('.desk-source__num').textContent).toBe('18 commencées')
    expect(rs[1].querySelector('.desk-source__num')).toBeNull()
    const list = freq.querySelector('.desk-source__rows')
    expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)
    // Another pool is another line; another size re-cuts it. Both ride
    // in the page's URL and in every row's link.
    const pool = [...freq.querySelectorAll('.desk-source__tools > .seg [role="radio"]')]
    pool[1].click()
    await settle()
    expect(where.search).toBe('?domain=jmdict')
    expect(rows(plates()[1])).toHaveLength(60)
    expect(rows(plates()[1])[0].getAttribute('href')).toBe('/learn/vocab/tier/1?size=200&domain=jmdict')
    // The size under the pool, as wide as it (square since 2026-09-26,
    // like every switch), with no caption over it: its name is the
    // switch's label.
    const sizeRow = plates()[1].querySelector('.desk-source__size')
    expect(sizeRow.querySelector('.cap')).toBeNull()
    expect(sizeRow.querySelector('.seg').getAttribute('aria-label')).toBeTruthy()
    expect(Math.round(sizeRow.querySelector('.seg').getBoundingClientRect().width))
      .toBe(Math.round(plates()[1].querySelector('.desk-source__tools > .seg').getBoundingClientRect().width))
    const size = [...sizeRow.querySelectorAll('.seg [role="radio"]')].find(r => r.textContent === '500')
    size.click()
    await settle()
    expect(where.search).toBe('?size=500&domain=jmdict')
    expect(rows(plates()[1])[0].getAttribute('href')).toBe('/learn/vocab/tier/1?size=500&domain=jmdict')
  })

  it('lists the themes under their filter, each a link to its bands', async () => {
    await mount()
    const themes = plates()[2]
    expect(rows(themes)).toHaveLength(12)
    expect(rows(themes)[0].getAttribute('href')).toBe('/learn/vocab/theme/animals')
    const input = themes.querySelector('input')
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setValue.call(input, 'fam')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(50)
    expect(rows(themes).map(r => r.getAttribute('href'))).toEqual(['/learn/vocab/theme/family'])
  })
})
