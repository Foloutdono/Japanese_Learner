import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 終着 on the short desk (plans 169, 191) ───────────────────────────
// A laptop's window, 1280×600: the Desk board is laid out for the box the
// Shell gives it, the air closing up first and then the tiles, so the
// whole of it -- the seal and the header, the grid, the tally, the fare,
// tomorrow and the gate -- stands in the window with nothing cut and no
// page scroll, during the sweep and at rest.

vi.mock('./lib/audio', async o => ({
  ...(await o()),
  playDayClear: vi.fn(), playStamp: vi.fn(), playFareTick: vi.fn(), playMilestone: vi.fn(), playArrival: vi.fn(), playClick: vi.fn(),
}))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { DeskShellStage } = await import('./components/chrome/Shell')
const { default: DayClearPreview } = await import('./screens/DayClearPreview')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))
async function until(check, ms = 8000) {
  const end = performance.now() + ms
  while (performance.now() < end) {
    if (check()) return true
    await settle(40)
  }
  return check()
}

function mount(query) {
  return render(
    <LangProvider>
      <MemoryRouter initialEntries={[`/dev/dayclear?${query}&bare=1`]}>
        <Routes>
          <Route element={<DeskShellStage />}>
            <Route path="/dev/dayclear" element={<DayClearPreview />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
}

const rect = el => el.getBoundingClientRect()
const inWindow = el => {
  const b = rect(el)
  return b.left >= -1 && b.top >= -1 && b.right <= window.innerWidth + 1 && b.bottom <= window.innerHeight + 1
}
const within = (inner, outer) => {
  const a = rect(inner)
  const b = rect(outer)
  return a.left >= b.left - 1 && a.top >= b.top - 1 && a.right <= b.right + 1 && a.bottom <= b.bottom + 1
}

function expectWhole() {
  expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  for (const sel of ['.clr-desk-seal', '.clr-desk-hdr', '.clr-desk-weekrow', '.clr-desk-fare', '.clr-desk-tom', '.clr-desk-gate', '.clr-desk-tally']) {
    const el = document.querySelector(sel)
    expect(el, sel).not.toBeNull()
    expect(inWindow(el), sel).toBe(true)
  }
  // Every tile whole in the window, its words inside it.
  const tiles = [...document.querySelectorAll('.clr-desk__grid > li button')]
  expect(tiles.length).toBeGreaterThan(0)
  for (const tile of tiles) {
    expect(inWindow(tile)).toBe(true)
    for (const word of tile.querySelectorAll('.clrk-tcard__term, .clrk-tcard__read')) expect(within(word, tile), word.textContent).toBe(true)
  }
  // Tomorrow's words inside its dashed panel, the fare's inside its card.
  const tom = document.querySelector('.clr-desk-tom')
  for (const part of tom.children) expect(within(part, tom), part.className).toBe(true)
  const fare = document.querySelector('.clr-desk-fare')
  for (const part of fare.children) expect(within(part, fare), part.className).toBe(true)
  // The header's row stops short of the fare card; the grid of tomorrow.
  expect(rect(document.querySelector('.clr-desk-streak')).right).toBeLessThanOrEqual(rect(fare).left)
  expect(rect(document.querySelectorAll('.clr-desk__grid > li button')[0]).right).toBeLessThanOrEqual(rect(tom).left)
  // The tally under the grid, not over it.
  const lowest = Math.max(...tiles.map(t => rect(t).bottom))
  expect(rect(document.querySelector('.clr-desk-tally')).top).toBeGreaterThanOrEqual(lowest)
}

describe('the day cleared on the short desk (1280×600)', () => {
  it('stands whole at rest: nothing cut, no page scroll', async () => {
    await mount('scene=day&reduced=1')
    await until(() => document.querySelector('.clr-desk-gate'))
    expectWhole()
  })

  it('sweeps inside the window, and rests whole after a skip', async () => {
    await mount('scene=day')
    await settle(1400)
    const reader = document.querySelector('.clr-desk-reader')
    const count = document.querySelector('.clr-desk-count')
    expect(reader).not.toBeNull()
    expect(inWindow(reader)).toBe(true)
    expect(inWindow(count)).toBe(true)
    // The counter stands clear of the reader, never over it.
    const c = rect(count)
    const r = rect(reader)
    expect(c.bottom <= r.top + 1 || c.left >= r.right - 1).toBe(true)
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(window.innerHeight)
    document.querySelector('main.clr-desk').click()
    await until(() => document.querySelector('.clr-desk-gate'))
    await settle(300)
    expectWhole()
  })

  it('stands a short run whole too', async () => {
    await mount('scene=day&reduced=1&cards=5')
    await until(() => document.querySelector('.clr-desk-gate'))
    expect(document.querySelectorAll('.clr-desk__grid > li')).toHaveLength(5)
    expectWhole()
  })
})
