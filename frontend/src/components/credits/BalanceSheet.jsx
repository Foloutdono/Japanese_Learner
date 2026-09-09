import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { useCredits, useBalanceOpen, closeBalance } from '../../stores/credits'
import { DAILY_REFILL, CAP } from '../../domain/credits'

// ── 残高 — the balance sheet (plan 069) ───────────────────────
// Off the HUD's pass: the balance as a figure over its track, the two
// facts of a free pass — the daily refill and the cap — and the one
// line that is never charged against either. The canvas draws an offer
// block under them; it stays out until a purchase flow exists
// (domain/credits.js, HAS_STORE), and nothing here says "unlimited" to
// a free learner.
function refillClock(iso, lang) {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(d)
}

export function BalanceSheet() {
  const { t, lang } = useLang()
  const open = useBalanceOpen()
  const credits = useCredits()
  const cap = credits?.cap ?? CAP
  const refill = credits?.dailyRefill ?? DAILY_REFILL
  const balance = credits?.unlimited ? null : credits?.balance
  const pct = balance == null ? 100 : Math.round((Math.min(balance, cap) / cap) * 100)
  const at = refillClock(credits?.refillAt, lang) ?? '00:00'

  return (
    <Sheet open={open} onClose={closeBalance} jp={t.balanceTitle} cap={t.passLabel} label={t.balanceTitle}>
      <div className="balance">
        <span className={`balance__fig${balance === 0 ? ' balance__fig--out' : ''}`}>
          {balance == null ? '∞' : balance}
          <span className="balance__unit">{t.creditsUnit}</span>
        </span>
        {balance != null && (
          <span className="balance__of">
            <span>{t.balanceOf(cap)}</span>
          </span>
        )}
      </div>
      <div className="balance__track" aria-hidden="true">
        <span className="balance__fill" style={{ width: `${pct}%` }} />
      </div>
      {balance != null && (
        <div className="balance__rows">
          <div className="balance__cell">
            <b>+{refill} <span className="balance__jp" lang="ja">毎日</span></b>
            <span className="balance__cap">{t.balanceRefillAt(at)}</span>
          </div>
          <div className="balance__cell">
            <b>{cap} <span className="balance__jp" lang="ja">上限</span></b>
            <span className="balance__cap">{t.balanceHolds(cap)}</span>
          </div>
        </div>
      )}
      {/* 無料 — the one line the balance is never asked for
          (domain/credits.js). Under the lattice, not a third cell in
          it: the rows are a flush two-column grid and a third cell
          would leave half a row empty. Only where there is a balance
          to be spared — a pass has nothing to be free of. */}
      {balance != null && (
        <p className="balance__free">
          <span className="balance__free-jp" lang="ja">無料</span>
          {t.balanceKanaFree}
        </p>
      )}
      <button type="button" className="btn-secondary" onClick={closeBalance}>{t.close}</button>
    </Sheet>
  )
}
