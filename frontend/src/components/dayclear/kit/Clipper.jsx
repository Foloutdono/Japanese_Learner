import { createElement, useId } from 'react'
import { CLIPPER_ART, CLIPPER_VIEWBOX } from './clipperArt'

// ── 改札鋏 — the ticket clipper (plan 191) ──────────────────────────
// The gate clerk's punch, as the canvas drew it (clipper/clipper.py,
// shared by Milestone-7 and -30): two crossed steel arms on a rivet, in
// along its own axis from the lower right, the jaws opening, biting the
// ticket's edge at 34% of its one-second clock and parting at 55%, then
// leaving the way it came. Its art is clipperArt.js, generated.
//
// Placed by `x`/`y` (px in the caller's positioned box): the punch's
// centre, which is the notch's -- the ticket's right edge, halfway down.
// `angle` is the axis it comes in along (58deg, from the lower right).
// It plays on mount, after `delay` ms: the ticket's punch is that delay
// plus 340ms (the bite), the chip's (ClipperChip) plus 550ms (the jaws
// part) -- one clock, so a late timer cannot set them apart.
export const CLIP_BITE_MS = 340
export const CLIP_PART_MS = 550
export const CLIP_MS = 1000

function render(node, key, ids) {
  const [tag, attrs, children] = node
  const props = { key }
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'id') props.id = ids[v] ?? v
    else if (typeof v === 'string' && v.startsWith('url(#')) props[k] = `url(#${ids[v.slice(5, -1)] ?? v.slice(5, -1)})`
    else props[k] = v
  }
  return createElement(tag, props, children.length ? children.map((c, i) => render(c, i, ids)) : undefined)
}

export function Clipper({ x, y, angle = 58, delay = 0, className = '' }) {
  // The two gradients are named per mount, so two clippers on one page
  // (a replay overlapping, the workbench's scenes) never share a def.
  const uid = useId().replace(/:/g, '')
  const ids = { 'clp-disc': `clrk-disc-${uid}`, 'clp-punch': `clrk-punch-${uid}` }
  return (
    <div
      className={['clrk-clp', className].filter(Boolean).join(' ')}
      style={{ left: x, top: y, '--clp-a': `${angle}deg`, '--d': `${delay}ms` }}
      aria-hidden="true"
    >
      <div className="clrk-clp__axis">
        <div className="clrk-clp__slide">
          <svg className="clrk-clp__svg" viewBox={CLIPPER_VIEWBOX} width="246" height="88" aria-hidden="true" focusable="false">
            {CLIPPER_ART.map((n, i) => render(n, i, ids))}
          </svg>
        </div>
      </div>
    </div>
  )
}

/**
 * The half disc the jaws bit out, revealed on the die as they part and
 * dropping past the lower jaw (the clipper's own chip, not the
 * ticket's). Place it on the notch: its right edge on the ticket's.
 * `delay` is the clipper's own delay plus CLIP_PART_MS.
 */
export function ClipperChip({ gold = false, delay = 0, style, className = '' }) {
  return (
    <span
      className={['clrk-clp-chip', gold ? 'clrk-clp-chip--gold' : 'clrk-clp-chip--paper', className].filter(Boolean).join(' ')}
      style={{ '--d': `${delay}ms`, ...style }}
      aria-hidden="true"
    />
  )
}
