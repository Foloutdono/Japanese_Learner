import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { StruckMark } from '../offers/StruckMark'
import { Wave, CornerMark } from '../offers/icons'
import { useSlotWidth, scaleVars, classLabel } from './cardScale'

// ── 定期券 — the learner's card (plan 173) ──────────────────────────
// The owner's pick of the canvas "Tsuji — the three offers": one card in
// three materials (domain/passCard.js's cardTier), replacing every pass
// the app drew. Its face is the offers' (plan 172): the contactless mark
// and "Pass", 辻 in the corner, the holder with the level under the name,
// the struck 辻 whose road 辶 fills with the climb, and at its foot what
// practice costs on it and the class. Whatever the old passes printed
// that the face does not is on the back (PassBack.jsx): the route and
// its validity, the contract, the three meters, the signature.
//
const FARE = { free: 'cardFareFree', pro: 'ofrCardFarePro', max: 'ofrCardFareMax' }

// The plates of the card's stuff between its two faces: the edge a turn
// shows, the card being an object with a thickness.
const CORE = [-1.2, -0.4, 0.4, 1.2]

/** The card's stuff, at the face's scale -- what both sides are cut
 *  from: white plastic with its band, charcoal, satin platinum. */
export function CardSkin({ tier }) {
  return (
    <span className={`pcs pcs--${tier}`} aria-hidden="true">
      <span className="pcs__grain" />
      {tier === 'free' && <span className="pcs__band" />}
    </span>
  )
}

/**
 * The face's print. `levelSlot` replaces the level's figure (the
 * level-up rolls its own there).
 */
export function FacePrint({ tier, name, level, share, levelSlot = null }) {
  const { t } = useLang()
  return (
    <div className={`pcf pcf--${tier}`} aria-hidden="true">
      <StruckMark xp={share} etched={tier === 'max'} className="pcf__seal" />
      <div className="pcf__row">
        <span className="pcf__brand"><Wave />{t.ofrCardBrand}</span>
        <CornerMark />
      </div>
      <span className="pcf__who">
        <span className="pcf__name">{name}</span>
        <span className="pcf__lvl">{levelSlot ?? level}</span>
      </span>
      <div className="pcf__row pcf__row--foot">
        <span className="pcf__meta">{t[FARE[tier]]}</span>
        <span className="pcf__class">{classLabel(t, tier)}</span>
      </div>
    </div>
  )
}

/**
 * The card face up and nothing else: the gate's reader, the level-up,
 * the holder's mouth. `children` are drawn over it (the level-up's
 * sparks).
 */
export function CardFace({ tier, name, level, share, levelSlot, className = '', label, children }) {
  const [ref, width] = useSlotWidth()
  return (
    <div
      ref={ref}
      className={`pcard pcard--${tier} ${className}`.trim()}
      style={scaleVars(width)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    >
      <div className="pcard__side pcard__side--face">
        <CardSkin tier={tier} />
        <FacePrint tier={tier} name={name} level={level} share={share} levelSlot={levelSlot} />
      </div>
      {children}
    </div>
  )
}

// How long the card is in the air: the flip's own 0.7s (index.css's
// .pcard__flip) and a margin, in case its transitionend never comes.
const TURN_MS = 800

/**
 * Whether the card is turning: from a change of side until the flip
 * lands. The card's depth (its perspective) is drawn only then. At rest
 * a perspective, however far, puts the print on a 3D layer the browser
 * resamples, and every glyph on the card read soft; flat, the two sides
 * stand exactly where they did and the print is crisp.
 */
function useTurning(side) {
  const [turning, setTurning] = useState(false)
  const first = useRef(side)
  useEffect(() => {
    if (first.current === side) return undefined
    first.current = side
    setTurning(true)
    const timer = setTimeout(() => setTurning(false), TURN_MS)
    return () => clearTimeout(timer)
  }, [side])
  return turning
}

/**
 * The card with both sides, turned by a touch. The face is one button,
 * the whole of it; the back carries its doors (PassBack), and a touch
 * anywhere on it off them turns it face up again. `side` is the
 * caller's ('face' | 'back'), and `onTurn` asks for the other one.
 */
export function PassCard({ tier, name, level, share, side = 'face', onTurn, back, className = '', label }) {
  const { t } = useLang()
  const [ref, width] = useSlotWidth()
  const turned = side === 'back'
  const turning = useTurning(side)
  const offDoor = e => {
    if (!turned || e.target.closest('button, a, input, [role="button"]')) return
    onTurn?.()
  }
  return (
    <div
      ref={ref}
      className={`pcard pcard--${tier} pcard--turnable${turned ? ' pcard--turned' : ''}${turning ? ' pcard--turning' : ''} ${className}`.trim()}
      style={scaleVars(width)}
      data-side={side}
    >
      <div className="pcard__flip">
        {CORE.map(z => <span key={z} className="pcard__core" style={{ '--pcard-z': z }} aria-hidden="true" />)}
        <div className="pcard__side pcard__side--face" inert={turned}>
          <CardSkin tier={tier} />
          <FacePrint tier={tier} name={name} level={level} share={share} />
          <button
            type="button"
            className="pcard__turn"
            aria-label={[label, `${t.level} ${level}`, t.cardTurn].filter(Boolean).join(' · ')}
            onClick={onTurn}
          />
        </div>
        {/* A touch off the back's doors turns it back over; the keys have
            the issuer's block, which is a button for that. */}
        <div className="pcard__side pcard__side--back" inert={!turned} onClick={offDoor}>
          <CardSkin tier={tier} />
          {back}
        </div>
      </div>
    </div>
  )
}
