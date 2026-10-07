// ── 終着 — the days, said aloud (plan 191) ──────────────────────────
// The ceremony's dates in words for a screen reader and for the copy
// that names a day ("Jour de repos utilisé mardi", "Demain · mercredi"):
// the server's YYYY-MM-DD UTC days in the learner's language. Shared by
// every screen of the day cleared, so the week is said the same way on
// the phone, the desk and the rest-day notice.

function locale(lang) {
  return lang === 'fr' ? 'fr-FR' : 'en-US'
}

function utc(day) {
  const [y, m, d] = String(day).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/** The weekday's name: mardi / Tuesday. */
export function dayName(day, lang) {
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'long', timeZone: 'UTC' }).format(utc(day))
}

/** The day in full: mardi 6 octobre 2026 / Tuesday, October 6, 2026. */
export function longDate(day, lang) {
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utc(day))
}

/** The day and month: 12 septembre / September 12 (`withMonth` false: 12). */
export function dayMonth(day, lang, withMonth = true) {
  const opts = withMonth ? { day: 'numeric', month: 'long', timeZone: 'UTC' } : { day: 'numeric', timeZone: 'UTC' }
  return new Intl.DateTimeFormat(locale(lang), opts).format(utc(day))
}

/**
 * The week row's parts, in order: runs of stamped days ("jeudi à mardi
 * tamponnés"), a missed day, a rest day, today waiting. Joined by the
 * caller's frame (t.clrWeekAria, t.rstWeekAria). `pending` says today's
 * stamp is not pressed yet (today then reads as today, not stamped).
 */
export function weekParts(week, t, lang, { pending = false } = {}) {
  const parts = []
  let run = null
  const flush = () => {
    if (run) parts.push(t.clrWeekStamped(dayName(run.from, lang), dayName(run.to, lang)))
    run = null
  }
  const last = (week?.length ?? 0) - 1
  ;(week ?? []).forEach((entry, i) => {
    const today = i === last
    const state = today && (pending || entry.state === 'today') ? 'today' : entry.state
    if (state === 'studied') {
      run = run ? { ...run, to: entry.day } : { from: entry.day, to: entry.day }
      return
    }
    flush()
    if (state === 'missed') parts.push(t.clrWeekMissed(dayName(entry.day, lang)))
    else if (state === 'rest') parts.push(t.clrWeekRest(dayName(entry.day, lang)))
    else if (state === 'today') parts.push(t.clrWeekToday(dayName(entry.day, lang)))
  })
  flush()
  return parts
}
