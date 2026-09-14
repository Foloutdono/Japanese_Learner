import { useCallback, useEffect, useRef, useState } from 'react'

// ── 引き戸 — dragging a sheet shut ────────────────────────────
// A bottom sheet rises from the bottom edge, so the gesture that
// dismisses it is a push back down. Every sheet in the app already had
// Escape and a tap on the scrim (hooks/useDialog, chrome/Sheet); on a
// phone neither is reachable with the thumb that opened it — the scrim
// above a full-height sheet is a sliver, and there is no Escape key.
//
// ── Why this listens to TOUCH and not to pointer events ──
// It was written on pointer events first, and on a real handset the
// browser takes the gesture away mid-drag. What Chrome actually sends,
// captured against the running app with CDP touch input:
//
//     pointerdown  y=491
//     pointermove  y=519
//     pointercancel            ← and the pointer stream ends here
//     touchmove    y=547 … 715
//
// The browser decided the vertical drag was a SCROLL, cancelled the
// pointer stream and kept the touch stream. Nothing above `pointerup`
// ever arrives, so a pointer-driven sheet follows the thumb for one
// frame and then freezes — while passing every synthetic-event test,
// because a dispatched PointerEvent is never cancelled by a scroll
// nobody is doing. Two things stop it, and both are needed:
//
//   1. `overscroll-behavior-y: contain` on the panel (index.css), so
//      the gesture can never chain to the page behind. A modal's
//      backdrop should not scroll under it in any case.
//   2. preventDefault on `touchmove`, the moment the drag is claimed.
//      It has to be a NON-PASSIVE listener on the node: React registers
//      touchmove at the root as passive, where preventDefault is a
//      no-op and a console warning.
//
// Touch-only is also the right rule on its own terms. A MOUSE drag
// inside a panel is a text selection, and turning that into a dismissal
// would make a sheet impossible to select text in; a mouse emits no
// touch events, so it is excluded by construction rather than by a
// check that could rot.
//
// The rest of the rules this has to live with:
//
//  - A sheet SCROLLS (.sheet is overflow-y: auto). A drag may only
//    become a dismissal when there is nothing above to scroll to, i.e.
//    scrollTop is at the top. Past that the browser's own overscroll is
//    what the finger would otherwise be doing, so nothing is stolen.
//  - Only downward. An upward drag from the top is an overscroll bounce
//    and must stay one.
//  - A field keeps its own drag. Dragging inside an input, a textarea,
//    a slider or a contenteditable is that control's gesture (caret,
//    handle), never the sheet's.
//
// The commit is distance OR speed, the way a real sheet reads: a slow
// deliberate push past CLOSE_PX, or a flick — short but fast — which is
// what a thumb actually does when it means "go away".

const START_SLOP = 6      // px before a touch is a drag at all
const CLOSE_PX = 88       // a deliberate push
const FLICK_PX = 28       // a flick travels less...
const FLICK_V = 0.45      // ...but at least this fast (px/ms)

// Controls whose own drag outranks the sheet's.
const OWN_GESTURE = 'input, textarea, select, [contenteditable], [data-sheet-drag="off"]'

// Is there anything above the finger to scroll to? The panel is the
// usual scroller, but a sheet may put its own inside (a long list of
// decks, a ledger), and the rule is the same wherever the scroller
// sits: while a scroller has content above it, the downward drag is
// that scroller's, not the sheet's. Walks from the touched element up
// to the panel inclusive, so a scroller added to a sheet later is
// answered for without the hook having to hear about it.
function canScrollUp(from, panel) {
  for (let el = from; el; el = el.parentElement) {
    if (el.scrollTop > 0) return true
    if (el === panel) break
  }
  return false
}

export function useSheetDrag(panelRef, onClose) {
  // Only the CLAIM is React state — twice a gesture, not sixty times a
  // second. The offset itself is written straight to the node: a sheet
  // has a whole screen of content under it (the status sheet redraws a
  // track, two comparison rows and two buttons), and re-rendering that
  // per frame is how a drag that is meant to feel physical starts to
  // stutter.
  const [dragging, setDragging] = useState(false)

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // A drag that ends on a button would otherwise fire it: the click is
  // dispatched after the touch ends, to the element the finger lifted
  // over. One capture-phase listener, swallowing exactly one click.
  const swallowNextClick = useCallback(() => {
    const swallow = e => {
      e.stopPropagation()
      e.preventDefault()
      window.removeEventListener('click', swallow, true)
    }
    window.addEventListener('click', swallow, true)
    // If no click follows (the finger lifted over nothing clickable),
    // the listener must not sit there waiting for the next real one.
    setTimeout(() => window.removeEventListener('click', swallow, true), 400)
  }, [])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return undefined
    let g = null

    const offset = px => { panel.style.transform = px ? `translateY(${px}px)` : '' }

    function onStart(e) {
      // A second finger is a pinch or a stray palm, not a push.
      if (e.touches.length !== 1) { g = null; return }
      if (e.target.closest?.(OWN_GESTURE)) return
      if (canScrollUp(e.target, panel)) return
      const t = e.touches[0]
      g = { y: t.clientY, x: t.clientX, lastY: t.clientY, lastT: e.timeStamp, on: false }
    }

    function onMove(e) {
      if (!g || e.touches.length !== 1) return
      const t = e.touches[0]
      const moved = t.clientY - g.y

      if (!g.on) {
        // Claim the gesture only once it is clearly a downward one: a
        // sideways swipe belongs to whatever is under the finger (the
        // deck picker's rows, a chip strip), and an upward one is the
        // scroll this sheet may still have to do.
        if (moved < START_SLOP) {
          if (moved < -START_SLOP || Math.abs(t.clientX - g.x) > START_SLOP) g = null
          return
        }
        // Something may have scrolled between the press and the move.
        if (canScrollUp(e.target, panel)) { g = null; return }
        g.on = true
        setDragging(true)
      }

      // Claimed — so the browser must not also scroll with it. See the
      // note at the top: without this the pointer stream is cancelled
      // and the sheet freezes one frame into the drag.
      if (e.cancelable) e.preventDefault()
      g.lastY = t.clientY
      g.lastT = e.timeStamp
      offset(Math.max(0, moved - START_SLOP))
    }

    function onEnd(e) {
      const drag = g
      g = null
      if (!drag || !drag.on) return
      const t = e.changedTouches[0]
      const y = t ? t.clientY : drag.lastY

      const travelled = Math.max(0, y - drag.y - START_SLOP)
      // Velocity over the last move rather than the whole gesture: a
      // finger that rests, then flicks, means the flick. The +16 on
      // both sides is one frame's grace, so a release in the same
      // millisecond as the last move is not an infinite speed.
      const v = (y - drag.lastY + 16) / Math.max(1, e.timeStamp - drag.lastT + 16)
      const commit = travelled > CLOSE_PX || (travelled > FLICK_PX && v > FLICK_V)

      setDragging(false)
      offset(0)
      swallowNextClick()
      if (commit) onCloseRef.current()
    }

    panel.addEventListener('touchstart', onStart, { passive: true })
    panel.addEventListener('touchmove', onMove, { passive: false })
    panel.addEventListener('touchend', onEnd)
    panel.addEventListener('touchcancel', onEnd)
    return () => {
      panel.removeEventListener('touchstart', onStart)
      panel.removeEventListener('touchmove', onMove)
      panel.removeEventListener('touchend', onEnd)
      panel.removeEventListener('touchcancel', onEnd)
    }
  }, [panelRef, swallowNextClick])

  return { dragging }
}
