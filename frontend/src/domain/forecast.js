// ── 予報 — a verdict's forecast, in words (plan 126) ─────────────────
// The desk's card panel prints, on each verdict's tile, when the card
// comes back: `due_in` in seconds off the card's own review_preview
// (srs.py's preview_reviews_bulk), turned into words at the scale of the
// wait. (A line saying what the rating does to the card stood under it
// until the owner cut it for room.) The tile draws it as a figure -- a
// large numeral and its unit, `dueFigure` -- and says it in words,
// `dueText`, to a screen reader.

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

/** The same wait as a figure, for the tile: `{ value: 3, unit: 'min' }`, a
 *  day and tomorrow alike `{ value: 1, unit: 'jour' }` so every tile is a
 *  numeral and its unit; null when there is no forecast. */
export function dueFigure(seconds, t) {
  if (!Number.isFinite(seconds)) return null
  const s = Math.max(0, seconds)
  const figure = (value, unit) => ({ value, unit: t.forecastUnit(unit, value) })
  if (s < HOUR) return figure(Math.max(1, Math.round(s / MINUTE)), 'minute')
  if (s < DAY) return figure(Math.max(1, Math.round(s / HOUR)), 'hour')
  const days = Math.max(1, Math.round(s / DAY))
  if (days < 14) return figure(days, 'day')
  if (days < 60) return figure(Math.round(days / 7), 'week')
  if (days < 730) return figure(Math.round(days / 30), 'month')
  return figure(Math.round(days / 365), 'year')
}
