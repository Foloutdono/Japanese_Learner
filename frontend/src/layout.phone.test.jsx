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

// Long enough for the shared `arrive` to finish: 0.32s of animation
// behind a stagger that reaches 0.23s at the eighth row.
const settle = (ms = 620) => new Promise(r => setTimeout(r, ms))

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

  // ── Every tab screen stands in the same box ──
  // .learn, .practice, .today and .dictionary were inset --sp-5 down
  // each side with --sp-6 under the last block; the pass, the stamp
  // book and the settings rows ran edge to edge, because the three
  // pages behind the pass were the only screens the rule never
  // reached. The pass then carried 44px under itself from when it
  // stood alone, which the column's own gap added to: a 60px hole
  // between the pass and the stamp book.
  it('stands the profile, the statistics and the settings in the screen box', async () => {
    const screen = await render(
      <div>
        <main className="learn" />
        <main className="profile" />
        <main className="stats" />
        <main className="settings" />
        <div className="pass" />
      </div>
    )
    const box = sel => {
      const c = getComputedStyle(screen.container.querySelector(sel))
      return `${c.paddingLeft} ${c.paddingRight} ${c.paddingBottom}`
    }
    expect(box('.learn')).toBe('16px 16px 22px')
    for (const page of ['.profile', '.stats', '.settings']) expect(box(page), page).toBe(box('.learn'))
    // And a block in that column brings no margin of its own to it.
    expect(getComputedStyle(screen.container.querySelector('.pass')).marginBottom).toBe('0px')
  })

  // ── The segmented control is one instrument ──
  // Its segments are divided by hairlines, not gaps or boxes
  // (DESIGN.md, Controls). Every option is a <button>, and the bare
  // `button` rule gives one --r-panel of radius, so the selected
  // segment printed as a rounded rectangle inside the pill: on either
  // side of the hairline, two curves turning away from each other
  // where a straight division belongs.
  it('divides a segmented control with a straight hairline, and rounds only its ends', async () => {
    const screen = await render(
      <div className="seg seg--full">
        <button type="button" className="seg__opt seg__opt--on"><span className="seg__opt-latin">Texte</span></button>
        <button type="button" className="seg__opt"><span className="seg__opt-latin">Photo</span></button>
        <button type="button" className="seg__opt"><span className="seg__opt-latin">Vidéo</span></button>
      </div>
    )
    const seg = screen.container.querySelector('.seg')
    const opts = [...seg.querySelectorAll('.seg__opt')]
    // The pill and the clip are the container's, and only the container's.
    expect(getComputedStyle(seg).overflow).toBe('hidden')
    expect(parseFloat(getComputedStyle(seg).borderTopLeftRadius)).toBeGreaterThan(100)
    for (const opt of opts) expect(getComputedStyle(opt).borderRadius).toBe('0px')
    // One hairline between two segments, none before the first.
    expect(getComputedStyle(opts[0]).borderLeftWidth).toBe('0px')
    for (const opt of opts.slice(1)) {
      expect(getComputedStyle(opt).borderLeftWidth).toBe('1px')
      expect(getComputedStyle(opt).borderLeftStyle).toBe('solid')
    }
    // And the lit segment's fill runs the full height into it.
    expect(Math.round(opts[0].getBoundingClientRect().height))
      .toBe(Math.round(seg.getBoundingClientRect().height - 2))
  })

  // ── 路線図 — the rail and its markers stand on one line, ON the card ──
  // A retired phone block (the pre-071 diagram, its rail inside a 52px
  // card indent) was still overriding the real one below 560px, and
  // the rail ran 7.5px to the right of its own dots on every level
  // list, kana list and exam list the app has.
  //
  // The axis is inside the card now. It stood in a 30px margin the
  // route reserved to its left, which spent that width on every row
  // and drew the line as something the stops were parked beside
  // rather than something they are on. Owner's call.
  it('stands the route rail on the axis of its markers, on the card', async () => {
    const screen = await render(
      <div className="route">
        <button type="button" className="route-stop route-stop--first route-stop--past">
          <span className="route-stop__rail" /><span className="route-stop__marker" />
          <span className="route-stop__code">きゃ</span>
        </button>
        <button type="button" className="route-stop route-stop--current route-stop--last">
          <span className="route-stop__rail" /><span className="route-stop__marker" />
          <span className="route-stop__code">キャ</span>
        </button>
      </div>
    )
    const route = screen.container.querySelector('.route').getBoundingClientRect()
    const mid = el => { const r = el.getBoundingClientRect(); return (r.left + r.right) / 2 }
    for (const stop of screen.container.querySelectorAll('.route-stop')) {
      const card = stop.getBoundingClientRect()
      const marker = stop.querySelector('.route-stop__marker').getBoundingClientRect()
      const rail = stop.querySelector('.route-stop__rail')
      expect(mid(rail)).toBeCloseTo(mid(stop.querySelector('.route-stop__marker')), 1)
      // The card takes the whole width the route has, and the mark —
      // the current stop's 3px ring included — stands on it.
      expect(card.left).toBe(route.left)
      expect(card.right).toBe(route.right)
      expect(marker.left).toBeGreaterThan(card.left)
      // Clear of the code beside it, which is what the left pad is for.
      const code = stop.querySelector('.route-stop__code').getBoundingClientRect()
      expect(marker.right).toBeLessThanOrEqual(code.left)
      // Two kana fit the code column on one line — it was 34px wide and
      // broke きゃ one character to a line.
      expect(code.height).toBeLessThan(parseFloat(getComputedStyle(stop.querySelector('.route-stop__code')).fontSize) * 2)
      // The rail bridges the gap to the next card, so the line the
      // stops stand on is unbroken between them.
      const r = rail.getBoundingClientRect()
      if (!stop.classList.contains('route-stop--first')) expect(r.top).toBeLessThan(card.top)
      if (!stop.classList.contains('route-stop--last')) expect(r.bottom).toBeGreaterThan(card.bottom)
    }
  })

  // ── 路線図 — the line runs the height of the screen ──
  // On the page it is actually drawn on, the route was its content's
  // own height and no more: four kana sets ended 360px above the tab
  // bar of a 746px screen, five JLPT grades 324px. Half a phone of
  // nothing under a diagram whose subject is distance.
  it('gives a station page\'s route the whole page, and its stops an equal share', async () => {
    const stop = i => (
      <button type="button" key={i} className={`route-stop${i === 0 ? ' route-stop--first' : ''}`}>
        <span className="route-stop__rail" /><span className="route-stop__marker" />
        <span className="route-stop__code">N5</span>
        <span className="route-stop__names"><span className="route-stop__jp">Niveau débutant</span></span>
        <span className="route-stop__fig"><b>120</b>/ 800</span>
        <span className="route-stop__go">▶</span>
        <span className="route-stop__bar"><span className="route-stop__fill" style={{ width: '15%' }} /></span>
      </button>
    )
    const screen = await render(
      <div className="phone">
        <div className="phone__content">
          <main className="learn">
            <div className="bar"><div className="bar__row" /></div>
            <div className="route">{[0, 1, 2, 3].map(stop)}</div>
          </main>
        </div>
      </div>
    )
    // The arrive animation lands the last row 10px low while it runs
    // (translateY(10px), the eighth child still delayed at 0.23s), and
    // every distance here is measured against the page's foot.
    await settle()
    const content = screen.container.querySelector('.phone__content').getBoundingClientRect()
    const route = screen.container.querySelector('.route').getBoundingClientRect()
    // The line reaches the foot of the page — nothing pooled under it.
    expect(content.bottom - route.bottom).toBeLessThanOrEqual(24)
    const stops = [...screen.container.querySelectorAll('.route-stop')].map(el => el.getBoundingClientRect())
    for (const box of stops) {
      // One share each, and each share is a thumb and then some.
      expect(box.height).toBeCloseTo(stops[0].height, 0)
      expect(box.height).toBeGreaterThan(88)
    }
    // The row stops being one line: code and figure on the first, the
    // name across the full width under them — which is what stopped
    // "Hiragana (combinaisons)" printing through the figure.
    const first = screen.container.querySelector('.route-stop')
    const code = first.querySelector('.route-stop__code').getBoundingClientRect()
    const fig = first.querySelector('.route-stop__fig').getBoundingClientRect()
    const names = first.querySelector('.route-stop__names').getBoundingClientRect()
    // Both are grid items of the first row, centred in it: the same
    // line, whatever their own type sizes.
    expect((fig.top + fig.bottom) / 2).toBeCloseTo((code.top + code.bottom) / 2, 0)
    expect(fig.bottom).toBeLessThanOrEqual(names.top)
    expect(names.top).toBeGreaterThanOrEqual(code.bottom)
    expect(names.right).toBeGreaterThan(fig.left)
    // The stop's own progress runs inside the content column, clear of
    // the card's rounded corners.
    const bar = first.querySelector('.route-stop__bar').getBoundingClientRect()
    expect(bar.left).toBeGreaterThan(first.getBoundingClientRect().left + 40)
    expect(Math.round(first.querySelector('.route-stop__fill').getBoundingClientRect().width))
      .toBe(Math.round(bar.width * 0.15))
  })

  // ── The run's foot is on the screen, not on its edge ──
  // The field and Submit of a reading run sat flush against the bottom
  // of the screen: `margin-top: auto` pins the foot, and the stage's
  // own bottom padding is --dock-bottom, which on a stage is the
  // safe-area inset ALONE — 0 in a desktop window, on Android and in
  // the preview. A browser's bar or a rounded corner then takes the
  // last of the button, which is what the owner photographed.
  it('docks a run\'s action clear of the screen\'s edge', async () => {
    const screen = await render(
      <div className="phone phone--stage">
        <div className="screen">
          <main className="container stage">
            <div className="prompt-card">かな</div>
            <div className="stage__foot">
              <input className="field" readOnly />
              <button type="button" className="btn-primary">Valider</button>
            </div>
          </main>
        </div>
      </div>
    )
    // The stage arrives 10px low; every distance here is to the edge.
    await settle()
    const btn = screen.container.querySelector('.btn-primary').getBoundingClientRect()
    expect(window.innerHeight - btn.bottom).toBeGreaterThanOrEqual(12)
    expect(btn.bottom).toBeLessThanOrEqual(window.innerHeight)
  })

  // And when the card is taller than the screen, the action stays on
  // it: the foot docks on the dock's edge the way the rating bar and
  // the exam's sheet bar do, with the card scrolling behind it.
  it('keeps that action on the screen when the stage overflows', async () => {
    const screen = await render(
      <div className="phone phone--stage">
        <div className="screen">
          <main className="container stage">
            <div className="prompt-card" style={{ height: '1400px', flex: 'none' }}>かな</div>
            <div className="stage__foot">
              <button type="button" className="btn-primary">Valider</button>
            </div>
          </main>
        </div>
      </div>
    )
    await settle()
    const foot = screen.container.querySelector('.stage__foot')
    const btn = screen.container.querySelector('.btn-primary').getBoundingClientRect()
    expect(getComputedStyle(foot).position).toBe('sticky')
    expect(btn.bottom).toBeLessThanOrEqual(window.innerHeight)
    expect(window.innerHeight - btn.bottom).toBeGreaterThanOrEqual(12)
    // Edge to edge of the stage — it cancels the page's own inset —
    // so nothing shows past it at the sides while the card passes
    // under.
    const stageBox = screen.container.querySelector('.stage').getBoundingClientRect()
    expect(Math.round(foot.getBoundingClientRect().width)).toBe(Math.round(stageBox.width))
  })

  // ── 路線図 — the map is the wall, so it takes the wall ──
  it('gives the Learn gate\'s board the whole page too', async () => {
    const line = i => (
      <button type="button" key={i} className="wmap-line">
        <span className="wmap-line__id"><span className="wmap-roundel">KN</span></span>
        <span className="wmap-line__due" />
        <span className="wmap-track" />
      </button>
    )
    const screen = await render(
      <div className="phone">
        <div className="phone__content">
          <main className="learn">
            <div className="bar"><div className="bar__row" /></div>
            <div className="board"><div className="wmap__lines">{[0, 1, 2, 3].map(line)}</div></div>
          </main>
        </div>
      </div>
    )
    await settle()
    const content = screen.container.querySelector('.phone__content').getBoundingClientRect()
    const board = screen.container.querySelector('.board').getBoundingClientRect()
    expect(content.bottom - board.bottom).toBeLessThanOrEqual(24)
    const lines = [...screen.container.querySelectorAll('.wmap-line')].map(el => el.getBoundingClientRect())
    for (const box of lines) expect(box.height).toBeCloseTo(lines[0].height, 0)
  })
})
