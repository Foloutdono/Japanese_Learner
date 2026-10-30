import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { CardIcon } from '../ui/Icons'
import { useRunOut, clearRunOut, useCredits, recordStop } from '../../stores/credits'
import { useTodaySummary } from '../../stores/today'
import { refillMinutes } from '../../domain/credits'
import { SOURCES } from '../../domain/paywall'
import { OfferButton } from './OfferButton'

// ── The run stops at the balance (plan 069) ───────────────────
// Raised by lib/reviews.js on a 402 out_of_credits — only ever under
// enforcement. The balance at zero in the danger ink, what this run
// cleared, what waits for the refill -- a credit every 48 minutes
// (plan 141), no longer tomorrow's lump -- and the way out: back to
// the station, which KEEPS the primary button. The offer sits above it
// as a secondary control — a balance at zero is the one moment the
// pass answers a question the learner is actually asking, but the way
// out of a stopped run must stay the obvious tap, never a purchase.
//
// The stop itself is recorded here (plan 172): under enforcement the
// server refuses the run's first unpaid fare and never sees the rest,
// so this sheet -- the one place that knows what the run left -- posts
// it once per stop, for the week the offer draws (WeekOffer).
// Mounted for the whole session (App.jsx) and drawn only at a run-out,
// so what it reads is read only then: closed, a sheet asking for
// /api/today and /api/credits at every boot put them in the learner's
// six-at-a-time queue (core/concurrency.py) ahead of the screen's own
// requests -- the first ride's cards among them (2026-10-18).
export function RunOutSheet() {
  const runOut = useRunOut()
  if (!runOut) return null
  return <RunOut runOut={runOut} />
}

function RunOut({ runOut }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const credits = useCredits()
  const today = useTodaySummary().data
  const cleared = runOut?.cleared ?? 0
  const waiting = Math.max(0, (today?.total ?? 0) - cleared)
  const recorded = useRef(null)
  useEffect(() => {
    if (!runOut || recorded.current === runOut || !(waiting > 0)) return
    recorded.current = runOut
    recordStop(waiting)
  }, [runOut, waiting])

  function leave() {
    clearRunOut()
    navigate('/today')
  }

  return (
    <Sheet open onClose={leave} title={t.balanceTitle} icon={CardIcon} line="var(--accent2)" label={t.runOutTitle} initialFocus=".btn-depart">
      <div className="balance">
        <span className="balance__fig balance__fig--out">
          0<span className="balance__unit">{t.creditsUnit}</span>
        </span>
        <span className="balance__of">
          <span>{t.runOutCleared(cleared)}</span>
          <span className="balance__of-wait">{t.runOutWaiting(waiting)}</span>
        </span>
      </div>
      <div className="balance__track" aria-hidden="true">
        <span className="balance__fill" style={{ width: '0%' }} />
      </div>
      <div className="balance__rows">
        <div className="balance__cell">
          <b>+1</b>
          <span className="balance__cap">{t.balanceRefillEvery(refillMinutes(credits))}</span>
        </div>
        <div className="balance__cell">
          <b>{waiting}</b>
          <span className="balance__cap">{t.runOutWaits}</span>
        </div>
      </div>
      <OfferButton source={SOURCES.RUNOUT} detail={{ waiting }} className="btn-secondary pw-open--wide" />
      <button type="button" className="btn-depart" onClick={leave}>
        <span className="btn-depart__jp">{t.backToStation}</span>
      </button>
    </Sheet>
  )
}
