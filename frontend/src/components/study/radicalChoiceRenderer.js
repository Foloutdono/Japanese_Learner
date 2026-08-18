import { createElement } from 'react'

// The choice rows carry the Kangxi number beside the glyph for the same
// reason RadicalAnswer (RadicalPieces.jsx) does: at row size ⺅ / 亻 / 人
// are one smudge, and the distractors are drawn from the SAME
// stroke-count bucket on purpose (see content/radical_data.py's
// siblings_by_stroke), so a row showing only the glyph is often four
// near-identical marks.
//
// Plain createElement rather than JSX: this is a pure helper function,
// not a component, and pairing the two in one .jsx file trips
// react-refresh/only-export-components (a file fast-refresh can act on
// must export components only) — see RadicalPieces.jsx, which keeps
// RadicalAnswer alone for exactly that reason.
export function radicalChoiceRenderer(options) {
  return char => {
    const o = options.find(c => c.char === char)
    return createElement('span', { className: 'radical-choice' },
      createElement('span', { className: 'radical-choice__char', lang: 'ja' }, char),
      o && createElement('span', { className: 'radical-choice__num' }, o.number),
    )
  }
}
