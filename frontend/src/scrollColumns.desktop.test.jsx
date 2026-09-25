import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter } from 'react-router-dom'
import { parkPointer } from './testing/parkPointer'
import './index.css'

// ── 机 — what a scrolling column must not cut ─────────────────────────
// The side, a split's list and Settings' list each scroll in their own
// box, and a scroll container clips at its padding edge on both axes.
// Their rows stood on that edge, so a row's hover lift took its top
// border off (the first kana set, the pass strip on Today), a focus
// ring lost three of its sides, and the rows' 10px arrival hung the last
// one past the column's foot: a scrollbar for as long as a list that
// fits took to arrive. index.css, the 机 block, gives each column a
// gutter inside its edge and takes it back outside. Held here on the
// real rows and the real cascade: nothing a row paints is cut, no
// scrollbar is printed while it arrives, and every row still stands,
// sticks and scrolls to where it did before the gutter.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))

const { RouteStops } = await import('./components/selection/RouteStops')

const cssPx = name => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
const settle = (ms = 250) => new Promise(r => setTimeout(r, ms))
// Every arrival on the page landed (or was cancelled by a restyle).
const landed = () => Promise.all(document.getAnimations()
  .filter(a => a.playState === 'running' && Number.isFinite(a.effect.getComputedTiming().endTime))
  .map(a => a.finished.catch(() => {})))
// The pointer parked and every row at rest: arrived, and down from any
// hover a file before this one left over it (the lift eases for 0.16s).
async function atRest() {
  await parkPointer()
  await landed()
  await settle()
}

// What an element paints: its box as transformed, and its ring.
function painted(el) {
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  const ring = cs.outlineStyle === 'none' ? 0 : parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset)
  return { top: r.top - ring, left: r.left - ring, right: r.right + ring, bottom: r.bottom + ring }
}
function expectInside(el, column) {
  const p = painted(el)
  const clip = column.getBoundingClientRect()
  expect(p.top).toBeGreaterThanOrEqual(clip.top)
  expect(p.left).toBeGreaterThanOrEqual(clip.left)
  expect(p.right).toBeLessThanOrEqual(clip.right)
}

const stops = n => Array.from({ length: n }, (_, i) => ({ key: `s${i}`, code: `S${i}`, name: `Stop ${i}`, learned: 0, total: 10 }))

// A station as the desk draws it: the stops beside a page.
function Station({ count = 4, pageHeight = 0 }) {
  return (
    <MemoryRouter>
      <div className="phone phone--desk">
        <div className="phone__content">
          <main className="learn">
            <div className="desk-split">
              <nav className="desk-split__list">
                <RouteStops stops={stops(count)} here="s1" selected="s0" linkTo={k => `/learn/kana/${k}`} />
              </nav>
              <div className="desk-split__page"><div className="platform-card" style={{ minHeight: pageHeight }}>page</div></div>
            </div>
          </main>
        </div>
      </div>
    </MemoryRouter>
  )
}

const list = () => document.querySelector('.desk-split__list')
const rows = () => [...document.querySelectorAll('.desk-split__list .route-stop')]

describe('a split\'s list on the desk', () => {
  it('prints no scrollbar while a list that fits arrives', async () => {
    await render(<Station />)
    // Every row held at its arrival's first frame, still 10px low.
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = 0 }
    expect(getComputedStyle(rows().at(-1)).transform).not.toBe('none')
    expect(list().scrollHeight).toBeLessThanOrEqual(list().clientHeight)
    for (const a of document.getAnimations()) a.finish()
  })

  it('keeps a lifted, ringed row whole', async () => {
    await render(<Station />)
    await atRest()
    // The open stop is the list's one tab stop: by the keyboard it is
    // both lifted and ringed, the most a row paints past its box.
    await userEvent.keyboard('{Tab}')
    await settle()
    const first = rows()[0]
    expect(document.activeElement).toBe(first)
    expect(getComputedStyle(first).transform).not.toBe('none')
    expect(getComputedStyle(first).outlineStyle).not.toBe('none')
    expectInside(first, list())
  })

  it('keeps a hovered row\'s top border', async () => {
    await render(<Station />)
    await atRest()
    await userEvent.hover(rows()[0])
    await settle()
    expect(getComputedStyle(rows()[0]).transform).not.toBe('none')
    expectInside(rows()[0], list())
  })

  it('stands its rows where the column stands', async () => {
    await render(<Station />)
    await atRest()
    const split = document.querySelector('.desk-split').getBoundingClientRect()
    const page = document.querySelector('.desk-split__page').getBoundingClientRect()
    const first = rows()[0].getBoundingClientRect()
    expect(Math.round(first.top)).toBe(Math.round(page.top))
    expect(Math.round(first.left)).toBe(Math.round(split.left))
    expect(Math.round(first.width)).toBe(cssPx('--desk-side-w'))
    // The gutter is a clip, not a gap: the page beside keeps its gap.
    expect(Math.round(page.left - first.right)).toBe(cssPx('--sp-6'))
  })

  it('sticks its rows at the page\'s gutter and scrolls the last one to it', async () => {
    await render(<Station count={30} pageHeight={3000} />)
    await atRest()
    window.scrollTo(0, 600)
    await settle(50)
    const gutter = cssPx('--sp-6')
    expect(Math.round(rows()[0].getBoundingClientRect().top)).toBe(gutter)
    list().scrollTop = list().scrollHeight
    await settle(50)
    expect(Math.round(rows().at(-1).getBoundingClientRect().bottom)).toBe(window.innerHeight - gutter)
    window.scrollTo(0, 0)
  })
})

describe('the side on Today', () => {
  function Today() {
    return (
      <div className="phone phone--desk">
        <div className="phone__content">
          <main className="today">
            <div className="gate-card">gate</div>
            <aside className="desk-side" aria-label="pass">
              <button type="button" className="pass pass--strip">strip</button>
            </aside>
          </main>
        </div>
      </div>
    )
  }

  it('keeps the pass strip whole, lifted and ringed, level with the gate', async () => {
    await render(<Today />)
    await atRest()
    const strip = document.querySelector('.pass--strip')
    const side = document.querySelector('.desk-side')
    const gate = document.querySelector('.gate-card')
    expect(Math.round(strip.getBoundingClientRect().top)).toBe(Math.round(gate.getBoundingClientRect().top))
    await userEvent.keyboard('{Tab}')
    await settle()
    expect(document.activeElement).toBe(strip)
    expect(getComputedStyle(strip).transform).not.toBe('none')
    expectInside(strip, side)
  })
})
