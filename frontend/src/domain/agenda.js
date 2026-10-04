// ── 時間割 — the weekly agenda, as the app reasons about it (plan 181) ──
// A learner's timetable of study blocks: a subject, the weekdays it
// repeats on, the minutes of the day it spans and whether and how early
// the phone says it is starting. Stored by the server (routes/agenda.py,
// which holds the same rules) and edited in Settings; the native shells
// turn each block into dated local notifications (lib/agenda.js).
//
// Pure. Days are 0 = Monday … 6 = Sunday, as the server stores them (a
// week that starts on Monday, whatever the language); times are minutes
// after midnight on the learner's own clock; the end of the day is 1440.

/** What a block can be about, and the place that opens for it. The
 *  server holds the same closed list (routes/agenda.py's Subject).
 *  `review` is the day's queue. */
export const SUBJECT_PATH = {
  review: '/today',
  kana: '/learn/kana',
  vocab: '/learn/vocab',
  kanji: '/learn/kanji',
  grammar: '/learn/grammar',
  reading: '/practice/reading',
  translation: '/practice/translation',
  dictation: '/practice/dictation',
  composition: '/practice/composition',
  comprehension: '/practice/comprehension',
  exam: '/practice/exam',
}

/** In the order the gates list them: the queue, the lines, the
 *  platforms. */
export const SUBJECTS = Object.keys(SUBJECT_PATH)

/** The places a notification may open the app on. Any app can hand the
 *  shell a link, so a tap is taken to one of these and nowhere else. */
export const OPENABLE_PATHS = new Set(Object.values(SUBJECT_PATH))

export const DAYS = [0, 1, 2, 3, 4, 5, 6]
export const WEEKDAYS = [0, 1, 2, 3, 4]
export const DAY_MINUTES = 24 * 60

/** The minutes ahead of a block the phone says so. */
export const LEADS = [0, 5, 10, 15, 30, 60]
/** A block's times fall on this grid, and it is this long at least. */
export const STEP = 5
export const MIN_BLOCK = 15
/** The server's bound on a week. */
export const MAX_BLOCKS = 40

/** The bounds of the week as drawn: the hours a day's column covers. A
 *  block outside them is clipped to the picture and still listed. */
export const AXIS_FROM = 6 * 60
export const AXIS_TO = DAY_MINUTES

/** JavaScript's Date#getDay (Sunday = 0) as the agenda's day (Monday = 0). */
export function agendaDay(date) {
  return (date.getDay() + 6) % 7
}

/** 540 → "9:00", 1440 → "24:00". The 24-hour clock, as the pass prints
 *  the hour. */
export function clock(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** 540 → "09:00", the value of an <input type="time">. The end of the
 *  day has no such value: it is drawn as 23:55 and read back as 1440. */
export function toInput(minutes) {
  const m = Math.min(minutes, DAY_MINUTES - STEP)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** "09:00" → 540, or null for anything that is not a clock. */
export function fromInput(value) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(value ?? ''))
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

/** A time off the grid, moved to the nearest mark. */
export function snap(minutes) {
  return Math.round(minutes / STEP) * STEP
}

/** What is wrong with a block, or null. The page marks the field the
 *  word names; the server refuses the same ones. */
export function blockProblem(block) {
  if (!block.days?.length) return 'days'
  if (block.start == null || block.end == null) return 'time'
  if (block.start < 0 || block.end > DAY_MINUTES) return 'time'
  if (block.end - block.start < MIN_BLOCK) return 'length'
  return null
}

/** The first block in `blocks` that shares a day and a stretch of time
 *  with `block` (touching is not sharing), or null. `skip` is the index
 *  of the block being edited, which never clashes with itself. */
export function clashWith(block, blocks, skip = -1) {
  const days = new Set(block.days)
  return blocks.find((other, i) => (
    i !== skip
    && other.days.some(d => days.has(d))
    && block.start < other.end
    && other.start < block.end
  )) ?? null
}

/** A new block, on the first free hour of the day it is begun on. */
export function newBlock(blocks, subject = 'kanji', days = WEEKDAYS) {
  const base = { subject, days, notify: true, lead: 10 }
  for (let start = 9 * 60; start + 60 <= DAY_MINUTES; start += 60) {
    const block = { ...base, start, end: start + 60 }
    if (!clashWith(block, blocks)) return block
  }
  return { ...base, start: 9 * 60, end: 10 * 60 }
}

/** The blocks that fall on a day, earliest first. */
export function blocksOn(blocks, day) {
  return blocks.filter(b => b.days.includes(day)).sort((a, b) => a.start - b.start)
}

/** The instants a block starts at, `days` calendar days from `now` on,
 *  on the device's clock: [{ block, start: Date }] in time order. Built
 *  from the calendar date, not by adding 24 hours, so a change of
 *  daylight saving keeps the hour. */
export function occurrences(blocks, now, days = 7) {
  const out = []
  for (let i = 0; i <= days; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    const day = agendaDay(date)
    for (const block of blocks) {
      if (!block.days.includes(day)) continue
      out.push({ block, start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(block.start / 60), block.start % 60) })
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

/** The block under way at `now`, else the next one to begin within the
 *  week: { block, start: Date, now: boolean }, or null for an empty week. */
export function nextBlock(blocks, now) {
  let best = null
  for (const occ of occurrences(blocks, now, 7)) {
    const end = new Date(occ.start.getTime() + (occ.block.end - occ.block.start) * 60_000)
    if (now >= occ.start && now < end) return { ...occ, now: true }
    if (occ.start > now && (!best || occ.start < best.start)) best = { ...occ, now: false }
  }
  return best
}

/** Mon–Fri → [0,1,2,3,4] drawn as a run: `[0,1,2,3,4]` → [[0,4]],
 *  `[0,2,3]` → [[0,0],[2,3]]. The page names each run with its first
 *  and last day. */
export function dayRuns(days) {
  const sorted = [...days].sort((a, b) => a - b)
  const runs = []
  for (const d of sorted) {
    const last = runs[runs.length - 1]
    if (last && d === last[1] + 1) last[1] = d
    else runs.push([d, d])
  }
  return runs
}

/** The same week with a block replaced, added (index -1) or dropped
 *  (`block` null). */
export function withBlock(blocks, index, block) {
  const next = blocks.map(b => ({ ...b }))
  if (block == null) next.splice(index, 1)
  else if (index < 0) next.push(block)
  else next[index] = block
  return next
}

/** What the server is sent: the fields it knows, ids left behind. */
export function forServer(blocks) {
  return blocks.map(({ subject, days, start, end, notify, lead }) => ({ subject, days, start, end, notify, lead }))
}

/** A weekday's name in the learner's language (`width` is Intl's:
 *  'long', 'short' or 'narrow'), from a week that starts on a Monday. */
export function dayName(day, lang, width = 'short') {
  return new Intl.DateTimeFormat(lang, { weekday: width }).format(new Date(2024, 0, 1 + day))
}

/** The days of a block as a short line: "Mon–Fri", "Mon, Wed–Thu",
 *  `everyDay` for all seven. */
export function daysLabel(days, lang, everyDay) {
  if (days.length === 7) return everyDay
  return dayRuns(days)
    .map(([a, b]) => (a === b ? dayName(a, lang) : `${dayName(a, lang)}–${dayName(b, lang)}`))
    .join(', ')
}
