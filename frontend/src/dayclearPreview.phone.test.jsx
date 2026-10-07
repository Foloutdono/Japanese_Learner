import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 試写 — /dev/dayclear plays every scene with no backend (plan 191) ──
// The workbench the screens are reviewed and filmed on: each scene of
// the canvas "Tsuji — the day cleared" from its own fixtures, at a
// phone's width, with nothing to fetch.

vi.mock('./lib/audio', async o => ({ ...(await o()), playDayClear: vi.fn(), playMilestone: vi.fn(), playArrival: vi.fn(), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { DeskShellStage } = await import('./components/chrome/Shell')
const { default: DayClearPreview } = await import('./screens/DayClearPreview')

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))

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

const SCENES = {
  day: 'main.clr-phone',
  ticket3: 'main.ms-ticket',
  ticket7: 'main.ms-ticket',
  ticket14: 'main.ms-ticket',
  month30: 'main.ms-month',
  month100: 'main.ms-month',
  partial: 'main.ptl',
  restday: 'section.rst',
  tickets: 'main.tkb',
  share: 'main.clrdev-share',
}

// A milestone day plays the everyday clear's sweep and stamp first, then
// hands the screen to its own ceremony; a tap hands over at once.
const MILESTONES = new Set(['ticket3', 'ticket7', 'ticket14', 'month30', 'month100'])

describe('/dev/dayclear at a phone\'s width', () => {
  for (const [scene, root] of Object.entries(SCENES)) {
    it(`plays ${scene} from its fixtures`, async () => {
      const screen = await mount(`?scene=${scene}`)
      await settle()
      if (MILESTONES.has(scene)) {
        const clear = screen.container.querySelector('main.clr-phone')
        expect(clear, 'main.clr-phone').not.toBeNull()
        clear.click()
        await settle()
      }
      expect(screen.container.querySelector(root), root).not.toBeNull()
      // The stage frame: no HUD, no tab bar on a phone.
      expect(document.querySelector('.phone--stage')).not.toBeNull()
    })
  }

  it('sweeps the run onto two piles when asked (a bar with no Perfect)', async () => {
    const screen = await mount('?scene=day&piles=2&reduced=1')
    await settle()
    const piles = [...screen.container.querySelectorAll('main.clr-phone .clr-phone__pile-name')].map(n => n.textContent)
    expect(piles).toEqual(['À revoir', 'Justes'])
  })

  it('opens a milestone day on its rest at once when reduced', async () => {
    const screen = await mount('?scene=ticket7&reduced=1')
    await settle()
    expect(screen.container.querySelector('main.ms-ticket.clrk--reduced')).not.toBeNull()
  })

  it('draws the desk\'s layout when asked, whatever the width', async () => {
    const screen = await mount('?scene=day&desk=1')
    await settle()
    expect(screen.container.querySelector('main.clr-desk')).not.toBeNull()
  })
})
