import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 試写 — /dev/dayclear plays every scene with no backend (plans 191, 247) ──
// The workbench the finishes are reviewed and filmed on: each scene of
// the canvas "Tsuji — the day cleared, new directions" from its own
// fixtures, at a phone's width, under the Shell as Today has it, with
// nothing to fetch. A cleared day's finish sends the bars away; a
// partial run's keeps them; the three scenes that are not a finish
// stand on the stage, as the workbench always drew them.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playStamp: vi.fn(), playDayClear: vi.fn(), playMilestone: vi.fn(), playPassClip: vi.fn(), playArrival: vi.fn(), playClick: vi.fn(),
}))
vi.mock('./lib/shareTicket', async o => ({ ...(await o()), renderTicketPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })) }))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { Shell } = await import('./components/chrome/Shell')
const { default: DayClearPreview } = await import('./screens/DayClearPreview')

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)

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

const CLEARED = ['day', 'again', 'ticket3', 'ticket7', 'ticket14', 'month30', 'month100', 'month365']
const OTHERS = { restday: 'section.rst', tickets: 'main.tkb', share: 'main.clrdev-share' }

describe('/dev/dayclear at a phone\'s width', () => {
  for (const scene of CLEARED) {
    it(`plays ${scene} on Today, the bars away`, async () => {
      await mount(`?scene=${scene}`)
      expect(await until(() => $('main.today--fin .tdy--fin.tdy--clear'))).toBeTruthy()
      expect($('.hud.hud--away')).not.toBeNull()
    })
  }

  it('plays the partial finish with its bars', async () => {
    await mount('?scene=partial')
    expect(await until(() => $('main.today--fin .tdy--fin'))).toBeTruthy()
    expect($('.tdy--clear')).toBeNull()
    expect($('.hud')).not.toBeNull()
    expect($('.hud--away')).toBeNull()
  })

  for (const [scene, root] of Object.entries(OTHERS)) {
    it(`draws ${scene} on the stage`, async () => {
      await mount(`?scene=${scene}&reduced=1`)
      expect(await until(() => $(root))).toBeTruthy()
      expect($('.phone--staged')).not.toBeNull()
      expect($('.hud')).toBeNull()
    })
  }

  it('draws the rest at once when reduced', async () => {
    await mount('?scene=ticket7&reduced=1')
    expect(await until(() => $('.tdy--fin.clrk--reduced'))).toBeTruthy()
    expect($('.tdy-next--ticket')).not.toBeNull()
    expect($('.btn-depart--gate')).not.toBeNull()
    expect($('.hud--away')).toBeNull()
  })

  it('opens the run\'s wrong pile from the board', async () => {
    await mount('?scene=day&reduced=1')
    const row = await until(() => $('[data-action="review-missed"]'))
    expect(row).toBeTruthy()
    row.click()
    expect(await until(() => $('.clr-pile-sheet'))).toBeTruthy()
    expect(document.querySelectorAll('.clr-pile-sheet__row')).toHaveLength(6)
  })

  it('says a level crossed on the month\'s jackpot', async () => {
    await mount('?scene=month30&reduced=1')
    expect(await until(() => $('.levelup'))).toBeTruthy()
  })
})
