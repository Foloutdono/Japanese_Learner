import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'
import { STATS, REPORT } from './testing/statsRecord'

// ── 路線別 on a laptop (plan 138) ────────────────────────────────
// At 1440 a plate has the width to stand its most-missed cards beside
// its grid, as the owner's drawing did; at 1100 (stats.desktop) they go
// under it. The rows of plates are as tall as their taller plate, and
// no plate holds air under its content.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: vi.fn(),
  apiJsonWithTimeout: vi.fn(async path => (path === '/api/stats' ? STATS : REPORT)),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))

const { default: StatsScreen } = await import('./screens/StatsScreen')

// Past the timer, the screen's arrival itself (@keyframes arrive, a 10px
// rise): measured mid-flight, a 44px target read 43.9999 on a loaded
// runner. Settled as the stations' tests are (8226935).
const settle = async (ms = 250) => {
  await new Promise(r => setTimeout(r, ms))
  await Promise.all(document.getAnimations()
    .filter(a => a.effect?.getComputedTiming().iterations !== Infinity)
    .map(a => a.finished.catch(() => {})))
}
const $$ = s => [...document.querySelectorAll(s)]

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/profile/stats']}>
        <div className="phone phone--desk">
          <div className="phone__content"><StatsScreen session={null} /></div>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

const plate = name => $$('.rep-plate').find(p => p.getAttribute('aria-label') === name)

describe('the statistics on a laptop', () => {
  it('stands a plate\'s tiles beside its grid', async () => {
    await mount()
    for (const name of ['Kanji', 'Grammaire']) {
      const grid = plate(name).querySelector('.rep-grid').getBoundingClientRect()
      const side = plate(name).querySelector('.rep-plate__side').getBoundingClientRect()
      expect(side.left, name).toBeGreaterThan(grid.right)
      expect(Math.abs(side.top - grid.top), name).toBeLessThan(8)
    }
  })

  it('makes a row as tall as its taller plate, and no plate taller than that', async () => {
    await mount()
    const plates = $$('.rep-plate')
    for (const [a, b] of [[plates[0], plates[1]], [plates[2], plates[3]]]) {
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      expect(Math.abs(ra.height - rb.height)).toBeLessThan(1)
      // The taller plate's content reaches its foot: the row is not
      // stretched past what either plate holds.
      const foot = Math.max(...[a, b].map(p => p.lastElementChild.getBoundingClientRect().bottom))
      expect(ra.bottom - foot).toBeLessThan(28)
    }
  })

  it('cuts no caption in the strip', async () => {
    await mount()
    for (const el of $$('.rep-strip .rep-cap, .rep-ladder__reach')) {
      expect(el.scrollWidth, el.textContent).toBeLessThanOrEqual(el.clientWidth + 1)
    }
    const steps = $$('.rep-ladder__step').map(s => s.getBoundingClientRect())
    for (let i = 1; i < steps.length; i++) expect(steps[i].left).toBeGreaterThanOrEqual(steps[i - 1].right)
  })
})
