import { cachedJson, CONTENT_TTL_MS } from './cachedJson'
import { warmStore } from '../stores/remote'
import { warmStationSamples } from '../stores/stationSamples'
import { preloadHourPrint } from '../components/station/print/usePrint'

// ── 予熱 — a gate's answers, asked before it is opened (plan 291) ──
// The first ride ended on a plate, then Today's dial waited a second or
// two on its day and its print; every gate after it drew a wait of its
// own on its first visit (Profile and the Dictionary a spinner, Learn
// and Practice their figures arriving late). The plate went, and the
// answers each gate opens on are asked before the learner gets there:
//
//   warmToday(desk)   Today and the chrome around it -- the day, the
//       balance, the journey and the print of the hour -- asked by the
//       first ride once its own sentence is up, so the gate its grade
//       opens onto is drawn at once.
//   warmGates(...)    the four other gates, asked once a visit from
//       Today once the day has come, two at a time and only when the
//       page is idle.
//
// Never before the screen in front of the learner has what it asked
// for: the API runs a learner's requests six at a time
// (core/concurrency.py), and a warm ahead of the screen's own requests
// is the boot's rule broken (CLAUDE.md, "the boot asks for the screen
// first"). Each answer goes where its gate reads it -- a store's cache,
// or lib/cachedJson's for a gate that asks for itself and draws the
// last answer kept meanwhile -- so a gate opened later is drawn on its
// first frame and asks again quietly behind it.

/** The shared stores the gates read, warmed by their paths
 *  (stores/remote's warmStore). */
export const STORE_PATHS = {
  today: '/api/today',
  credits: '/api/credits',
  journey: '/api/journey/status',
  stats: '/api/stats',
  basics: '/api/basics',
  record: '/api/practice/record',
  agenda: '/api/agenda',
  duels: '/api/pvp',
}

/** The paths a gate asks for itself, one spelling for the gate and its
 *  warm (lib/cachedJson's keepCachedJson and lastCachedJson). */
export const GATE_PATHS = {
  decks: '/api/decks',
  // ProfileScreen's two boards: the top five, with the learner's place.
  board: '/api/leaderboard?limit=5&around=1',
  week: '/api/leaderboard?limit=5&around=1&period=week',
  radicals: '/api/dictionary/radicals',
  // The Dictionary as it opens: kanji, every level, the first page of
  // its LIMIT (50), no query.
  catalogue: lang => `/api/dictionary?${new URLSearchParams({ q: '', page: 0, limit: 50, lang, category: 'kanji' })}`,
}

// The practice platforms whose specimens the desk's gate draws
// (PracticeScreen's PLATFORM).
const SPECIMENS = ['reading', 'comprehension', 'translation', 'dictation', 'composition', 'exam', 'conversation']

/** Today's gate, ahead of the first ride's end. */
export function warmToday(desk) {
  warmStore(STORE_PATHS.today)
  warmStore(STORE_PATHS.credits)
  warmStore(STORE_PATHS.journey)
  preloadHourPrint(desk)
}

// The learner the other gates were warmed for, once a visit.
let warmedFor = null
// How long Today keeps the page to itself before the warm starts, and
// how many of its requests may be out at once.
const AFTER_MS = 1200
const AT_ONCE = 2

/**
 * The other gates, once a visit: Learn (the lines' stops, the shelf,
 * the basics' units while the course rides), Practice (the record, and
 * on the desk each platform's specimen), the Dictionary (its opening
 * page and the radical index) and Profile (the two boards, the agenda,
 * the duels). `basics` is whether Today rides the basics.
 */
export function warmGates({ session, desk = false, lang, basics = false }) {
  const user = session?.user?.id
  if (!user || warmedFor === user) return
  warmedFor = user
  const ask = (path, ttlMs = 0) => () => cachedJson(path, session, { ttlMs })
  const store = path => () => warmStore(path)
  const tasks = [
    store(STORE_PATHS.stats),
    ask(GATE_PATHS.decks),
    basics && store(STORE_PATHS.basics),
    store(STORE_PATHS.record),
    ask(GATE_PATHS.catalogue(lang)),
    ask(GATE_PATHS.radicals, CONTENT_TTL_MS),
    ask(GATE_PATHS.board),
    ask(GATE_PATHS.week),
    store(STORE_PATHS.agenda),
    store(STORE_PATHS.duels),
    ...(desk ? SPECIMENS.map(source => () => warmStationSamples(source, lang)) : []),
  ].filter(Boolean)
  whenIdle(() => {
    if (warmedFor !== user) return
    for (let i = 0; i < AT_ONCE; i++) drain(tasks, user)
  })
}

// One lane of the queue: a task, then the next once it has answered.
function drain(tasks, user) {
  const task = tasks.shift()
  if (!task || warmedFor !== user) return
  Promise.resolve()
    .then(task)
    .catch(() => {})   // a warm that failed is the gate's own wait, as before
    .then(() => drain(tasks, user))
}

function whenIdle(fn) {
  setTimeout(() => {
    if (typeof window !== 'undefined' && window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 2000 })
    else fn()
  }, AFTER_MS)
}

/** The learner has signed out (stores/account): the next is warmed afresh. */
export function forgetWarm() {
  warmedFor = null
}
