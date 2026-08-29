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
        <span className="next-service__jp" lang="ja">本日の運行</span>
        <span className="next-service__when">3h</span>
        <span className="next-service__latin">Today</span>
      </div>
    )
    const strip = screen.container.querySelector('.next-service')
    const jp    = screen.container.querySelector('.next-service__jp')
    const when  = screen.container.querySelector('.next-service__when')
    const latin = screen.container.querySelector('.next-service__latin')

    const primary = getComputedStyle(strip).color
    // Regression guard for the formerly-undefined dim-text token: an
    // invalid var() on an inherited property makes the element inherit
    // instead, which silently flattened every dim register onto the body
    // colour.
    expect(getComputedStyle(when).color).not.toBe(primary)

    // The caption used to be a color-mix() against `transparent`, and this
    // asserted the result was translucent -- translucency being the visible
    // proof that the mix had resolved rather than collapsing to an inherited
    // fallback. The mix is gone: it composited toward the GROUND, not the
    // ink, so it cost contrast in both themes and failed at 4.01:1 in dark.
    // The failure mode it guarded has not gone anywhere, so the guard moves
    // rather than being deleted. .next-service__jp now takes the block's own
    // ink, so an unresolved --ns-ink-soft would make the caption inherit and
    // land on exactly jp's colour -- which is what this catches.
    expect(getComputedStyle(latin).color).not.toBe(getComputedStyle(jp).color)

    // And the inverse of the old assertion, because the rule is now absolute:
    // no ink in this strip may be a mix toward `transparent`.
    for (const el of [jp, when, latin]) {
      expect(getComputedStyle(el).color).not.toMatch(/rgba|\/\s*0?\./)
    }
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
