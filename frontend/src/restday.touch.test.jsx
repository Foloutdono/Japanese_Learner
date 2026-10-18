import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 運休 and 記念切符 on a short phone (plans 191, 250b) ───────────────
// 390×667, a thumb, under the Shell's bars as Today shows the notice:
// its air gives way first, then the hero's own rhythm, so the whole
// notice and its gate stand between the bars; on a phone shorter still
// the column scrolls under its foot, docked on the tab bar. The
// tickets' book and gate too, nothing clipped and nothing past the
// edges.

vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn() }))
vi.mock('./lib/shareTicket', async o => ({ ...(await o()), renderTicketPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })) }))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { Shell } = await import('./components/chrome/Shell')
const { default: DayClearPreview } = await import('./screens/DayClearPreview')

const settle = (ms = 500) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)

beforeEach(() => {
  document.body.innerHTML = ''
  document.documentElement.style.scrollbarGutter = 'auto'
  try { localStorage.setItem('lang', 'fr') } catch { /* private mode */ }
})

afterEach(async () => {
  document.scrollingElement.scrollTop = 0
  await page.viewport(390, 667)
})

const top = sel => $(sel).getBoundingClientRect().top
const bottom = sel => $(sel).getBoundingClientRect().bottom

function mount(query) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[`/dev/dayclear${query}`]}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/dev/dayclear" element={<DayClearPreview />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('at 390×667', () => {
  it('stands the rest-day notice whole between the bars: the air gives way, not the content', async () => {
    await mount('?scene=restday&bare=1&reduced=1')
    await settle()
    expect($('.hud')).not.toBeNull()
    expect(bottom('.rst-gatewrap .btn-depart--gate')).toBeLessThanOrEqual(top('.tabbar'))
    expect(top('.rst-head')).toBeGreaterThanOrEqual(bottom('.hud'))
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(667)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    // The air over the rally shrank from the board's 124px, and the
    // hero's rhythm from its 28 and 44 -- each to no less than a rung.
    const air = $('.rst-air--top').getBoundingClientRect().height
    expect(air).toBeLessThan(124)
    expect(air).toBeGreaterThanOrEqual(16)
    const [over, under] = [...document.querySelectorAll('.rst-air--in')].map(n => n.getBoundingClientRect().height)
    expect(over).toBeLessThan(28)
    expect(under).toBeLessThan(44)
    expect(Math.min(over, under)).toBeGreaterThanOrEqual(12)
  })

  it('docks the foot on the tab bar where the notice cannot stand whole', async () => {
    await page.viewport(360, 600)
    await mount('?scene=restday&bare=1&reduced=1')
    await settle()
    // The column scrolls; the gate stays on the screen over the tab bar.
    expect(document.documentElement.scrollHeight).toBeGreaterThan(600)
    expect(bottom('.rst-gatewrap .btn-depart--gate')).toBeLessThanOrEqual(top('.tabbar'))
    expect(top('.rst-gatewrap .btn-depart--gate')).toBeGreaterThan(bottom('.hud'))
    // Scrolled to its end, what the foot stood over comes out above it.
    document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight
    await settle(100)
    expect(bottom('.rst-reserve')).toBeLessThanOrEqual(top('.rst-low'))
    expect(bottom('.rst-low')).toBeLessThanOrEqual(top('.tabbar') + 1)
  })

  it('lays the tickets out with nothing past the edges, the gate reachable', async () => {
    await mount('?scene=tickets&bare=1&reduced=1')
    await settle()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    const book = $('.tkb-book').getBoundingClientRect()
    const hero = $('.tkb-meta').getBoundingClientRect()
    const gate = $('.tkb-foot .btn-depart--gate').getBoundingClientRect()
    expect(book.top).toBeGreaterThan(hero.bottom)
    expect(gate.top).toBeGreaterThan(book.bottom)
  })
})
