import { useMemo, useState } from 'react'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import { Loading } from '../ui/Loading'
import Empty from '../ui/Empty'
import { XpToast } from '../rewards/XpToast'
import { clearModel, clearPaid } from '../../domain/dayClear'
import { InkFilters } from './kit'
import { useReducedMotion } from './useReducedMotion'
import ClearPhone from './ClearPhone'
import ClearDesk from './ClearDesk'
import MilestoneTicket from './MilestoneTicket'
import MilestoneMonth from './MilestoneMonth'
import PartialFinish from './PartialFinish'

// ── 終着 — which finish a run gets (plan 191) ─────────────────────────
// The picker between the server's answer and the screens of the canvas
// "Tsuji — the day cleared":
//
//   loading   the app's three gold dots (the ask waits on the last review)
//   partial   the run ended with cards left today: PartialFinish
//   cleared   the everyday clear -- ClearPhone, or ClearDesk at 1100px and
//             up -- and on a milestone day, once its stamp beat is done
//             (`onHandover`), the milestone's ceremony in its place:
//             MilestoneTicket (3, 7, 14) or MilestoneMonth (30 and up).
//             Under reduced motion a milestone day opens on the
//             milestone's rest state at once.
//   error     the ask failed: a way to ask again, and the way back
//
// A level crossed by the bonus plays the existing 進級 (XpToast's level
// scene) once the ceremony says its fare has landed (`onFareBeat`).
//
// Used by screens/DayClearScreen.jsx with the store's answer, and by the
// workbench (/dev/dayclear) with the canvas's fixtures.
//
// Props:
//   status    'loading' | 'cleared' | 'partial' | 'error'
//   result    POST /api/today/clear's answer (components/dayclear/fixtures.js
//             has one of each shape)
//   run       the run's tally: { at, cleared, xp, minutes, cards: [face] }
//   levelUp   { newLevel } | null -- stores/dayClear's
//   desk      the desk's layout (default: hooks/useDesk)
//   reduced   the rest state at once (default: prefers-reduced-motion)
//   onLeave()     back to the gate, /today ("Retour à la gare", "Garder le billet")
//   onContinue()  the rest of the day, /today/run (the partial finish's gate)
//   onShare(ticket)  share a milestone's ticket ({ days, day }) -- lib/shareTicket
//   onRetry()     ask again after an error
export default function DayClearView({
  status, result, run, levelUp = null,
  desk: deskProp, reduced: reducedProp,
  onLeave, onContinue, onShare, onRetry,
}) {
  const { t } = useLang()
  const deskNow = useDesk()
  const desk = deskProp ?? deskNow
  const reduced = useReducedMotion(reducedProp)
  const model = useMemo(() => (result?.cleared ? clearModel(result, run) : null), [result, run])
  // A milestone's ceremony plays once, on the clear that paid it: a
  // later run the same day (`already`, nothing paid) gets the everyday
  // clear -- no second ticket clipped, no "+0 billet", no rest day
  // announced again.
  const handover = Boolean(model && model.tier !== 'day' && !model.already)
  // On a milestone day the everyday clear hands over after its stamp;
  // reduced, the milestone's rest is the screen from the start.
  const [handedOver, setHandedOver] = useState(false)
  const stage = handover && (handedOver || reduced) ? 'milestone' : 'clear'
  const [fareLanded, setFareLanded] = useState(false)
  // The 進級 is keyed once per finish, so a re-render cannot replay it.
  const toastId = `clear-${run?.at ?? 'x'}`

  if (status === 'loading' || status === 'idle') {
    return <main id="main-content" className="clr-wait"><Loading /></main>
  }
  if (status === 'error') {
    return (
      <main id="main-content" className="clr-wait">
        <Empty
          tone="error"
          message={t.errorTitle}
          hint={t.errorHint}
          action={{ label: t.tryAgain, onClick: onRetry }}
        />
      </main>
    )
  }
  if (status === 'partial') {
    return (
      <>
        <InkFilters />
        <PartialFinish result={result} run={run} desk={desk} reduced={reduced} onContinue={onContinue} onLeave={onLeave} />
      </>
    )
  }

  const fareBeat = () => setFareLanded(true)
  const ticket = model?.ticket ? { days: model.ticket.days, day: result.day } : null
  let screen
  if (stage === 'milestone' && model.tier === 'ticket') {
    screen = (
      <MilestoneTicket
        result={result} run={run} model={model} desk={desk} reduced={reduced}
        onFareBeat={fareBeat} onKeep={onLeave} onShare={() => onShare?.(ticket)}
      />
    )
  } else if (stage === 'milestone') {
    screen = (
      <MilestoneMonth
        result={result} run={run} model={model} desk={desk} reduced={reduced}
        onFareBeat={fareBeat} onKeep={onLeave} onShare={() => onShare?.(ticket)}
      />
    )
  } else {
    const Clear = desk ? ClearDesk : ClearPhone
    screen = (
      <Clear
        result={result} run={run} model={model} reduced={reduced}
        handover={handover} onHandover={() => setHandedOver(true)}
        onFareBeat={fareBeat} onLeave={onLeave}
      />
    )
  }
  return (
    <>
      <InkFilters />
      {screen}
      {fareLanded && levelUp && (
        <XpToast
          toast={{ id: toastId, amount: clearPaid(result), leveledUp: true, newLevel: levelUp.newLevel }}
          onDone={() => {}}
        />
      )}
    </>
  )
}
