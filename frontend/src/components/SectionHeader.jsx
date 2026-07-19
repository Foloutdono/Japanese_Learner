// ── Section header ────────────────────────────────────────
// Serif-JP title + a short seal-red stroke instead of a full-width
// hairline — a single deliberate mark rather than a line dividing
// the whole page. Shared by any screen with grouped content
// (Stats, Profile, ...) so the pattern stays in one place.
export function SectionHeader({ title }) {
  return (
    <div className="section-header">
      <div className="section-header__title">{title}</div>
      <div className="section-header__rule" />
    </div>
  )
}