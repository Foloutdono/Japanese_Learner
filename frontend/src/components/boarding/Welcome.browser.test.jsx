import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { LangProvider } from '../../LangContext'
// The rules asserted below only exist once the real sheet is loaded —
// same explicit import every style-asserting browser test carries.
import '../../index.css'

// ── Welcome — the screen a stranger lands on ──────────────────────
// Step zero of the boarding is the one screen with no way out but the
// two controls in its foot, so the thing to pin is not what it says but
// that it never moves: no scrollbar on either axis, and Embarquer and
// "Déjà un compte ?" on screen at every height a phone comes in.
//
// It got this wrong on both axes at once, and each has its own trap:
//
//  - the frame carried `min-height: 100dvh` rather than a height, so
//    `.brd__body` — the flex child that owns the scrolling — never had
//    a settled height to overflow. On a short screen the frame just
//    grew and the DOCUMENT scrolled, carrying the foot off the bottom.
//  - `.brd-roll` bleeds var(--sp-5) past the body on each side to reach
//    the screen edge, and a box that scrolls one axis scrolls the other
//    (`overflow-y: auto` computes x to `auto` — the spec, not a quirk),
//    so that bleed was 16px of real horizontal overflow: the whole
//    screen panned sideways under a scrollbar of its own.
//
// Both are geometry, so both are measured here rather than described.

// LangContext pulls the content-translation maps over the network on
// mount — same stub the boarding flow's own suite uses.
globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

const { default: Welcome } = await import('./Welcome')

const settle = (ms = 80) => new Promise(r => setTimeout(r, ms))

// Every phone this has to survive, by CSS height: a current handset, a
// small one, and one short enough that two lanes of cards cannot fit.
const PHONES = [
  ['a current handset', 393, 807],
  ['a small handset', 360, 780],
  ['a short screen', 393, 660],
]

async function renderWelcome(w, h) {
  await page.viewport(w, h)
  const screen = await render(
    <LangProvider>
      <Welcome onBoard={() => {}} onSignIn={() => {}} />
    </LangProvider>,
  )
  await settle()
  return screen.container
}

afterEach(async () => { await cleanup() })

describe('the welcome screen holds still', () => {
  for (const [name, w, h] of PHONES) {
    it(`neither scrolls nor pans on ${name}`, async () => {
      const root = await renderWelcome(w, h)
      const frame = root.querySelector('.brd--welcome')
      const body = root.querySelector('.brd__body')
      const foot = root.querySelector('.brd__foot')

      // The frame is the viewport, not more: a definite height is what
      // hands the body something to scroll inside of.
      expect(frame.getBoundingClientRect().height).toBeCloseTo(h, 0)

      // Nothing to scroll vertically, and nothing to pan sideways. The
      // pan is probed by asking for it — scrollWidth still reports
      // clipped content, so only scrollLeft tells the truth.
      expect(body.scrollHeight).toBeLessThanOrEqual(body.clientHeight + 1)
      body.scrollLeft = 999
      const panned = body.scrollLeft
      body.scrollLeft = 0
      expect(panned).toBe(0)

      // The two controls are the screen's whole purpose.
      expect(foot.getBoundingClientRect().bottom)
        .toBeLessThanOrEqual(frame.getBoundingClientRect().bottom + 1)
    })
  }

  it('still runs the cards to both screen edges', async () => {
    const root = await renderWelcome(393, 807)
    const frame = root.querySelector('.brd--welcome').getBoundingClientRect()
    const roll = root.querySelector('.brd-roll').getBoundingClientRect()
    // The bleed is the point of the roll: it reaches past the frame's
    // gutter to the edge. Widening the body to carry it is what removed
    // the overflow — the bleed itself must survive that.
    expect(roll.left).toBeCloseTo(frame.left, 0)
    expect(roll.right).toBeCloseTo(frame.right, 0)
  })

  it('keeps one lane whole rather than slicing two, when the screen is short', async () => {
    const tall = await renderWelcome(393, 807)
    const bothLanes = [...tall.querySelectorAll('.brd-roll__lane')]
      .filter(l => getComputedStyle(l).display !== 'none')
    expect(bothLanes).toHaveLength(2)
    // Two 204px cards and the sp-4 between them fit whole at this height.
    const rollTall = tall.querySelector('.brd-roll').getBoundingClientRect()
    for (const lane of bothLanes) {
      const b = lane.getBoundingClientRect()
      expect(b.top).toBeGreaterThanOrEqual(rollTall.top - 1)
      expect(b.bottom).toBeLessThanOrEqual(rollTall.bottom + 1)
    }

    await cleanup()

    const short = await renderWelcome(393, 660)
    const shownLanes = [...short.querySelectorAll('.brd-roll__lane')]
      .filter(l => getComputedStyle(l).display !== 'none')
    expect(shownLanes).toHaveLength(1)
    // And the one that stays is whole — a card cut through its own word
    // is what dropping the second lane exists to avoid.
    const rollShort = short.querySelector('.brd-roll').getBoundingClientRect()
    const kept = shownLanes[0].getBoundingClientRect()
    expect(kept.top).toBeGreaterThanOrEqual(rollShort.top - 1)
    expect(kept.bottom).toBeLessThanOrEqual(rollShort.bottom + 1)
  })
})
