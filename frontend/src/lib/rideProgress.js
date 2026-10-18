// ── 試乗 — where the first ride got to, on this device ─────────────
// The front door (App's '/' and '/app') boards a learner with no
// tutorialAt onto the ride's first screen. A ride left between its two
// halves -- the cards done, the reading not stamped yet: a reload, a
// back gesture out of the document, the tab killed in the background --
// was boarded again from the first card, ninety seconds the learner had
// already given (the trail of 2026-10-18). So the cards, once done,
// leave a note here, and the door boards the reading instead.
//
// A convenience, never the record: the stamp is the server's
// (POST /api/onboarding/ride/done). A note lost to a private window or
// cleared storage costs the cards again, as before. Keyed by account, so
// a second learner on the same phone starts at the start.
const KEY = 'tsuji.ride.cards:'

export function cardsRidden(userId) {
  if (!userId) return false
  try { return window.localStorage.getItem(KEY + userId) === '1' } catch { return false }
}

export function markCardsRidden(userId) {
  if (!userId) return
  try { window.localStorage.setItem(KEY + userId, '1') } catch { /* storage refused: the cards again */ }
}
