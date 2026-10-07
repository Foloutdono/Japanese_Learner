import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 運休 and 記念切符 on the short desk (plans 169, 191) ──────────────
// A 1280×600 window: the rest-day notice gives its air first and its
// streak and reserve a rung, so the gate still stands in the window;
// the tickets' two columns stand whole.

vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn() }))
vi.mock('./lib/shareTicket', async o => ({ ...(await o()), renderTicketPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })) }))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { DeskShellStage } = await import('./components/chrome/Shell')
const { default: DayClearPreview } = await import('./screens/DayClearPreview')

const settle = (ms = 500) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)

beforeEach(() => {
  document.body.innerHTML = ''
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

describe('on a 1280×600 window', () => {
  it('stands the rest-day notice whole, its gate in the window', async () => {
    await mount('?scene=restday&bare=1&reduced=1')
    await settle()
    const gate = $('.rst-gatewrap .btn-depart--gate').getBoundingClientRect()
    expect(gate.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect($('.rst-head').getBoundingClientRect().top).toBeGreaterThanOrEqual(0)
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight)
    // The rally clear of the head, the today card clear of the reserve.
    expect($('.rst-rally').getBoundingClientRect().top).toBeGreaterThan($('.rst-head').getBoundingClientRect().bottom)
    expect($('.rst-today').getBoundingClientRect().top).toBeGreaterThan($('.rst-reserve').getBoundingClientRect().bottom)
  })

  it('stands the tickets whole', async () => {
    await mount('?scene=tickets&bare=1&reduced=1')
    await settle()
    const gate = $('.tkb-foot .btn-depart--gate').getBoundingClientRect()
    const book = $('.tkb-book').getBoundingClientRect()
    expect(gate.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(book.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })
})
