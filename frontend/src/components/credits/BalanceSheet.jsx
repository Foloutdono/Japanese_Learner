import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { useCredits, useBalanceOpen, closeBalance } from '../../stores/credits'
import { CAP, refillMinutes, nextCreditClock } from '../../domain/credits'
import { SOURCES } from '../../domain/paywall'
import { OfferButton } from './OfferButton'

// ── 残高 — the balance sheet (plan 069) ───────────────────────
// Off the HUD's pass: the balance as a figure over its track, with the
// hour its next credit lands beside it, the two facts of a free pass —
// the refill's rhythm (one every 48 minutes, plan 141) and the cap —
// and the one line that is never charged against either. The canvas draws an offer
// block under them, and it is now drawn: the pass is SHOWN but not yet
// sold (domain/paywall.js's HAS_PAYWALL, which is deliberately not
// HAS_STORE). It sits under the free line, so what a learner already
// has is stated before what they could buy, and nothing here says
// "unlimited" to a free learner who has not asked.
export function BalanceSheet() {
  const { t, lang } = useLang()
  const open = useBalanceOpen()
  const credits = useCredits()
  const cap = credits?.cap ?? CAP
  const balance = credits?.unlimited ? null : credits?.balance
  const pct = balance == null ? 100 : Math.round((Math.min(balance, cap) / cap) * 100)
  // Null on a full tank: no hour is printed that is not true.
  const next = nextCreditClock(credits, lang)

  return (
    <Sheet open={open} onClose={closeBalance} jp={t.balanceTitle} cap={t.passLabel} label={t.balanceTitle} initialFocus=".btn-secondary">
      <div className="balance">
        <span className={`balance__fig${balance === 0 ? ' balance__fig--out' : ''}`}>
          {balance == null ? '∞' : balance}
          <span className="balance__unit">{t.creditsUnit}</span>
        </span>
        {balance != null && (
          <span className="balance__of">
            <span>{t.balanceOf(cap)}</span>
            {next && <span className="balance__of-wait">{t.balanceNext(next)}</span>}
          </span>
        )}
      </div>
      <div className="balance__track" aria-hidden="true">
        <span className="balance__fill" style={{ width: `${pct}%` }} />
      </div>
      {balance != null && (
        <div className="balance__rows">
          <div className="balance__cell">
            <b>+1</b>
            <span className="balance__cap">{t.balanceRefillEvery(refillMinutes(credits))}</span>
          </div>
          <div className="balance__cell">
            <b>{cap}</b>
            <span className="balance__cap">{t.balanceHolds(cap)}</span>
          </div>
        </div>
      )}
      {/* The one line the balance is never asked for
          (domain/credits.js). Under the lattice, not a third cell in
          it: the rows are a flush two-column grid and a third cell
          would leave half a row empty. Only where there is a balance
          to be spared — a pass has nothing to be free of. It opened
          with 無料 until 2026-09-21; the sentence says it. */}
      {balance != null && (
        <p className="balance__free">{t.balanceKanaFree}</p>
      )}
      <OfferButton source={SOURCES.BALANCE} className="btn-depart pw-open--wide" />
      <button type="button" className="btn-secondary" onClick={closeBalance}>{t.close}</button>
    </Sheet>
  )
}
