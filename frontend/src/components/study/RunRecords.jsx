import { useLang } from '../../LangContext'
import { useRunTally, tallyAccuracy } from '../../stores/runTally'

// ── 机 — this run, in three figures (plan 114; on the floor since 124) ──
// Cards rated, the share good or better, the XP they earned
// (stores/runTally, counted where every SRS run already reviews —
// hooks/useReviewGates). They stood at the head of the run's side as
// three record cells until plan 124 moved them onto the run's floor:
// the level bar draws them at the strip's left when a run hands
// StudyStage `records`, in the strip's own register — the level's pair,
// label over number, the number a rung up (the 机 section, .desk-tally).
//
// Rendered on the desk only: the level bar receives `records` from
// StudyStage, which sets it only where the desk stands a side.
//
// `done` is the run's end: a run that ends with nothing rated -- nothing
// was due -- has no record to keep, and three zeros beside its done
// message said otherwise (plan 123). Mid-run the zeros stand: they are
// the figures the first rating moves.
export function RunRecords({ done = false }) {
  const { t } = useLang()
  const tally = useRunTally()
  const accuracy = tallyAccuracy(tally)
  if (done && tally.reviewed === 0) return null
  return (
    <div className="desk-tally" role="group" aria-label={t.deskRunLabel}>
      <Figure label={t.totalReviews} value={tally.reviewed} />
      <Figure label={t.accuracy} value={accuracy ?? '—'} unit={accuracy === null ? null : '%'} />
      <Figure label={t.deskEarned} value={`+${tally.xp}`} unit="XP" />
    </div>
  )
}

function Figure({ label, value, unit }) {
  return (
    <span className="desk-tally__fig">
      {label}
      <b className="desk-tally__num">
        {value}
        {unit && <span className="desk-tally__unit">{unit}</span>}
      </b>
    </span>
  )
}
