import { useState } from 'react'

// ── The walk of a trace (plans 216, 267) ─────────────────────────
// What the glyph tour's writing stop and the stroke sheet's trace both
// keep beside a TraceBoard: which stroke is asked (`at`), the misses so
// far, the strokes the board drew for the learner after three misses on
// one (`given`) and where « Montre-moi » took over (`shownFrom`). The
// board says how a trace went; this turns it into the next state.
export const MISS_LIMIT = 3

const FRESH = { at: 0, misses: 0, tries: 0, last: null, given: [], shownFrom: null }

export function useTraceRun() {
  const [trace, setTrace] = useState(FRESH)

  function verdict(v) {
    setTrace(s => {
      if (v === 'ok') return { ...s, at: s.at + 1, tries: 0, last: 'ok' }
      const tries = s.tries + 1
      if (tries < MISS_LIMIT) return { ...s, misses: s.misses + 1, tries, last: v }
      return { ...s, at: s.at + 1, misses: s.misses + 1, tries: 0, last: 'given', given: [...s.given, s.at] }
    })
  }

  const show = () => setTrace(s => ({ ...s, shownFrom: s.at, last: 'shown' }))
  const reset = () => setTrace(FRESH)

  return { trace, verdict, show, reset }
}
