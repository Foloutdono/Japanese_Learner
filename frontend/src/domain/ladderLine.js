// ── 194 — a grammar point's line, in words ───────────────────────
// A ladder card (`grammar.ladder`) carries `step` (srs/ladder.py's
// `position`): the group it is in (choose, build, mastered), the step of
// that group it is asked (`at` of `of`), and whether this is the short
// relapse after a miss once mastered. The point's steps (PointLine) say
// it at the card's head; the desk's map (LadderMap) draws every stop of
// it. The waits mirror srs/ladder.py's _WAIT.

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
 *  Choisir and Construire steps under their group, the star; each 'done',
 *  'now' or ahead, an ahead one with the wait before it. */
export function mapOf(step, t) {
  if (!step) return []
  const index = step.group === CHOOSE ? step.at - 1 : step.group === BUILD ? 3 + step.at - 1 : 7
  const rows = [{ kind: 'stop', name: t.mapTutorial, i: -1 }]
  rows.push({ kind: 'group', name: t.lineChoose })
  if (step.relapse) {
    rows.push({ kind: 'stop', name: t.lineChoose, i: step.group === CHOOSE ? 'now' : 'done' })
    rows.push({ kind: 'group', name: t.lineBuild })
    rows.push({ kind: 'stop', name: t.lineBuild, i: step.group === BUILD ? 'now' : 'ahead', wait: t.mapAfter(1) })
    rows.push({ kind: 'end', name: t.lineMastered, i: 'ahead', wait: t.mapAfter(MASTERED_DAYS) })
    return rows.map(r => ({ ...r, state: r.i === -1 ? 'done' : typeof r.i === 'string' ? r.i : undefined }))
  }
  CHOOSE_WAITS.forEach((wait, n) => rows.push({
    kind: 'stop', name: stepName(t, CHOOSE, n + 1), i: n,
    wait: wait ? (wait.minutes ? `+${t.forecastMinutes(wait.minutes)}` : `+${t.forecastHours(wait.hours)}`) : null,
  }))
  rows.push({ kind: 'group', name: t.lineBuild })
  BUILD_DAYS.forEach((days, n) => rows.push({ kind: 'stop', name: stepName(t, BUILD, n + 1), i: 3 + n, wait: t.mapAfter(days) }))
  rows.push({ kind: 'end', name: t.lineMastered, i: 7, wait: t.mapAfter(MASTERED_DAYS) })
  return rows.map(r => ({
    ...r,
    state: r.kind === 'group' ? undefined : r.i < index ? 'done' : r.i === index ? 'now' : 'ahead',
  }))
}

/** A pattern as a form written in a sentence: 〜をください → をください. */
export function bare(pattern) {
  return String(pattern ?? '').replace(/^[〜～]/, '')
}
