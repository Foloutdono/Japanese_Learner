import { useCallback, useState } from 'react'

// ── The daily pace, client side ──────────────────────────────────
// Every card-batch endpoint now rides a `pace` object along with its
// cards ({target, newToday, remaining} — null for an account with no
// stored daily_new_target), and stops topping sessions up with NEW
// cards once today's target is spent. This hook is the one piece of
// wiring every study screen needs: capture the latest pace snapshot
// out of a batch response, and hold the 臨時列車 flag — the learner's
// explicit "keep the new cards coming" — which is sent back as
// `beyond_target=true` on the next fetches.
//
// The flag is keyed on the session's storageKey rather than reset in
// an effect: boarding the extra train for one (deck, mode) session
// must not quietly carry into the next one, and deriving it from the
// key needs no effect at all (the same shape App.jsx's onboarding
// gate uses, for the same reason).
export function usePace(sessionKey) {
  const [pace, setPace] = useState(null)
  const [beyondFor, setBeyondFor] = useState(null)
  const beyond = beyondFor === sessionKey

  const capture = useCallback(data => {
    setPace(data?.pace ?? null)
    return data
  }, [])

  return {
    pace,
    beyond,
    // Appended verbatim to a batch URL's query string.
    query: beyond ? '&beyond_target=true' : '',
    capture,
    // Board the 臨時列車: flip the flag for THIS session, then let the
    // caller's retry() clear the hook's done state so the next refill
    // fetches with the cap lifted.
    boardExtra: retry => { setBeyondFor(sessionKey); retry() },
    // The finish panel should offer the extra train only when the
    // session ended BECAUSE of the pace (target spent, not yet
    // boarded) — a genuinely exhausted deck gets the plain message.
    pacedOut: !beyond && pace != null && pace.remaining === 0,
  }
}
