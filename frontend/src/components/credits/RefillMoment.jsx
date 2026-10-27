import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { useCredits, useClaimOffer, takeClaim } from '../../stores/credits'
import { CAP } from '../../domain/credits'
import { useRefill } from '../../hooks/useRefill'
import { REFILL_MS } from './refill'

// ── 補充 — while you were away (plans 141, 276) ──────────────
// The refill lands a credit every 48 minutes whether the app is open or
// not; what landed while it was not is charged onto the card on
// arrival (plan 276, the owner's pick C2: RefillCard.jsx draws it, on
// the strip it hangs from or in the holder it stands up in). This is
// its clock: the card is out for REFILL_MS, and the claim is taken as
// it goes back -- one way out, which always claims, since a credit left
// behind is nobody's gain. Nothing here gates: no scrim, no button, the
// screen under it answers every tap. It replaced plan 141's sheet.
//
// Mounted once beside <Routes/> (App.jsx); it also carries the hook that
// decides when to charge the card and when a credit is claimed quietly
// instead (hooks/useRefill.js). `hold` keeps it back through the 改札
// cutscene, and so does the first ride (/ride/*), which is a lesson with
// a guide walking it. A screen reader hears what landed, once.
export function RefillMoment({ hold = false }) {
  const { t } = useLang()
  const { pathname } = useLocation()
  useRefill(hold || pathname.startsWith('/ride'))
  const offer = useClaimOffer()
  const credits = useCredits()

  useEffect(() => {
    if (!offer) return undefined
    const id = setTimeout(() => takeClaim(), REFILL_MS)
    return () => clearTimeout(id)
  }, [offer])

  if (!offer) return null
  const cap = credits?.cap ?? CAP
  return createPortal(
    <span className="sr-only" aria-live="polite">{t.refillLanded(offer.amount, offer.from + offer.amount, cap)}</span>,
    document.body,
  )
}
