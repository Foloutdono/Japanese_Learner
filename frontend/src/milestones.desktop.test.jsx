import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 記念 on the desk (plan 191) ───────────────────────────────────────
// Beside the real rail the milestone ceremonies take the content area:
// the composition centred at the phone board's width, the month's
// night, station and fireworks sky across all of it. Enter skips the
// ceremony, and at rest keeps the ticket.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playMilestone: vi.fn(), playPassClip: vi.fn(), playFareTick: vi.fn(), playDayClear: vi.fn(),
  playArrival: vi.fn(), playClick: vi.fn(),
}))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { default: MilestoneTicket } = await import('./components/dayclear/MilestoneTicket')
const { default: MilestoneMonth } = await import('./components/dayclear/MilestoneMonth')
const { DeskShellStage } = await import('./components/chrome/Shell')
const { default: DayClearPreview } = await import('./screens/DayClearPreview')
const { clearModel } = await import('./domain/dayClear')
const F = await import('./components/dayclear/fixtures')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const rect = sel => $(sel).getBoundingClientRect()
const enter = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

function mount(Screen, { result, run = F.RUN_TICKET7, ...props }) {
  const handlers = { onKeep: vi.fn(), onShare: vi.fn(), onFareBeat: vi.fn() }
  render(
    <LangProvider>
      <Screen result={result} run={run} model={clearModel(result, run)} desk {...handlers} {...props} />
    </LangProvider>
  )
  return handlers
}

function preview(query) {
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

// What a fixed box is laid out in: the window less the scrollbar gutter.
function viewport() {
  const probe = document.createElement('div')
  probe.style.cssText = 'position: fixed; inset: 0'
  document.body.appendChild(probe)
  const box = probe.getBoundingClientRect()
  probe.remove()
  return box
}

function whole(sels, area) {
  for (const sel of sels) {
    const r = rect(sel)
    expect(r.top, `${sel} top`).toBeGreaterThanOrEqual(area.top - 0.5)
    expect(r.bottom, `${sel} bottom`).toBeLessThanOrEqual(area.bottom + 0.5)
    expect(r.left, `${sel} left`).toBeGreaterThanOrEqual(area.left - 0.5)
    expect(r.right, `${sel} right`).toBeLessThanOrEqual(area.right + 0.5)
  }
}

beforeEach(() => vi.clearAllMocks())

describe('the milestones beside the rail', () => {
  it('stands the week\'s ticket in the content area, centred at the board\'s width', async () => {
    preview('?scene=ticket7&reduced=1')
    await settle(200)
    const rail = rect('.desk-rail')
    const main = rect('main.ms-ticket.ms-ticket--desk')
    expect(main.left).toBeCloseTo(rail.right, 0)
    const col = rect('.ms-col')
    expect(col.width).toBeCloseTo(390, 0)
    expect(col.left + col.width / 2).toBeCloseTo(main.left + main.width / 2, 0)
    whole(['.ms-t-hdr', '.ms-t-stn:first-child', '.ms-t-stn:last-child', '.ms-t-fare', '.clrk-tk', '.ms-t-rest', '.btn-depart--gate'], main)
    expect($('.btn-depart--gate .desk-kbd')).not.toBeNull()
  })

  it('spreads the month\'s night, station and sky across the content area', async () => {
    preview('?scene=month30')
    await settle(400)
    const main = rect('main.ms-month.ms-month--desk')
    expect(rect('.ms-m-night').width).toBeGreaterThanOrEqual(main.width)
    expect(rect('.ms-m-station').width).toBeCloseTo(main.width, 0)
    expect(rect('.ms-fw').width).toBeCloseTo(main.width, 0)
    // More windows on the wider hall, the door still in the middle.
    expect(document.querySelectorAll('.ms-m-win').length).toBeGreaterThan(11)
    const door = rect('.ms-m-win--door')
    expect(door.left + door.width / 2).toBeCloseTo(main.left + main.width / 2, -1)
    // The composition in its column, centred.
    const col = rect('.ms-col')
    expect(col.left + col.width / 2).toBeCloseTo(main.left + main.width / 2, 0)
  })

  it('stands the month whole at rest', async () => {
    preview('?scene=month30&reduced=1')
    await settle(200)
    expect(document.querySelector('main.ms-month canvas')).toBeNull()
    whole(['.ms-m-sheet', '.clrk-tk--gold', '.ms-m-total', '.ms-m-break', '.ms-m-actions .clrk-quiet', '.ms-m-actions .btn-depart--gate'], viewport())
  })

  it('Enter skips the ceremony, then keeps the ticket', async () => {
    const { onKeep } = mount(MilestoneTicket, { result: F.CLEAR_TICKET7, reduced: false })
    await settle(300)
    enter()
    await settle(150)
    expect($('main.ms-ticket.clrk--skip')).not.toBeNull()
    expect(onKeep).not.toHaveBeenCalled()
    enter()
    await settle(50)
    expect(onKeep).toHaveBeenCalledTimes(1)
  })

  it('Enter skips the month, and the show plays on; then keeps the ticket', async () => {
    const { onKeep, onFareBeat } = mount(MilestoneMonth, { result: F.CLEAR_MONTH30, run: F.RUN_MONTH30, reduced: false })
    await settle(300)
    enter()
    await settle(150)
    expect($('main.ms-month.clrk--skip')).not.toBeNull()
    expect(onFareBeat).toHaveBeenCalledTimes(1)
    expect(document.querySelectorAll('.ms-fw canvas')).toHaveLength(2)
    enter()
    await settle(50)
    expect(onKeep).toHaveBeenCalledTimes(1)
  })
})
