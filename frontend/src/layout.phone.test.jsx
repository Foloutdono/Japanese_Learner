import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// The phone lane (vite.config.js): chromium at 390×844 from the first
// paint, so the rules under `@media (max-width: 768px)` are the ones
// getComputedStyle reads back. These are stylesheet contracts on
// fixture markup — the objects a phone user reaches for, pinned by the
// real classes rather than by mounting whole screens (the same trick as
// index.tokens.browser.test.jsx).
import './index.css'

const HUD_H = 36 // --hud-h; --safe-bottom is 0 in chromium

describe('the phone layout contract', () => {
  it('runs at phone width', () => {
    expect(window.innerWidth).toBe(390)
    expect(window.matchMedia('(max-width: 768px)').matches).toBe(true)
  })

  it('the study stage clears the level bar and docks the rating bar on it', async () => {
    const screen = await render(
      <main className="container quiz-area"><div className="rating-bar" /></main>
    )
    const area = screen.container.querySelector('.quiz-area')
    const bar  = screen.container.querySelector('.rating-bar')
    expect(getComputedStyle(area).paddingBottom).toBe(`${HUD_H}px`)
    expect(getComputedStyle(bar).position).toBe('sticky')
    expect(getComputedStyle(bar).bottom).toBe(`${HUD_H}px`)
  })

  it('the level bar sits on the bottom edge at its own height', async () => {
    const screen = await render(<div className="mobile-level-bar" />)
    const bar = screen.container.querySelector('.mobile-level-bar')
    expect(getComputedStyle(bar).display).not.toBe('none')
    const rect = bar.getBoundingClientRect()
    expect(rect.height).toBe(HUD_H)
    expect(Math.round(rect.bottom)).toBe(window.innerHeight)
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

  it('the docked note sits above the level bar on a phone', async () => {
    const screen = await render(<div className="dock-note" />)
    expect(getComputedStyle(screen.container.querySelector('.dock-note')).bottom).toBe(`${HUD_H}px`)
  })

  it('the drawer reads the inset tokens, not a raw env()', async () => {
    const screen = await render(
      <div className="burger-drawer"><div className="burger-drawer__pocket" /></div>
    )
    const pocket = screen.container.querySelector('.burger-drawer__pocket')
    // 14px + --safe-bottom (0 here): the same number the raw env() gave,
    // now through the token that carries the fallback.
    expect(getComputedStyle(pocket).paddingBottom).toBe('14px')
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
})
