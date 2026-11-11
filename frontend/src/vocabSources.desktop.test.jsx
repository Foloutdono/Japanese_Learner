import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation, useNavigationType } from 'react-router-dom'
import { LangProvider } from './LangContext'
// The faces main.jsx loads: the gate's width is its label's, and the
// runner's fallback sets « Reprendre » narrower than Space Grotesk does.
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import './index.css'

// ── 机 — the vocabulary's sources, doors all the way down (plan 267) ──
// The owner's pick C3 of the canvas "Tsuji — the sources and the line,
// redrawn". JLPT heads the page as five doors, the gate that resumes the
// learner's level the line's last; under it the tiers as doors in a
// lattice beside their pool and size, and the themes as doors under
// their filter. Every door pushes. This is the narrowest desk
// (1100×800), where the gate takes a row of its own under the doors.
// The phone keeps its three cards (deskfree.phone).

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

afterEach(() => {
  SUMMARY.jlptLevel = 'N5'
})

describe('the vocabulary\'s sources on the desk (plan 267)', () => {
  it('heads the page with the doors over the two bands, down to the window\'s foot and no further', async () => {
    await mount()
    const d = box($('.desk-linedoors'))
    const t = box(tierBand())
    const th = box(themeBand())
    expect(t.top).toBeGreaterThan(d.bottom)
    expect(th.top).toBeGreaterThan(t.bottom)
    for (const b of [t, th]) {
      expect(near(b.left, d.left)).toBe(true)
      expect(near(b.width, d.width)).toBe(true)
    }
    expect(th.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(th.bottom).toBeGreaterThan(window.innerHeight - 60)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    // The strip and the JLPT plate are gone: the doors say the level once.
    expect($('.desk-resume, .desk-sources__lower')).toBeNull()
    expect($('.bar__sub')).toBeNull()
  })

  it('draws JLPT as five doors on one row, the learner\'s own captioned, each a push to its stop', async () => {
    await mount()
    const ds = doors()
    expect(ds.map(r => r.getAttribute('href'))).toEqual(['N5', 'N4', 'N3', 'N2', 'N1'].map(l => `/learn/vocab/${l}`))
    const bs = ds.map(box)
    for (const [i, b] of bs.entries()) {
      expect(near(b.top, bs[0].top)).toBe(true)
      expect(near(b.height, bs[0].height)).toBe(true)
      if (i) expect(b.left).toBeGreaterThanOrEqual(bs[i - 1].right - 1)
    }
    expect(ds[0].getAttribute('aria-current')).toBe('location')
    expect(ds[0].querySelector('.route-stop__here').textContent).toBe('Tu es ici')
    expect(ds.slice(1).every(d => !d.querySelector('.route-stop__here'))).toBe(true)
    expect(ds[0].querySelector('.route-stop__fig').textContent).toMatch(/12\s*\/\s*674/)
    expect(parseFloat(ds[0].querySelector('.desk-line__met').style.width)).toBeCloseTo((100 * 31) / 674, 1)
    expect(parseFloat(ds[0].querySelector('.desk-line__learned').style.width)).toBeCloseTo((100 * 12) / 674, 1)
    // Each name whole, on two lines where the door is narrow.
    for (const d of ds) {
      const name = d.querySelector('.route-stop__jp')
      expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth + 1)
    }
    // One tab stop, the learner's level, walked with ←/→; a door pushes.
    expect(ds.filter(d => d.tabIndex === 0)).toEqual([ds[0]])
    ds[0].focus()
    ds[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(ds[1])
    ds[1].click()
    await settle(50)
    expect(where.path).toBe('/learn/vocab/N4')
    expect(where.type).toBe('PUSH')
  })

  it('stands the gate in a row of its own under the doors, at the line\'s far end, and boards the learner\'s level', async () => {
    await mount()
    const g = box(gateCell())
    const line = box($('.desk-linedoors__line'))
    expect(g.top).toBeGreaterThanOrEqual(line.bottom - 1)
    const gate = gateCell().querySelector('button.btn-depart--gate')
    expect(box(gate).right).toBeGreaterThan(line.right - 80)
    expect(gateInside()).toBe(true)
    expect(gate.textContent).toContain('Reprendre N5')
    expect(gateCell().querySelector('.desk-source__num').textContent).toBe('643 jamais vues')
    // The gate boards the level's first platform, the main flashcards.
    gate.click()
    await settle(50)
    expect(where.path).toBe('/learn/vocab/N5/vocab.flashcard.f2b')
  })

  it('offers somewhere to go on with nothing met: the level the learner chose, to start', async () => {
    SUMMARY.jlptLevel = 'N4'
    await mount()
    expect(gateCell().querySelector('button.btn-depart--gate').textContent).toContain('Commencer N4')
    expect(gateCell().querySelector('.desk-source__num').textContent).toBe('642 jamais vues')
    expect(doors()[1].querySelector('.route-stop__here').textContent).toBe('Tu es ici')
  })

  it('draws the tiers as doors in a lattice beside their pool and size, the met ones lit, named and filled', async () => {
    await mount()
    const head = box(tierBand().querySelector('.desk-band__head'))
    const cs = cells()
    expect(cs).toHaveLength(41)
    expect(box(cs[0]).left).toBeGreaterThan(head.right - 1)
    const grid = cs[0].parentElement
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length
    expect(columns).toBeGreaterThanOrEqual(10)
    expect(cs[0].getAttribute('href')).toBe('/learn/vocab/tier/1?size=200')
    expect(cs[0].getAttribute('aria-label')).toBe('Palier 1 · Mots 1–200 · 18 commencées')
    expect(cs[0].classList.contains('desk-source__cell--met')).toBe(true)
    expect(cs[0].querySelector('.desk-source__cell-met').textContent).toBe('18')
    expect(parseFloat(cs[0].querySelector('.desk-source__cell-fill').style.width)).toBeCloseTo(9, 1)
    expect(cs[1].getAttribute('aria-label')).toBe('Palier 2 · Mots 201–400')
    expect(cs[1].querySelector('.desk-source__cell-met')).toBeNull()
    // Joined doors: no gap wider than a seam between two of a row.
    expect(box(cs[1]).left - box(cs[0]).right).toBeLessThanOrEqual(1.5)
    for (const c of cs) {
      const r = box(c)
      expect(r.height).toBeGreaterThanOrEqual(43)
      expect(r.width).toBeGreaterThanOrEqual(43)
    }
    // Three rows at most: past them the lattice scrolls in its band.
    expect(grid.clientHeight).toBeLessThanOrEqual(3 * box(cs[0]).height + 4)
    // One tab stop, walked in two dimensions.
    expect(cs.filter(c => c.tabIndex === 0)).toHaveLength(1)
    cs[0].focus()
    grid.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(cs[1])
    cs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    expect(document.activeElement).toBe(cs[1 + columns])
  })

  it('cuts the tiers by the pool and the size, in the URL and every door', async () => {
    await mount()
    const pool = [...tierBand().querySelectorAll('.desk-band__head > .seg [role="radio"]')]
    pool[1].click()
    await settle()
    expect(where.search).toBe('?domain=jmdict')
    expect(cells()).toHaveLength(300)
    expect(cells()[0].getAttribute('href')).toBe('/learn/vocab/tier/1?size=200&domain=jmdict')
    const grid = cells()[0].parentElement
    expect(grid.scrollHeight).toBeGreaterThan(grid.clientHeight)
    // The size under the pool, as wide as it, with no caption over it:
    // its name is the switch's label.
    const sizeRow = tierBand().querySelector('.desk-source__size')
    expect(sizeRow.querySelector('.cap')).toBeNull()
    expect(sizeRow.querySelector('.seg').getAttribute('aria-label')).toBeTruthy()
    expect(Math.round(box(sizeRow.querySelector('.seg')).width))
      .toBe(Math.round(box(tierBand().querySelector('.desk-band__head > .seg')).width))
    const size = [...sizeRow.querySelectorAll('.seg [role="radio"]')].find(r => r.textContent === '500')
    size.click()
    await settle()
    expect(where.search).toBe('?size=500&domain=jmdict')
    expect(cells()[0].getAttribute('href')).toBe('/learn/vocab/tier/1?size=500&domain=jmdict')
  })

  it('lists the themes as doors under their filter, several to a row, each a push to its bands', async () => {
    await mount()
    const rs = themes()
    expect(rs).toHaveLength(12)
    expect(rs[0].getAttribute('href')).toBe('/learn/vocab/theme/animals')
    const [a, b] = rs.map(box)
    expect(near(a.top, b.top)).toBe(true)
    expect(b.left).toBeGreaterThan(a.right - 1)
    for (const r of rs) {
      const label = r.querySelector('.desk-source__label')
      expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth)
    }
    const input = themeBand().querySelector('input')
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setValue.call(input, 'fam')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await settle(50)
    expect(themes().map(r => r.getAttribute('href'))).toEqual(['/learn/vocab/theme/family'])
    themes()[0].click()
    await settle(50)
    expect(where.path).toBe('/learn/vocab/theme/family')
    expect(where.type).toBe('PUSH')
  })

  it('shows the wait in the tiers\' band until the ranking arrives, not an empty band', async () => {
    let release
    const held = new Promise(r => { release = r })
    apiFetch.mockImplementation(async path => {
      if (path.startsWith('/api/frequency/vocab/tiers?')) await held
      return { ok: true, status: 200, json: async () => answer(path) }
    })
    await mount()
    expect(tierBand().querySelector('.loading')).not.toBeNull()
    expect(tierBand().querySelector('.desk-source__cells')).toBeNull()
    release()
    await settle(100)
    expect(tierBand().querySelector('.loading')).toBeNull()
    expect(cells().length).toBeGreaterThan(0)
    apiFetch.mockImplementation(async path => ({ ok: true, status: 200, json: async () => answer(path) }))
  })
})
