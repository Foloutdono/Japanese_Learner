import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { useCredits, useClaimOffer, takeClaim } from '../../stores/credits'
import { CAP } from '../../domain/credits'
import { useRefill } from '../../hooks/useRefill'
import { playFareTick } from '../../lib/audio'

// ── 補充 — while you were away (plan 141) ─────────────────────
// The refill lands a credit every 48 minutes whether the app is open or
// not; what landed while it was not waits here, on arrival. The figure
// in the pass's gold, the balance it takes them from and to, the 回数券
// book -- the cap as a stub a credit, ten to a row: the ones already
// held in a pale metal, the ones that landed in full gold, filling in
// one after another, the room left as dashed outlines (the owner's pick
// C of four drawn directions) -- and the one button. Every way out of
// the sheet claims -- a credit left behind is nobody's gain -- so the
// scrim and Escape are the button too. On the desk it is a dialog in
// the window's middle, not beside the rail's pass like the balance
// sheet: nothing on the rail opened it.
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
  const held = Math.min(Math.max(from, 0), cap)
  const filled = Math.min(to, cap)

  function claim() {
    playFareTick()
    takeClaim()
  }

  return (
    <Sheet open className="claim-sheet" onClose={claim} jp={t.claimTitle} label={t.claimTitle} initialFocus=".btn-depart">
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
      <div className="claim-book" role="img" aria-label={t.claimBookLabel(filled, cap)}>
        {Array.from({ length: cap }, (_, i) => {
          const kind = i < held ? 'held' : i < filled ? 'new' : 'room'
          return (
            <span
              key={i}
              className={`claim-book__stub claim-book__stub--${kind}`}
              style={kind === 'new' ? { '--i': i - held } : undefined}
            />
          )
        })}
      </div>
      <button type="button" className="btn-depart" onClick={claim}>
        <span className="btn-depart__jp">{t.claimButton}</span>
      </button>
    </Sheet>
  )
}
