import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 記念切符 and 運休 on the desk (plan 191) ───────────────────────────
// Profile › Billets beside the rail: the head over two columns, the
// ticket held up (its line and the gate under it) beside the book of
// tickets, side by side as the profile's holder opens flat. And the
// rest-day notice: the phone's composition at the board's width,
// centred in the gate's column, the gate at the window's foot. Both
// from the workbench, with no backend, in the route's own frame.

vi.mock('./lib/audio', async o => ({ ...(await o()), playDayClear: vi.fn(), playMilestone: vi.fn(), playArrival: vi.fn(), playClick: vi.fn() }))
vi.mock('./lib/shareTicket', async o => ({ ...(await o()), renderTicketPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })) }))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { DeskShellStage } = await import('./components/chrome/Shell')
const { default: DayClearPreview } = await import('./screens/DayClearPreview')

const settle = (ms = 200) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]
const box = sel => $(sel).getBoundingClientRect()

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

describe('the tickets on the desk', () => {
  it('stands the ticket and the book side by side beside the rail', async () => {
    await mount('?scene=tickets&bare=1&reduced=1')
    await settle(500)
    expect($('.phone--desk .desk-rail')).not.toBeNull()
    expect($('.phone__content > main.tkb')).not.toBeNull()
    const head = box('.tkb-head')
    const hero = box('.tkb-hero')
    const book = box('.tkb-book')
    const gate = box('.tkb-foot .btn-depart--gate')
    // The head over both columns; the hero beside the book, top-aligned.
    expect(head.bottom).toBeLessThanOrEqual(hero.top)
    expect(book.left).toBeGreaterThan(hero.right)
    expect(Math.round(book.top)).toBe(Math.round(hero.top))
    // The gate under the ticket held up, in its column, its Enter printed.
    expect(gate.top).toBeGreaterThan(hero.bottom)
    expect(Math.round(gate.left)).toBe(Math.round(hero.left))
    expect($('.tkb-foot .btn-depart--gate .desk-kbd')).not.toBeNull()
    // The book still four across and two rows of the board's 144px.
    const cells = $$('.tkb-book > li').map(li => li.getBoundingClientRect())
    expect(cells).toHaveLength(8)
    expect(new Set(cells.slice(0, 4).map(c => Math.round(c.top))).size).toBe(1)
    expect(Math.round(cells[0].height)).toBe(144)
    // Nothing past the window.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    expect(gate.bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  it('flips a picked ticket into the hero on the desk too', async () => {
    await mount('?scene=tickets&bare=1')
    await settle(1400)
    $$('.tkb-pick')[0].click()
    await settle()
    expect($('.tkb-hero .clrk-tk__big').textContent).toBe('三日')
    expect($('.tkb-range').textContent).toBe('du 12 au 14 septembre')
  })
})

describe('the rest-day notice on the desk', () => {
  it('draws the phone\'s composition, centred in the gate\'s column, its gate at the foot', async () => {
    await mount('?scene=restday&bare=1&reduced=1')
    await settle(500)
    const rest = box('main.today > .rst')
    expect(Math.round(rest.width)).toBe(390)
    const column = $('main.today').getBoundingClientRect()
    // The gate's column: the today grid's first track.
    const first = parseFloat(getComputedStyle($('main.today')).gridTemplateColumns.split(' ')[0])
    const padding = parseFloat(getComputedStyle($('main.today')).paddingLeft)
    expect(Math.abs((rest.left + rest.right) / 2 - (column.left + padding + first / 2))).toBeLessThan(2)
    const gate = box('.rst-gatewrap .btn-depart--gate')
    expect(gate.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(window.innerHeight - gate.bottom).toBeLessThan(80)
    expect($('.rst-gatewrap .desk-kbd')).not.toBeNull()
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight)
  })
})
