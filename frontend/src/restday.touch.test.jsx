import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 運休 and 記念切符 on a short phone (plan 191) ──────────────────────
// 390×667, a thumb: the rest-day notice's air gives way first, so the
// whole notice and its gate stand on the screen; the tickets' book and
// gate too, nothing clipped and nothing past the edges.

vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn() }))
vi.mock('./lib/shareTicket', async o => ({ ...(await o()), renderTicketPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })) }))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { DeskShellStage } = await import('./components/chrome/Shell')
const { default: DayClearPreview } = await import('./screens/DayClearPreview')

const settle = (ms = 500) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)

beforeEach(() => {
  document.body.innerHTML = ''
  document.documentElement.style.scrollbarGutter = 'auto'
  try { localStorage.setItem('lang', 'fr') } catch { /* private mode */ }
})

function mount(query) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[`/dev/dayclear${query}`]}>
        <Routes>
          <Route element={<DeskShellStage />}>
            <Route path="/dev/dayclear" element={<DayClearPreview />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

describe('at 390×667', () => {
  it('stands the rest-day notice whole: the air gives way, not the content', async () => {
    await mount('?scene=restday&bare=1&reduced=1')
    await settle()
    const gate = $('.rst-gatewrap .btn-depart--gate').getBoundingClientRect()
    expect(gate.bottom).toBeLessThanOrEqual(667)
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(667)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    // The air over the rally shrank from the board's 124px.
    const air = $('.rst-air--top').getBoundingClientRect().height
    expect(air).toBeLessThan(124)
    expect(air).toBeGreaterThanOrEqual(16)
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
