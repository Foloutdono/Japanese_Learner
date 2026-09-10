import { useLang } from '../../LangContext'
import { useCredits } from '../../stores/credits'
import { DAILY_REFILL, CAP, showsCap } from '../../domain/credits'

// ── The balance, printed on the pass (canvas Profile, plan 074) ───
// The commuter pass's footer line: the word, the figure over its cap,
// and the daily refill with its hour — the three facts of a free pass,
// on the pass itself. A subscription prints ∞ and no refill. The same
// store the HUD's pocket pass reads, so the two never disagree.
function refillClock(iso, lang) {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  return new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' }).format(d)
}

export function BalanceLine() {
  const { t, lang } = useLang()
  const credits = useCredits()
  const cap = credits?.cap ?? CAP
  const refill = credits?.dailyRefill ?? DAILY_REFILL
  const balance = credits?.unlimited ? null : credits?.balance
  const at = refillClock(credits?.refillAt, lang) ?? '00:00'
  return (
    <div className="jour-line balance-line">
      {/* The word and the figure are ONE part of the line, not two, so
          that a footer too narrow for the whole thing breaks between
          the balance and the refill — the only place it reads. */}
      <span className="balance-line__reading">
        <span className="jour-line__status"><b className="balance-line__word">{t.balanceLabel}</b></span>
        <span className="jour-line__validity">
          <b>{balance == null ? '∞' : balance}</b>
          {balance != null && (
            <span className="jour-cap">
              {showsCap(balance, cap) ? `/ ${cap} ` : ''}{t.creditsUnit}
            </span>
          )}
        </span>
      </span>
      {balance != null && <span className="jour-cap balance-line__refill">{t.balanceRefillLine(refill, at)}</span>}
    </div>
  )
}
