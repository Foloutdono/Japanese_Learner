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
// The app's one width split in JavaScript is the desk's, and it reads
// this through hooks/useDesk.js rather than writing its query again.
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
