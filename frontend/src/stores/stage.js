import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react'

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

// ── 退場 — the bars stepped away, in their places (plan 247) ──────────
// The day cleared plays on Today with the phone's two bars gone, as a
// run's stage, and hands the screen back with them drawn in. Taken out
// of the page (a stage) the bars would take their room with them, and
// the print of the hour, which stands on the room it is given, would
// move under the finish the moment they came back. So these bars stay
// where they are and are not drawn (the screen paints what is under
// them), then arrive in their places: nothing moves but them.
//
// Counted as a claim is; taken before the first paint (a layout
// effect), so a screen that sends them away on arrival never shows them
// for a frame. On the last release they arrive (`useChromeArriving`)
// for as long as their way in takes.
let aways = 0
let arriving = false
let arriveTimer = null
const ARRIVE_MS = 700
const readAway = () => aways > 0
const readArriving = () => arriving

/** Send the bars away while `on`; they arrive when it turns off or on unmount. */
export function useChromeAway(on) {
  useLayoutEffect(() => {
    if (!on) return undefined
    aways += 1
    emit()
    return () => {
      aways -= 1
      if (aways === 0) {
        arriving = true
        clearTimeout(arriveTimer)
        arriveTimer = setTimeout(() => {
          arriving = false
          emit()
        }, ARRIVE_MS)
      }
      emit()
    }
  }, [on])
}

/** Whether the bars are away. */
export function useChromeAwayState() {
  return useSyncExternalStore(subscribe, readAway, readAway)
}

/** Whether the bars are being drawn back in. */
export function useChromeArriving() {
  return useSyncExternalStore(subscribe, readArriving, readArriving)
}
