import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { LangProvider } from './LangContext'
import ModeSelector from './components/selection/ModeSelector'
import { RouteStops } from './components/selection/RouteStops'
import './index.css'

// ── 机 — the stations and the run's column, laid out for the width (plan 114) ──
// A station page is a bar over one thing to choose from. On the desk:
// its platforms go two across with the odd one out taking the row, and
// exactly three go three across — never a column of 1,000px cards, never
// an orphan; a route that is the whole page is drawn across, one rail
// through every marker; a run's head and foot share the card's column;
// the analyzer's working rail stands right of the stage, away from the
// desk's own rail. The phone's half (none of this below 1100) is
// deskfree.phone.test.jsx.

vi.mock('./lib/audio', async o => ({ ...(await o()), playUi: vi.fn(), playClick: vi.fn() }))
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const modes = n => Array.from({ length: n }, (_, i) => ({ key: `m${i}`, label: `Mode ${i + 1}`, desc: 'desc' }))

function station(children) {
  return render(
    <LangProvider>
      <div className="phone phone--desk">
        <div className="phone__content">
          <main className="learn">{children}</main>
        </div>
      </div>
    </LangProvider>
  )
}

const boxes = sel => [...document.querySelectorAll(sel)].map(el => el.getBoundingClientRect())

describe('platforms on the desk', () => {
  it('go two across, the odd one out taking the row', async () => {
    await station(<ModeSelector modes={modes(5)} onSelect={() => {}} />)
    await settle()
    const [a, b, c, d, e] = boxes('.platform-slot')
    const grid = document.querySelector('.platform-grid').getBoundingClientRect()
    expect(Math.round(a.top)).toBe(Math.round(b.top))
    expect(Math.round(c.top)).toBe(Math.round(d.top))
    expect(b.left).toBeGreaterThan(a.right)
    expect(Math.abs(e.width - grid.width)).toBeLessThanOrEqual(1)
  })

  it('go three across when there are three', async () => {
    await station(<ModeSelector modes={modes(3)} onSelect={() => {}} />)
    await settle()
    const [a, b, c] = boxes('.platform-slot')
    expect(Math.round(a.top)).toBe(Math.round(c.top))
    expect(Math.abs(a.width - c.width)).toBeLessThanOrEqual(1)
    expect(c.left).toBeGreaterThan(b.right)
  })

  it('fill a four without an orphan', async () => {
    await station(<ModeSelector modes={modes(4)} onSelect={() => {}} />)
    await settle()
    const [a, b, c, d] = boxes('.platform-slot')
    expect(Math.round(a.top)).toBe(Math.round(b.top))
    expect(Math.round(c.top)).toBe(Math.round(d.top))
    expect(Math.abs(a.width - d.width)).toBeLessThanOrEqual(1)
  })
})

describe('a route that is the whole page', () => {
  const stops = ['N5', 'N4', 'N3', 'N2', 'N1'].map((k, i) => ({
    key: k, code: k, name: `Niveau ${i + 1}`, hereLabel: 'Tu es ici', learned: 10 * i, total: 600,
  }))

  it('is drawn across: one row of equal stops, one rail through the markers', async () => {
    await station(<RouteStops stops={stops} here="N4" onSelect={() => {}} />)
    // Under no pointer: the lane's pointer is shared, a file before this
    // one may have left it where a stop now stands, and a hovered stop
    // lifts a pixel. Parked on a probe in the window's corner.
    const corner = document.createElement('div')
    corner.style.cssText = 'position: fixed; left: 0; top: 0; width: 4px; height: 4px; z-index: 9999'
    document.body.appendChild(corner)
    await userEvent.hover(corner, { force: true })
    corner.remove()
    // Past the stops' staggered arrival, which lifts each into place --
    // waited out by the animations themselves, not a guess at their
    // length: a full parallel run was slow enough to measure mid-lift.
    await settle(900)
    await Promise.all(document.getAnimations().map(a => a.finished.catch(() => {})))
    const cards = boxes('.route-stop')
    expect(cards).toHaveLength(5)
    for (const c of cards) {
      expect(Math.round(c.top)).toBe(Math.round(cards[0].top))
      expect(Math.abs(c.width - cards[0].width)).toBeLessThanOrEqual(1)
    }
    const markers = boxes('.route-stop__marker')
    const mid = m => m.top + m.height / 2
    for (const m of markers) expect(Math.abs(mid(m) - mid(markers[0]))).toBeLessThanOrEqual(1)
    // Each marker stands over its own stop's centre.
    markers.forEach((m, i) => {
      expect(Math.abs((m.left + m.width / 2) - (cards[i].left + cards[i].width / 2))).toBeLessThanOrEqual(1)
    })
    // The rail is horizontal and runs through the markers.
    const rail = document.querySelectorAll('.route-stop__rail')[2].getBoundingClientRect()
    expect(rail.width).toBeGreaterThan(rail.height)
    expect(Math.abs((rail.top + rail.height / 2) - mid(markers[2]))).toBeLessThanOrEqual(1)
    // Nothing points sideways any more: the ▶ is the upright list's.
    expect(getComputedStyle(document.querySelector('.route-stop__go')).display).toBe('none')
  })

  it('stays upright where it is not the page', async () => {
    await station(<div className="wrap"><RouteStops stops={stops} here="N4" onSelect={() => {}} /></div>)
    await settle()
    const cards = boxes('.route-stop')
    expect(cards[1].top).toBeGreaterThan(cards[0].bottom)
  })
})

describe('a run on the desk', () => {
  it('keeps its head and its foot on the card\'s column', async () => {
    await render(
      <div className="phone phone--stage">
        <main className="container stage">
          <div className="stage__head"><button type="button">‹</button><span>here</span></div>
          <div className="quiz-card-stage"><div className="prompt-card">card</div></div>
          <form className="stage__foot"><input className="field" aria-label="answer" /></form>
        </main>
      </div>
    )
    await settle()
    const card = document.querySelector('.prompt-card').getBoundingClientRect()
    for (const sel of ['.stage__head', '.stage__foot']) {
      const box = document.querySelector(sel).getBoundingClientRect()
      expect(box.width, sel).toBeLessThanOrEqual(640)
      expect(Math.abs(box.left - card.left), sel).toBeLessThanOrEqual(1)
    }
  })
})

describe('the analyzer on the desk', () => {
  it('stands its working rail right of the stage, away from the desk\'s own', async () => {
    await render(
      <div className="phone phone--desk">
        <div className="phone__content">
          <main className="dictionary analyzer">
            <div className="anl-results">
              <div className="anl-railcol">rail</div>
              <div className="anl-stage">stage</div>
            </div>
          </main>
        </div>
      </div>
    )
    await settle()
    const rail = document.querySelector('.anl-railcol').getBoundingClientRect()
    const stage = document.querySelector('.anl-stage').getBoundingClientRect()
    expect(rail.left).toBeGreaterThan(stage.right - 1)
    expect(Math.round(rail.width)).toBe(360)
  })
})
