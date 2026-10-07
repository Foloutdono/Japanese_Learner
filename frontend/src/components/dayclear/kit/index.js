// ── 終着 — the ceremony's kit (plan 191) ─────────────────────────────
// The shared pieces of the canvas "Tsuji — the day cleared" (its kit.css
// and kit.md, round 2), for every screen of the day cleared: the phone's
// and the desk's everyday clear, the two milestone ceremonies, the
// partial finish, the rest-day notice, the tickets' collection and the
// share image. Their CSS is the `primitives` region of index.css
// (.clrk-*, keyframes clr-*); a ceremony's root wears .clrk--skip after a
// skip and .clrk--reduced under reduced motion, and every primitive
// answers both.
//
// The gate button is the app's own (components/ui/GateButton.jsx) with
// the boards' `compact` and `arrive`.
export { InkFilters } from './InkFilters'
export { Seal, Bloom, Specks } from './Seal'
export { WeekStamps, Slot } from './WeekStamps'
export { XpTotal, Glint, Odometer, XpChip, LevelBar } from './XpTotal'
export { useCountUp, useXpFormat } from './useCountUp'
export { Ticket, TicketChip } from './Ticket'
export { Clipper, ClipperChip, CLIP_BITE_MS, CLIP_PART_MS, CLIP_MS } from './Clipper'
export { Reader, RunCard, Pile, ClearHeader, QuietButton, ContactlessMark } from './Run'
export { WEEK_TILTS, VERDICT_INK, lineInk, makeSpecks } from './constants'
export { useBeats } from './useBeats'
export { rng, BOARD_SEED } from './rng'
export { GateButton } from '../../ui/GateButton'
