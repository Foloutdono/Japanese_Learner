import { useId } from 'react'
import { CROSS, SHIN, ROAD, MARK_TOP, MARK_FOOT, CROSS_FOOT, crossShare } from './markParts'

// ── 辻, struck into a pass, filling with the XP (plan 172) ─────────
// The owner's drawing: the pass carries the app's mark large and
// faint, and the XP bar is the mark itself, filling from the road's foot
// up to the share of the level climbed: the sweep, then the zigzag, then
// the dot, and 十 as the line passes its foot (it stands on the road). 十
// filled only in the level-up (plan 200) until it was asked to fill at
// rest too; now the level-up's end state is the same line, so a level
// that turns over is the whole 辻 filled and empties onto the new
// level's climb. Printed on Pro (a tone on its charcoal, the fill a gold
// ink); `etched` on Max (fine diagonal cuts in the platinum, the fill
// gold laid into them).
//
// The fill is one line rising across the mark's own 1000-unit square
// (31 to 977), as two bars clipped over it. 辶's covers the whole extent,
// scaled by --ofr-xp; 十's covers its own (31 to 783), scaled by
// --ofr-xp-cross, which is the same line in 十's units (markParts.js's
// crossShare) and which the level-up's animation drives past it. Ids are
// the component's own, so two passes on one screen keep their clips apart.
export function StruckMark({ xp = 0, etched = false, className = '' }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      className={`ofr-mark${etched ? ' ofr-mark--etched' : ''} ${className}`.trim()}
      viewBox="0 0 1000 1000"
      aria-hidden="true"
      focusable="false"
      style={{ '--ofr-xp': xp, '--ofr-xp-cross': crossShare(xp) }}
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
          <rect className="ofr-mark__bar" x="0" y={MARK_TOP} width="1000" height={MARK_FOOT - MARK_TOP} />
        </clipPath>
        <clipPath id={`${id}x`}>
          <rect className="ofr-mark__bar ofr-mark__bar--cross" x="0" y={MARK_TOP} width="1000" height={CROSS_FOOT - MARK_TOP} />
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
      <g className="ofr-mark__xp ofr-mark__xp--cross" clipPath={`url(#${id}x)`} fill={etched ? `url(#${id}g)` : undefined}>
        <path d={CROSS} />
      </g>
    </svg>
  )
}
