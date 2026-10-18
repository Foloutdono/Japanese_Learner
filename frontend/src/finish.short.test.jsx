import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 終着 on a 1280×600 window (plan 250) ─────────────────────────────
// The finishes at rest on the short desk: what stands under the dial
// (the week's stamps, the thread's key, the month's ticket and its rest
// day) clear of the board over the gate, the gate in the window and
// nothing past its edges. The month's ticket is drawn smaller here
// than the canvas drew it (GateCard's useTicketFit), never under the
// board.

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

// The lowest thing each finish stands under its dial, and what it must clear.
const LOWEST = {
  day: ['.tdy-rally', '.tdy-board'],
  ticket7: ['.tdy-rally', '.tdy-board'],
  month30: ['.tdy-mtkt', '.tdy-board'],
  partial: ['.tdy-key--fare', '.tdy-desk__go .btn-depart--gate'],
}

describe('the finishes at rest on a 1280×600 window', () => {
  for (const [scene, [low, foot]] of Object.entries(LOWEST)) {
    it(`stands ${scene} whole, clear of its foot`, async () => {
      await mount(`?scene=${scene}&bare=1&reduced=1`)
      expect(await until(() => $(low) && $(foot))).toBeTruthy()
      await settle(200)
      expect(box(low).bottom).toBeLessThanOrEqual(box(foot).top)
      expect(box('.tdy-desk__go .btn-depart--gate').bottom).toBeLessThanOrEqual(window.innerHeight)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    })
  }

  it('draws the month\'s ticket smaller than the canvas did, to fit', async () => {
    await mount('?scene=month30&bare=1&reduced=1')
    expect(await until(() => $('.tdy-mtkt'))).toBeTruthy()
    await settle(200)
    expect(Number($('.tdy-mtkt').style.getPropertyValue('--tk-zoom'))).toBeLessThan(0.8)
  })
})
