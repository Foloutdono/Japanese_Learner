import { useId } from 'react'
import { CROSS, SHIN, ROAD } from './markParts'

// ── 辻, struck into a pass, filling with the XP (plan 171) ─────────
// The owner's drawing: the pass carries the app's mark large and
// faint, and the XP bar is the mark itself -- 辶, the road, filling
// from its foot up (the sweep, then the zigzag, then the dot) to the
// share of the level climbed. 十 never fills. Printed on Pro (a tone
// on its charcoal, the fill a gold ink); `etched` on Max (fine
// diagonal cuts in the platinum, the fill gold laid into them).
//
// The fill is one bar clipped over 辶's extent (its box in the mark's
// own 1000-unit square: 56 to 977), scaled by --ofr-xp. Ids are the
// component's own, so two passes on one screen keep their clips apart.
export function StruckMark({ xp = 0, etched = false, className = '' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      className={`ofr-mark${etched ? ' ofr-mark--etched' : ''} ${className}`.trim()}
      viewBox="0 0 1000 1000"
      aria-hidden="true"
      focusable="false"
      style={{ '--ofr-xp': xp }}
    >
      <defs>
        {etched && (
          <pattern id={`${id}h`} width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
            <rect width="16" height="6" fill="rgba(60, 64, 72, 0.3)" />
          </pattern>
        )}
        {etched && (
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e6bd62" />
            <stop offset="1" stopColor="#b0852f" />
          </linearGradient>
        )}
        <clipPath id={`${id}c`}>
          <rect className="ofr-mark__bar" x="0" y="56" width="1000" height="921" />
        </clipPath>
      </defs>
      <g className="ofr-mark__ink" fill={etched ? `url(#${id}h)` : undefined}>
        <path d={CROSS} />
        <path d={SHIN} />
        <path d={ROAD} />
      </g>
      <g className="ofr-mark__xp" clipPath={`url(#${id}c)`} fill={etched ? `url(#${id}g)` : undefined}>
        <path d={SHIN} />
        <path d={ROAD} />
      </g>
    </svg>
  )
}
