import { Link } from 'react-router-dom'

// ── 机 — a split's row: a link on the desk, a button below it (plan 117) ──
// A row in the desk's split (StationSplit) opens its item beside the
// list: another level, set, band, tier, grammar point, library deck or
// exam question. That is a place, and a link is what a place gets
// (components/chrome/TabBar.jsx): the middle click, Ctrl/⌘-click and
// "open in new tab" a desktop reader reaches for all work on a link and
// do nothing on a button. Replacing rather than pushing, as the split
// always has, so Back leaves the station instead of walking its rows.
//
// Only the desk passes `to`. Without it the row is the button it always
// was — the same element, the same attributes, the same order — so
// nothing of this reaches a phone (deskfree.phone.test.jsx), and a
// component rendered outside a router keeps working. `state` rides
// along with the navigation, for a screen that keeps its data in the
// history entry (screens/ExamResult.jsx).
//
// The caller's onClick still runs on a link (the click sound); the
// navigation is the link's own, and a modified click is the browser's.
export function SplitRow({ to, state, ...props }) {
  if (to == null) return <button type="button" {...props} />
  return <Link replace to={to} state={state} {...props} />
}
