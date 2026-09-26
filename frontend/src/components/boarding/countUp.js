import { useEffect, useState } from 'react'

// ── The welcome, counted onto the pass ───────────────────────────
// The balance a fresh account is given is the one number on this
// screen the learner did not work for, and it printed like every other
// figure: already there, in the same grey as the refill line under it.
// It counts up now, from nothing to what the account holds, while a
// gold note rises off the pass saying what it is — the pass's own
// metal, the same the XP fare uses, for about a second (owner's call:
// "transmitting the feeling that you are lucky to receive this").
//
// The count is the figure the store answers with, so a learner whose
// account already holds something else sees THAT number climbed to,
// never a promised one. Shared by the pass step (PassStep) and, on the
// desk where that screen folds into the plan, by the pass at the
// column's foot (DeskLine, plan 139).
const COUNT_MS = 900
const COUNT_FROM_MS = 520

export function useCountUp(to, enabled) {
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!enabled || to == null) return undefined
    let raf = 0
    const start = performance.now() + COUNT_FROM_MS
    const step = now => {
      const p = Math.min(1, Math.max(0, (now - start) / COUNT_MS))
      // Out-cubic: the figure sprints and lands rather than crawling in.
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to, enabled])

  // Not counting — reduced motion, or no figure to count — is the
  // figure itself, derived rather than written into state: an effect
  // that sets state on the frame it runs is a cascading render.
  return enabled && to != null ? n : to
}

export function stillPreferred() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}
