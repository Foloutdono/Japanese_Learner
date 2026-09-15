// ── 改札の記憶 — who this device has already let through ────────────
//
// App.jsx's onboarding gate asks GET /api/profile "has this learner
// boarded?" on every launch, and fails OPEN when the answer never
// comes: a flaky network must not lock someone out of an app they
// already use. The trouble is the phrase "already use". A guest pass
// is minted the instant Embarquer is tapped (lib/guest.js), and the
// gate's request for that brand-new user is the very one a sleeping
// Render instance holds for 30–60 s. Past the 45 s ceiling the old
// gate opened the app to a learner who had answered nothing — no
// name, no level, no plan — and the next launch, with the server
// awake, put them back at question one. The boarding was skippable
// by accident.
//
// This is the missing half of the decision: a localStorage note, per
// user id, written the moment the gate has once seen a real answer
// (the profile carried onboardedAt, or the contract was just signed
// here). Failing open is then reserved for a learner this DEVICE has
// already let through; everyone else waits for the server to answer.
//
// localStorage, not the profile — the profile is exactly what could
// not be read. A mirror, never an authority: a real "not onboarded"
// answer still sends a noted learner to the boarding, and a cleared
// storage costs only the fail-open shortcut, never any progress.
const KEY = 'jp-onboarded'
// Enough for every account a shared device is likely to see; the note
// is one id, so the cap is tidiness rather than a budget.
const KEEP = 8

function read() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const ids = raw ? JSON.parse(raw) : []
    return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : []
  } catch {
    // Private mode, or a value someone edited by hand: nobody is
    // remembered, which only means nobody gets the shortcut.
    return []
  }
}

/** Whether this device has already seen `userId` through the gate. */
export function wasOnboardedHere(userId) {
  return !!userId && read().includes(userId)
}

/** Note that `userId` is past the gate: the shortcut is theirs from now on. */
export function rememberOnboarded(userId) {
  if (!userId) return
  const ids = [userId, ...read().filter(id => id !== userId)].slice(0, KEEP)
  try { window.localStorage.setItem(KEY, JSON.stringify(ids)) } catch { /* not persisted */ }
}

/** Drop the note — the account was erased, so the shortcut must go with it. */
export function forgetOnboarded(userId) {
  if (!userId) return
  const ids = read().filter(id => id !== userId)
  try {
    if (ids.length) window.localStorage.setItem(KEY, JSON.stringify(ids))
    else window.localStorage.removeItem(KEY)
  } catch { /* not persisted */ }
}
