import { NOVICE_GOAL } from '../../domain/goalMath'
import { PACES } from '../onboarding/paces'
import { DEPART_TIMES } from '../onboarding/departures'

// ── The pass's contract, as words (plan 139) ─────────────────────
// Settings prints the learner's contract on the pass at its head
// (SettingsPass.jsx) and each field opens the page that changes it, so
// the pass and the pages say every value the same way. Its own module
// because a component file exports components alone (react-refresh).

/** The day, the month and the year: a promise a year out printed
 *  without its year reads as the wrong one. */
export function dateFormat(lang) {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** A pace by its service's name where it is one of the three, else the
 *  number alone (the column is a free integer). */
export function paceLabel(t, perDay) {
  if (perDay == null) return ''
  const pace = PACES.find(p => p.perDay === perDay)
  return pace
    ? `${t.paceName[pace.id]} · ${perDay} ${t.settingsPerDay}`
    : `${perDay} ${t.settingsPerDay}`
}

/** The daily ride's hour, or the flexible one's word. */
export function hourLabel(t, id) {
  return id ? `${t.destHour[id]} · ${DEPART_TIMES[id]}` : t.destFlexible
}

/** A stop as the pass prints it: the code, and its name under it. The
 *  kana stop wears no JLPT code, and no destination is a dash. */
export function stopParts(t, level) {
  if (level === NOVICE_GOAL) return { code: '—', name: t.brdNovice }
  if (!level) return { code: '—', name: t.settingsGoalNoneShort }
  return { code: level, name: t.levelName[level] }
}

const DAY_MS = 86400000

/** A time axis from `now` to a little past the latest of `dates`:
 *  `place(date)` is a date's share of the axis in percent, and `ticks`
 *  mark it -- a year's start where the axis runs past a year (a month
 *  printed twice without its year reads as the wrong one), otherwise a
 *  month's -- kept clear of both ends and of each other, so a phone's
 *  narrow track holds them. The Service page draws its services on it. */
export function timeAxis(now, dates, lang) {
  const start = now.getTime()
  const last = Math.max(...dates.map(d => d.getTime()))
  const span = Math.max((last - start) * 1.08, DAY_MS)
  const place = d => Math.min(100, Math.max(0, ((d.getTime() - start) / span) * 100))
  const marks = []
  if (span > 330 * DAY_MS) {
    for (let y = now.getFullYear() + 1; new Date(y, 0, 1).getTime() <= start + span; y += 1) {
      marks.push({ at: new Date(y, 0, 1), label: String(y) })
    }
  } else {
    const month = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', { month: 'short' })
    for (const m = new Date(now.getFullYear(), now.getMonth() + 1, 1); m.getTime() <= start + span; m.setMonth(m.getMonth() + 1)) {
      marks.push({ at: new Date(m), label: m.getMonth() === 0 ? String(m.getFullYear()) : month.format(m) })
    }
  }
  const ticks = []
  for (const mark of marks) {
    const pct = place(mark.at)
    if (pct < 10 || pct > 88) continue
    if (ticks.length && pct - ticks[ticks.length - 1].pct < 24) continue
    ticks.push({ pct, label: mark.label })
  }
  return { place, ticks }
}
