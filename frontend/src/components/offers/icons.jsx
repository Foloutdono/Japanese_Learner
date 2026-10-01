import { MARK_INK, MARK_ROAD } from '../ui/markPaths'

// The small marks the offers draw in their stages and on their cards
// (plan 171).

/** A padlock; `.ofr-lk__shackle` is what the stages lift to open it. */
export function PadLock({ className = '' }) {
  return (
    <svg className={`ofr-lk ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path className="ofr-lk__shackle" d="M8 11V7a4 4 0 0 1 8 0v4" />
      <rect x="5" y="11" width="14" height="10" rx="2" />
    </svg>
  )
}

/** The answer's check. */
export function Tick({ className = '' }) {
  return (
    <svg className={`ofr-chk ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <polyline points="5 12.5 10 17 19 7" />
    </svg>
  )
}

/** The pass's contactless mark at the cards' size: three arcs, the
 *  outer two fainter, in the ink of what prints it. */
export function Wave() {
  return (
    <span className="ofr-wave" aria-hidden="true">
      <i className="ofr-wave__arc ofr-wave__arc--1" />
      <i className="ofr-wave__arc ofr-wave__arc--2" />
      <i className="ofr-wave__arc ofr-wave__arc--3" />
    </span>
  )
}

/** 辻 in the card's corner, as the issuer prints it: the app's mark,
 *  inked by the card it is printed on. */
export function CornerMark() {
  return (
    <svg className="ofr-corner" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">
      <path className="ofr-corner__road" d={MARK_ROAD} />
      <path className="ofr-corner__ink" d={MARK_INK} />
    </svg>
  )
}
