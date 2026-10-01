// Small readings the offers print (plan 171). Pure, so the screens
// stay drawings and these stay testable.

/** "14:32" / "2:32 PM": when the refill lands its next credit. */
export function clockTime(iso, lang) {
  if (!iso) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { hour: 'numeric', minute: '2-digit' }).format(at)
}

/** The 1st of next month, as a learner reads it: "1er novembre" /
 *  "November 1". When a month's new mock papers come back. */
export function firstOfNextMonth(lang, now = new Date()) {
  const first = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const month = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { month: 'long' }).format(first)
  return lang === 'fr' ? `1er ${month}` : `${month} 1`
}

/** A day's one-letter name: "L", "M" … / "M", "T" …, from its ISO date. */
export function dayLetter(isoDate, lang) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const day = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'narrow' }).format(day)
}

/** The share of the level climbed, 0..1, from the profile's summary. */
export function xpShare(profile) {
  if (!profile) return 0
  const span = (profile.xpForNext ?? 0) - (profile.xpPrevLevel ?? 0)
  if (!(span > 0)) return 0
  return Math.min(1, Math.max(0, ((profile.xp ?? 0) - profile.xpPrevLevel) / span))
}

/** The week as drawn: the server's days, with today's wait never less
 *  than the run that just stopped left (the stop may not have reached
 *  the server yet). */
export function weekDays(week, waiting) {
  const days = (week?.days ?? []).map(d => ({ ...d }))
  if (days.length && waiting > 0) {
    const today = days[days.length - 1]
    today.waited = Math.max(today.waited, waiting)
  }
  return days
}
