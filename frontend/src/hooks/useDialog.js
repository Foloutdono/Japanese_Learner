import { useEffect, useLayoutEffect, useRef } from 'react'

// ── Modal behaviour, in one place ─────────────────────────
// Every overlay in this app was already a scrim with a panel and a
// close button. What none of them had was the part a mouse user never
// notices: Escape, focus moving into the dialog when it opens, focus
// staying inside while it is open, and focus going back to whatever
// opened it when it closes. The retired quick-change drawer had the
// Escape half and was the model for the rest.
//
// Returns a ref to attach to the dialog panel (not the scrim).
//
//   const dialogRef = useDialog(onClose)
//   <div className="scrim" onClick={onClose}>
//     <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={...}>
//
// The trap is deliberately a Tab-wrap rather than an inert-background
// approach: `inert` would be cleaner but needs every sibling of the
// portal root enumerated, and these dialogs mount in several different
// places in the tree.
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useDialog(onClose) {
  const ref = useRef(null)
  // Captured at mount, before focus moves into the dialog, so it is
  // genuinely the control the user was on when they opened this.
  const returnTo = useRef(null)

  // A ref rather than a dependency: an inline `onClose={() => ...}` gets a
  // new identity every render, and this effect must NOT re-run over that —
  // re-running is what re-steals focus to the first control and re-captures
  // returnTo mid-interaction. Callers may pass a stable callback or not;
  // either way the trap sets up once per mount and always calls the latest
  // onClose.
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    returnTo.current = document.activeElement

    const node = ref.current
    if (node) {
      const first = node.querySelector(FOCUSABLE)
      // Fall back to the panel itself so focus lands *somewhere* inside
      // even in a dialog that is still loading and has no controls yet.
      if (first) {
        first.focus()
      } else {
        node.setAttribute('tabindex', '-1')
        node.focus()
      }
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !ref.current) return

      const items = [...ref.current.querySelectorAll(FOCUSABLE)]
        .filter(el => el.offsetParent !== null)
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      // Only restore if focus is still somewhere we put it — if the
      // user has since clicked elsewhere, yanking them back is worse
      // than leaving them alone.
      const active = document.activeElement
      if (returnTo.current && (!active || active === document.body)) {
        returnTo.current.focus?.()
      }
    }
  }, [])

  return ref
}
