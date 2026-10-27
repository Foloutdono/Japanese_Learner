import { useEffect, useState } from 'react'
import { useCredits, useClaimOffer } from '../../stores/credits'
import { useProfileSummary } from '../../stores/profileSummary'
import { CAP, showsCap } from '../../domain/credits'
import { cardTier, holderName, xpClimb } from '../../domain/passCard'
import { useReducedMotion } from '../dayclear/useReducedMotion'
import { playFareTick } from '../../lib/audio'
import { Wave } from '../offers/icons'
import { CardFace } from '../pass/PassCard'

// ── 補充 — the card, charged (plan 278) ──────────────────────
// The owner's pick C2 of the canvas "Tsuji — the refill, reloaded": what
// the refill landed while the app was closed is told on the card itself,
// where the learner carries it, and nothing waits on it. On the phone's
// HUD and a run's head the card drops out from under its strip and hangs
// below it a moment, the strip an empty pocket meanwhile (the card is
// never on the screen twice); on the desk it stands up out of its
// holder's mouth. Either way, while it is out:
//
//   the balance  printed in the foot's left, in the fare line's place,
//                the strip's own door at the card's size (the mark and
//                the figure in the card's balance ink), counting up
//                from what was held to what it holds now, a tick a step
//   the amount   rising off the figure, as the fare rises off the level
//   the mark     its three arcs lit one after another, a charge
//   the gauge    along the card's foot in the pass's metal: the balance
//                as a share of the cap, filling with the count
//
// then it goes back, the claim is taken (RefillMoment.jsx) and the
// figure it went back with glints on the strip or the holder. It takes
// no pointer: a tap lands on the screen under it.
//
// Its clock is refill.js's (and index.css's --refill-ms).
const COUNT_AT = 500
const COUNT_MS = 800
// A step a credit, up to this many: past it the figure counts by more
// than one, so the coin is never a buzz.
const MAX_STEPS = 12

/**
 * The balance as the card shows it: from what was held to what it holds
 * now, a step at a time from COUNT_AT, the fare's coin on each. Under
 * reduced motion, the end at once and no coin. Keyed on the offer by
 * the caller, so a new offer counts from its own start.
 */
function useCount(offer, still) {
  const { from, amount } = offer
  const [step, setStep] = useState(0)
  const steps = Math.min(amount, MAX_STEPS)
  useEffect(() => {
    if (still) return undefined
    const every = COUNT_MS / steps
    const timers = Array.from({ length: steps }, (_, i) => setTimeout(() => {
      setStep(i + 1)
      playFareTick()
    }, COUNT_AT + every * (i + 1)))
    return () => timers.forEach(clearTimeout)
  }, [steps, still])
  if (still) return from + amount
  return from + Math.round((amount * step) / steps)
}

/**
 * What the refill prints over the face while the card is out, at the
 * face's own scale (CardFace's `children`).
 */
export function RefillPrint({ offer, cap = CAP }) {
  const still = useReducedMotion()
  const shown = useCount(offer, still)
  return (
    <span className="refill-print" aria-hidden="true" style={{ '--refill-share': Math.min(1, shown / cap) }}>
      <span className="refill-print__bal">
        <Wave />
        <span className="refill-print__fig">
          <b>{shown}</b>
          {showsCap(shown, cap) && <small>/{cap}</small>}
        </span>
        <span className="refill-print__plus">+{offer.amount}</span>
      </span>
      <span className="refill-print__gauge"><i /></span>
      <i className="refill-print__sheen" />
    </span>
  )
}

/**
 * The card hung from the strip (Hud.jsx: the HUD's, a run head's): the
 * strip an empty pocket over its doors, the card out from under it. A
 * child of the strip, so it is placed by the strip wherever the chrome
 * draws one.
 */
export function StripRefill() {
  const offer = useClaimOffer()
  const credits = useCredits()
  const summary = useProfileSummary()
  if (!offer) return null
  const tier = cardTier(credits)
  return (
    <>
      <i className="hstrip__pocket" aria-hidden="true" />
      <span className="refill-hang" aria-hidden="true">
        <span className="refill-hang__card">
          <CardFace tier={tier} name={holderName(summary)} level={summary?.level ?? ''} share={xpClimb(summary).share}>
            <RefillPrint key={offer.id} offer={offer} cap={credits?.cap ?? CAP} />
          </CardFace>
        </span>
      </span>
    </>
  )
}
