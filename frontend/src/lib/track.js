// ── 足跡 — the trail, and the one seam that writes it ────────────────
//
// Every event in the app goes through track(). No screen calls fetch
// for this, and no screen names an endpoint: if the sink ever changes
// -- to PostHog, to a second copy alongside this one -- it changes
// here and nowhere else.
//
// The rules it exists to keep, in the order they matter:
//
//   1. NOTHING A LEARNER TYPED. EVENTS below is a closed set of names,
//      each with the property keys it may carry, and anything else is
//      dropped before it is queued. The server applies the same set
//      again (backend/core/events.py) rather than trusting this, and a
//      test fails if the two lists drift apart.
//   2. Never in the way. Queued in memory, flushed on a timer and when
//      the page goes away -- never awaited by a caller, never on the
//      path of a render or a navigation. A study session must not be
//      able to notice that this file exists.
//   3. Never lost to a reload. The queue is mirrored to localStorage,
//      so a learner who studies on a train and closes the tab is not a
//      learner who was never there.
//
// See docs/adr/0012.
// The API client and the auth client are loaded when a flush needs them
// (plan 218), not when this module is: everything that counts something
// imports track, and importing it must not construct the Supabase client
// -- a settings store or the language context would otherwise drag auth
// into every module (and every test) that only wants to say a thing
// happened. Both are long loaded by the app before the first flush.
const clients = () => Promise.all([import('./api'), import('./supabase')])
import { isOptedOut } from '../stores/analyticsOptOut'
import { visitContext } from './visitContext'
import { runHideHooks } from './pageHide'

// The closed set: name -> the keys it may carry. Kept in the same order
// as backend/core/events.py's EVENTS, which tests/test_events.py checks
// this against name-for-name.
export const EVENTS = {
  app_open: ['boot_ms', 'cold', 'platform', 'standalone'],
  boot_timeout: ['waited_ms'],
  screen_view: ['route', 'tab'],
  // How long the screen was in front of someone (plan 218): engaged
  // time, sent on leaving it and on the page being hidden
  // (lib/screenTrail.js).
  screen_leave: ['route', 'tab', 'ms'],
  // A visit began (see the session below). The id rides beside the
  // event, not inside it; the properties are the visit's coarse
  // context (lib/visitContext.js), never a raw value.
  session_start: ['platform', 'vp', 'os', 'lang', 'theme', 'input', 'standalone', 'reduced'],
  boarding_step: ['step', 'to', 'index', 'dir', 'ms'],
  boarding_done: ['motive', 'kana_known', 'level', 'pace', 'notifications', 'lines', 'ms', 'level_how', 'placed'],
  account_claimed: ['from'],
  // The first ride (plan 097): the two lessons after the boarding and
  // the guide over each gate. Step and stop names are the app's own,
  // never anything typed.
  ride_step: ['step', 'to', 'dir', 'ms'],
  ride_done: ['skipped', 'at', 'ms'],
  guide_step: ['gate', 'stop', 'index'],
  guide_done: ['gate', 'skipped', 'stops', 'ms'],
  // Every run, the practice runs too since plan 218 (lib/runTrail.js),
  // with how it went: engaged ms, the time per item's median and slow
  // tail, how many right, and the door it was entered by.
  run_start: ['kind', 'mode', 'level', 'where'],
  run_complete: ['kind', 'mode', 'level', 'items', 'secs', 'ms', 'card_p50', 'card_p90', 'right', 'where'],
  run_abandon: ['kind', 'mode', 'level', 'done', 'ms', 'card_p50', 'card_p90', 'right', 'where'],
  fare_blocked: ['balance', 'fare', 'kind'],
  limit_reached: ['kind', 'at'],
  offer_view: ['where'],
  offer_intent: ['where', 'ms', 'plan', 'billing', 'all'],
  offer_dismiss: ['where', 'ms', 'all'],
  // The library. Never a deck name or description — both are
  // learner-typed, and no deck id either: the trail should say whether
  // learners give each other decks, not who follows whom.
  deck_publish: ['structure', 'cards'],
  deck_unpublish: ['structure', 'followers'],
  deck_subscribe: ['structure', 'cards', 'where'],
  deck_detach: ['structure', 'cards', 'withdrawn'],
  library_view: ['sort', 'results', 'filtered'],
  // The dictionary's shelf (plan 093): the kind of entry kept or let
  // go, never its key — a key names the word a learner looked up.
  favorite_toggle: ['kind', 'on'],
  // A song's decks (plan 215): the counts that went in, never its name.
  song_deck: ['words', 'lines'],
  // The app opened from its notification or its widget (plan 156).
  nudge_opened: ['via'],
  // The basics course (plan 186f): its own unit number, never a card.
  basics_unit_done: ['unit'],
  basics_skipped: ['unit'],
  // A grammar point's tour (plan 187b): the level, never the pattern.
  grammar_tour_step: ['level', 'stop', 'outcome'],
  grammar_tour_done: ['level', 'tries', 'helped', 'authored'],
  // A kana or a kanji's first tour (plan 216): its line, never the character.
  glyph_tour_done: ['source', 'misses', 'shown'],
  // The day cleared (plan 191). day_clear and rest_day_used are written
  // by the server (POST /api/today/clear, the rest-day bridge);
  // ticket_share is a milestone ticket shared, its days and nothing of
  // the image.
  day_clear: ['streak', 'milestone', 'tier'],
  rest_day_used: ['days'],
  ticket_share: ['days'],
  // The review plan (plan 217): the comeback sheet opened (ours, once a
  // sheet); its answer, a catch-up's end, the ceiling and an absence set
  // in Settings, and the absence's days bridged (the server's).
  catchup_offer: ['owed', 'away'],
  catchup_choice: ['choice', 'days', 'per_day'],
  catchup_done: ['days'],
  review_cap_set: ['cap'],
  away_set: ['days'],
  away_day_used: ['days'],
  // The small features, counted per screen and sent on leaving it
  // (lib/screenTrail.js countUse), and a setting changed to one of the
  // app's own values (plan 218). Both closed by VALUES below.
  feature_use: ['feature', 'action', 'route', 'n'],
  setting_change: ['setting', 'value'],
  // Written by the server (core/daily_limit.claim): a rationed model
  // call, its count against the day's ceiling. Declared here only so
  // the two sets stay one.
  ai_use: ['feature', 'count', 'limit', 'over'],
  api_error: ['path', 'status'],
  install_prompt: ['outcome'],
  // An uncaught error, by screen -- never its message or stack -- and
  // the page's own speed once per load (lib/clientErrors.js,
  // lib/vitals.js; plan 218).
  client_error: ['route', 'where'],
  vitals: ['route', 'lcp', 'inp', 'cls', 'ttfb'],
}

// The values a string property may take where it is an enum (plan 218),
// mirrored from backend/core/events.py's VALUES, which
// tests/test_events.py reads this block against -- keep it plain data
// (one name per key, single-quoted strings) and keep the end marker.
// A value outside its list is dropped here and again on the server.
export const VALUES = {
  session_start: {
    platform: ['web', 'native'],
    vp: ['phone', 'tablet', 'desk', 'wide'],
    os: ['ios', 'android', 'windows', 'mac', 'linux', 'chromeos', 'other'],
    lang: ['fr', 'en'],
    theme: ['light', 'dark', 'auto'],
    input: ['touch', 'mouse'],
  },
  boarding_done: { level_how: ['pick', 'test'], placed: ['N5', 'N4', 'N3', 'N2', 'N1'] },
  run_start: { where: ['today', 'learn', 'practice', 'deck', 'ride', 'exam', 'other'] },
  run_complete: { where: ['today', 'learn', 'practice', 'deck', 'ride', 'exam', 'other'] },
  run_abandon: { where: ['today', 'learn', 'practice', 'deck', 'ride', 'exam', 'other'] },
  feature_use: {
    feature: ['speech', 'analyzer', 'ocr', 'ask', 'explain', 'dictionary', 'export', 'level_fit'],
    action: ['play', 'text', 'photo', 'video', 'scan', 'send', 'open', 'search', 'progress', 'move', 'stay'],
  },
  setting_change: {
    setting: ['theme', 'lang', 'rating_scale', 'reading_pace', 'sound', 'notifications', 'level', 'lines', 'daily_target'],
    value: ['light', 'dark', 'auto', 'fr', 'en', 'binary', 'simple', 'full', 'standard', 'relaxed', 'slow', 'untimed', 'on', 'off', 'N5', 'N4', 'N3', 'N2', 'N1', 'changed'],
  },
  ai_use: { feature: ['ask', 'composition', 'translation_review', 'deep_analysis', 'exam_paper', 'line_translation'] },
  client_error: { where: ['error', 'rejection'] },
}
// end VALUES

// `route` and `path` are held to a shape on every name, as the server
// holds them: a pattern or an API area, never a learner's words.
const SHAPES = {
  route: /^\/[A-Za-z0-9/:_-]{0,63}$/,
  path: /^\/api\/[a-z][a-z0-9_-]{0,30}$/,
}

const KEY = 'jp-trail'
// Flush at twenty, or after thirty seconds, whichever comes first. One
// request per twenty screens is invisible next to what the app already
// does per screen.
const BATCH = 20
const IDLE_MS = 30_000
// The queue is bounded so a long offline stretch cannot fill a phone's
// storage quota and take the auth token down with it. Oldest go first:
// a boarding step from two days ago matters less than what is happening
// now, and the server's own MAX_BATCH means an enormous backlog would
// be trimmed on arrival anyway.
const MAX_QUEUE = 200
// Strings are cut here too, not only on the server. The server is the
// guarantee; this keeps the localStorage mirror small.
const MAX_STR = 64

// Only storage and the page-lifecycle listeners actually need a
// window. Queueing does not, and gating it on one would mean the node
// test lane -- where most of the rules above are pinned -- could only
// ever watch this file do nothing.
const HAS_WINDOW = typeof window !== 'undefined'

let queue = load()
let timer = null
let flushing = false

// ── The visit ────────────────────────────────────────────────────────
// A random id, minted here, for one visit: it lets the trail say how
// long a session lasted and how many a day a learner has, which no row
// can say alone. It carries nothing about the learner (the server
// already attributes rows to the account), is not a device id, and
// lives in sessionStorage -- gone with the tab, never shared between
// two. A visit ends after thirty minutes without an event; the next
// one begins a new one and says so with `session_start`.
const SESSION_KEY = 'jp-sid'
const SESSION_GAP_MS = 30 * 60_000

let session = loadSession()

function loadSession() {
  if (!HAS_WINDOW) return null
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || 'null')
    return parsed && typeof parsed.id === 'string' && Number.isFinite(parsed.last) ? parsed : null
  } catch {
    return null
  }
}

function saveSession() {
  if (!HAS_WINDOW) return
  try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch { /* in memory still */ }
}

// The live session's id, or null when there is none (or it lapsed).
function liveSession(now) {
  return session && now - session.last <= SESSION_GAP_MS ? session : null
}

function load() {
  if (!HAS_WINDOW) return []
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.slice(-MAX_QUEUE) : []
  } catch {
    return []
  }
}

function save() {
  if (!HAS_WINDOW) return
  try {
    if (queue.length) window.localStorage.setItem(KEY, JSON.stringify(queue))
    else window.localStorage.removeItem(KEY)
  } catch {
    // A full or refused storage is not a reason to stop tracking for
    // this tab -- the in-memory queue still flushes.
  }
}

// Only the keys this name declares, and only scalars. A dict or an
// array is the shape free text arrives in (a token list, an analysed
// sentence, a card body), so it is dropped rather than serialised.
function clean(name, props) {
  const allowed = EVENTS[name]
  if (!allowed) return null
  const out = {}
  if (!props || typeof props !== 'object') return out
  const enums = VALUES[name] || {}
  for (const key of allowed) {
    if (!(key in props)) continue
    const value = props[key]
    if (typeof value === 'string') {
      if (enums[key] && !enums[key].includes(value)) continue
      if (SHAPES[key] && !SHAPES[key].test(value)) continue
    }
    if (value === null || typeof value === 'boolean') out[key] = value
    else if (typeof value === 'number') out[key] = Number.isFinite(value) ? value : null
    else if (typeof value === 'string') out[key] = value.slice(0, MAX_STR)
  }
  return out
}

// Each event carries an id of its own, so a batch the server took but
// the page never heard back about -- a flush on pagehide whose response
// arrived after the page had gone -- is sent again from the mirror and
// kept ONCE (core/events.py's unique (user_id, cid)). Without it the
// live walk of plan 100 wrote two guide_done rows for one gate.
function eventId() {
  const c = typeof crypto !== 'undefined' ? crypto : null
  if (c?.randomUUID) return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Record one event. Never throws, never returns anything worth waiting
 * for, and does nothing at all when the learner has opted out.
 */
export function track(name, props) {
  if (isOptedOut()) return
  const cleaned = clean(name, props)
  if (cleaned === null) {
    // Loud in dev, silent in production: a name that is not in the set
    // is a bug at the call site, and the place to find out is the
    // console of the person who just wrote it -- not a learner's
    // session, and not a support thread three weeks later.
    if (import.meta.env.DEV) console.warn(`track: unknown event "${name}"`)
    return
  }
  const now = Date.now()
  const at = new Date(now).toISOString()
  let live = liveSession(now)
  // A failed request is not the learner doing anything: it joins the
  // visit that is running, and neither begins one nor keeps one alive.
  if (name !== 'api_error') {
    if (!live) {
      session = { id: eventId(), last: now }
      live = session
      queue.push({ id: eventId(), name: 'session_start', at, sid: live.id, props: clean('session_start', visitContext()) })
    } else {
      live.last = now
    }
    saveSession()
  }
  queue.push({ id: eventId(), name, at, ...(live ? { sid: live.id } : {}), props: cleaned })
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE)
  save()
  if (queue.length >= BATCH) flush()
  else arm()
}

function arm() {
  if (timer !== null) return
  timer = setTimeout(() => { timer = null; flush() }, IDLE_MS)
}

/**
 * Send what is queued.
 *
 * `keepalive` rather than navigator.sendBeacon: the API takes a bearer
 * token and sendBeacon cannot set a header, so a beacon would arrive
 * unauthenticated and be thrown away. fetch(keepalive) carries headers
 * and still outlives the page, within a 64 KB body -- which twenty
 * events of enum-and-number properties is nowhere near.
 */
export async function flush() {
  if (flushing || !queue.length) return
  if (timer !== null) { clearTimeout(timer); timer = null }

  let session
  let apiFetch
  try {
    const [api, auth] = await clients()
    apiFetch = api.apiFetch
    ;({ data: { session } } = await auth.supabase.auth.getSession())
  } catch {
    return                      // signed out mid-flush; keep the queue
  }
  // Everything here is about a signed-in learner. Anonymous guests
  // count -- "Embarquer" mints one and the boarding runs on it, which
  // is most of what this exists to measure -- but a session with no
  // user at all has nothing to attribute to.
  if (!session?.user?.id) return

  const sending = queue.slice(0, BATCH)
  flushing = true
  try {
    const response = await apiFetch('/api/events', session, {
      method: 'POST',
      keepalive: true,
      body: JSON.stringify({ events: sending }),
    })
    // 4xx means the server will never take these rows -- retrying is a
    // loop. Drop them and move on; only a network failure or a 5xx is
    // worth keeping the queue for.
    if (response.ok || (response.status >= 400 && response.status < 500)) {
      queue = queue.slice(sending.length)
      save()
    }
  } catch {
    // Offline. The queue keeps, and the next flush carries it.
  } finally {
    flushing = false
  }
  if (queue.length) arm()
}

// The page going away is the flush that matters: it is the one that
// catches the last screen of a session, and a session that ended is
// exactly what a funnel needs to know about. `pagehide` rather than
// `unload`, which a bfcache-eligible page never fires; `visibilitychange`
// as well, because on iOS a tab switch is often the last thing that
// happens before the process is reclaimed.
//
// Whatever must be queued BEFORE that flush registers in lib/pageHide.js
// (the screen's dwell and feature counts, the page's vitals; plan 218)
// and runs here, first.
function onHide(kind) {
  runHideHooks(kind)
  flush()
}

if (HAS_WINDOW) {
  window.addEventListener('pagehide', () => { onHide('pagehide') })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide('hidden')
  })
}

// ── For tests ────────────────────────────────────────────────────────
// The node lane has no localStorage between files and no way to reach
// the module's queue otherwise.
export function _peek() { return queue.slice() }
export function _reset() {
  queue = []
  session = null
  if (HAS_WINDOW) { try { window.sessionStorage.removeItem(SESSION_KEY) } catch { /* nothing to clear */ } }
  if (timer !== null) { clearTimeout(timer); timer = null }
  save()
}
