import { useEffect, useSyncExternalStore } from 'react'

// ── 運賃 — the day's fare, said at its beat (plan 247) ──────────────
// A review's XP reports to the pass the moment the summary moves
// (components/chrome/useXpGain.js). The cleared day is the exception:
// its bonus is paid into the summary as the server answers
// (stores/dayClear), but the finish played on Today says the day's
// fare at its own beat, as one figure rising off the pass -- the run's
// XP and what the clear paid -- the bar lit from where the run began.
//
// While a finish holds the fare, the pass reports no rise of its own
// (a summary fetched in the meantime moves it silently); `showFare` is
// the beat. A hold is counted, as a stage claim is (stores/stage.js),
// so a second holder's release cannot let the first one's fare go.
let holds = 0
let shown = null
let count = 0
let snapshot = Object.freeze({ held: false, shown: null })
const listeners = new Set()
function emit() {
  snapshot = Object.freeze({ held: holds > 0, shown })
  listeners.forEach(fn => fn())
}
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }
const read = () => snapshot

/** Hold the pass's fare while `on`; let it go when it turns off or on unmount. */
export function useFareHold(on) {
  useEffect(() => {
    if (!on) return undefined
    holds += 1
    emit()
    return () => {
      holds -= 1
      emit()
    }
  }, [on])
}

/** The beat: the pass says `amount` as one fare (the XP already paid). */
export function showFare(amount) {
  if (!(amount > 0)) return
  count += 1
  shown = Object.freeze({ id: count, amount })
  emit()
}

/** { held, shown: { id, amount } | null }, for the pass's gain. */
export function useFare() {
  return useSyncExternalStore(subscribe, read, read)
}
