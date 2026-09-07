import { useState, useCallback } from 'react'

// ── 運賃 — the fare, reported where it was paid ──
// XP earned by a review reports to the level roundel, because that is
// the object the figure was paid into, and a "+4" rising off it needs
// no panel, no label and no dismissal to be understood. The hook turns
// "xp went up" into something to draw, during render (the React docs'
// adjust-state-during-render pattern) so the figure appears in the
// same frame the summary moves.
//
// Returns { gain, clear }: `gain` is null or { id, delta, fromPct,
// toPct }, and `clear` is what the HUD calls once its animation ends.
export function useXpGain(summary) {
  const [last, setLast] = useState(summary?.xp ?? null)
  const [gain, setGain] = useState(null)
  const xp = summary?.xp
  if (xp != null && xp !== last) {
    setLast(xp)
    if (last != null && xp > last) {
      const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
      // Clamped against the CURRENT span so a level-up (which shifts
      // xpPrevLevel/xpForNext) still yields a sane highlight instead
      // of a stale or negative offset.
      const prevInto = Math.min(span, Math.max(0, last - summary.xpPrevLevel))
      const curInto  = Math.min(span, Math.max(0, xp - summary.xpPrevLevel))
      setGain({
        // xp only ever climbs, so it is its own unique key — and it
        // keeps this render pure, which a Date.now() here is not.
        id: xp,
        delta: xp - last,
        fromPct: Math.round((prevInto / span) * 100),
        toPct:   Math.round((curInto / span) * 100),
      })
    }
  }
  const clear = useCallback(() => setGain(null), [])
  return { gain, clear }
}

