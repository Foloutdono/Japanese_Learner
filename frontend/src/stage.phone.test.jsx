import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// Stylesheet contracts for the run at 390px (plan 070), on fixture
// markup — the same trick as layout.phone.test.jsx. The objects the
// canvas draws for the stage and the gate, pinned by their real classes.
import './index.css'

describe('the stage at phone width', () => {
  it('carries the inset itself, docks the rating bar, and keeps the pass at pocket size', async () => {
    const screen = await render(
      <main className="container stage">
        <div className="stage__head">
          <button type="button" className="stage__leave">Gate</button>
          <span className="stage__where"><h1 className="stage__where-jp">Kanji N4</h1></span>
          <span className="today-remaining">18</span>
          <button type="button" className="hud__pass"><span className="hud__pass-fig">24</span></button>
        </div>
        <div className="prompt-card"><div className="prompt-card__body">駅</div></div>
        <div className="rating-bar" />
      </main>
    )
    const stage = screen.container.querySelector('.stage')
    // safe-top is 0 in chromium: the --sp-3 alone.
    expect(getComputedStyle(stage).paddingTop).toBe('8px')
    expect(getComputedStyle(stage).flexDirection).toBe('column')
    const bar = screen.container.querySelector('.rating-bar')
    expect(getComputedStyle(bar).position).toBe('sticky')
    expect(getComputedStyle(bar).bottom).toBe('0px')
    expect(getComputedStyle(screen.container.querySelector('.stage__leave')).height).toBe('44px')
    expect(getComputedStyle(screen.container.querySelector('.hud__pass')).height).toBe('34px')
    expect(getComputedStyle(screen.container.querySelector('.today-remaining')).borderRadius).toBe('999px')
  })

  it('the lanes are 44px switches, off at the disabled opacity', async () => {
    const screen = await render(
      <div className="gate-card">
        <div className="gate-card__lanes">
          <button type="button" className="lane" style={{ '--lane-color': 'var(--line-kanji)' }}>
            <span className="lane__tick" /><span className="lane__where">Kanji N4</span><span className="lane__due">9</span>
          </button>
          <button type="button" className="lane lane--off">
            <span className="lane__tick" /><span className="lane__where">Vocabulary N5</span><span className="lane__due">8</span>
          </button>
        </div>
      </div>
    )
    const [on, off] = screen.container.querySelectorAll('.lane')
    expect(parseFloat(getComputedStyle(on).minHeight)).toBe(44)
    expect(getComputedStyle(off).opacity).toBe('0.5')
    // The tick fills with the lane's pigment when on, and is empty off.
    const tickOn = getComputedStyle(on.querySelector('.lane__tick'))
    const tickOff = getComputedStyle(off.querySelector('.lane__tick'))
    expect(tickOn.backgroundColor).not.toBe(tickOff.backgroundColor)
    expect(tickOff.backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })

  it('the finish: the check ring, the slip, and the ghost way back', async () => {
    const screen = await render(
      <div className="today-clear">
        <span className="today-clear__mark" />
        <div className="fare-slip"><div className="fare-slip__cell" /><div className="fare-slip__cell" /><div className="fare-slip__cell" /></div>
        <button type="button" className="btn-depart btn-depart--ghost"><span className="btn-depart__jp">Back</span></button>
      </div>
    )
    const mark = getComputedStyle(screen.container.querySelector('.today-clear__mark'))
    expect(mark.width).toBe('56px')
    expect(mark.height).toBe('56px')
    expect(getComputedStyle(screen.container.querySelector('.fare-slip')).gridTemplateColumns.split(' ')).toHaveLength(3)
    const ghost = getComputedStyle(screen.container.querySelector('.btn-depart--ghost'))
    expect(ghost.backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(ghost.boxShadow).toBe('none')
  })

  it('the browse nav is two columns on the stage\'s foot', async () => {
    const screen = await render(
      <main className="container stage">
        <div className="stage__foot browse-nav">
          <button type="button" className="btn-secondary">Previous</button>
          <button type="button" className="btn-primary">Next</button>
        </div>
      </main>
    )
    const nav = getComputedStyle(screen.container.querySelector('.browse-nav'))
    expect(nav.display).toBe('grid')
    expect(nav.gridTemplateColumns.split(' ')).toHaveLength(2)
  })
})
