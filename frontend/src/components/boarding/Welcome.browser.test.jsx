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
// Since plan 167 the rolling stock is the crossroads, drawn on the
// paper's own box: a shorter screen draws shorter lines rather than cut
// a name, and the gold road still runs from 辻 into Board's reader.

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

  for (const [name, w, h] of PHONES) {
    it(`draws every line and its name whole on ${name}`, async () => {
      const root = await renderWelcome(w, h)
      const frame = root.querySelector('.brd--welcome').getBoundingClientRect()
      const map = root.querySelector('.brd-front__map').getBoundingClientRect()
      const stations = [...root.querySelectorAll('.brd-front__stn')]
      expect(stations).toHaveLength(7)
      for (const stn of stations) {
        for (const part of stn.querySelectorAll('.brd-front__sign, .brd-front__name')) {
          const b = part.getBoundingClientRect()
          expect(b.left, stn.dataset.line).toBeGreaterThanOrEqual(frame.left)
          expect(b.right, stn.dataset.line).toBeLessThanOrEqual(frame.right)
          expect(b.top, stn.dataset.line).toBeGreaterThanOrEqual(map.top - 1)
          expect(b.bottom, stn.dataset.line).toBeLessThanOrEqual(map.bottom + 1)
        }
      }
    })
  }

  it('runs the gold road from 辻 down into Board\'s reader', async () => {
    const root = await renderWelcome(393, 807)
    const map = root.querySelector('.brd-front__map').getBoundingClientRect()
    const figures = root.querySelector('.brd-front__way').getAttribute('d')
      .split(/[\s,A-Z]+/).filter(Boolean).map(Number)
    const hub = root.querySelector('.brd-front__hub').getBoundingClientRect()
    const reader = root.querySelector('[data-action="board"] .btn-depart__reader').getBoundingClientRect()
    // From the hub's centre …
    expect(Math.abs(map.left + figures[0] - (hub.left + hub.width / 2))).toBeLessThanOrEqual(1)
    expect(Math.abs(map.top + figures[1] - (hub.top + hub.height / 2))).toBeLessThanOrEqual(1)
    // … to the paper's foot, over the reader's centre.
    const [x, y] = figures.slice(-2)
    expect(Math.abs(map.left + x - (reader.left + reader.width / 2))).toBeLessThanOrEqual(1)
    expect(Math.abs(map.top + y - map.bottom)).toBeLessThanOrEqual(1)
  })
})
