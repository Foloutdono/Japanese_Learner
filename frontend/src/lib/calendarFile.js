// ── 時刻表 — the daily train in the learner's own calendar (plan 246) ──
// On the web the boarding asks for no reminder: a tab cannot promise to
// be open at seven, and a browser's notification is a permission prompt
// on the first minute of a stranger's visit. The hour's sheet offers one
// calendar event a day at the hour instead, as a file the learner's own
// calendar opens -- written here, in the browser, and sent nowhere.
//
// The time is floating (no TZID): a calendar reads it in the device's
// own zone, which is the zone the learner chose the hour in, and it
// stays at 07:30 when they travel -- the train leaves at their seven.

const pad = n => String(n).padStart(2, '0')

/** A date's floating local stamp, YYYYMMDDTHHMMSS. */
function localStamp(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
}

/** A UTC stamp, for DTSTAMP. */
function utcStamp(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

/** RFC 5545 TEXT: backslash, semicolon, comma and line breaks escaped. */
function text(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

const octets = ch => new TextEncoder().encode(ch).length

/** RFC 5545 §3.1: a line is at most 75 octets, a longer one folded onto
 *  continuation lines that open with a space -- never inside a
 *  character, so an accented title stays whole. */
export function fold(line) {
  const out = []
  let run = ''
  let size = 0
  for (const ch of line) {
    const n = octets(ch)
    // The continuation's own space is one of its 75.
    if (size + n > (out.length ? 74 : 75)) { out.push(run); run = ''; size = 0 }
    run += ch
    size += n
  }
  out.push(run)
  return out.join('\r\n ')
}

/**
 * The calendar file: one event a day from `first` (the first departure,
 * domain/boarding firstDeparture), `minutes` long, with an alarm on the
 * hour. `title` and `body` are the learner's language; `url` the app.
 */
export function dailyTrain({ first, minutes, title, body, url, now = new Date() }) {
  const uid = `${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 10)}@tsuji.app`
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tsuji//Boarding//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${localStamp(first)}`,
    `DURATION:PT${Math.max(1, Math.round(minutes))}M`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${text(title)}`,
    `DESCRIPTION:${text(body)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    `DESCRIPTION:${text(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].map(fold).join('\r\n')
}

/** Hand the file to the browser: a calendar opens it, or it is saved. */
export function saveCalendar(ics, filename = 'tsuji.ics') {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Long enough for the download to have taken the URL.
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
