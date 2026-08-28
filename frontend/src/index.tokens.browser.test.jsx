import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// The dim registers on .next-service / .today-* are pure CSS contracts, so
// this pins the stylesheet directly rather than mounting NextService and
// TodayScreen (which would need LangProvider, a fetch stub and a dozen
// props none of which this is about). Same import trick as
// AnalyzerHistory.browser.test.jsx: the rules only exist if the sheet is
// really loaded.
import './index.css'

describe('the dimmed text register', () => {
  it('renders a strictly different colour from the primary one', async () => {
    const screen = await render(
      <div className="next-service">
        <span className="next-service__when">3h</span>
        <span className="next-service__latin">Today</span>
      </div>
    )
    const strip = screen.container.querySelector('.next-service')
    const when  = screen.container.querySelector('.next-service__when')
    const latin = screen.container.querySelector('.next-service__latin')

    const primary = getComputedStyle(strip).color
    // Regression guard for the formerly-undefined dim-text token: an
    // invalid var() on an inherited property makes the element inherit
    // instead, which silently flattened every dim register onto the body
    // colour.
    expect(getComputedStyle(when).color).not.toBe(primary)

    // The color-mix() site is a separate failure mode -- one bad var()
    // invalidates the whole function -- so it gets its own assertion.
    // A real mix against `transparent` is translucent; the inherited
    // fallback never is.
    expect(getComputedStyle(latin).color).toMatch(/rgba|\/\s*0?\./)
  })

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
