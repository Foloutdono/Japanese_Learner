import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider, useLang } from '../../LangContext'
import { getSections } from '../../config/tabs'
// The layout under test is entirely the stylesheet's (the max-width:
// 768px block, "The map is the wall"), so the sheet has to be loaded.
import '../../index.css'
import { WallMap } from './WallMap'

// ── 路線図 — the map takes the wall, ALL of it ─────────────────
// The phone lane, at 390×844, because the rule under test only exists
// under `max-width: 768px` and only means anything when the board has
// a page to fill.
//
// The map fills the Learn gate's page and its rows share the room. The
// bug this pins: the SHELF was left out of the sharing. `.wmap__lines`
// took `flex: 1` and the deck row's group took nothing, so four lanes
// grew into all the slack and the one row under them stayed at its
// natural height — a squeezed strip under four lanes with air around
// them. Every row on the wall is a row, so every row gets a share, and
// the split is per ROW (--rows, set by the component) rather than per
// GROUP, which would have handed one deck row as much as four lanes.

function Harness({ decks = true }) {
  const { t } = useLang()
  const sections = getSections('learn', t)
  const shelf = sections.find(s => s.path === '/learn/decks')
  return (
    // The app's own frame: .phone is 100dvh and .phone__content is the
    // flex child a screen grows inside (chrome/Shell.jsx). Without it
    // there is no slack to share and the rule under test is inert.
    <div className="phone">
      <div className="phone__content">
        <main className="learn">
          <WallMap
            sections={sections}
            stats={null}
            bySource={{}}
            onDepart={vi.fn()}
            decks={decks ? { section: shelf, count: 2, cards: 47, due: 3 } : null}
          />
        </main>
      </div>
    </div>
  )
}

const mount = (props) => render(<LangProvider><Harness {...props} /></LangProvider>)
const h = el => el.getBoundingClientRect().height

// The lowest a panel on this page may reach: the gate page's content
// box, inside its own bottom gutter.
function pageFloor(root) {
  const page = root.querySelector('.learn')
  return page.getBoundingClientRect().bottom
    - parseFloat(getComputedStyle(page).paddingBottom)
}

describe('the wall map fills the phone', () => {
  it('shares the room with the shelf, not only with the lanes', async () => {
    const screen = await mount()
    const root = screen.container
    const lanes = [...root.querySelectorAll('.wmap-line')]
    const shelf = root.querySelector('.wmap-row')
    expect(lanes).toHaveLength(4)
    expect(shelf).not.toBeNull()

    // A lane is naturally taller than the shelf row by exactly one
    // track — the rail, its stops and their names, which a shelf row
    // has not got. Past that difference the two should stand level: it
    // is the same identity block with the same air around it.
    const track = h(lanes[0].querySelector('.wmap-track'))
    const lane = Math.min(...lanes.map(h))
    expect(h(shelf)).toBeGreaterThan(lane - track - 24)

    // Stated the other way, so a regression cannot pass by making the
    // LANES short instead: the shelf is well past the height it has
    // with no slack at all (a 30px roundel in 12px of padding).
    expect(h(shelf)).toBeGreaterThan(70)
  })

  it('leaves no air pooled under the last row', async () => {
    const screen = await mount()
    const root = screen.container
    const board = root.querySelector('.board').getBoundingClientRect()
    // The board reaches the bottom of the page's own content box — the
    // page keeps its gutter (.learn's padding) and the room the tab bar
    // is docked in (.phone__content's), and neither is air pooled under
    // the map.
    expect(board.bottom).toBeGreaterThan(pageFloor(root) - 2)
  })

  it('counts the lanes for the split rather than assuming four', async () => {
    const screen = await mount()
    const lines = screen.container.querySelector('.wmap__lines')
    // --rows is the component's, so a fifth tracked line re-balances the
    // wall instead of quietly giving the shelf a fifth of it.
    expect(lines.style.getPropertyValue('--rows'))
      .toBe(String(screen.container.querySelectorAll('.wmap-line').length))
  })

  it('still fills the page with no shelf to share it with', async () => {
    const screen = await mount({ decks: false })
    const root = screen.container
    expect(root.querySelector('.wmap-row')).toBeNull()
    const board = root.querySelector('.board').getBoundingClientRect()
    expect(board.bottom).toBeGreaterThan(pageFloor(root) - 2)
  })
})
