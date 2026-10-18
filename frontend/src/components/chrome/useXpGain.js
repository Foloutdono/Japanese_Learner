import { useState, useCallback } from 'react'
import { useFare } from '../../stores/fare'

// ── 運賃 — the fare, reported where it was paid ──
// XP earned by a review reports to the level roundel, because that is
// the object the figure was paid into, and a "+4" rising off it needs
// no panel, no label and no dismissal to be understood. The hook turns
// "xp went up" into something to draw, during render (the React docs'
// adjust-state-during-render pattern) so the figure appears in the
// same frame the summary moves.
//
// The day cleared says its fare at its own beat (stores/fare.js, plan
// 247): while a finish holds the fare, a rise is taken in silently,
// and the fare it shows is reported whole -- the day's XP as one
// figure, the bar lit from where it began.
//
// Returns { gain, clear }: `gain` is null or { id, delta, fromPct,
// toPct }, and `clear` is what the HUD calls once its animation ends.
export function useXpGain(summary) {
  const fare = useFare()
  const [last, setLast] = useState(summary?.xp ?? null)
  const [seen, setSeen] = useState(fare.shown?.id ?? null)
  const [gain, setGain] = useState(null)
  const xp = summary?.xp
  if (fare.shown && fare.shown.id !== seen) {
    setSeen(fare.shown.id)
    if (xp != null) {
      setLast(xp)
      setGain(gainOf(summary, xp - fare.shown.amount, xp, `fare-${fare.shown.id}`))
    }
  } else if (xp != null && xp !== last) {
    setLast(xp)
    // xp only ever climbs, so it is its own unique key — and it keeps
    // this render pure, which a Date.now() here is not.
    if (!fare.held && last != null && xp > last) setGain(gainOf(summary, last, xp, xp))
  }
  const clear = useCallback(() => setGain(null), [])
  return { gain, clear }
}

// Clamped against the CURRENT span so a level-up (which shifts
// xpPrevLevel/xpForNext) still yields a sane highlight instead of a
// stale or negative offset.
function gainOf(summary, from, to, id) {
  const span = Math.max(1, summary.xpForNext - summary.xpPrevLevel)
  const prevInto = Math.min(span, Math.max(0, from - summary.xpPrevLevel))
  const curInto = Math.min(span, Math.max(0, to - summary.xpPrevLevel))
  return {
    id,
    delta: to - from,
    fromPct: Math.round((prevInto / span) * 100),
    toPct: Math.round((curInto / span) * 100),
  }
}
