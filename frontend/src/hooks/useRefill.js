import { useEffect, useRef, useState } from 'react'
import { useCredits, peekCredits, refreshCredits, peekClaimOffer, offerClaim, claimCredits } from '../stores/credits'

// ── 補充 — when the refill is claimed (plan 141) ──────────────
// The server lands a credit every 48 minutes and holds what has landed
// as `pending` (core/credits.py). This decides which of the two ways it
// reaches the balance:
//
//   arriving   the app opened, or came back to the front after AWAY_MS
//              or longer out of sight: a fresh read, and anything
//              pending opens the "while you were away" sheet
//              (components/credits/ClaimSheet.jsx) with its figure.
//   staying    the app is in front of the learner when a credit lands:
//              it is claimed quietly on the minute, so the balance
//              fills itself in the HUD while they watch -- nobody is
//              asked to claim one credit in the middle of a card.
//
// `hold` defers the arrival -- the 改札 cutscene, the first ride -- and
// the arrival still happens, once, when it is let go.

/** Out of sight this long, coming back is arriving. A glance at another
 *  tab is not; putting the phone down for a quarter of an hour is. */
export const AWAY_MS = 15 * 60 * 1000
// A claim sent a moment after the credit's minute, so a client clock a
// little behind the server's does not ask before it has landed...
const SLACK_MS = 2000
// ...and one that asked early anyway (claimed nothing, same next credit)
// asks again after this, rather than spinning or giving up.
const RETRY_MS = 30 * 1000

function visible() {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

async function arrive() {
  await refreshCredits()
  // Read after the refresh, outside React: the answer this arrival asked for.
  const c = peekCredits()
  if (c && !c.unlimited && c.pending > 0 && !peekClaimOffer()) offerClaim(c.pending, c.balance)
}

export function useRefill(hold = false) {
  const credits = useCredits()
  const arrived = useRef(false)
  // True while an arrival's read is out: what it finds is the sheet's,
  // and the quiet claim below must not take it first.
  const arriving = useRef(false)
  const hiddenAt = useRef(null)
  const [beat, setBeat] = useState(0)

  function doArrive() {
    arrived.current = true
    arriving.current = true
    arrive()
      .catch(() => {})
      .finally(() => { arriving.current = false; setBeat(b => b + 1) })
  }

  // Arriving: the first time the hold is off.
  useEffect(() => {
    if (hold || arrived.current) return
    doArrive()
  }, [hold])

  // Coming back to the front.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    function onVisibility() {
      if (!visible()) {
        hiddenAt.current = Date.now()
        return
      }
      const away = hiddenAt.current != null ? Date.now() - hiddenAt.current : 0
      hiddenAt.current = null
      if (hold) return
      if (away >= AWAY_MS) doArrive()
      else setBeat(b => b + 1)   // a glance away: the staying clock catches up
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [hold])

  // Staying: a quiet claim on each credit's minute (at once for any
  // already landed), while in sight and while the sheet is not the one
  // offering them.
  const nextAt = credits && !credits.unlimited ? credits.nextCreditAt : null
  const landed = credits && !credits.unlimited ? credits.pending ?? 0 : 0
  useEffect(() => {
    if (hold || !arrived.current) return undefined
    if (!nextAt && !(landed > 0)) return undefined
    let retry = null
    const wait = landed > 0 ? 0 : Date.parse(nextAt) - Date.now() + SLACK_MS
    const id = setTimeout(() => {
      if (!visible() || arriving.current || peekClaimOffer()) return
      claimCredits()
        .catch(() => 0)
        .then(n => {
          if (!(n > 0)) retry = setTimeout(() => setBeat(b => b + 1), RETRY_MS)
        })
    }, Number.isFinite(wait) ? Math.max(0, wait) : RETRY_MS)
    return () => { clearTimeout(id); clearTimeout(retry) }
  }, [hold, nextAt, landed, beat])
}
