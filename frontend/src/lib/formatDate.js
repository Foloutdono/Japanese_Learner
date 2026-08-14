// ── Short review date ─────────────────────────────────────
// "14 Aug" / "14 août", not "14/08/2025".
//
// Two bugs in one line, repeated across three screens:
//
//   new Date(next_review).toLocaleDateString()
//
// It took no locale, so it followed the *browser's* language rather
// than the app's — a French UI on an English machine printed American
// dates. And the full numeric form is ten characters wide, which
// overflowed the stat tile it lives in and got clipped by the grid's
// `overflow: hidden` to "14/08/202".
//
// A next-review date is always within the SRS horizon, so the year is
// noise; day + short month is the useful part and fits.
export function shortDate(value, lang) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'short' })
}
