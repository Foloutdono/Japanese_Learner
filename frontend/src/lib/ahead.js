// ── 発車案内 — the day ahead, as the app says it while closed (plan 155) ──
// The native shells tell the learner about the day's queue twice while
// the app is shut: a daily notification at their hour, and a home or
// lock screen widget. Both are decided while the app is open, so both
// are planned from GET /api/today/ahead -- what the gate WILL hold at
// the instants this module names -- and both are replanned whenever
// the app opens, comes back to the front or a run lands (NativeBridge).
//
// Pure: the instants, the notifications' words and the widget's
// figures. The network and the plugins are lib/platform.js's.
import { laneTypeOf, laneCount } from '../domain/lanes'

// One notification a day at most, as the boarding promised ("One a
// day, at your time. Never more."): a dated one for each of the next
// seven days, each with its own figures, rather than one repeating
// notification that can only ever say the same words. Rescheduling
// cancels the lot and plans again.
export const AHEAD_DAYS = 7
export const NUDGE_IDS = [101, 102, 103, 104, 105, 106, 107]
// The repeating reminder plan 076 scheduled under id 1. Cancelled on
// every plan, so an install that updates stops sending it.
export const LEGACY_NUDGE_ID = 1
// Where the widget's day turns over when the learner has no hour: the
// counts are read at a morning train.
export const WIDGET_HOUR = { hour: 9, minute: 0 }
// A notification closer than this is not scheduled: it would fire
// while the app that planned it is still open.
const LEAD_MS = 60_000
// Lines a notification lists, busiest first (Android's inbox style
// shows five).
const MAX_LINES = 5

/** Midnight at the start of `now`'s day, on the device's clock. */
export function localMidnight(now) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function sameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** The next `days` instants at { hour, minute } on the device's clock,
 *  today's included while it is still ahead. Built from the calendar
 *  date rather than by adding 24 hours, so a change of daylight saving
 *  keeps the hour. */
export function aheadInstants(at, now, days = AHEAD_DAYS) {
  const out = []
  for (let i = 0; out.length < days && i <= days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, at.hour, at.minute)
    if (d.getTime() - now.getTime() >= LEAD_MS) out.push(d)
  }
  return out
}

/** The query /api/today/ahead is asked with. */
export function aheadQuery(instants, now, lang) {
  const params = new URLSearchParams({
    at: instants.map(d => d.toISOString()).join(','),
    since: localMidnight(now).toISOString(),
    lang,
  })
  return `/api/today/ahead?${params}`
}

/** Minutes a run of `total` takes at the learner's pace, or null
 *  before there is a pace (GET /api/today's seconds_per_review). */
export function minutesFor(total, secondsPerReview) {
  if (!secondsPerReview || !total) return null
  return Math.max(1, Math.round((total * secondsPerReview) / 60))
}

/** A lane in the words the gate uses: its line and level, a kana set's
 *  own name, or the learner's deck. */
export function laneLine(lane, t, kanaSetLabel) {
  if (lane.kind === 'personal') return lane.deck_name
  if (lane.source === 'kana') return kanaSetLabel(t, lane.deck)
  return `${t.nudgeLine[lane.source] ?? lane.source} ${lane.deck}`
}

/**
 * The notifications to schedule: one for each instant whose train
 * carries anything, none on a day with nothing due, and none today
 * once the learner has already ridden. `platform` decides where the
 * lanes go: Android lists them in the expanded notification, iOS shows
 * them under the body.
 */
export function planNudges({ ahead, time, t, kanaSetLabel, now, platform }) {
  const out = []
  for (const point of ahead?.points ?? []) {
    if (out.length >= NUDGE_IDS.length) break
    const at = new Date(point.at)
    if (at.getTime() - now.getTime() < LEAD_MS) continue
    if (!point.total) continue
    if (ahead.rode_today && sameLocalDay(at, now)) continue
    const minutes = minutesFor(point.total, ahead.seconds_per_review)
    const summary = [minutes && t.nudgeMinutes(minutes), point.new > 0 && t.nudgeNew(point.new)]
      .filter(Boolean).join(' · ') || t.brdNotifText
    const lines = (point.lanes ?? []).slice(0, MAX_LINES)
      .map(lane => `${laneLine(lane, t, kanaSetLabel)} · ${lane.count}`)
    out.push({
      id: NUDGE_IDS[out.length],
      at,
      title: t.nudgeTitle(time, point.total),
      body: platform === 'ios' && lines.length ? [summary, ...lines].join('\n') : summary,
      summary,
      lines,
      extra: { to: '/today' },
    })
  }
  return out
}

/**
 * What the widget prints, as JSON the native side reads: the count now
 * and at the turn of each day ahead (read at that day's hour), the
 * lanes of now for its stripe, a word the learner knows, and every word
 * it prints already in the learner's language -- the native side
 * carries no strings of its own.
 */
export function widgetPayload({ today, ahead, t, now }) {
  const spr = ahead?.seconds_per_review ?? today?.seconds_per_review ?? null
  const point = (from, total) => {
    const minutes = minutesFor(total, spr)
    return {
      from,
      total,
      unit: t.widgetUnit(total),
      minutes: minutes ? t.widgetMinutes(minutes) : '',
    }
  }
  const nowTotal = today?.total ?? ahead?.points?.[0]?.total ?? 0
  const points = [point(now.getTime(), nowTotal)]
  const seen = new Set([localMidnight(now).getTime()])
  for (const p of ahead?.points ?? []) {
    const day = localMidnight(new Date(p.at)).getTime()
    if (seen.has(day)) continue
    seen.add(day)
    points.push(point(day, p.total))
  }
  const lanes = (today?.lanes ?? [])
    .map(lane => ({ line: laneTypeOf(lane), n: laneCount(lane) }))
    .filter(lane => lane.n > 0)
  return {
    v: 1,
    made: now.getTime(),
    labels: { title: t.widgetTitle, clear: t.widgetClear, depart: t.depart },
    points,
    lanes,
    words: (ahead?.words ?? []).map(({ jp, reading, meaning }) => ({ jp, reading, meaning })),
  }
}

/** When a planned notification goes, as its header says it: today,
 *  tomorrow, or the day of the week. */
export function whenLabel(at, now, t, lang) {
  const days = Math.round((localMidnight(at).getTime() - localMidnight(now).getTime()) / 86_400_000)
  if (days === 0) return t.nudgeWhen.today
  if (days === 1) return t.nudgeWhen.tomorrow
  const name = new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(at)
  return name.charAt(0).toUpperCase() + name.slice(1)
}
