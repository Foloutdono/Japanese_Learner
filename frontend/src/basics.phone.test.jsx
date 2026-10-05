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

// ── 基礎 on a phone (plan 186g) ───────────────────────────────────
// The station lists the fourteen units as a route, the one at hand
// ringed; a unit is its own screen, its cards and the gate; the gate
// rides Today's run held to the unit.
describe('the basics, on a phone', () => {
  it('lists the units as a route, the unit at hand ringed', async () => {
    await mount('/learn/basics')
    await settle()
    const stops = [...document.querySelectorAll('.route-stop')]
    expect(stops).toHaveLength(14)
    const here = document.querySelector('.route-stop--current')
    expect(here.textContent).toContain('数')
    expect(document.querySelectorAll('.route-stop--past')).toHaveLength(2)
    stops[2].click()
    await settle()
    expect(where()).toBe('/learn/basics/kazu')
  })

  it('draws a unit: its rules, words and kanji, each with its bar, then the gate', async () => {
    await mount('/learn/basics/kazu')
    await settle()
    expect(apiJson.mock.calls.some(([u]) => u === '/api/basics/kazu?lang=fr')).toBe(true)
    const lists = [...document.querySelectorAll('.bsc-list')]
    expect(lists).toHaveLength(4)
    expect(document.querySelectorAll('.bsc-row')).toHaveLength(5)
    expect(document.querySelector('[data-card="vocab_N5_一_いち"] .bsc-row__bar > i').style.width).toBe('20%')
    // A word written in kana alone prints no reading beside itself.
    expect(document.querySelector('[data-card="vocab_N5__いくら"] .bsc-row__reading')).toBeNull()
    // No translation from a bank that has none in French.
    expect(document.querySelector('.bsc-sentence__tr')).toBeNull()
    // Nothing runs past the phone's width.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    document.querySelector('[data-action="basics-depart"]').click()
    await settle()
    expect(where()).toBe('/today/run?unit=kazu')
  })

  it('sends an unknown unit back to the station', async () => {
    await mount('/learn/basics/nope')
    await settle()
    expect(where()).toBe('/learn/basics')
  })
})
