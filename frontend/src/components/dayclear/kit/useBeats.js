import { useCallback, useEffect, useRef, useState } from 'react'

// ── The ceremony's clock (plan 191) ─────────────────────────────────
// Each board on the canvas runs one timeline -- a schedule(t, fn) of
// beats, skip() to the rest, reduced motion as the rest at once -- and
// every screen of the ceremony needs the same three things, so they are
// one hook: `beats` is [[ms, phase], ...] (ascending), `final` the rest
// phase. Every timer is owned and cleared on unmount (StrictMode's
// double mount replays from the start, as a remount should).
//
//   const { phase, skipped, skip, at } = useBeats(BEATS, { final: 7, reduced })
//
// `phase` is the latest beat reached; `skipped` whether a tap jumped to
// the rest (the root then wears .clrk--skip); `at(p)` is phase >= p.
// Reduced: the final phase from the first render, and nothing scheduled.
export function useBeats(beats, { final, reduced = false, onBeat } = {}) {
  const last = final ?? beats.at(-1)?.[1] ?? 0
  const [state, setState] = useState(() => ({ phase: reduced ? last : 0, skipped: false }))
  const timers = useRef([])
  const beatRef = useRef(onBeat)
  useEffect(() => { beatRef.current = onBeat })

  const clear = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  useEffect(() => {
    if (reduced) return undefined
    for (const [t, p] of beats) {
      const id = setTimeout(() => {
        setState(s => (s.skipped || s.phase >= p ? s : { ...s, phase: p }))
        beatRef.current?.(p)
      }, t)
      timers.current.push(id)
    }
    return clear
    // The beats are the screen's constant timeline: read once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, clear])

  const skip = useCallback(() => {
    clear()
    setState(s => (s.phase >= last ? s : { phase: last, skipped: true }))
  }, [clear, last])

  const phase = reduced ? last : state.phase
  return { phase, skipped: !reduced && state.skipped, skip, at: p => phase >= p, final: last }
}
