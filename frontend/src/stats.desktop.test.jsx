import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'
import { parkPointer } from './testing/parkPointer'
import { STATS, REPORT, LONG_REPORT } from './testing/statsRecord'

// ── 路線別 — the statistics as the four lines (plan 136) ─────────
// On the desk the record is a strip of four figures over the four
// lines' plates, two by two, each row as tall as its taller plate and
// no taller (a plate has no body to give the window's height to, and a
// card stretched past its content holds air). Each plate carries its line's retention, its grid
// of exercise by deck with the leak in red, and its most-missed cards;
// every cell and every tile opens a run. No sheet. The phone's side is
// stats.phone and deskfree.phone; the laptop's is stats.wide.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))

const payload = vi.hoisted(() => ({ report: null }))
vi.mock('./lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: vi.fn(),
  apiJsonWithTimeout: vi.fn(async path => (path === '/api/stats' ? STATS : payload.report)),
  apiUpload: vi.fn(),
  ApiError: class extends Error {},
}))

const { default: StatsScreen } = await import('./screens/StatsScreen')

const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]

function Where() {
  return <output data-where>{useLocation().pathname}</output>
}

async function mount(report = REPORT) {
  payload.report = report
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/profile/stats']}>
        <div className="phone phone--desk">
          <div className="phone__content"><StatsScreen session={null} /></div>
        </div>
        <Where />
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

const plate = name => $$('.rep-plate').find(p => p.getAttribute('aria-label') === name)

describe('the statistics on the desk', () => {
  it('reads the strip on one row over the four plates, two by two', async () => {
    await mount()
    const cells = $$('.rep-strip__cell').map(c => c.getBoundingClientRect())
    expect(cells).toHaveLength(4)
    for (const c of cells) expect(Math.abs(c.top - cells[0].top)).toBeLessThan(1)
    // The line's cell and the ladder's are twice a figure's.
    expect(cells[0].width).toBeGreaterThan(cells[1].width * 1.8)

    const plates = $$('.rep-plate').map(p => p.getBoundingClientRect())
    expect(plates).toHaveLength(4)
    expect(Math.abs(plates[1].top - plates[0].top)).toBeLessThan(1)
    expect(plates[1].left).toBeGreaterThan(plates[0].right)
    expect(plates[2].top).toBeGreaterThan(plates[0].bottom)
    expect(Math.abs(plates[2].left - plates[0].left)).toBeLessThan(1)
    expect(document.body.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    expect($('[role="dialog"]')).toBeNull()
  })

  it('makes a row of plates as tall as its taller plate, and no taller', async () => {
    await mount()
    const [a, b] = $$('.rep-plate')
    const ra = a.getBoundingClientRect()
    expect(Math.abs(ra.height - b.getBoundingClientRect().height)).toBeLessThan(1)
    const foot = Math.max(...[a, b].map(p => p.lastElementChild.getBoundingClientRect().bottom))
    expect(ra.bottom - foot).toBeLessThan(28)
  })

  it('draws the line 1:1 at the strip\'s height, a stop a day in the first week', async () => {
    await mount()
    const svg = $('.rep-line__svg')
    const box = svg.getBoundingClientRect()
    const [, , w, h] = svg.getAttribute('viewBox').split(' ').map(Number)
    expect(Math.abs(w - box.width)).toBeLessThanOrEqual(1)
    expect(h).toBe(64)
    const ridden = REPORT.days.length
    expect($$('.rep-line__stop, .rep-line__now')).toHaveLength(ridden)
    // The days left in the week are the rail ahead.
    if (ridden < 7) expect($('.rep-line__ahead')).not.toBeNull()
    expect($('.rep-axis')).toBeNull()
  })

  it('draws weeks once there are four of them', async () => {
    await mount(LONG_REPORT)
    const stops = $$('.rep-line__stop, .rep-line__now')
    expect(stops.length).toBeGreaterThanOrEqual(4)
    expect(stops.length).toBeLessThanOrEqual(12)
    expect($('.rep-strip__when').textContent).toMatch(/sem\. du|week of/)
    expect($('.rep-delta')).not.toBeNull()
  })

  it('grids each line by exercise and deck, the leak in red, once a line', async () => {
    await mount()
    const kanji = plate('Kanji')
    expect([...kanji.querySelectorAll('.rep-grid__deck')].map(th => th.textContent)).toEqual(['N5', 'N4'])
    expect(kanji.querySelectorAll('tbody tr')).toHaveLength(3)
    const leaks = $$('.rep-cell--leak')
    // Kanji's N4 drawing, vocabulary's N4 reading, grammar's one cell;
    // kana holds everywhere.
    expect(leaks).toHaveLength(3)
    expect(plate('Kana').querySelector('.rep-cell--leak')).toBeNull()
    expect(kanji.querySelector('.rep-cell--leak').getAttribute('aria-label')).toMatch(/N4/)
    // A kana set's column is its first glyph.
    expect([...plate('Kana').querySelectorAll('.rep-grid__deck')].map(th => th.textContent)).toEqual(['あ', 'きゃ', 'ア', 'キャ'])
  })

  it('opens the exercise\'s run from its cell, and a card\'s from its tile', async () => {
    await mount()
    plate('Kanji').querySelector('.rep-cell--leak').click()
    await settle(60)
    expect($('[data-where]').textContent).toBe('/learn/kanji/N4/kanji.write_kanji')
  })

  it('tiles each line\'s own weakest; a line with none says so', async () => {
    await mount()
    expect(plate('Kanji').querySelectorAll('.rep-tile')).toHaveLength(8)
    expect(plate('Grammaire').querySelectorAll('.rep-tile')).toHaveLength(2)
    expect(plate('Kana').querySelector('.rep-tile')).toBeNull()
    expect(plate('Kana').querySelector('.rep-plate__none')).not.toBeNull()
    const tile = plate('Kanji').querySelector('.rep-tile')
    expect(tile.textContent).toContain('仕')
    tile.click()
    await settle(60)
    expect($('[data-where]').textContent).toBe('/learn/kanji/N4/kanji.flashcard.f2b')
  })

  it('cuts no caption and squeezes no name', async () => {
    await mount()
    for (const el of $$('.rep-cap, .rep-plate__name, .rep-grid__mode, .rep-grid__deck')) {
      expect(el.scrollWidth, el.textContent).toBeLessThanOrEqual(el.clientWidth + 1)
    }
  })
})

// ── plan 123, P19 — the line asked by a mouse ──
// A mouse over the line asks the stop under it: the figures and the
// caption follow it, the last stop comes back when it leaves, and a
// click pins one.
describe('the retention line under a mouse', () => {
  it('previews the stop under the pointer, and a click pins it', async () => {
    const { userEvent } = await import('vitest/browser')
    await mount(LONG_REPORT)
    const asked = () => $('.rep-strip__when')?.textContent
    const ring = () => Number($('.rep-line__sel').getAttribute('cx'))
    const now = [asked(), ring()]
    await userEvent.hover($('.rep-line__svg'))
    await settle(60)
    expect(asked()).not.toBe(now[0])
    expect(ring()).toBeLessThan(now[1])
    const middle = [asked(), ring()]
    await userEvent.hover($('.rep-strip__figs'))
    await settle(60)
    expect([asked(), ring()]).toEqual(now)
    await userEvent.click($('.rep-line__svg'))
    await userEvent.hover($('.rep-strip__figs'))
    await settle(60)
    expect([asked(), ring()]).toEqual(middle)
    // The lane's pointer is shared: parked, not over the next file's page.
    await parkPointer()
  })
})
