import { normalizeCard, structureKeyOf, wordForm } from './cardShape'

// ── 終着 — the day cleared (plan 191) ──────────────────────────
// What the clear's screens read off the run and off the server's
// answer, as facts and no markup: the ticket's name and number for a
// streak, the tier a milestone plays, the three piles a run's cards
// fall into, the level bar before and after the fare. Every screen of
// the ceremony (components/dayclear/) draws from these, so the phone,
// the desk, the milestones, the collection and the share image agree
// on what a 14-day ticket is called without each spelling it again.

// ── The ladder ────────────────────────────────────────────────
// The days a streak pays a ticket on (backend srs/xp.py's JACKPOTS),
// and every hundred after a year. Kept here for the collection's book,
// which draws the tickets not yet earned as well as the earned ones.
export const MILESTONES = Object.freeze([3, 7, 14, 30, 50, 100, 200, 365])

/** The milestones a learner's book shows: the ladder, and once a year is
 *  behind them every hundred after it up to the next one ahead. */
export function milestoneLadder(longest = 0) {
  const out = [...MILESTONES]
  if (longest < 365) return out
  const last = Math.ceil((longest + 1) / 100) * 100
  for (let d = 400; d <= last; d += 100) out.push(d)
  return out
}

/** 'day' (no milestone), 'ticket' (3, 7, 14) or 'month' (30 and up) -- the server's clear_tier. */
export function clearTier(milestone) {
  if (!milestone) return 'day'
  return milestone >= 30 ? 'month' : 'ticket'
}

// ── Numbers in kanji ─────────────────────────────────────────
const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const UNITS = [[1000, '千'], [100, '百'], [10, '十']]

/** A positive integer in kanji numerals: 7 七, 14 十四, 400 四百, 1200 千二百. */
export function kanjiNumber(n) {
  if (!Number.isInteger(n) || n <= 0) return String(n)
  if (n >= 10000) {
    const rest = n % 10000
    return kanjiNumber(Math.floor(n / 10000)) + '万' + (rest ? kanjiNumber(rest) : '')
  }
  let out = ''
  let rest = n
  for (const [value, unit] of UNITS) {
    const d = Math.floor(rest / value)
    if (d) out += (d === 1 ? '' : DIGITS[d]) + unit
    rest %= value
  }
  return out + DIGITS[rest]
}

// The ticket's big name, by the owner's list: the round names where
// Japanese has one (a month, a year), the count of days elsewhere.
const TICKET_NAMES = {
  3: '三日', 7: '七日', 14: '十四日', 30: '一ヶ月', 50: '五十日', 100: '百日', 200: '二百日', 365: '一年',
}

/** The ticket's big name: 七日, 一ヶ月, 一年, else the days in kanji + 日 (400 四百日). */
export function ticketName(days) {
  return TICKET_NAMES[days] ?? `${kanjiNumber(days)}日`
}

/** The route printed under the ticket's kind: 辻 ⇄ 七日目. */
export function ticketRoute(days) {
  return `辻 ⇄ ${kanjiNumber(days)}日目`
}

/** The ticket's number, four digits: 7 → 0007 (the caller prints "N°"). */
export function ticketNumber(days) {
  return String(days).padStart(4, '0')
}

// ── Dates ─────────────────────────────────────────────────────
// The server's days are UTC calendar days (YYYY-MM-DD), the streak's.
// Read as UTC so a learner west of Greenwich does not see yesterday.
function utcParts(day) {
  const [y, m, d] = String(day).split('-').map(Number)
  return { y, m, d }
}
const pad2 = n => String(n).padStart(2, '0')

/** The seal's foot: 06·10·2026. */
export function sealDate(day) {
  const { y, m, d } = utcParts(day)
  return `${pad2(d)}·${pad2(m)}·${y}`
}

/** A ticket's foot: 06.10.2026. */
export function ticketDate(day) {
  const { y, m, d } = utcParts(day)
  return `${pad2(d)}.${pad2(m)}.${y}`
}

const WEEKDAY_KANJI = ['日', '月', '火', '水', '木', '金', '土']

/** The weekday's kanji of a YYYY-MM-DD day (UTC): 2026-10-06 → 火. */
export function weekdayKanji(day) {
  const { y, m, d } = utcParts(day)
  return WEEKDAY_KANJI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/** The day `n` days before a YYYY-MM-DD day, as YYYY-MM-DD. */
export function daysBefore(day, n) {
  const { y, m, d } = utcParts(day)
  const at = new Date(Date.UTC(y, m - 1, d - n))
  return `${at.getUTCFullYear()}-${pad2(at.getUTCMonth() + 1)}-${pad2(at.getUTCDate())}`
}

// ── The run's cards ──────────────────────────────────────────
/** A rating's verdict: 0 wrong (< 3), 1 correct (3, 4), 2 perfect (5). */
export function verdictOf(quality) {
  if (!Number.isFinite(quality) || quality < 3) return 0
  return quality >= 5 ? 2 : 1
}

// A grammar card's "reading" on a run's card is its sense, cut to the
// first of its words (the boards print 〜は over "topic").
function shortGloss(meaning) {
  if (typeof meaning !== 'string') return ''
  return meaning.split(/[;,(/·]/)[0].trim()
}

/**
 * The face a reviewed card shows on the clear's sweep and its piles:
 * { id, term, kana, line, verdict, up, mastered }. `line` is the lane's
 * line ('kana' | 'vocab' | 'kanji' | 'grammar' | 'personal'), the
 * card's rail pigment; `up` a stage climbed, `mastered` the climb to
 * the last one. Read off the card as served and the preview of the
 * rating it got.
 */
export function cardFace(card, { quality, preview } = {}) {
  if (!card) return null
  const c = normalizeCard(card)
  const kind = structureKeyOf(c)
  let term
  let kana
  if (kind === 'grammar') {
    term = c.grammar ?? c.front ?? ''
    kana = shortGloss(c.meaning)
  } else if (kind === 'kana') {
    term = c.kana ?? ''
    kana = c.romaji ?? ''
  } else if (kind === 'kanji') {
    term = c.kanji ?? ''
    kana = c.kana ?? ''
  } else if (kind === 'vocab') {
    term = wordForm(c)
    kana = c.kanji ? (c.kana ?? '') : ''
  } else {
    term = c.front ?? c.term ?? ''
    kana = ''
  }
  const lane = card.lane
  const line = lane ? (lane.kind === 'personal' ? 'personal' : lane.source) : (kind ?? 'personal')
  return {
    id: `${card.card_id}|${card.mode}`,
    term,
    kana,
    line,
    verdict: verdictOf(quality),
    up: Boolean(preview?.stage_up),
    mastered: preview?.stage_up === 'mastered',
  }
}

/** The three piles' counts: [wrong, correct, perfect]. */
export function pileCounts(cards) {
  const out = [0, 0, 0]
  for (const c of cards ?? []) out[c.verdict] = (out[c.verdict] ?? 0) + 1
  return out
}

/** The run's summary line, "4 montent · 1 maîtrisée": the cards that
 *  climbed a stage short of the last, and the ones that reached it. */
export function runMarks(cards) {
  let up = 0
  let mastered = 0
  for (const c of cards ?? []) {
    if (c.mastered) mastered += 1
    else if (c.up) up += 1
  }
  return { up, mastered }
}

// ── The level bar ────────────────────────────────────────────
/**
 * The level bar before and after the whole fare (the run's XP and the
 * clear's bonus and jackpot), from the server's level after paying
 * ({ level, into, span }). `from` and `to` are shares of the level's
 * span; a fare that crossed into this level starts the bar at 0 and
 * says so (`crossed`), the 進級 having played for it.
 */
export function levelBar(level, paid) {
  if (!level || !(level.span > 0)) return null
  const to = Math.min(1, Math.max(0, level.into / level.span))
  const before = level.into - (Number.isFinite(paid) ? paid : 0)
  const crossed = before < 0
  const from = crossed ? 0 : Math.min(to, before / level.span)
  return { level: level.level, next: level.level + 1, from, to, crossed }
}

/** What the clear paid on top of the run: the day's bonus and the milestone's jackpot. */
export function clearPaid(result) {
  if (!result?.cleared || result.already) return 0
  return (result.bonus ?? 0) + (result.jackpot ?? 0)
}

/** What the run earned: the server's sum of its reviews as written
 *  (`run_xp`) when it has one, else the run's own, summed from its
 *  cards' previews -- which run high on a long run, a review's XP
 *  shrinking as the day's count grows. */
export function runXp(result, run) {
  return Number.isFinite(result?.run_xp) ? result.run_xp : (run?.xp ?? 0)
}

/** The whole fare a ceremony prints: the run's XP plus what the clear paid. */
export function fareTotal(result, run) {
  return runXp(result, run) + clearPaid(result)
}

// ── What a ceremony draws, in one object ─────────────────────────────
/**
 * Everything the clear's screens print, read off the server's answer
 * and the run's tally once, so the phone, the desk and the milestones
 * print the same figures:
 *
 *   tier       'day' | 'ticket' | 'month'
 *   streak     the streak with today counted; `longest`
 *   milestone  the ticket's days (3, 7, 14, 30 …) or null
 *   week       the 7 days ending today, oldest first ({ day, kanji, state })
 *   seal       { day: 火, foot: 06·10·2026 } -- the day's stamp
 *   ticket     { days, date: 06.10.2026 } on a milestone day, else null
 *   cards      the run's faces; `piles` [wrong, correct, perfect];
 *              `marks` { up, mastered }; `minutes`
 *   fare       { run, bonus, jackpot, total } -- the run's XP, the
 *              day's bonus, the milestone's jackpot, their sum
 *   level      levelBar(): { level, next, from, to, crossed } or null
 *   tomorrow   { cards, minutes }; `next` { milestone, jackpot } -- the
 *              ticket ahead; `rest` { held, earned, next_at }
 *   already    the day was cleared before this run (nothing paid)
 */
export function clearModel(result, run) {
  const cards = run?.cards ?? []
  const day = result?.day ?? null
  const paid = clearPaid(result)
  const earned = runXp(result, run)
  return {
    tier: result?.tier ?? clearTier(result?.milestone),
    streak: result?.streak ?? 0,
    longest: result?.longest ?? result?.streak ?? 0,
    milestone: result?.milestone ?? null,
    week: result?.week ?? [],
    seal: day ? { day: weekdayKanji(day), foot: sealDate(day) } : null,
    ticket: result?.milestone && day ? { days: result.milestone, date: ticketDate(day) } : null,
    cards,
    count: run?.cleared ?? cards.length,
    piles: pileCounts(cards),
    marks: runMarks(cards),
    minutes: run?.minutes ?? null,
    fare: {
      run: earned,
      bonus: result?.already ? 0 : (result?.bonus ?? 0),
      jackpot: result?.already ? 0 : (result?.jackpot ?? 0),
      total: earned + paid,
    },
    level: levelBar(result?.level, earned + paid),
    tomorrow: result?.tomorrow ?? null,
    next: { milestone: result?.next_milestone ?? null, jackpot: result?.next_jackpot ?? null },
    rest: result?.rest ?? { held: 0, earned: false, next_at: null },
    already: Boolean(result?.already),
  }
}

/**
 * The week on Today's rest-day notice: the 7 UTC days ending `today`,
 * from the profile's `week` ([{ date, count, practice }], days with
 * nothing absent) and the rest days Today's summary names (`rest`).
 * Today is 'today' until it has a review.
 */
export function restWeek(profileWeek, restDays, today) {
  const studied = new Set((profileWeek ?? []).filter(d => (d.count ?? 0) + (d.practice ?? 0) > 0).map(d => d.date))
  // The days told of now, and any other this week the profile's week
  // marks as covered (`rest: true`, a 運休 already seen).
  const rest = new Set([...(restDays ?? []), ...(profileWeek ?? []).filter(d => d.rest).map(d => d.date)])
  return Array.from({ length: 7 }, (_, i) => {
    const day = daysBefore(today, 6 - i)
    const state = rest.has(day) ? 'rest' : studied.has(day) ? 'studied' : day === today ? 'today' : 'missed'
    return { day, kanji: weekdayKanji(day), state }
  })
}

/** Today as the server's streak counts it: the UTC day, YYYY-MM-DD. */
export function utcToday(now = new Date()) {
  return now.toISOString().slice(0, 10)
}
