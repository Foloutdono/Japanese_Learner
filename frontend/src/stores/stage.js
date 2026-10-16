import { useEffect, useSyncExternalStore } from 'react'

// ── 舞台 — a screen under the shell that takes the stage (plan 219) ──
// The Shell draws the HUD and the tab bar round every screen it carries;
// a run is drawn on the StageFrame instead, which has neither. The
// analyser's result on a phone is the one screen between the two: it
// lives on the dictionary's route, under the shell, and it is watched
// like a run (the owner's pick D of "Video Analyser Rework"). While it
// claims the stage, the Shell leaves its two bars out -- on a phone
// only: the desk's rail stays -- and the screen's own container stays
// the element it was, so nothing it holds is remounted.
//
// A claim is counted rather than flagged, so a second claimant's
// release cannot take the first one's stage away.
let claims = 0
const listeners = new Set()
function emit() { listeners.forEach(fn => fn()) }
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }
const read = () => claims > 0

/** Hold the stage while `on`; let it go when it turns off or on unmount. */
export function useStageClaim(on) {
  useEffect(() => {
    if (!on) return undefined
    claims += 1
    emit()
    return () => {
      claims -= 1
      emit()
    }
  }, [on])
}

/** Whether a screen holds the stage. */
export function useStaged() {
  return useSyncExternalStore(subscribe, read, read)
}
