// ── Section header ────────────────────────────────────────
// Serif-JP title + a short seal-red stroke instead of a full-width
// hairline — a single deliberate mark rather than a line dividing
// the whole page. Shared by any screen with grouped content
// (Stats, Profile, ...) so the pattern stays in one place.
// `count` is an optional tally set to the right of the title — "3 of
// 6" over a badge grid, say. Kept as a separate slot rather than
// glued onto `title` so it can be typeset as data (tracked, tabular)
// while the title stays a serif heading.
export function SectionHeader({ title, count }) {
  return (
    <div className="section-header">
      <div className="section-header__title">{title}</div>
      {count != null && <div className="section-header__count">{count}</div>}
      <div className="section-header__rule" />
    </div>
  )
}