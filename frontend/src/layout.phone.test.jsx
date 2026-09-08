import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// The phone lane (vite.config.js): chromium at 390×844 from the first
// paint, so the rules under `@media (max-width: 768px)` are the ones
// getComputedStyle reads back. These are stylesheet contracts on
// fixture markup — the objects a phone user reaches for, pinned by the
// real classes rather than by mounting whole screens (the same trick as
// index.tokens.browser.test.jsx). The chrome itself is
// chrome.phone.test.jsx.
import './index.css'

describe('the phone layout contract', () => {
  it('runs at phone width', () => {
    expect(window.innerWidth).toBe(390)
    expect(window.matchMedia('(max-width: 768px)').matches).toBe(true)
  })

  it('the study stage docks the rating bar on the dock edge', async () => {
    // No data-chrome on the document here: --dock-bottom is the inset
    // alone (0 in chromium), as on a stage. The shell's own case is
    // chrome.phone.test.jsx.
    const screen = await render(
      <main className="container stage"><div className="rating-bar" /></main>
    )
    const area = screen.container.querySelector('.stage')
    const bar  = screen.container.querySelector('.rating-bar')
    expect(getComputedStyle(area).paddingBottom).toBe('0px')
    expect(getComputedStyle(bar).position).toBe('sticky')
    expect(getComputedStyle(bar).bottom).toBe('0px')
  })

  it('the same rules read the tab bar under the shell', async () => {
    document.documentElement.dataset.chrome = 'shell'
    try {
      const screen = await render(
        <div>
          <main className="container stage"><div className="rating-bar" /></main>
          <div className="dock-note" />
        </div>
      )
      expect(getComputedStyle(screen.container.querySelector('.stage')).paddingBottom).toBe('50px')
      expect(getComputedStyle(screen.container.querySelector('.rating-bar')).bottom).toBe('50px')
      expect(getComputedStyle(screen.container.querySelector('.dock-note')).bottom).toBe('50px')
    } finally {
      delete document.documentElement.dataset.chrome
    }
  })

  it('a drawn stroke never scrolls the page: touch-action none on the canvases', async () => {
    const screen = await render(
      <div>
        <canvas className="canvas-board" />
        <div className="analysis-cropper__stage" />
      </div>
    )
    for (const sel of ['.canvas-board', '.analysis-cropper__stage']) {
      expect(getComputedStyle(screen.container.querySelector(sel)).touchAction).toBe('none')
    }
  })

  it('a focused field does not zoom the page: 16px on a phone', async () => {
    const screen = await render(<input className="field" defaultValue="" />)
    expect(getComputedStyle(screen.container.querySelector('.field')).fontSize).toBe('16px')
  })

  it('pull-to-refresh is off at the root, and the chrome is not selectable', async () => {
    expect(getComputedStyle(document.documentElement).overscrollBehaviorY).toBe('none')
    const screen = await render(<div className="rating-bar" />)
    expect(getComputedStyle(screen.container.querySelector('.rating-bar')).userSelect).toBe('none')
  })

  it('a section header keeps the tighter phone rhythm', async () => {
    // The phone block's own rule (index.css, "the gap ABOVE stays
    // large"): 44 above to separate two sections, 12 below so a group's
    // first card sits close to its title.
    const screen = await render(<div><p /><div className="section-header" /></div>)
    const head = screen.container.querySelector('.section-header')
    expect(getComputedStyle(head).marginTop).toBe('44px')
    expect(getComputedStyle(head).marginBottom).toBe('12px')
  })

  // ── 路線図 — the rail and its markers stand on one line ──
  // A retired phone block (the pre-071 diagram, its rail inside a 52px
  // card indent) was still overriding the real one below 560px, and
  // the rail ran 7.5px to the right of its own dots on every level
  // list, kana list and exam list the app has.
  it('stands the route rail on the axis of its markers, inside the route\'s margin', async () => {
    const screen = await render(
      <div className="route">
        <button type="button" className="route-stop route-stop--first route-stop--past">
          <span className="route-stop__rail" /><span className="route-stop__marker" />
        </button>
        <button type="button" className="route-stop route-stop--current route-stop--last">
          <span className="route-stop__rail" /><span className="route-stop__marker" />
        </button>
      </div>
    )
    const route = screen.container.querySelector('.route').getBoundingClientRect()
    const mid = el => { const r = el.getBoundingClientRect(); return (r.left + r.right) / 2 }
    for (const stop of screen.container.querySelectorAll('.route-stop')) {
      const marker = stop.querySelector('.route-stop__marker')
      expect(mid(stop.querySelector('.route-stop__rail'))).toBeCloseTo(mid(marker), 1)
      // Both stand in the room the route reserves for them, left of
      // the cards — the current stop's 3px ring included.
      expect(marker.getBoundingClientRect().left - route.left).toBeGreaterThanOrEqual(3)
      expect(marker.getBoundingClientRect().right).toBeLessThanOrEqual(stop.getBoundingClientRect().left)
    }
  })
})
