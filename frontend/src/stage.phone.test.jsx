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
          <div className="hstrip hstrip--free hstrip--solo"><button type="button" className="hstrip__bal"><span className="hstrip__fig"><b>24</b></span></button></div>
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
    // The pass at pocket size: the card's strip holding the balance alone (plan 173).
    expect(getComputedStyle(screen.container.querySelector('.hstrip--solo')).height).toBe('34px')
    expect(getComputedStyle(screen.container.querySelector('.today-remaining')).borderRadius).toBe('999px')
  })

  it('docks the level bar on the bottom edge and the rating bar on top of it', async () => {
    // The stage frame stamps this on <html> (useChrome); the fixture
    // does it by hand so --dock-bottom resolves the way it does on a run.
    document.documentElement.dataset.chrome = 'stage'
    try {
      const screen = await render(
        <div className="screen">
          <main className="container stage">
            <div className="prompt-card"><div className="prompt-card__body">駅</div></div>
            <div className="rating-bar">
              <div className="rating-bar__buttons rating-bar__buttons--4">
                <div className="rating-bar__misses">
                  <button type="button" className="rating-bar__btn rating-bar__btn--q1"><span className="rating-bar__btn-ring" /><span className="rating-bar__btn-label">Wrong</span></button>
                  <button type="button" className="rating-bar__btn rating-bar__btn--q2"><span className="rating-bar__btn-ring" /><span className="rating-bar__btn-label">Almost</span></button>
                  <button type="button" className="rating-bar__btn rating-bar__btn--q3"><span className="rating-bar__btn-ring" /><span className="rating-bar__btn-label">Difficult</span></button>
                </div>
                <div className="rating-bar__keys">
                  <button type="button" className="rating-bar__btn rating-bar__btn--q4 rating-bar__btn--key rating-bar__btn--best"><span className="rating-bar__btn-label">Correct</span></button>
                </div>
              </div>
            </div>
          </main>
          <div className="lvlbar">
            <span className="lvlbar__level">Lv<b className="lvlbar__level-num">12</b></span>
            <span className="lvlbar__track"><span className="lvlbar__fill" style={{ width: '40%' }} /></span>
            <span className="lvlbar__xp">200 / 500<span className="lvlbar__unit">xp</span></span>
          </div>
        </div>
      )
      const lvl = screen.container.querySelector('.lvlbar')
      const lvlStyle = getComputedStyle(lvl)
      expect(lvlStyle.position).toBe('sticky')
      expect(lvlStyle.bottom).toBe('0px')
      expect(lvl.getBoundingClientRect().height).toBe(36)
      // The rating bar docks over the level bar's height, not on the inset.
      const bar = screen.container.querySelector('.rating-bar')
      expect(getComputedStyle(bar).bottom).toBe('36px')
      // 正解 (plan 180): the misses are one instrument -- one hairline
      // and a panel's corner round them, a hairline between two -- and
      // Correct a key of its own beside it, a gap apart, wider than a
      // miss and filled in its verdict's ink with the sumi type on it.
      // Not gold: gold is the action's metal (plan 174).
      expect(getComputedStyle(screen.container.querySelector('.rating-bar__buttons')).columnGap).toBe('8px')
      const misses = getComputedStyle(screen.container.querySelector('.rating-bar__misses'))
      expect(misses.columnGap).toBe('0px')
      expect(misses.outlineWidth).toBe('1px')
      expect(misses.outlineOffset).toBe('-1px')
      expect(misses.borderTopLeftRadius).toBe('8px')
      expect(misses.overflow).toBe('hidden')
      const [plain, , , key] = screen.container.querySelectorAll('.rating-bar__btn')
      expect(getComputedStyle(plain).backgroundColor).toBe('rgba(0, 0, 0, 0)')
      expect(getComputedStyle(plain).color).toBe(getComputedStyle(lvl).color)
      expect(getComputedStyle(plain).borderRadius).toBe('0px')
      expect(getComputedStyle(key).backgroundImage).toContain('linear-gradient')
      expect(getComputedStyle(key).backgroundImage).not.toContain('201, 154, 62')
      expect(getComputedStyle(key).color).toBe('rgb(28, 24, 17)')
      expect(getComputedStyle(key).borderTopLeftRadius).toBe('8px')
      expect(key.getBoundingClientRect().width).toBeGreaterThan(plain.getBoundingClientRect().width * 1.3)
      expect(Math.round(key.getBoundingClientRect().height)).toBe(Math.round(plain.getBoundingClientRect().height))
      const ring = getComputedStyle(plain.querySelector('.rating-bar__btn-ring'))
      expect(ring.width).toBe('26px')
      expect(ring.height).toBe('6px')
    } finally {
      delete document.documentElement.dataset.chrome
    }
  })

  // 上下 (plan 174): a run with a tally floors on the level as the card's
  // struck 辻, a rung taller than the strip, and the docks above read
  // its height.
  it('docks the run\'s floor on the bottom edge and the rating bar on top of it', async () => {
    document.documentElement.dataset.chrome = 'stage'
    try {
      const screen = await render(
        <div className="screen">
          <main className="container stage">
            <div className="prompt-card"><div className="prompt-card__body">駅</div></div>
            <div className="rating-bar"><div className="rating-bar__buttons rating-bar__buttons--2" /></div>
          </main>
          <div className="run-floor run-floor--free">
            <span className="run-floor__track"><span className="run-floor__fill" style={{ width: '40%' }} /></span>
          </div>
        </div>
      )
      const floor = screen.container.querySelector('.run-floor')
      expect(getComputedStyle(floor).position).toBe('sticky')
      expect(floor.getBoundingClientRect().height).toBe(60)
      expect(getComputedStyle(screen.container.querySelector('.rating-bar')).bottom).toBe('60px')
    } finally {
      delete document.documentElement.dataset.chrome
    }
  })

  it('the lanes are 44px switches, off at the disabled opacity', async () => {
    const screen = await render(
      <div className="gate-sheet">
        <div className="gate-sheet__line">
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

  it('the browse nav is two columns on the stage\'s foot, on the card\'s own column', async () => {
    const screen = await render(
      <main className="container stage">
        <div className="quiz-card-stage">
          <div className="prompt-card"><div className="prompt-card__body">駅</div></div>
        </div>
        <div className="stage__foot browse-nav">
          <button type="button" className="btn-secondary">Previous</button>
          <button type="button" className="btn-primary">Next</button>
        </div>
      </main>
    )
    const nav = getComputedStyle(screen.container.querySelector('.browse-nav'))
    expect(nav.display).toBe('grid')
    expect(nav.gridTemplateColumns.split(' ')).toHaveLength(2)
    // The pair runs the whole width of the card above it. The foot is
    // docked here (bled to both edges on negative inline margins, then
    // re-padded to the page's gutter), and a percentage width used to
    // ignore those margins: the row sat 16px left of its column with
    // Next 32px short of the card's right edge.
    const edges = el => el.getBoundingClientRect()
    const card = edges(screen.container.querySelector('.prompt-card'))
    const prev = edges(screen.container.querySelector('.browse-nav .btn-secondary'))
    const next = edges(screen.container.querySelector('.browse-nav .btn-primary'))
    expect(prev.left).toBe(card.left)
    expect(next.right).toBe(card.right)
    // And they split it evenly, so neither action is the wider target.
    expect(Math.round(prev.width)).toBe(Math.round(next.width))
  })
})
