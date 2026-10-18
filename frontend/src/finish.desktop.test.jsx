import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 終着 — the day's run, finished on Today, on the desk (plan 247) ───
// The desk keeps its rail while a finish plays (the phone's bars step
// away, the rail never does); the gate's column draws the finish on the
// print and the services' board comes back beside it at the chrome
// beat. Enter skips to the rest as a tap does. The month's gold ticket
// stands under the moon clear of the board. From the workbench, with no
// backend, in the Shell as the app has it.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playStamp: vi.fn(), playDayClear: vi.fn(), playMilestone: vi.fn(), playPassClip: vi.fn(), playArrival: vi.fn(), playClick: vi.fn(),
}))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { Shell } = await import('./components/chrome/Shell')
const { default: DayClearPreview } = await import('./screens/DayClearPreview')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const box = sel => $(sel).getBoundingClientRect()

async function until(fn, ms = 4000) {
  const end = Date.now() + ms
  while (!fn() && Date.now() < end) await settle(25)
  return fn()
}

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

describe('the finish on the desk', () => {
  it('plays beside the rail, the services\' board coming back at its beat', async () => {
    await mount('?scene=day&bare=1')
    expect(await until(() => $('.tdy--fin.tdy--desk'))).toBeTruthy()
    // The rail stays; the phone's bars are not the desk's.
    expect($('.phone--desk .desk-rail')).not.toBeNull()
    expect($('.hud')).toBeNull()
    expect($('.tdy-desk__col')).toBeNull()
    expect(await until(() => $('.tdy-desk__col'))).toBeTruthy()
    expect($('.phone--desk .desk-rail')).not.toBeNull()
    // At rest: the board and the shut gate at the window's foot.
    const gate = await until(() => $('.tdy-desk__go .btn-depart--gate'))
    expect(gate.disabled).toBe(true)
    expect(gate.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  it('skips to the rest on Enter', async () => {
    await mount('?scene=ticket7&bare=1')
    expect(await until(() => $('.tdy--fin'))).toBeTruthy()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await settle(80)
    expect($('.tdy--fin.clrk--skip')).not.toBeNull()
    expect($('.tdy-next--ticket')).not.toBeNull()
    expect($('.tdy-desk__col')).not.toBeNull()
  })

  it('stands the month\'s ticket under the moon, clear of the board', async () => {
    await mount('?scene=month30&bare=1&reduced=1')
    expect(await until(() => $('.tdy-mtkt') && $('.tdy-board'))).toBeTruthy()
    await settle(200)
    const ticket = box('.tdy-mtkt')
    expect(ticket.top).toBeGreaterThan(box('.tdy-dial__gate').bottom)
    expect(ticket.bottom).toBeLessThanOrEqual(box('.tdy-board').top)
    expect(box('.tdy-desk__go .btn-depart--gate').bottom).toBeLessThanOrEqual(window.innerHeight)
  })
})
