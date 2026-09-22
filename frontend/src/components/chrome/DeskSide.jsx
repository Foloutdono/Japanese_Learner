// ── 机 — a screen's second column (plan 113) ───────────────────────
// On the desk a screen may stand one companion beside its main work: the
// pass's back beside the fare gate, a deck's platforms beside its cards.
// One column, --desk-side-w wide (index.css, the 机 block), sticky so it
// stays in view while the main work scrolls. Rendered only when
// hooks/useDesk says so, by the screen that owns it — a phone never
// meets it. It is a landmark (<aside>), named by what it holds.
export function DeskSide({ label, className = '', children }) {
  return (
    <aside className={`desk-side${className ? ` ${className}` : ''}`} aria-label={label}>
      {children}
    </aside>
  )
}
