import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { BASICS, KAZU } from './testing/basics'
import './index.css'

const apiJson = vi.hoisted(() => vi.fn())
vi.mock('./lib/api', async o => ({ ...(await o()), apiJson: (...a) => apiJson(...a) }))
vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), startAmbiance: vi.fn(), stopAmbiance: vi.fn() }))
vi.mock('./stores/boarding', async o => ({ ...(await o()), board: c => c() }))
vi.mock('./stores/basics', () => ({
  useBasics: () => ({ data: BASICS, failed: false }),
  refreshBasics: vi.fn(),
}))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: BasicsScreen } = await import('./screens/BasicsScreen')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))

function Where() {
  const { pathname, search } = useLocation()
  return <output data-testid="where">{pathname + search}</output>
}

function mount(path) {
  apiJson.mockImplementation(async url => (url.startsWith('/api/basics/kazu') ? KAZU : {}))
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/learn/basics" element={<BasicsScreen session={{ access_token: 't' }} />} />
          <Route path="/learn/basics/:unit" element={<BasicsScreen session={{ access_token: 't' }} />} />
          <Route path="*" element={null} />
        </Routes>
        <Where />
      </MemoryRouter>
    </LangProvider>
  )
}
const where = () => document.querySelector('[data-testid="where"]').textContent

// ── 基礎 on the desk (plan 186g) ──────────────────────────────────
// The units stand beside the open unit (StationSplit), each a link that
// replaces the page; the bare station opens on the unit at hand.
describe('the basics, on the desk', () => {
  it('opens on the unit at hand, the units beside it', async () => {
    await mount('/learn/basics')
    await settle()
    expect(where()).toBe('/learn/basics/kazu')
    const split = document.querySelector('.desk-split')
    expect(split).not.toBeNull()
    const links = [...split.querySelectorAll('.desk-split__list a.route-stop')]
    expect(links).toHaveLength(14)
    expect(links[2].getAttribute('aria-current')).toBe('page')
    expect(links[3].getAttribute('href')).toBe('/learn/basics/masu')
    expect(split.querySelector('.desk-split__page .bsc-unit')).not.toBeNull()
    // The list and the page side by side.
    const list = split.querySelector('.desk-split__list').getBoundingClientRect()
    const page = split.querySelector('.desk-split__page').getBoundingClientRect()
    expect(page.left).toBeGreaterThanOrEqual(list.right)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })
})
