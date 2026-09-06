import { useLang } from '../../LangContext'

// ── The fare slip (plan 069) ──────────────────────────────────
// Printed at the end of a run: what was cleared, what it paid in XP,
// what the pass has left. Three cells on a hairline lattice.
export function FareSlip({ reviews, xp, creditsLeft }) {
  const { t } = useLang()
  return (
    <div className="fare-slip">
      <div className="fare-slip__cell">
        <span className="fare-slip__v">{reviews}</span>
        <span className="fare-slip__cap">{t.fareReviews}</span>
      </div>
      <div className="fare-slip__cell">
        <span className="fare-slip__v">+{xp}<span className="fare-slip__u">xp</span></span>
        <span className="fare-slip__cap">{t.fareFare}</span>
      </div>
      <div className="fare-slip__cell">
        <span className="fare-slip__v fare-slip__v--gold">{creditsLeft == null ? '∞' : creditsLeft}</span>
        <span className="fare-slip__cap">{t.fareCreditsLeft}</span>
      </div>
    </div>
  )
}
