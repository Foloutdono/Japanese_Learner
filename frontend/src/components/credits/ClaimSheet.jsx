import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { useCredits, useClaimOffer, takeClaim } from '../../stores/credits'
import { CAP } from '../../domain/credits'
import { useRefill } from '../../hooks/useRefill'
import { playFareTick } from '../../lib/audio'

// ── 補充 — while you were away (plan 139) ─────────────────────
// The refill lands a credit every 48 minutes whether the app is open or
// not; what landed while it was not waits here, on arrival. The figure
// in the pass's gold, the balance it takes them from and to, the track
// with the new part lit beside the old, and the one button. Every way
// out of the sheet claims -- a credit left behind is nobody's gain --
// so the scrim and Escape are the button too.
//
// Mounted once beside <Routes/> (App.jsx), like the balance sheet; it
// also carries the hook that decides when to open it and when a credit
// is claimed quietly instead (hooks/useRefill.js). `hold` keeps it shut
// through the 改札 cutscene, and so does the first ride (/ride/*), which
// is a lesson with a guide walking it.
export function ClaimSheet({ hold = false }) {
  const { t } = useLang()
  const { pathname } = useLocation()
  useRefill(hold || pathname.startsWith('/ride'))
  const offer = useClaimOffer()
  const credits = useCredits()
  if (!offer) return null
  const cap = credits?.cap ?? CAP
  const from = offer.from
  const to = from + offer.amount
  const pct = n => Math.round((Math.min(Math.max(n, 0), cap) / cap) * 100)

  function claim() {
    playFareTick()
    takeClaim()
  }

  return (
    <Sheet open onClose={claim} jp={t.claimTitle} label={t.claimTitle} initialFocus=".btn-depart">
      <div className="balance">
        <span className="balance__fig">
          +{offer.amount}
          <span className="balance__unit">{t.creditsUnit}</span>
        </span>
        <span className="balance__of">
          <span>{from} → {to}</span>
          <span className="balance__of-wait">{t.balanceOf(cap)}</span>
        </span>
      </div>
      <div className="balance__track balance__track--split" aria-hidden="true">
        <span className="balance__fill" style={{ width: `${pct(from)}%` }} />
        <span className="balance__fill balance__fill--gain" style={{ width: `${pct(to) - pct(from)}%` }} />
      </div>
      <button type="button" className="btn-depart" onClick={claim}>
        <span className="btn-depart__jp">{t.claimButton}</span>
      </button>
    </Sheet>
  )
}
