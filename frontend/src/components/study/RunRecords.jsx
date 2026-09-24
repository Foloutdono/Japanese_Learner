import { useLang } from '../../LangContext'
import { useRunTally, tallyAccuracy } from '../../stores/runTally'

// ── 机 — this run, in three figures (plan 114; on the floor since 122) ──
// Cards rated, the share good or better, the XP they earned
// (stores/runTally, counted where every SRS run already reviews —
// hooks/useReviewGates). They stood at the head of the run's side as
// three record cells until plan 122 moved them onto the run's floor:
// the level bar draws them at the strip's left when a run hands
// StudyStage `records`, in the strip's own register — the level's pair,
// label over number, the number a rung up (the 机 section, .desk-tally).
//
// Rendered on the desk only: the level bar receives `records` from
// StudyStage, which sets it only where the desk stands a side.
export function RunRecords() {
  const { t } = useLang()
  const tally = useRunTally()
  const accuracy = tallyAccuracy(tally)
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
