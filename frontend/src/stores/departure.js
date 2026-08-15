import { useSyncExternalStore } from 'react'

// ── The departure in progress ─────────────────────────────
// Which board row is being travelled to, or null. A store rather than
// component state, and that is not gold-plating: the ticket gate has
// to outlive the screen that started it.
//
// It began as `useState` inside HomeScreen, which put the gate inside
// <Routes>. Navigating therefore unmounted HomeScreen, and the gate
// with it — measured, the gate died 14ms after the navigation instead
// of the 240ms later it was written to. The exit never once played:
// the wipe was supposed to fade off the destination, and instead it
// vanished on the frame the destination arrived.
//
// Held here, read by <DepartureGate/> mounted alongside <Routes/>
// rather than inside it, the gate survives the route change and can
// finish.
//
// Same shape as stores/profileSummary: a value and a set of listeners.
let current = null
const listeners = new Set()

function emit() {
  listeners.forEach(fn => fn(current))
}

/** Begin travelling to `section` (a nav-links entry). */
export function beginDeparture(section) {
  current = section
  emit()
}

/** The gate has finished; take it down. */
export function endDeparture() {
  if (current === null) return
  current = null
  emit()
}

// Module-level so the reference is stable: an inline arrow would be a
// new function every render and resubscribe on each one.
function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * useSyncExternalStore rather than the useState/useEffect pair the
 * older stores here use. This is precisely what it is for — reading a
 * value that lives outside React — and it needs no effect, so there is
 * no window between render and subscription in which a departure could
 * begin and be missed.
 */
export function useDeparture() {
  return useSyncExternalStore(subscribe, () => current)
}
