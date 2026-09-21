import { useEffect, useRef } from 'react'
import { swallowNextClick } from '../lib/swallowClick'

// ── 乗り換え — a flick between the gates ───────────────────────
// The five gates are a row in walking order (config/tabs' TAB_IDS),
// and the bar along the bottom is not the only way along it: a
// sideways flick across a gate's own screen moves one gate over —
// left for the next, right for the one before. The tab bar is
// untouched and is still what SAYS where you are; this is the
// shortcut the thumb already reaches for, not a second navigation.
//
// ── TOUCH, not pointer events ──
// The reason hooks/useSheetDrag captured from a real handset: the
// browser cancels the pointer stream the moment it decides a drag is
// a scroll, and nothing above `pointerup` ever arrives. Touch-only is
// right on its own terms too — a mouse drag across a screen is a text
// selection, and a mouse emits no touch events, so it is excluded by
// construction rather than by a check that could rot.
//
// ── PASSIVE, unlike the sheet's ──
// Nothing follows the finger here: the gesture is read, and then
// either acted on at the release or forgotten. So there is nothing to
// preventDefault for, and a non-passive `touchmove` on the app's main
// scroller would be a tax on every scroll in the app to buy nothing.
//
// ── What outranks it ──
// All of it decided at touchstart, so a gesture is never half-claimed:
//
//  - Anything modal. Sheets, dialogs and the guide's callout are
//    portalled onto document.body, so their own touches never reach
//    this node — but the guide's SPOT takes no pointer events by
//    design (a learner can tap the very thing it frames), so without
//    this a swipe would navigate out from under a lesson.
//  - A field, a select, a slider, a canvas. That drag is the caret's,
//    the handle's, the stroke's.
//  - Anything that scrolls sideways under the finger — a rail of
//    stroke counts, a wide table. index.css already says it for the
//    rail: "the swipe belongs to the rail, not to the page behind it".
//  - The strip down each edge of the screen, which is where iOS and
//    Android put their own back gesture. A swipe starting there is the
//    system's, and racing it would navigate twice.
//
// The commit is distance OR speed, as the sheet's is: a deliberate
// sweep past TRAVEL, or a flick — short but fast — which is what a
// thumb actually does when it means "next".

const SLOP = 12        // px before a touch is a swipe at all
const TRAVEL = 64      // a deliberate sweep
const FLICK_PX = 28    // a flick travels less...
const FLICK_V = 0.35   // ...but at least this fast (px/ms)
const SIDEWAYS = 1.4   // how much more sideways than up-and-down it must be
const EDGE = 28        // the strip each side that the system's own gesture owns

// Controls whose own drag outranks the swipe.
const OWN_GESTURE = 'input, textarea, select, canvas, [contenteditable], [role="slider"], [data-gate-swipe="off"]'

/** Is something modal standing over the screen? */
function modalUp() {
  return Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'))
}

// Is there a sideways scroller under the finger? Walks from the
// touched element up to the root inclusive, so a rail added to a gate
// later is answered for without this hook having to hear about it.
// Both halves are needed: overflowing content alone is any clipped
// ellipsis, and `overflow-x: auto` alone is every box that happens to
// fit.
function scrollsSideways(from, root) {
  for (let el = from; el; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const x = getComputedStyle(el).overflowX
      if (x === 'auto' || x === 'scroll') return true
    }
    if (el === root) break
  }
  return false
}

/**
 * Read sideways flicks across `nodeRef` and report them as a step
 * along the bar: +1 for the next gate (a flick to the LEFT, the way
 * the screen would travel), -1 for the one before.
 *
 * `enabled` is the caller's veto — the Shell closes it while the 改札
 * cutscene is already taking the screen somewhere.
 */
export function useGateSwipe(nodeRef, onStep, enabled = true) {
  // Held in a ref so a new callback per render (it closes over the
  // pathname) does not tear the listeners down and put them back on
  // every navigation.
  const onStepRef = useRef(onStep)
  useEffect(() => { onStepRef.current = onStep })

  useEffect(() => {
    const root = nodeRef.current
    if (!root || !enabled) return undefined
    let g = null

    function onStart(e) {
      g = null
      // A second finger is a pinch or a stray palm, not a flick.
      if (e.touches.length !== 1) return
      if (modalUp()) return
      const t = e.touches[0]
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return
      if (e.target.closest?.(OWN_GESTURE)) return
      if (scrollsSideways(e.target, root)) return
      g = { x: t.clientX, y: t.clientY, lastX: t.clientX, lastT: e.timeStamp, on: false }
    }

    function onMove(e) {
      if (!g) return
      if (e.touches.length !== 1) { g = null; return }
      const t = e.touches[0]
      const dx = t.clientX - g.x
      const dy = t.clientY - g.y

      if (!g.on) {
        // Vertical first, and the moment it is clear: the page's own
        // scroll is the commonest gesture on every one of these
        // screens, and it must never have to win a tie.
        if (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(dx)) { g = null; return }
        if (Math.abs(dx) < SLOP) return
        if (Math.abs(dx) < Math.abs(dy) * SIDEWAYS) { g = null; return }
        g.on = true
      }
      g.lastX = t.clientX
      g.lastT = e.timeStamp
    }

    function onEnd(e) {
      const swipe = g
      g = null
      if (!swipe || !swipe.on) return
      const t = e.changedTouches[0]
      const x = t ? t.clientX : swipe.lastX
      const travelled = x - swipe.x
      const dir = travelled < 0 ? -1 : 1
      // Speed over the last move rather than the whole gesture: a
      // finger that rests, then flicks, means the flick. The one
      // frame's grace on both sides keeps a release in the same
      // millisecond as the last move from reading as infinite speed,
      // and it is measured along the way the swipe went, so a wobble
      // at the release does not become a flick of its own.
      const v = (dir * (x - swipe.lastX) + 16) / Math.max(1, e.timeStamp - swipe.lastT + 16)
      const far = Math.abs(travelled) > TRAVEL
      const flick = Math.abs(travelled) > FLICK_PX && v > FLICK_V
      if (!far && !flick) return
      // The release lands over whatever the screen has there — a
      // plate, a row — and that click is the gesture's, not a tap.
      swallowNextClick()
      onStepRef.current(-dir)
    }

    root.addEventListener('touchstart', onStart, { passive: true })
    root.addEventListener('touchmove', onMove, { passive: true })
    root.addEventListener('touchend', onEnd, { passive: true })
    root.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      root.removeEventListener('touchstart', onStart)
      root.removeEventListener('touchmove', onMove)
      root.removeEventListener('touchend', onEnd)
      root.removeEventListener('touchcancel', onEnd)
    }
  }, [nodeRef, enabled])
}
