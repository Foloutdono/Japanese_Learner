import { useLayoutEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { useRunTally, tallyAccuracy } from '../../stores/runTally'

// ── 机 — this run, in three figures (plans 114, 124, 126) ──
// Cards rated, the share good or better, the XP they earned
// (stores/runTally, counted where every SRS run already reviews —
// hooks/useReviewGates). They stood at the head of the run's side (plan
// 114), then on the level strip (plan 124); since plan 126 they head
// the session panel, the first of the run's two left panels
// (components/study/RunPanel.jsx), as the panel's figures: the number
// over its label (DeskFigure, the same pair the card panel's rhythm
// prints).
//
// Rendered on the desk only, by the session panel, which StudyStage
// stands only where the desk lays a run out on panels.
//
// `done` is the run's end: a run that ends with nothing rated -- nothing
// was due -- has no record to keep, and three zeros beside its done
// message said otherwise (plan 123). Mid-run the zeros stand: they are
// the figures the first rating moves. `remaining`, where the run counts
// its queue (Today), is the row's fourth figure: the panel prints no
// caption (owner's cut, plan 126), so the count stands with the others.
//
// A row too narrow for its labels -- the left column at its 300px on a
// laptop, four labels in caps -- ran them into each other and into the
// figures. There the figures stand bare, the labels kept for a screen
// reader (owner's call). Measured rather than set at a width: how long
// the labels are is the language's and the count's.
export function RunRecords({ done = false, remaining = null }) {
  const { t } = useLang()
  const tally = useRunTally()
  const accuracy = tallyAccuracy(tally)
  const [rowRef, bare] = useLabelsFit()
  if (done && tally.reviewed === 0) return null
  return (
    <div ref={rowRef} className="desk-figs" role="group" aria-label={t.deskRunLabel}>
      <DeskFigure label={t.totalReviews} value={tally.reviewed} bare={bare} />
      <DeskFigure label={t.accuracy} value={accuracy ?? '—'} unit={accuracy === null ? null : '%'} bare={bare} />
      <DeskFigure label={t.deskEarned} value={`+${tally.xp}`} unit="XP" bare={bare} />
      {remaining != null && <DeskFigure label={t.deskRemaining} value={remaining} bare={bare} />}
    </div>
  )
}

// Whether a row of figures is too narrow for its labels: [ref, bare].
// With the labels shown, a label wider than its figure is a label the
// row squeezed (the figures shrink to share it, and the labels, never
// wrapped, spill into each other). Once bare, the row's width alone
// decides -- it is its column's, not its content's -- and the labels
// are tried again only past the width they last failed at, so hiding
// them can never be what shows them again. Measured before paint, then
// whenever the row or a label changes size: a resize, a figure that
// grows and squeezes its label, the font arriving.
function useLabelsFit() {
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
      const labels = row.querySelectorAll('.desk-fig__label')
      if ([...labels].some(l => l.scrollWidth > l.clientWidth + 1)) {
        failedAt.current = width
        setBare(true)
      }
    }
    measure()
    document.fonts?.ready.then(measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(row)
    if (!bare) row.querySelectorAll('.desk-fig__label').forEach(l => observer?.observe(l))
    return () => {
      live = false
      observer?.disconnect()
    }
  }, [row, bare])

  return [setRow, bare]
}

/** A panel's figure: the number, its unit beside it, the label under --
 *  or, `bare`, for a screen reader only. */
export function DeskFigure({ label, value, unit, bare = false }) {
  return (
    <span className="desk-fig">
      <b className="desk-fig__value">
        {value}
        {unit && <small className="desk-fig__unit">{unit}</small>}
      </b>
      <span className={bare ? 'desk-fig__label sr-only' : 'desk-fig__label'}>{label}</span>
    </span>
  )
}
