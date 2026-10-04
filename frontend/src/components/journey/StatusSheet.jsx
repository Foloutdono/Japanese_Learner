import { useMemo } from 'react'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { useJourneyStatus, useVolumes, useStatusOpenedAt, closeStatus } from '../../stores/journey'
import { useProfileSummary } from '../../stores/profileSummary'
import { useCredits } from '../../stores/credits'
import { journeyModel } from '../../domain/goalMath'
import { cardTier } from '../../domain/passCard'
import { useDesk } from '../../hooks/useDesk'
import { JourneyBody, JourneyMoves } from './JourneyBody'
import { JourneyCard } from './JourneyCard'

// ── 運行状況 — the status sheet (進捗が主役, chosen off a four-
// direction mockup round; plan 074 drew the two-lane one it replaces) ─
// The pass's back, as a bottom sheet off the HUD's station panel, and
// it leads with DISTANCE: how far along the line you are (the count,
// the percent, the stop you are heading for and the backlog in items),
// then the ghost track directly under it as the proof, then two
// comparison rows — pace and arrival, each against what the pass
// promised, with the difference already worked out — and, when behind,
// the two honest moves: run faster and keep the date, or reprint the
// date at the pace kept.
//
// Why distance first: itemsDone/itemsTotal arrived on every payload,
// placed the car as a percentage and was then thrown away, so the one
// fact a learner can act on without arithmetic was the one fact the
// sheet never printed. The four-figure lattice went with it — two of
// its cells were one comparison and two were another, and it left both
// subtractions to the reader.
//
// The judgement is domain/goalMath's journeyModel over the same facts
// the HUD reads (stores/journey), so the sheet can never disagree with
// the panel that opened it.
//
// A pass with no destination is judged on pace alone and points at the
// office (Settings › Destination); a pass with no contract at all
// (never onboarded) has nothing to show and the panel never opens it.
//
// The body is JourneyBody.jsx (plan 114), which the desk also stands
// beside the fare gate on Today; this is the sheet around it.
//
// On a phone since plan 174 the sheet holds the card's back instead
// (JourneyCard.jsx, the owner's pick C″): the line alone, the drift in
// days signed in the state's ink, the next stop and the arrival dated
// under it, and the two moves beneath the card. The desk keeps the
// body, the same one its Today panel stands.

export function StatusSheet({ session }) {
  const { t } = useLang()
  // 0 while the sheet is closed; the moment it opened otherwise.
  const nowMs = useStatusOpenedAt()
  const open = nowMs > 0
  const { data: status } = useJourneyStatus()
  const { data: volumes } = useVolumes()
  const summary = useProfileSummary()
  const credits = useCredits()
  const desk = useDesk()

  const model = useMemo(
    () => (status && nowMs ? journeyModel(status, new Date(nowMs)) : null),
    [status, nowMs],
  )

  if (!open) return null
  if (!model || model.status == null) return null

  return (
    <Sheet
      open
      onClose={closeStatus}
      sumi
      dismiss
      className={`status-sheet jour-st--${model.status}`}
      /* The verdict is a word no longer printed on this sheet — the
         state's ink and the two deltas carry it — so the sheet's own
         name is where a screen reader still hears it. */
      label={`${t.hudStatusLabel} — ${t.jourStatus[model.status]}`}
    >
      {desk ? (
        <JourneyBody
          status={status}
          model={model}
          now={new Date(nowMs)}
          volumes={volumes}
          summary={summary}
          session={session}
          onLeave={closeStatus}
        />
      ) : (
        <>
          <JourneyCard
            status={status}
            model={model}
            now={new Date(nowMs)}
            volumes={volumes}
            summary={summary}
            tier={cardTier(credits)}
          />
          <JourneyMoves model={model} session={session} onLeave={closeStatus} />
        </>
      )}
    </Sheet>
  )
}
