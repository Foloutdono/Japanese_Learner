import { useState } from 'react'
import { pointKey } from './grammarSpans'

// ── The light (plan 095) ─────────────────────────────────────
// Where a grammar point sits on the sentence: the words it is written
// on light up while its chip (or the row that opens it) is hovered or
// focused, and the last point pressed stays lit once its sheet has
// closed -- on a phone there is no hover, and "where was that" is the
// question the learner comes back from the sheet with. Two states,
// because a hover ends when the pointer moves and a pick does not:
// the hover wins while it lasts. Both are remembered against the
// analysis they were made on, so a new sentence arrives with nothing
// lit and no effect has to clear it -- not even a hover a keyboard
// shortcut left behind on a chip that unmounted under the pointer.
// A module of its own since plan 134: the desk's analyser holds one
// light across its three columns (the line, the points, the rows).
export function useLight(analysis) {
  const [hover, setHover] = useState(null)
  const [pick, setPick] = useState(null)
  const here = held => (held && held.analysis === analysis ? held.point : null)
  const lit = here(hover) ?? here(pick)
  return {
    lit,
    litKey: pointKey(lit),
    onLight: point => setHover(point ? { analysis, point } : null),
    // Wraps a screen's onGrammarOpen: the press lights as it opens.
    open: onOpen => (onOpen ? point => { setPick({ analysis, point }); onOpen(point) } : undefined),
  }
}
