// ── 墨 — the ink the stamps are pressed in (plan 191) ─────────────
// The two SVG filters every seal and stamped slot reads (kit.css §1 of
// the canvas "Tsuji — the day cleared"): #clrk-ink, a rough edge
// (1.6px of displacement), sparse voids where the ink did not take and
// a slow pressure blot, for the seal's face; #clrk-ink-fine, the voids
// alone, for a slot's ring so its weekday stays crisp. Seeds are fixed:
// the grain is the same on every replay.
//
// Mount it once per screen that draws a seal or a stamped slot (the
// clear's view does, and so do the tickets' screen and the share
// image); a second copy is harmless, the first id wins.
export function InkFilters() {
  return (
    <svg className="clrk-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter id="clrk-ink" x="-6%" y="-6%" width="112%" height="112%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" result="fine" />
          <feDisplacementMap in="SourceGraphic" in2="fine" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="4" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -12 0 0 0 8.52" result="voids" />
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="2" seed="2" result="blot" />
          <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 2 0 0 -0.05" result="pressure" />
          <feComposite in="voids" in2="pressure" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="mask" />
          <feComposite in="rough" in2="mask" operator="in" />
        </filter>
        <filter id="clrk-ink-fine" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="5" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -10 0 0 0 6.6" result="voids" />
          <feComposite in="SourceGraphic" in2="voids" operator="in" />
        </filter>
      </defs>
    </svg>
  )
}
