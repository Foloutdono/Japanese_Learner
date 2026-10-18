// ── 終着 — the ceremony's kit (plan 191) ─────────────────────────────
// The shared pieces of the canvas "Tsuji — the day cleared" (its kit.css
// and kit.md, round 2), for every screen of the day cleared: the finish
// on Today (plan 250: the week's stamps, the odometer, the tickets and
// the clipper, components/dayclear/FinishBoard.jsx), the rest-day
// notice, the tickets' collection and the share image. Their CSS is the `primitives` region of index.css
// (.clrk-*, keyframes clr-*); a ceremony's root wears .clrk--skip after a
// skip and .clrk--reduced under reduced motion, and every primitive
// answers both.
//
// The gate button is the app's own (components/ui/GateButton.jsx) with
// the boards' `compact` and `arrive`.
export { InkFilters } from './InkFilters'
export { WeekStamps, Slot } from './WeekStamps'
export { Odometer } from './Odometer'
export { Ticket } from './Ticket'
export { Clipper, ClipperChip, CLIP_BITE_MS, CLIP_PART_MS } from './Clipper'
export { ClearHeader } from './ClearHeader'
export { WEEK_TILTS, VERDICT_INK } from './constants'
export { useBeats } from './useBeats'
export { rng } from './rng'
export { GateButton } from '../../ui/GateButton'
