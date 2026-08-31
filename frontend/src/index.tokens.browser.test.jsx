import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// The dim registers on .today-* are pure CSS contracts, so this pins
// the stylesheet directly rather than mounting TodayScreen (which
// would need LangProvider, a fetch stub and a dozen props none of
// which this is about). Same import trick as
// AnalyzerHistory.browser.test.jsx: the rules only exist if the sheet
// is really loaded.
//
// A first test here pinned .next-service's --ns-ink indirection; that
// strip retired with the wall-map redesign (its successor, the gate
// card, has ONE ground and needs no indirection), so the test went
// with the component it guarded.
import './index.css'

describe('the dimmed text register', () => {
  it('gives the Today tick a border colour of its own', async () => {
    // index.css's .today-lane-row__tick mixes the same dim-text token
    // inside a border shorthand; with the token undefined the whole
    // color-mix() dropped and border-color fell back to currentColor.
    const screen = await render(
      <div className="today-lane-row"><span className="today-lane-row__tick" /></div>
    )
    const row  = screen.container.querySelector('.today-lane-row')
    const tick = screen.container.querySelector('.today-lane-row__tick')
    expect(getComputedStyle(tick).borderTopColor)
      .not.toBe(getComputedStyle(row).color)
  })
})
