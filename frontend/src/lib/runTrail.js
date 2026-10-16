// ── 乗車の記録 — what a run cost and how it went (plan 218) ─────────
//
// The card runs have reported run_start / run_complete / run_abandon
// from hooks/useCardSession since ADR 0012; the five practice runs
// (reading, translation, comprehension, dictation, composition) reported
// nothing, so half of what the app offers had no figures at all. Every
// run already goes through one seam, stores/runTally.js -- startTally
// when it begins, countReview per answer -- so this module hangs off
// that seam rather than off five screens:
//
//   - startTally of a practice key opens a run here (run_start);
//   - leaving its screen (lib/screenTrail.js) or the page closes it.
//
// A practice run has no end of its own -- the sentences keep coming
// until the learner stops -- so a closed run with at least one answer
// is a `run_complete` (its `items` the answers given) and one with none
// is a glance, recorded as nothing, the rule useCardSession already
// keeps. Its `mode` says so: 'stream'.
//
// runFigures() is what every run's end carries, card runs included:
// engaged ms, the time per answer's median and 90th percentile, how
// many answers were right (quality >= 3, the tally's own line). Counts
// and durations; never an item, a sentence or an answer.
import { routePattern } from './routePattern'
import { track } from './track'

const PRACTICE = new Set(['reading', 'translation', 'comprehension', 'dictation', 'composition'])
const LEVELS = new Set(['N5', 'N4', 'N3', 'N2', 'N1'])

let open = null      // { kind, level, at, where, route }
let figuresOf = null // () => the live tally's figures; set by runTally

/** runTally hands over its reader once, to avoid an import cycle. */
export function _bindTally(read) { figuresOf = read }

/** The door a run was entered by, from the screen it runs on. */
export function runWhere(pathname = typeof window !== 'undefined' ? window.location.pathname : '') {
  const route = routePattern(pathname) || ''
  if (route.startsWith('/today')) return 'today'
  if (route.startsWith('/ride')) return 'ride'
  if (route.startsWith('/learn/decks')) return 'deck'
  if (route.startsWith('/learn')) return 'learn'
  if (route.startsWith('/practice/exam')) return 'exam'
  if (route.startsWith('/practice')) return 'practice'
  return 'other'
}

/** p-th percentile of a list of numbers, rounded; undefined if empty. */
export function percentile(values, p) {
  if (!values.length) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return Math.round(sorted[i])
}

/** What a run's end carries, from the live tally. */
export function runFigures() {
  const t = figuresOf?.()
  if (!t) return {}
  return {
    ms: t.engagedMs,
    card_p50: percentile(t.laps, 50),
    card_p90: percentile(t.laps, 90),
    right: t.good,
  }
}

/** A tally began: if it is a practice run's, open it. */
export function beginRun(key) {
  const [kind, what] = String(key).split(':')
  if (!PRACTICE.has(kind)) return
  endOpenRun()
  const level = LEVELS.has(what) ? what : undefined
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  open = { kind, level, at: Date.now(), where: runWhere(pathname), route: routePattern(pathname) }
  track('run_start', { kind, mode: 'stream', level, where: open.where })
}

/**
 * Close the open practice run, if any. With a `route`, only a run that
 * began on that screen: the screen being left. A new screen's run can
 * open before the trail hears the route changed (its effect runs first),
 * and must not be closed by the leaving of the one before it. A run
 * begun on a path the trail does not know has no screen to wait for.
 */
export function endOpenRun(route) {
  if (!open) return
  if (route !== undefined && open.route && open.route !== route) return
  const run = open
  open = null
  const items = figuresOf?.()?.reviewed ?? 0
  if (items === 0) return
  track('run_complete', {
    kind: run.kind,
    mode: 'stream',
    level: run.level,
    items,
    secs: Math.round((Date.now() - run.at) / 1000),
    where: run.where,
    ...runFigures(),
  })
}

export function _resetRun() { open = null }
