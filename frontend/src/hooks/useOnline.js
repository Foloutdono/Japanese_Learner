import { useSyncExternalStore } from 'react'

// ── Is the network there? ───────────────────────────────────
// navigator.onLine plus the two events that move it, through
// useSyncExternalStore so the first render already knows (the
// hooks/useMediaQuery.js reasoning). `true` is a promise the browser
// cannot keep — "online" means a route exists, not that the API
// answers — so consumers treat it as "no reason to expect failure",
// and the request path's own errors stay the last word.
function subscribe(callback) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
    () => true,
  )
}
