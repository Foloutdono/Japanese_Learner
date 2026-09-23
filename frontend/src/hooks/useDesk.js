import { useMediaQuery } from './useMediaQuery'

// ── 机 — the desk, and the one line that says where it starts (plan 113) ──
// Tsuji has two chromes. Below this line it is the phone's: the HUD
// across the top, the five gates across the bottom, the screen between
// them (components/chrome/Shell.jsx) — and between 769 and 1099 that same
// frame, centred. At and above it, a computer's: the rail down the left
// edge (components/chrome/DeskRail.jsx), every gate captioned, the HUD's
// three instruments at its foot, and the screens laid out for the width.
//
// Width alone, no pointer test: 1100 is where the dictionary's dock and
// the analyzer's rail already stood beside their content, so the three
// splits are one split. A phone never reaches it, a tablet held upright
// never does, and a window narrowed below it gets the phone back.
//
// The query lives here and nowhere else in the JavaScript
// (src/desk.css.test.js holds that), and it is the string the desk's
// section of index.css is written under — the same test compares the two.
// `@media` cannot read a custom property, so the pair is kept equal by a
// test rather than by a token.
export const DESK_QUERY = '(min-width: 1100px)'

/** Whether the desk chrome is drawn: reactive, right on the first render. */
export function useDesk() {
  return useMediaQuery(DESK_QUERY)
}

/** The same answer, once, for an event handler or an effect's first run. */
export function isDesk() {
  return typeof window !== 'undefined' && window.matchMedia(DESK_QUERY).matches
}
