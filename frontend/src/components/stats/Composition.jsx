// ── A bucket's composition (plan 085) ─────────────────────
// Mastered and in progress, in the two state inks, over the new cards'
// track. The statistics drew it per line until plan 136 gave each line
// a plate of its own; the desk's station split (components/selection/
// ModeFigures.jsx, plan 114) draws one platform's share with it.
export function Composition({ row }) {
  return (
    <span className="composition" aria-hidden="true">
      <span className="composition__seg composition__seg--mastered" style={{ width: `${row.masteredPct}%` }} />
      <span className="composition__seg composition__seg--learning" style={{ width: `${row.learningPct}%` }} />
    </span>
  )
}
