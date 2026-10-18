import { useCallback, useEffect, useRef } from 'react'
import { dialogOpen } from '../lib/dialogOpen'

// ── 戻る — Back, held where the entry behind leads back in ──────────
// The first ride (plan 098) is boarded through the front door: '/' and
// '/app' send a learner whose profile carries no tutorialAt to it, and
// each of its screens replaces the one before. So the entry under the
// ride is the one the boarding began on -- or, after a Google sign-in,
// one from before the round trip -- and Back landed on it, where the
// front door opened the ride again. A phone's back gesture on the
// reading ride put a new learner back on the first card, the lesson
// begun again from nothing (reported 2026-10-17, from the trail).
//
// So, as the boarding (screens/BoardingFlow.jsx) and the asking
// (hooks/useAskPage.js) do, one guard entry stands in the history while
// `on`: Back pops it and calls `onBack`, which does what the screen's
// own ‹ does. A new `step` stands it again while `on` still says so --
// the introduction's screens, one Back each. An entry of the screen's
// own is the only Back that can be caught at all: the one under it may
// not even be in this document.
//
// A sheet open over the screen (the card's dictionary entry, which a
// phone's ride asks to be opened, or the offer) is closed by that Back
// instead, as Android's back button closes one in the shell
// (components/chrome/NativeBridge.jsx), and the guard stands again for
// the Back after it.
//
// The screen's own ways out call `release()` and navigate once it has
// resolved. The guard is taken out first (history.back(), its pop
// ignored), so the navigation replaces the screen's own entry and
// nothing of the screen is left behind it; and it never stands again.
// A pop that does not come is no reason to hold a door: the release
// resolves on its own after RELEASE_MS.
//
//   on       whether the guard should stand now
//   onBack   Back popped it
//   step     a new one stands it again, after a pop
//   release  () => Promise, before leaving
//
// A browser that refuses the history API keeps the screen as it was:
// Back leaves it.
//
// Two things the first version (2026-10-18) missed, both on a phone:
//
// - Chrome's back button passes over an entry a page added without a
//   tap since it was reached (its history intervention), and the guard
//   is stood on mount. So Back can land PAST it, on the entry under the
//   screen -- the front door -- in one pop. history.back() is exempt
//   from that rule, which is why a test of it passed.
// - A pop that changes the address is rendered by React 19 inside the
//   popstate event, in React Router's own listener: the screen unmounts
//   and its listener is gone before the event reaches it, so `onBack`
//   never ran and the door boarded the ride from its first card again.
//
// So the guards hear the pop through ONE window listener, added when
// this module loads -- before App's and React Router's, which are added
// at render, and listeners on the window run in the order they were
// added (a capture flag does not put one first there) -- and a pop that
// left the address the guard stood on is the screen left, `onBack`,
// whatever sheet was open over it.
const RELEASE_MS = 1500

// Every guard mounted now, told of each pop before the router hears it.
const guards = new Set()
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { [...guards].forEach(onPop => onPop()) })
}

export function useBackGuard(on, onBack, step = null) {
  const guard = useRef(false)
  const released = useRef(false)
  // The guard's own taking out: what its pop lands, its fallback, and the
  // promise a release waits on.
  const landing = useRef(null)
  const timer = useRef(null)
  const out = useRef(null)
  // The address the guard stood on: a pop elsewhere went past it.
  const standingAt = useRef(null)
  const onBackRef = useRef(onBack)
  useEffect(() => { onBackRef.current = onBack })

  const stand = useCallback(() => {
    if (released.current || guard.current) return
    try {
      // The router's own state rides along, so the guard reads as the
      // entry it stands over.
      window.history.pushState({ ...window.history.state, guard: true }, '')
      guard.current = true
      standingAt.current = window.location.pathname
    } catch { /* a browser refusing the history API: Back leaves, as before */ }
  }, [])

  const takeOut = useCallback(() => {
    guard.current = false
    out.current = new Promise(resolve => {
      const land = () => {
        clearTimeout(timer.current)
        landing.current = null
        resolve()
      }
      landing.current = land
      timer.current = setTimeout(land, RELEASE_MS)
      try { window.history.back() } catch { land() }
    })
    return out.current
  }, [])

  useEffect(() => {
    function onPop() {
      if (landing.current) { landing.current(); return }
      if (!guard.current) return
      guard.current = false
      const past = window.location.pathname !== standingAt.current
      if (!past && dialogOpen()) {
        // hooks/useDialog closes every sheet on Escape, whoever mounted it.
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
        stand()
        return
      }
      onBackRef.current()
    }
    guards.add(onPop)
    return () => {
      guards.delete(onPop)
      // Gone before the pop it waited on: nothing navigates for it.
      clearTimeout(timer.current)
    }
  }, [stand])

  useEffect(() => {
    if (released.current) return
    if (on) stand()
    else if (guard.current) takeOut()
  }, [on, step, stand, takeOut])

  return useCallback(() => {
    released.current = true
    if (guard.current) return takeOut()
    return out.current ?? Promise.resolve()
  }, [takeOut])
}
