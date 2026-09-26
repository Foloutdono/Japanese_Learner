import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'
import { STATS, REPORT } from './testing/statsRecord'

// ── 路線別 on a phone (plan 136) ─────────────────────────────────
// The strip two across — retention with its line and the ladder the
// row's whole width — over the four lines' plates in one column, every
// grid cell and every tile a thumb's target, nothing wider than the
// screen, and no sheet: a plate's drill-down is on the plate. Replaces
// plan 085's fixture in profile.phone, which drew a copy of the old
// markup rather than the screen.

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

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

async function mount() {
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/profile/stats']}>
        <div className="phone"><div className="phone__content"><StatsScreen session={null} /></div></div>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

describe('the statistics on a phone', () => {
  it('stands the strip two across and the plates in one column', async () => {
    await mount()
    const strip = $('.rep-strip').getBoundingClientRect()
    const [line, reviews, misses, ladder] = $$('.rep-strip__cell').map(c => c.getBoundingClientRect())
    expect(Math.abs(line.width - (strip.width - 2))).toBeLessThan(1)
    expect(Math.abs(ladder.width - line.width)).toBeLessThan(1)
    expect(Math.abs(reviews.top - misses.top)).toBeLessThan(1)
    expect(misses.left).toBeGreaterThan(reviews.right)

    const plates = $$('.rep-plate').map(p => p.getBoundingClientRect())
    expect(plates).toHaveLength(4)
    for (let i = 1; i < 4; i++) {
      expect(plates[i].top).toBeGreaterThan(plates[i - 1].bottom)
      expect(Math.abs(plates[i].left - plates[0].left)).toBeLessThan(1)
    }
    expect(document.body.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    expect($('[class*="desk-"]')).toBeNull()
    expect($('[role="dialog"]')).toBeNull()
  })

  it('draws the line at its cell\'s own width and the ladder\'s captions whole', async () => {
    await mount()
    const svg = $('.rep-line__svg')
    const [, , w] = svg.getAttribute('viewBox').split(' ').map(Number)
    expect(Math.abs(w - svg.getBoundingClientRect().width)).toBeLessThanOrEqual(1)
    const steps = $$('.rep-ladder__step').map(s => s.getBoundingClientRect())
    expect(steps).toHaveLength(5)
    for (let i = 1; i < 5; i++) expect(steps[i].left).toBeGreaterThanOrEqual(steps[i - 1].right)
    for (const el of $$('.rep-ladder__reach, .rep-cap, .rep-plate__name')) {
      expect(el.scrollWidth, el.textContent).toBeLessThanOrEqual(el.clientWidth + 1)
    }
  })

  it('fits the grids without a scroll, the tiles under them', async () => {
    await mount()
    for (const box of $$('.rep-grid-box')) {
      expect(box.scrollWidth, box.closest('.rep-plate').getAttribute('aria-label')).toBeLessThanOrEqual(box.clientWidth + 1)
    }
    const kanji = $$('.rep-plate').find(p => p.getAttribute('aria-label') === 'Kanji')
    const grid = kanji.querySelector('.rep-grid').getBoundingClientRect()
    const side = kanji.querySelector('.rep-plate__side').getBoundingClientRect()
    expect(side.top).toBeGreaterThanOrEqual(grid.bottom)
  })

  it('makes every cell and every tile a thumb\'s target', async () => {
    await mount()
    const targets = $$('.rep-cell, .rep-tile')
    expect(targets.length).toBeGreaterThan(20)
    for (const el of targets) {
      const r = el.getBoundingClientRect()
      expect(r.height).toBeGreaterThanOrEqual(44)
      expect(r.width).toBeGreaterThanOrEqual(44)
    }
  })
})
