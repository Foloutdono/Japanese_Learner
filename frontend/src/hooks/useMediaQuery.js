import { useSyncExternalStore } from 'react'

// ── Subscribe to a media query ────────────────────────────
// matchMedia, not a resize listener counting pixels: the browser
// already knows when the condition flips and tells us once, instead of
// firing on every pixel of a drag and making us re-derive the answer.
//
// useSyncExternalStore rather than useState + useEffect, so the first
// render already has the right answer -- an effect-based version renders
// once with the wrong layout and corrects it, which on this screen is a
// visible flash of the route diagram in the wrong orientation.
//
// (components/ui/TopBar.jsx still uses a resize listener for its own
// MOBILE_BREAKPOINT. That one is load-bearing for the auto-hide logic
// and documented as moving in step with index.css's 768px; it is
// deliberately not changed here.)
export function useMediaQuery(query) {
  return useSyncExternalStore(
    callback => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', callback)
      return () => mql.removeEventListener('change', callback)
    },
    () => window.matchMedia(query).matches,
    // Server snapshot: no window, so nothing matches. This app never
    // server-renders, but getServerSnapshot is required and throwing
    // from it is worse than answering false.
    () => false,
  )
}
