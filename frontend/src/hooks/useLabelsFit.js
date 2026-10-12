import { useLayoutEffect, useRef, useState } from 'react'

// Whether a row of figures is too narrow for its labels: [ref, bare].
// With the labels shown, a label wider than its box is a label the row
// squeezed (the figures shrink to share it, and the labels, never
// wrapped, spill into each other). Once bare, the row's width alone
// decides -- it is its column's, not its content's -- and the labels
// are tried again only past the width they last failed at, so hiding
// them can never be what shows them again. Measured before paint, then
// whenever the row or a label changes size: a resize, a figure that
// grows and squeezes its label, the font arriving.
//
// Moved out of RunRecords for the ladder's outcome rows (plan 198),
// whose verdicts' words are the labels: `selector` names what to
// measure under the row -- the run panel's figure labels
// (`.desk-fig__label`) or a row's keys (`.gl-out__keys`).
export function useLabelsFit(selector = '.desk-fig__label') {
  const [row, setRow] = useState(null)
  const [bare, setBare] = useState(false)
  const failedAt = useRef(0)

  useLayoutEffect(() => {
    if (!row) return undefined
    let live = true
    const measure = () => {
      if (!live) return
      const width = row.clientWidth
      if (bare) {
        if (width > failedAt.current) setBare(false)
        return
      }
      const labels = row.querySelectorAll(selector)
      if ([...labels].some(l => l.scrollWidth > l.clientWidth + 1)) {
        failedAt.current = width
        setBare(true)
      }
    }
    measure()
    document.fonts?.ready.then(measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(row)
    if (!bare) row.querySelectorAll(selector).forEach(l => observer?.observe(l))
    return () => {
      live = false
      observer?.disconnect()
    }
  }, [row, bare, selector])

  return [setRow, bare]
}
