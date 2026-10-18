// ── 194 — a grammar point's line, in words ───────────────────────
// A ladder card (`grammar.ladder`) carries `step` (srs/ladder.py's
// `position`): the group it is in (choose, build, mastered), the step of
// that group it is asked (`at` of `of`), and whether this is the short
// relapse after a miss once mastered. The point's steps (PointLine) say
// it at the card's head; the desk's map (LadderMap) draws every stop of
// it, and what each rating would do to the point on the stop in hand
// (outcomesOf, plan 198). The waits mirror srs/ladder.py's _WAIT.

import { dueFigure } from './forecast'

export const CHOOSE = 'choose'
export const BUILD = 'build'
export const MASTERED = 'mastered'

// The wait before each step once the one before it is passed, as the
// map prints a stop still ahead: Choisir 2 and 3, Construire 1–4, the star.
export const CHOOSE_WAITS = [null, { minutes: 10 }, { hours: 1 }]
export const BUILD_DAYS = [1, 2, 4, 8]
export const MASTERED_DAYS = 21

function stepName(t, group, n) {
  const name = group === CHOOSE ? t.lineChoose : t.lineBuild
  return n == null ? name : `${name} ${n}`
}

/** The bars of the point's line: Choisir's three and Construire's four
 *  (one each in a relapse), each 'on' (passed), 'now' (asked) or ''
 *  (ahead), and whether the star is reached. */
export function lineOf(step) {
  if (!step) return null
  const { group, at, of, relapse } = step
  const bars = (n, upto, here) => Array.from({ length: n }, (_, i) => (
    i < upto ? 'on' : i === upto && here ? 'now' : ''
  ))
  if (group === MASTERED) {
    return { relapse: false, choose: bars(3, 3, false), build: bars(4, 4, false), star: true }
  }
  const chooseN = relapse ? 1 : 3
  const buildN = relapse ? 1 : 4
  return {
    relapse,
    choose: group === CHOOSE ? bars(chooseN, at - 1, true) : bars(chooseN, chooseN, false),
    build: group === BUILD ? bars(buildN, at - 1, true) : bars(buildN, 0, false),
    star: false,
    of,
  }
}

/** Every stop of the point's walk, for the desk's map: the tutorial, the
 *  Choisir and Construire steps (each named with its own step, so no
 *  group heading stands over them), the star; each 'done',
 *  'now' or ahead, an ahead one with the wait before it. */
export function mapOf(step, t) {
  if (!step) return []
  const index = step.group === CHOOSE ? step.at - 1 : step.group === BUILD ? 3 + step.at - 1 : 7
  const rows = [{ kind: 'stop', name: t.mapTutorial, i: -1 }]
  if (step.relapse) {
    rows.push({ kind: 'stop', name: t.lineChoose, i: step.group === CHOOSE ? 'now' : 'done' })
    rows.push({ kind: 'stop', name: t.lineBuild, i: step.group === BUILD ? 'now' : 'ahead', wait: t.mapAfter(1) })
    rows.push({ kind: 'end', name: t.lineMastered, i: 'ahead', wait: t.mapAfter(MASTERED_DAYS) })
    return rows.map(r => ({ ...r, state: r.i === -1 ? 'done' : typeof r.i === 'string' ? r.i : undefined }))
  }
  CHOOSE_WAITS.forEach((wait, n) => rows.push({
    kind: 'stop', name: stepName(t, CHOOSE, n + 1), i: n,
    wait: wait ? (wait.minutes ? `+${t.forecastMinutes(wait.minutes)}` : `+${t.forecastHours(wait.hours)}`) : null,
  }))
  BUILD_DAYS.forEach((days, n) => rows.push({ kind: 'stop', name: stepName(t, BUILD, n + 1), i: 3 + n, wait: t.mapAfter(days) }))
  rows.push({ kind: 'end', name: t.lineMastered, i: 7, wait: t.mapAfter(MASTERED_DAYS) })
  return rows.map(r => ({
    ...r,
    state: r.i < index ? 'done' : r.i === index ? 'now' : 'ahead',
  }))
}

/** Where a rating moves the point (plan 198), from the step it stands on
 *  to the one the rating leaves it on -- both are `step`s, as srs/ladder.py's
 *  `position` writes them: 'stay' on the same step (a miss asks it again;
 *  a pass once mastered stays mastered), 'back' to the relapse from
 *  mastered, 'next' one stop down the line otherwise. */
export function moveOf(from, to) {
  if (to.group === from.group && to.at === from.at && Boolean(to.relapse) === Boolean(from.relapse)) return 'stay'
  if (from.group === MASTERED && to.relapse) return 'back'
  return 'next'
}

/** What each verdict does to the point, grouped by what it does (plan
 *  198). On the ladder a verdict is one of a few outcomes -- a miss asks
 *  the step again, a pass climbs it -- and the forecast says so: two
 *  verdicts with the same move and the same wait are one outcome, and
 *  the walk draws them as one row. Worst to best, as the verdicts come;
 *  each `{ move, passed, figure, due, verdicts }` with the figure the
 *  wait as the tiles drew it (forecast.js's dueFigure) and `verdicts`
 *  the `{ q, label, digit }` it answers.
 *
 *  Null where the card cannot say: off the ladder, or served before its
 *  forecast carried the landing (a queue from before the plan, a server
 *  one release behind) -- the panel then draws the tiles it always did. */
export function outcomesOf(card, verdicts, t) {
  const step = card?.step
  const preview = card?.review_preview
  if (!step || !preview) return null
  const rows = []
  for (const verdict of verdicts) {
    const landing = preview[String(verdict.q)]
    const figure = landing?.step ? dueFigure(landing.due_in, t) : null
    if (!figure) return null
    const move = moveOf(step, landing.step)
    const passed = Boolean(landing.passed)
    const last = rows[rows.length - 1]
    if (last && last.move === move && last.passed === passed
        && last.figure.value === figure.value && last.figure.unit === figure.unit) {
      last.verdicts.push(verdict)
    } else {
      rows.push({ move, passed, figure, due: landing.due_in, verdicts: [verdict] })
    }
  }
  return rows
}

/** A pattern as a form written in a sentence: 〜をください → をください. */
export function bare(pattern) {
  return String(pattern ?? '').replace(/^[〜～]/, '')
}
