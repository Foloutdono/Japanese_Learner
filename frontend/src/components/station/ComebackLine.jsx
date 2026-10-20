import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { countUse } from '../../lib/screenTrail'
import { track } from '../../lib/track'
import { comebackHidden, countComebackOffer, hideComeback } from '../../stores/comeback'
import { useDesk } from '../../hooks/useDesk'
import { ChevronIcon, CrossIcon } from '../ui/Icons'
import { ComebackSheet } from './ComebackSheet'

// ── 運転再開 — the comeback notice (plan 254) ─────────────────────
// The owner: the comeback sheet (plan 217) that opened over the gate
// becomes a notice inside it, and once closed it stays away for the
// day. So a gate whose reviews piled up says it in one quiet row over
// the gate's own, as the level that does not fit does (LevelFitLine,
// the owner's D of plan 224): a ring in the due ink, the cards that
// wait, and the way to the paces -- the sheet, which this row opens and
// nothing else does. Its ✕ closes it until the next day on this device
// (stores/comeback); answered, the offer leaves GET /api/today and the
// row goes with it.
//
// The offer is counted when the row is put before the learner
// (catchup_offer, once a visit), the sheet opened and the row closed as
// the gate's uses (feature_use comeback · open, hide).
//
// Props:
//   today    GET /api/today: its review.comeback, and the pace the
//            sheet prices "all now" at
//   session
//   hold     a finish plays on the gate: the row waits for its rest

export default function ComebackLine({ today, session, hold = false }) {
  const { t } = useLang()
  const desk = useDesk()
  const [hidden, setHidden] = useState(() => comebackHidden())
  const [open, setOpen] = useState(false)
  const offer = today?.review?.comeback ?? null
  const shown = Boolean(offer) && !hidden && !hold
  const owed = offer?.owed ?? 0
  const away = offer?.days_away ?? 0

  useEffect(() => {
    if (shown && countComebackOffer()) track('catchup_offer', { owed, away })
  }, [shown, owed, away])

  if (!shown) return null

  function show() {
    playClick()
    countUse('comeback', 'open')
    setOpen(true)
  }

  function hide() {
    playClick()
    countUse('comeback', 'hide')
    hideComeback()
    setHidden(true)
  }

  return (
    <div className="tdy-cb">
      <button type="button" className="tdy-cb__open" onClick={show} aria-haspopup="dialog" data-action="comeback-open">
        <span className="tdy-cb__ring" aria-hidden="true" />
        <span className="tdy-door__what"><b>{owed}</b> {t.cbLinePiled(owed)}</span>
        <span className="tdy-door__go">{t.cbLineGo}<ChevronIcon direction="right" size={16} /></span>
      </button>
      <button
        type="button"
        className="tdy-cb__hide"
        onClick={hide}
        aria-label={t.cbHide}
        title={desk ? t.cbHide : undefined}
        data-action="comeback-hide"
      >
        <CrossIcon size={14} />
      </button>
      {open && (
        <ComebackSheet
          offer={offer}
          secondsPerReview={today.seconds_per_review}
          session={session}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
