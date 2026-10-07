import { useEffect, useSyncExternalStore } from 'react'
import { apiJson } from '../lib/api'
import { reviewsSettled } from '../lib/reviews'
import { applyXpGain } from './profileSummary'
import { refreshToday } from './today'
import { clearPaid } from '../domain/dayClear'

// ── 終着 — asking whether the day is cleared (plan 191) ──────────────
// A run hands its finish to /today/clear with its tally in the router's
// state (screens/TodayRun.jsx); the finish asks the server, once per
// run, whether that run cleared the day (POST /api/today/clear) and
// plays the ceremony or the partial finish on the answer.
//
// Module state keyed by the run, not screen state: StrictMode mounts the
// screen twice in development and a desk window dragged across 1100px
// swaps the layout route under it, and neither may post twice -- the
// server pays once a day under its own key, but the bonus must also be
// paid into the HUD's figure once (applyXpGain), and a second answer
// ("already") would print zeros over the first. The run's `at` (when
// it ended) is its key.
//
// The day's last review can still be in the air as the run ends (it is
// fired and forgotten), so the ask waits for every review in flight to
// settle first (lib/reviews' reviewsSettled), or the server would count
// one card left.
//
// What a screen reads: { status, result, levelUp, error, retry }
//   status   'idle' (no run) | 'loading' | 'cleared' | 'partial' | 'error'
//   result   the server's answer, as is (see the plan's contract)
//   levelUp  { newLevel } when the bonus crossed a level, else null: the
//            ceremony plays the 進級 after its fare beat
const IDLE = Object.freeze({ status: 'idle', result: null, levelUp: null, error: null })
const LOADING = Object.freeze({ status: 'loading', result: null, levelUp: null, error: null })

const entries = new Map()
const listeners = new Set()
function emit() { listeners.forEach(fn => fn()) }
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn) }

function set(key, entry) {
  entries.set(key, Object.freeze(entry))
  emit()
}

/** The run's identity: when it ended (TodayRun's `at`). */
export function runKey(run) {
  if (!run) return null
  return String(run.at ?? `${run.cleared ?? 0}:${run.xp ?? 0}`)
}

/** What clearing paid into the HUD's figure, and whether it crossed a level. */
function payInto(result) {
  const paid = clearPaid(result)
  if (paid <= 0) return null
  const gain = applyXpGain({ amount: paid })
  // No summary cached (a cold start straight into a run): the server's
  // own word on the level, which it computed after paying.
  const crossed = gain.newLevel === undefined ? Boolean(result.xp?.leveled_up) : gain.leveledUp
  if (!crossed) return null
  return { newLevel: gain.newLevel ?? result.xp?.new_level ?? result.level?.level ?? null }
}

// A reload does not drop the router's state: BrowserRouter keeps it in
// history.state, which the browser restores, so /today/clear reloaded
// would find its run again with this module's answers gone -- and play
// the finish a second time, asking the server again (which answers
// `already`, paying nothing, but the ceremony replays the stamp). The
// tab remembers the last run whose finish it asked for (sessionStorage
// survives a reload and nothing else); a run it remembers that this
// module has no answer for is a finish already shown, and the screen
// sends it to the gate.
const ASKED_KEY = 'tsuji.dayClear.asked'

function noteAsked(key) {
  try { window.sessionStorage.setItem(ASKED_KEY, key) } catch { /* a reload replays it at worst */ }
}

/** Whether this run's finish was shown before a reload (the gate's, now). */
export function finishShown(run) {
  const key = runKey(run)
  if (!key || entries.has(key)) return false
  try { return window.sessionStorage.getItem(ASKED_KEY) === key } catch { return false }
}

// The run's count of reviews: the server sums what those reviews wrote
// for the run's XP (`run_xp`), the run's own sum of its previews
// running high on a long run.
function clearBody(run) {
  return JSON.stringify(Number.isInteger(run?.cleared) && run.cleared >= 0 ? { reviews: run.cleared } : {})
}

/** Ask once for this run; a second call for the same run does nothing. */
export function requestClear(run, session) {
  const key = runKey(run)
  if (!key || entries.has(key)) return
  noteAsked(key)
  set(key, LOADING)
  reviewsSettled()
    .then(() => apiJson('/api/today/clear', session, { method: 'POST', body: clearBody(run) }))
    .then(result => {
      const cleared = Boolean(result?.cleared)
      const levelUp = cleared ? payInto(result) : null
      // The gate's figures (the badge, day_clear.done) are stale now.
      refreshToday()
      set(key, { status: cleared ? 'cleared' : 'partial', result, levelUp, error: null })
    })
    .catch(error => set(key, { status: 'error', result: null, levelUp: null, error }))
}

/** Ask again after a failure (the screen's Retry). */
export function retryClear(run, session) {
  const key = runKey(run)
  if (!key || entries.get(key)?.status !== 'error') return
  entries.delete(key)
  requestClear(run, session)
}

/** The answer for this run as it stands (IDLE before it was asked). */
export function peekDayClear(run) {
  const key = runKey(run)
  return (key ? entries.get(key) : null) ?? IDLE
}

/** The answer for this run, asked for on first use. */
export function useDayClear(run, session) {
  const key = runKey(run)
  useEffect(() => {
    if (key) requestClear(run, session)
    // The run is the router's state and the key is its identity; a new
    // session object (a token refresh) is the same learner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? entries.get(key) : null) ?? (key ? LOADING : IDLE),
    () => IDLE,
  )
  return { ...entry, retry: () => retryClear(run, session) }
}

/** Tests only: forget every run asked about. */
export function resetDayClear() {
  entries.clear()
  try { window.sessionStorage.removeItem(ASKED_KEY) } catch { /* nothing kept */ }
  emit()
}

// ── 運休 — the rest-day notice, seen (plan 191) ───────────────────────
// Today shows the rest-day notice while its summary names a rest day the
// learner has not been told of (`rest.unseen`), and tells the server the
// moment the notice leaves -- by Départ or any other way out -- so it is
// shown once. Kept here too, by the days it named, so a second visit to
// the gate before the summary refreshes does not show it again.
const restSeen = new Set()

/** Whether the notice for these rest days has already been seen here. */
export function restNoticeSeen(key) {
  return restSeen.has(key)
}

/** The notice for these days has left the screen: POST /api/today/rest/seen, once. */
export function markRestSeen(session, key) {
  if (!key || restSeen.has(key)) return
  restSeen.add(key)
  apiJson('/api/today/rest/seen', session, { method: 'POST', body: '{}' })
    .then(() => refreshToday())
    .catch(() => { /* shown again tomorrow at worst */ })
}
