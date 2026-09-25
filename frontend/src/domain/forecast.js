// ── 予報 — a verdict's forecast, in words (plan 126) ─────────────────
// The desk's card panel prints, on each verdict's tile, when the card
// comes back: `due_in` in seconds off the card's own review_preview
// (srs.py's preview_reviews_bulk), turned into words at the scale of the
// wait. (A line saying what the rating does to the card stood under it
// until the owner cut it for room.)

const MINUTE = 60
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** When the card comes back: "dans 10 min", "demain", "dans 3 j", "dans 3 sem.", "dans 2 mois", "dans 100 ans" (the scheduler's cap). */
export function dueText(seconds, t) {
  if (!Number.isFinite(seconds)) return '—'
  const s = Math.max(0, seconds)
  if (s < HOUR) return t.forecastIn(t.forecastMinutes(Math.max(1, Math.round(s / MINUTE))))
  if (s < DAY) return t.forecastIn(t.forecastHours(Math.max(1, Math.round(s / HOUR))))
  const days = Math.round(s / DAY)
  if (days <= 1) return t.forecastTomorrow
  if (days < 14) return t.forecastIn(t.forecastDays(days))
  if (days < 60) return t.forecastIn(t.forecastWeeks(Math.round(days / 7)))
  if (days < 730) return t.forecastIn(t.forecastMonths(Math.round(days / 30)))
  return t.forecastIn(t.forecastYears(Math.round(days / 365)))
}
