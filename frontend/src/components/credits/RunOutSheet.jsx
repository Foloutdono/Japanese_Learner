import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { useRunOut, clearRunOut } from '../../stores/credits'
import { useTodaySummary } from '../../stores/today'
import { DAILY_REFILL } from '../../domain/credits'
import { SOURCES } from '../../domain/paywall'
import { OfferButton } from './OfferButton'

// ── The run stops at the balance (plan 069) ───────────────────
// Raised by lib/reviews.js on a 402 out_of_credits — only ever under
// enforcement. The balance at zero in the danger ink, what this run
// cleared, what waits for tomorrow's refill, and the way out: back to
// the station, which KEEPS the primary button. The offer sits above it
// as a secondary control — a balance at zero is the one moment the
// pass answers a question the learner is actually asking, but the way
// out of a stopped run must stay the obvious tap, never a purchase.
export function RunOutSheet() {
  const { t } = useLang()
  const navigate = useNavigate()
  const runOut = useRunOut()
  const today = useTodaySummary().data
  if (!runOut) return null
  const cleared = runOut.cleared ?? 0
  const waiting = Math.max(0, (today?.total ?? 0) - cleared)

  function leave() {
    clearRunOut()
    navigate('/today')
  }

  return (
    <Sheet open onClose={leave} jp={t.balanceTitle} label={t.runOutTitle}>
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
          <b>+{DAILY_REFILL} <span lang="ja">毎日</span></b>
          <span className="balance__cap">{t.runOutRefill}</span>
        </div>
        <div className="balance__cell">
          <b>{waiting} <span lang="ja">待機</span></b>
          <span className="balance__cap">{t.runOutTomorrow}</span>
        </div>
      </div>
      <OfferButton source={SOURCES.RUNOUT} className="btn-secondary pw-open--wide" />
      <button type="button" className="btn-depart" onClick={leave}>
        <span className="btn-depart__jp">{t.backToStation}</span>
      </button>
    </Sheet>
  )
}
