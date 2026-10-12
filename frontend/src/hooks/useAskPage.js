import { useCallback, useEffect, useRef, useState } from 'react'

// ── 問 — the asking's page, and Back (plan 197) ─────────────────────
// On a phone the asking is a page of its own over the run
// (components/study/AskPage.jsx), not a route: the run holds the graded
// sentence, its breakdown and the threads, and a route would unmount it.
// A page that is not a route is not in the history, and Back -- Alt+←, a
// mouse's side button, a phone's back gesture -- left the run from
// underneath it. So, as the boarding does (screens/BoardingFlow.jsx), one
// guard entry stands in the history exactly while the page is open: Back
// pops it and closes the page, and a close from the page itself (‹ Retour,
// Esc, Android's back button, which presses Esc) takes the guard out again
// with history.back(), its pop ignored, so no dead entry is left behind.
//
//   open   whether the page is up
//   show   open it (and stand the guard)
//   hide   close it (and take the guard out)
//
// A browser that refuses the history API opens and closes the page all
// the same; Back then leaves the run, as it did before.
export function useAskPage() {
  const [open, setOpen] = useState(false)
  const guard = useRef(false)
  const ignorePop = useRef(false)

  useEffect(() => {
    function onPop() {
      if (ignorePop.current) { ignorePop.current = false; return }
      if (!guard.current) return
      guard.current = false
      setOpen(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const show = useCallback(() => {
    try {
      if (!guard.current) {
        window.history.pushState({ ask: true }, '')
        guard.current = true
      }
    } catch { /* a browser refusing the history API: Back leaves, as before */ }
    setOpen(true)
  }, [])

  const hide = useCallback(() => {
    if (guard.current) {
      guard.current = false
      ignorePop.current = true
      try { window.history.back() } catch { ignorePop.current = false }
    }
    setOpen(false)
  }, [])

  return { open, show, hide }
}
