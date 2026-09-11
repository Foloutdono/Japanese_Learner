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
import { apiFetch } from './api'
import { supabase } from './supabase'
import { isOptedOut } from '../stores/analyticsOptOut'

// The closed set: name -> the keys it may carry. Kept in the same order
// as backend/core/events.py's EVENTS, which tests/test_events.py checks
// this against name-for-name.
export const EVENTS = {
  app_open: ['boot_ms', 'cold', 'platform', 'standalone'],
  boot_timeout: ['waited_ms'],
  screen_view: ['route', 'tab'],
  boarding_step: ['step', 'to', 'index', 'dir', 'ms'],
  boarding_done: ['motive', 'kana_known', 'level', 'pace', 'notifications', 'ms'],
  account_claimed: ['from'],
  run_start: ['kind', 'mode', 'level'],
  run_complete: ['kind', 'mode', 'level', 'items', 'secs'],
  run_abandon: ['kind', 'mode', 'level', 'done'],
  fare_blocked: ['balance', 'fare', 'kind'],
  limit_reached: ['kind', 'at'],
  offer_view: ['where'],
  offer_intent: ['where', 'ms'],
  offer_dismiss: ['where', 'ms'],
  // The library. Never a deck name or description — both are
  // learner-typed, and no deck id either: the trail should say whether
  // learners give each other decks, not who follows whom.
  deck_publish: ['structure', 'cards'],
  deck_unpublish: ['structure', 'followers'],
  deck_subscribe: ['structure', 'cards', 'where'],
  deck_detach: ['structure', 'cards', 'withdrawn'],
  library_view: ['sort', 'results'],
  api_error: ['path', 'status'],
  install_prompt: ['outcome'],
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
  for (const key of allowed) {
    if (!(key in props)) continue
    const value = props[key]
    if (value === null || typeof value === 'boolean') out[key] = value
    else if (typeof value === 'number') out[key] = Number.isFinite(value) ? value : null
    else if (typeof value === 'string') out[key] = value.slice(0, MAX_STR)
  }
  return out
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
  queue.push({ name, at: new Date().toISOString(), props: cleaned })
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
  try {
    ({ data: { session } } = await supabase.auth.getSession())
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
if (HAS_WINDOW) {
  window.addEventListener('pagehide', () => { flush() })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

// ── For tests ────────────────────────────────────────────────────────
// The node lane has no localStorage between files and no way to reach
// the module's queue otherwise.
export function _peek() { return queue.slice() }
export function _reset() {
  queue = []
  if (timer !== null) { clearTimeout(timer); timer = null }
  save()
}
