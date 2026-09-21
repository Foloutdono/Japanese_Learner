// ── The click a gesture leaves behind ─────────────────────────
// A touch gesture ends with a `click` dispatched to whatever the finger
// lifted over. So a sheet dragged shut from over a button fires that
// button, and a flick between gates that ends over a plate opens it —
// on the screen you were leaving, a frame before it goes. One
// capture-phase listener, swallowing exactly one click.
//
// Shared by hooks/useSheetDrag and hooks/useGateSwipe rather than
// copied into each. The subtle half is the timeout: a gesture that
// lifts over nothing clickable leaves no click to swallow, and the
// listener must not sit there waiting for the next real one — which is
// exactly the half a second copy tends to lose.
export function swallowNextClick(within = 400) {
  const swallow = e => {
    e.stopPropagation()
    e.preventDefault()
    window.removeEventListener('click', swallow, true)
  }
  window.addEventListener('click', swallow, true)
  setTimeout(() => window.removeEventListener('click', swallow, true), within)
}
