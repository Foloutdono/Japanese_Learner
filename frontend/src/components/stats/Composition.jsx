// ── A bucket's composition (plan 085) ─────────────────────
// What the cards add up to, and the cards met beyond it, in the two
// state inks, over the new cards' track. The statistics drew it per line
// until plan 138 gave each line a plate of its own; the desk's station
// split (components/selection/ModeFigures.jsx, plan 114) draws one
// platform's share with it. The first segment is the figure printed
// beside it (plan 184) -- each card for how far it has come -- so the
// bar is not empty on a week's work; the second is the rest of the cards
// met, as the Learn plate's bar draws them.
export function Composition({ row }) {
  return (
    <span className="composition" aria-hidden="true">
      <span className="composition__seg composition__seg--mastered" style={{ width: `${row.learnedPct}%` }} />
      <span className="composition__seg composition__seg--learning" style={{ width: `${row.metPct}%` }} />
    </span>
  )
}
