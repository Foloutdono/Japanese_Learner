import { useLang } from '../../LangContext'
import { useCredits } from '../../stores/credits'
import { CAP, showsCap, nextCreditClock } from '../../domain/credits'

// ── The balance, printed on the pass (canvas Profile, plan 074) ───
// The commuter pass's footer line: the word, the figure over its cap,
// and the hour the refill lands its next credit (plan 139) — the three
// facts of a free pass, on the pass itself. A full tank prints no hour,
// having none coming; a subscription prints ∞ and no refill. The same
// store the HUD's pocket pass reads, so the two never disagree.
export function BalanceLine() {
  const { t, lang } = useLang()
  const credits = useCredits()
  const cap = credits?.cap ?? CAP
  const balance = credits?.unlimited ? null : credits?.balance
  const next = nextCreditClock(credits, lang)
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
      {balance != null && next && <span className="jour-cap balance-line__refill">{t.balanceRefillLine(next)}</span>}
    </div>
  )
}
