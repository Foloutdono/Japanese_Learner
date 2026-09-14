import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
// The panel's own geometry, its touch-action and its overscroll rule
// are the stylesheet's; component tests do not import it themselves
// (main.jsx does).
import '../../index.css'
import { Sheet } from './Sheet'

// ── 引き戸 — pushing a sheet shut ──────────────────────────────
// The touch lane, because this is a touch gesture: `hasTouch` is what
// makes chromium report a coarse pointer and dispatch these events at
// all, and the hook listens to TOUCH rather than to pointer events
// because a real browser cancels the pointer stream one frame into a
// vertical drag (hooks/useSheetDrag carries the captured trace).
//
// What is pinned here is the contract, not the arithmetic: a deliberate
// push shuts it, a nudge does not and springs back, a flick shuts it on
// speed rather than distance, and the two things that outrank the
// gesture — a field's own drag, and the scroll a sheet still has left —
// keep it. Two tests carry the freeze that the pointer version shipped
// with: the drag has to be claimed from the browser, and the panel has
// to tell the browser the gesture is its own.

const STEP = 16 // ms per move, near enough a frame

function touch(node, type, y, { x = 40 } = {}) {
  const point = new Touch({ identifier: 1, target: node, clientX: x, clientY: y })
  const list = type === 'touchend' || type === 'touchcancel' ? [] : [point]
  node.dispatchEvent(new TouchEvent(type, {
    bubbles: true, cancelable: true,
    touches: list, targetTouches: list, changedTouches: [point],
  }))
}

const tick = ms => new Promise(r => setTimeout(r, ms))

// One gesture: press, a run of moves, release. `pace` is the ms between
// moves — small is a flick, large is a deliberate push.
async function drag(node, from, to, { pace = STEP, steps = 4 } = {}) {
  touch(node, 'touchstart', from)
  for (let i = 1; i <= steps; i++) {
    touch(node, 'touchmove', from + ((to - from) * i) / steps)
    await tick(pace)
  }
  touch(node, 'touchend', to)
  await tick(0)
}

async function open(onClose, children = <p>body</p>) {
  // The panel is a PORTAL onto document.body (chrome/Sheet.jsx), so it
  // is never under the render's own container.
  await render(<Sheet open onClose={onClose} label="sheet" jp="運行状況">{children}</Sheet>)
  return document.querySelector('.sheet')
}

// A mouse has a grip: the handle and the head. Pointer events, because
// a mouse emits no touch stream; dispatched on the grip, released on
// the window, the way a real drag that wanders off the panel ends.
function mouse(node, type, y, extra = {}) {
  node.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerType: 'mouse', pointerId: 7, button: 0, clientX: 40, clientY: y, ...extra,
  }))
}

async function mouseDrag(grip, from, to, { pace = STEP, steps = 4 } = {}) {
  mouse(grip, 'pointerdown', from)
  for (let i = 1; i <= steps; i++) {
    mouse(window, 'pointermove', from + ((to - from) * i) / steps)
    await tick(pace)
  }
  mouse(window, 'pointerup', to)
  await tick(0)
}

describe('a sheet is dragged shut by a mouse, from its grip', () => {
  it('shuts on a push down from the head', async () => {
    const onClose = vi.fn()
    const sheet = await open(onClose)
    await mouseDrag(sheet.querySelector('.sheet__head'), 100, 260)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(sheet.style.transform).toBe('')
  })

  it('shuts on a push down from the handle', async () => {
    const onClose = vi.fn()
    const sheet = await open(onClose)
    await mouseDrag(sheet.querySelector('.sheet__handle'), 100, 260)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a mouse drag in the body is a selection, not a dismissal', async () => {
    const onClose = vi.fn()
    const sheet = await open(onClose)
    await mouseDrag(sheet.querySelector('p'), 100, 260)
    expect(onClose).not.toHaveBeenCalled()
    expect(sheet.style.transform).toBe('')
  })

  it('springs back from a nudge', async () => {
    const onClose = vi.fn()
    const sheet = await open(onClose)
    await mouseDrag(sheet.querySelector('.sheet__head'), 100, 130, { pace: 60 })
    expect(onClose).not.toHaveBeenCalled()
    expect(sheet.classList.contains('sheet--dragging')).toBe(false)
  })
})

describe('a sheet is dragged shut', () => {
  it('shuts on a deliberate push down', async () => {
    const onClose = vi.fn()
    const sheet = await open(onClose)
    await drag(sheet, 100, 260)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('shuts on a flick — short, but fast', async () => {
    const onClose = vi.fn()
    const sheet = await open(onClose)
    // Half the deliberate push's distance, covered in two frames.
    await drag(sheet, 100, 160, { pace: 0, steps: 2 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('springs back from a nudge, and leaves no transform behind', async () => {
    const onClose = vi.fn()
    const sheet = await open(onClose)
    await drag(sheet, 100, 130, { pace: 60 })
    expect(onClose).not.toHaveBeenCalled()
    // Back at rest means the stylesheet is in charge again — a
    // translateY(0px) left inline would still be an inline transform.
    expect(sheet.style.transform).toBe('')
    expect(sheet.classList.contains('sheet--dragging')).toBe(false)
  })

  it('follows the finger while the finger is down', async () => {
    const sheet = await open(vi.fn())
    touch(sheet, 'touchstart', 100)
    touch(sheet, 'touchmove', 190)
    await tick(STEP)
    expect(sheet.style.transform).toContain('translateY')
    // No transition while it is being held: a sheet that eases toward
    // the thumb is a sheet that lags behind it.
    expect(sheet.classList.contains('sheet--dragging')).toBe(true)
    expect(getComputedStyle(sheet).transitionDuration).toBe('0s')
    touch(sheet, 'touchend', 190)
  })

  it('claims the gesture from the browser once it is a drag', async () => {
    // The whole reason this is not on pointer events. Until the drag is
    // claimed the move is the browser's to scroll with; from the claim
    // on it is prevented, or the browser takes it as a scroll and
    // answers with a pointercancel — the drag then freezes with the
    // thumb still down. Real handset behaviour, invisible to a
    // synthetic PointerEvent, which is why it is stated here.
    const sheet = await open(vi.fn())
    const prevented = []
    sheet.addEventListener('touchmove', e => prevented.push(e.defaultPrevented))
    touch(sheet, 'touchstart', 100)
    touch(sheet, 'touchmove', 103)   // inside the slop: still the browser's
    touch(sheet, 'touchmove', 180)   // claimed
    touch(sheet, 'touchmove', 240)
    await tick(STEP)
    expect(prevented).toEqual([false, true, true])
    touch(sheet, 'touchend', 240)
  })

  it('ignores a drag upward — that is the overscroll bounce', async () => {
    const onClose = vi.fn()
    const sheet = await open(onClose)
    await drag(sheet, 300, 120)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('leaves a field its own drag', async () => {
    const onClose = vi.fn()
    await open(onClose, <input aria-label="q" defaultValue="hello" />)
    const field = document.querySelector('.sheet input')
    await drag(field, 100, 260)
    // Dragging inside an input is the caret's gesture, not the sheet's.
    expect(onClose).not.toHaveBeenCalled()
  })

  it('scrolls before it dismisses', async () => {
    const onClose = vi.fn()
    // flexShrink: 0 — the panel is a flex column, so a tall child is
    // squashed to fit rather than overflowing, and there would be
    // nothing to scroll.
    const sheet = await open(onClose, <div style={{ height: '3000px', flexShrink: 0 }}>tall</div>)
    sheet.scrollTop = 400
    expect(sheet.scrollTop, 'the panel has to be scrolled for this to test anything').toBe(400)
    await drag(sheet, 100, 300)
    // There is content above: that gesture was a scroll, and the sheet
    // has no business reading it as "go away".
    expect(onClose).not.toHaveBeenCalled()
  })

  it('declares the gesture to the browser', async () => {
    const sheet = await open(vi.fn())
    const css = getComputedStyle(sheet)
    // `pan-y` leaves the sheet's own scroll alone and rules out the
    // horizontal pan and the double-tap zoom, which a sheet has no use
    // for. `none` would take the scroll with them.
    expect(css.touchAction).toBe('pan-y')
    // ...and `contain` keeps the gesture from chaining to the page
    // behind, which is where the browser used to find something to
    // scroll and take the drag away. A modal's backdrop should not
    // scroll under it in any case.
    expect(css.overscrollBehaviorY).toBe('contain')
  })
})
