import { describe, it, expect, afterEach } from 'vitest'
import { render } from 'vitest-browser-react'
import './index.css'

// ── 机 — what a wide window no longer stretches (plan 123, P4) ─────
// Pinned on fixture markup against the real cascade at 1440×900, the
// same trick as the phone lanes' stylesheet contracts: the classes are
// the real ones, and what is measured is what the 机 block does to them.
//   - A state card (nothing yet, something failed) stands at the card's
//     width: an empty shelf was a 1152px card round two lines.
//   - A settings page's cards stand at the card's width: seven
//     one-word buttons ran ~770px wide. The page itself takes the width
//     beside its column since plan 139, for its two columns of cards.
//   - The sentence stations' tier toggles stand at a column's width.
//   - A shelf with nothing to open is one card across, not half a page
//     beside a blank half.
//   - The ticket gate leaves the rail lit.

const cardW = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w'))
const sideW = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--desk-side-w'))
const railW = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--desk-rail-w'))
const box = el => el.getBoundingClientRect()

function Canvas({ children }) {
  return (
    <div className="phone phone--desk">
      <div className="phone__content">{children}</div>
    </div>
  )
}

afterEach(() => { delete document.documentElement.dataset.chrome })

describe('the desk at 1440', () => {
  it('stands a state card at the card\'s width, centred in its column', async () => {
    const screen = await render(
      <Canvas>
        <main className="learn">
          <div className="empty"><p className="empty__title">No decks yet</p></div>
        </main>
      </Canvas>
    )
    const empty = box(screen.container.querySelector('.empty'))
    const main = box(screen.container.querySelector('main'))
    expect(Math.round(empty.width)).toBe(cardW())
    expect(Math.abs((empty.left - main.left) - (main.right - empty.right))).toBeLessThan(2)
  })

  it('keeps a settings page\'s actions at the card\'s width', async () => {
    const screen = await render(
      <Canvas>
        <div className="settings desk-settings">
          <nav className="desk-settings__list"><button type="button" className="stg-row">Display</button></nav>
          <section className="desk-settings__page">
            <div className="slip"><button type="button" className="btn-secondary slip__act">Export</button></div>
          </section>
        </div>
      </Canvas>
    )
    expect(box(screen.container.querySelector('.desk-settings__page > .slip')).width).toBeLessThanOrEqual(cardW())
    expect(box(screen.container.querySelector('.slip__act')).width).toBeLessThanOrEqual(cardW())
  })

  it('keeps the tier page\'s two toggles at a column\'s width', async () => {
    const screen = await render(
      <Canvas>
        <main className="learn">
          <div className="seg seg--full" role="radiogroup"><button type="button" className="seg__opt">Deck</button><button type="button" className="seg__opt">JMdict</button></div>
          <div className="tier-picker">
            <div className="tier-picker__size"><div className="seg seg--full"><button type="button" className="seg__opt">100</button></div></div>
          </div>
        </main>
      </Canvas>
    )
    expect(box(screen.container.querySelector('.learn > .seg--full')).width).toBeLessThanOrEqual(sideW())
    expect(box(screen.container.querySelector('.tier-picker__size')).width).toBeLessThanOrEqual(sideW())
  })

  it('stands a shelf with nothing to open as one card across', async () => {
    const screen = await render(
      <Canvas>
        <div className="desk-split desk-split--shelf">
          <nav className="desk-split__list"><div className="empty"><p>Nothing here</p></div></nav>
          <section className="desk-split__page" />
        </div>
      </Canvas>
    )
    const split = screen.container.querySelector('.desk-split')
    expect(getComputedStyle(split).gridTemplateColumns.split(' ')).toHaveLength(1)
  })

  it('stands the ticket gate on the canvas, the rail lit beside it', async () => {
    document.documentElement.dataset.chrome = 'shell'
    const screen = await render(<div className="gate"><span>改札</span></div>)
    expect(Math.round(box(screen.container.querySelector('.gate')).left)).toBe(railW())
    document.documentElement.dataset.chrome = 'stage'
    await new Promise(r => setTimeout(r, 30))
    expect(Math.round(box(screen.container.querySelector('.gate')).left)).toBe(0)
  })
})
