import { utcToday } from '../domain/dayClear'

// ── 運転再開 — the comeback notice, hidden for the day (plan 254) ──
// The offer stands on the gate as a notice (components/station/
// ComebackLine), never over it: until plan 254 it was a sheet the gate
// opened on, and shut, it opened again on the next visit. Closed with
// its ✕, the notice keeps out of the way until the next day -- the
// queue's, UTC, as the streak's -- on this device, and comes back the
// day after while the server still offers it: an offer, never a toll at
// the gate. A browser that keeps nothing holds it for the visit.
const HIDDEN_KEY = 'tsuji.comebackHidden'
let hiddenOn = null

/** Whether the comeback notice was closed on this day. */
export function comebackHidden(day = utcToday()) {
  if (hiddenOn === day) return true
  try { return window.localStorage.getItem(HIDDEN_KEY) === day } catch { return false }
}

/** The comeback notice was closed: out of the way for the rest of the day. */
export function hideComeback(day = utcToday()) {
  hiddenOn = day
  try { window.localStorage.setItem(HIDDEN_KEY, day) } catch { /* the visit's, at worst */ }
}

// The offer is counted once a visit (catchup_offer), as the sheet that
// opened on the gate was: going back and forth between the tabs mounts
// the notice again, and is not a second offer.
let counted = false

/** Whether this visit has counted the offer yet; the first ask counts it. */
export function countComebackOffer() {
  if (counted) return false
  counted = true
  return true
}

/** Tests only: no notice closed, no offer counted. */
export function resetComeback() {
  hiddenOn = null
  counted = false
  try { window.localStorage.removeItem(HIDDEN_KEY) } catch { /* nothing kept */ }
}
