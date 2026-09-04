import { useCallback, useEffect, useRef, useState } from 'react'
import { applyXpGain } from '../stores/profileSummary'
import { rewardTier } from '../domain/rewardTier'

// ── 出発合図 — when the next card is allowed to arrive ────────────
// A rating does not advance the deck by itself. What the learner just
// earned has to play out first — the XP toast, the stage stamp, a
// writing drill — so each of those opens a GATE, and the queue moves
// only once every gate is closed again. The card underneath stays put
// and locked in the meantime, so nothing lands on a card that is
// already mid-celebration and a second tap cannot fire a review twice.
//
// This was six copies of the same forty lines, one per study screen,
// and the copies drifted exactly as you would expect: the 4-second
// safety net reached two screens, the guard against a non-numeric
// xp_earned reached one, and the reset that stops a gate leaking from
// one session into the next reached none until a learner got stuck on
// a kana card with no rating bar and no way forward. One
// implementation now, so a fix reaches every screen by construction
// rather than by whoever remembers.
//
// What a screen still owns: its own rating bar and reveal state, its
// review POST, its progress refetch, and any gate of its own (see
// `hold`/`release` — the writing drill is one).

// How long a gate may stay open before the queue forces itself
// through. Every gate is closed by an animation ending or a component
// unmounting, and if one of those never happens the learner is stuck
// on a card they have already answered with nothing to tap. Four
// seconds is longer than any celebration here and short enough to read
// as a hiccup rather than a hang.
const SAFETY_MS = 4000

/**
 * @param {() => void} advance   pop the queue — whatever "next card"
 *   means on this screen. StudyScreen also bumps its card nonce here.
 * @param {string} sessionKey    the session's own identity (deck,
 *   level or set, plus mode). Changing it resets everything: see the
 *   effect below for why that is load-bearing rather than tidy.
 */
export function useReviewGates({ advance, sessionKey }) {
  const [locked, setLocked]   = useState(false)
  const [xpToast, setXpToast] = useState(null)
  const [stamp, setStamp]     = useState(null)

  const gatesRef    = useRef(new Set())
  const advancedRef = useRef(false)
  const safetyRef   = useRef(null)
  // Synchronous twin of `locked`: state is a render away, and two taps
  // inside one tick would both read the old value and post twice.
  const busyRef     = useRef(false)

  // Read through a ref so `review` does not change identity on every
  // render just because the screen rebuilt its advance closure.
  const advanceRef = useRef(advance)
  useEffect(() => { advanceRef.current = advance })

  const clearSafety = useCallback(() => {
    if (safetyRef.current) {
      clearTimeout(safetyRef.current)
      safetyRef.current = null
    }
  }, [])

  // Advances once every gate has closed, and only once per review even
  // if the set empties more than once.
  const checkAdvance = useCallback(() => {
    if (gatesRef.current.size > 0 || advancedRef.current) return
    advancedRef.current = true
    busyRef.current = false
    clearSafety()
    advanceRef.current?.()
    setLocked(false)
  }, [clearSafety])

  /** Close one gate this screen opened itself. */
  const release = useCallback((name) => {
    gatesRef.current.delete(name)
    checkAdvance()
  }, [checkAdvance])

  const reset = useCallback(() => {
    gatesRef.current.clear()
    advancedRef.current = false
    busyRef.current = false
    clearSafety()
    setLocked(false)
    setXpToast(null)
    setStamp(null)
  }, [clearSafety])

  // ── Leaving a card mid-flight must not strand the next one ──────
  // All of the above is per-REVIEW, but it lives on a screen that
  // survives stepping back to the mode picker and coming in again.
  // Rate a card that promotes, walk out while its stamp is still
  // playing, and that stamp's gate is still open on the way back —
  // with no stamp playing to close it, the queue never advances and
  // the lock never lifts. The rating bar hides itself the instant a
  // rating is tapped, so the card sits revealed with no way forward:
  // reported from production, reproduced in
  // screens/KanaScreen.stuck.browser.test.jsx.
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a key-keyed reset in shape, and the state it clears (`locked`, and the two celebrations) is also set mid-flow by review() below, independent of the session changing. A key-remounted child would have to take that whole flow with it, which is the machinery this hook exists to hold in one place.
  useEffect(() => { reset() }, [sessionKey, reset])
  useEffect(() => clearSafety, [clearSafety])

  /**
   * Start a review: lock the card, play out what it earned, and
   * advance as soon as nothing is left to watch.
   *
   * @param preview  the card's own review_preview[quality], precomputed
   *   at fetch time (see preview_reviews_bulk in srs.py) so nothing
   *   here waits on a round trip.
   * @param cardKey  what the stamp must match to be shown — the same
   *   key the screen gives its CardTransition. TodayScreen's is
   *   `id:mode:nonce`, everyone else's is the bare card id, and a
   *   mismatch is what once made every stamped review hang.
   * @param hold     gates the screen opens itself, e.g. a writing drill.
   * @returns false if a review is already in flight, so the caller can
   *   drop out before firing its own side effects.
   */
  const review = useCallback((preview, { cardKey, quality, hold = [] } = {}) => {
    if (busyRef.current) return false
    busyRef.current = true
    setLocked(true)

    const gates = gatesRef.current
    // Whatever is still open belongs to a review that is over, and the
    // component that would have closed it is long gone. Nothing can be
    // in flight here — busyRef said so — so anything left is stale by
    // construction and would hang this review forever.
    gates.clear()
    advancedRef.current = false
    clearSafety()
    // A level-up toast never auto-dismisses (see XpToast — it waits
    // indefinitely for the claim button), so the net below must never
    // force it shut. That is the one case where an open gate is the
    // design rather than a fault.
    let safeToForce = true

    try {
      for (const name of hold) gates.add(name)

      try {
        if (preview) {
          // Guard a non-numeric xp_earned: if applyXpGain or setXpToast
          // threw on a bad value, no toast would render and nothing
          // would be left to fire the animationend that closes the
          // 'toast' gate. The gate is added AFTER the tier is known, so
          // a throw before that leaves nothing open; the catch is the
          // guarantee from the other side for the tiers that do gate.
          const amount = typeof preview.xp_earned === 'number' ? preview.xp_earned : 0
          // leveledUp/newLevel come from applyXpGain's running total,
          // not from preview.leveled_up — the latter is computed once
          // per batch fetch and cannot see XP earned from other cards
          // answered earlier in that same batch.
          const { leveledUp, newLevel } = applyXpGain({ amount })
          // A fare tick is a corner badge under the XP ring it reports
          // to; it never touches the card. Gating the next card on its
          // fade cost 2175ms measured, on the overwhelming majority of
          // reviews, for an animation the learner is not looking at. It
          // plays over the next card instead. The louder two tiers do
          // still gate: a level board is a moment, and a rank waits to
          // be dismissed by hand.
          if (rewardTier({ leveledUp, newLevel }) !== 'fare') gates.add('toast')
          if (leveledUp) safeToForce = false
          setXpToast({ amount, id: Date.now(), leveledUp, newLevel, quality })

          const to = preview.stage_up ?? preview.stage_down
          if (to) {
            gates.add('stamp')
            setStamp({ id: Date.now(), to, demoted: !preview.stage_up, cardKey })
          }
        }
      } catch (err) {
        gates.delete('toast')
        console.error('XP toast setup failed', err)
      }

      if (gates.size > 0 && safeToForce) {
        safetyRef.current = setTimeout(() => {
          safetyRef.current = null
          gates.clear()
          checkAdvance()
        }, SAFETY_MS)
      }
    } finally {
      // In a finally so a synchronous throw anywhere above cannot skip
      // it and leave the card frozen.
      checkAdvance()
    }
    return true
  }, [checkAdvance, clearSafety])

  const toastDone = useCallback(() => { setXpToast(null); release('toast') }, [release])
  const stampDone = useCallback(() => { setStamp(null); release('stamp') }, [release])

  return { locked, xpToast, stamp, toastDone, stampDone, review, release }
}
