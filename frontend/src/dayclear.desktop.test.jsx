import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 終着 on the desk (plan 191) ───────────────────────────────────────
// The day cleared is drawn beside the real rail on the desk (the route's
// frame is the Shell at 1100px and up), not full screen as on a phone;
// the workbench plays it the same way, with no backend.

vi.mock('./lib/audio', async o => ({ ...(await o()), playDayClear: vi.fn(), playMilestone: vi.fn(), playArrival: vi.fn(), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { DeskShellStage } = await import('./components/chrome/Shell')
const { default: DayClearPreview } = await import('./screens/DayClearPreview')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))

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

describe('/dev/dayclear on the desk', () => {
  it('stands the everyday clear beside the rail', async () => {
    const screen = await mount('?scene=day')
    await settle()
    expect(document.querySelector('.phone--desk .desk-rail')).not.toBeNull()
    const clear = screen.container.querySelector('.phone__content main.clr-desk')
    expect(clear).not.toBeNull()
    expect(clear.querySelectorAll('.clr-desk__grid > li')).toHaveLength(32)
    expect(clear.querySelector('.btn-depart--gate .desk-kbd')).not.toBeNull()
  })

  it('stands the month\'s ceremony in the content area', async () => {
    const screen = await mount('?scene=month30')
    await settle()
    expect(screen.container.querySelector('.phone__content main.ms-month')).not.toBeNull()
    expect(screen.container.querySelector('.clrk-tk--gold')).not.toBeNull()
  })
})
