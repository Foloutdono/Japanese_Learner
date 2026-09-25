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
export function RunRecords({ done = false, remaining = null }) {
  const { t } = useLang()
  const tally = useRunTally()
  const accuracy = tallyAccuracy(tally)
  if (done && tally.reviewed === 0) return null
  return (
    <div className="desk-figs" role="group" aria-label={t.deskRunLabel}>
      <DeskFigure label={t.totalReviews} value={tally.reviewed} />
      <DeskFigure label={t.accuracy} value={accuracy ?? '—'} unit={accuracy === null ? null : '%'} />
      <DeskFigure label={t.deskEarned} value={`+${tally.xp}`} unit="XP" />
      {remaining != null && <DeskFigure label={t.deskRemaining} value={remaining} />}
    </div>
  )
}

/** A panel's figure: the number, its unit beside it, the label under. */
export function DeskFigure({ label, value, unit }) {
  return (
    <span className="desk-fig">
      <b className="desk-fig__value">
        {value}
        {unit && <small className="desk-fig__unit">{unit}</small>}
      </b>
      <span className="desk-fig__label">{label}</span>
    </span>
  )
}
