import { useLang } from '../../LangContext'
import { journeyPositions, NOVICE_GOAL } from '../../domain/goalMath'
import { journeyStations } from './stations'
import { JourneyLine } from './GhostTrack'

// ── 定期券の裏 — the line alone, on the card's back (plan 174) ─────────
// The owner's pick C″ of the canvas "Tsuji — the three offers", page
// "The ghost train": the status sheet on a phone is the learner's card
// turned over, in its own material (domain/passCard's cardTier: white
// plastic and its band, charcoal, satin platinum), and on it only what
// the question "am I on course?" needs:
//
//   the head     how far ahead of the promise or behind it, in days,
//                signed and in the state's ink -- no word, the colour
//                and the sign carry it (the owner's cut of "en avance"
//                and "en retard") -- and the route, start → destination.
//   the line     JourneyLine (GhostTrack.jsx), in the card's inks: the
//                route's legs, your train riding them at the share
//                learned, the ghost of the promise dashed above the
//                line, the stretch between them hatched in the state's
//                ink; the stops named under the line, the next one
//                dated "~ 6 déc." and the terminus with the arrival the
//                pace kept delivers.
//   the foot     the card's band.
//
// Everything else the sheet used to print (the count, the percent, the
// two comparisons) went: the line already says how far, and the date
// under the terminus says when. The moves stay under the card, outside
// it (JourneyBody's JourneyMoves), because they act on it.
//
// Pure and presentational over the same journeyModel the HUD's plate
// reads, so the two can never disagree. The drawing is aria-hidden; the
// head is the card's text and the sheet's label names the verdict.

export function JourneyCard({ status, model, now, volumes, summary, tier = 'free' }) {
  const { t } = useLang()
  const start = status.goalStartLevel ?? summary?.jlptLevel ?? null
  const stations = journeyStations(volumes, start, status.goalLevel, status.itemsTotal)
  const { youF, planF } = journeyPositions(status, model, now)

  // The head: the drift in days, signed (deltaDays is projected − planned,
  // so ahead is negative there and positive here), or the state's word
  // when there is no number to print.
  const signed = model.deltaDays && (model.status === 'ahead' || model.status === 'slightlyBehind' || model.status === 'delayed')
    ? t.jourDrift(-model.deltaDays)
    : t.jourStatus[model.status]
  const from = status.goalLevel === NOVICE_GOAL ? stations[0]?.label : start
  const to = stations.at(-1)?.label ?? status.goalLevel

  return (
    <div className={`jcard jcard--${tier}`}>
      <span className="jcard__grain" aria-hidden="true" />
      <div className="jcard__head">
        <span className="jcard__st"><i aria-hidden="true" />{signed}</span>
        {status.goalLevel && from && to && <span className="jcard__route">{t.jourRoute(from, to)}</span>}
      </div>
      <JourneyLine stations={stations} youF={youF} planF={planF} status={status} model={model} now={now} />
      <span className="jcard__foot" aria-hidden="true" />
    </div>
  )
}
