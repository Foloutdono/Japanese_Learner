import { useEffect, useSyncExternalStore } from 'react'

// ── 机 — the keys a run's head lists behind its Help button ─────────
// A run on the desk's panels lists its keys (Space turns the card, Esc
// leaves ...) -- no longer printed in the left panel but behind a "?" in
// the run's head (components/chrome/RunHelp.jsx). The head is the stage's
// and the keys are the run's panel's, two siblings, so the panel hands
// them over here and the head reads them: a value and a set of listeners,
// as stores/escHold.
const listeners = new Set()
let current = []

function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }
function set(next) { current = next; listeners.forEach(fn => fn()) }

/** A panel registers its keys, [[cap, what it does], …], while it stands. */
export function useRegisterRunKeys(keys) {
  const sig = JSON.stringify(keys)
  useEffect(() => {
    const mine = JSON.parse(sig)
    set(mine)
    return () => { if (current === mine) set([]) }
  }, [sig])
}

export function useRunKeys() {
  return useSyncExternalStore(subscribe, () => current, () => current)
}
