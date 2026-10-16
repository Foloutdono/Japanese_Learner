// ── 足跡を残さない — the learner asks not to be counted ──────────────
//
// The trail is first-party and carries nothing anyone typed, which is
// why it needs no banner in front of it. That is a reason to make the
// opt-out easy to find, not a reason to skip it: Réglages › Données,
// beside the export and the delete, which is where the privacy policy
// already points.
//
// localStorage rather than the profile, deliberately. It has to be
// readable SYNCHRONOUSLY, before the first event of the boot is
// queued -- a flag that arrives with GET /api/profile arrives after
// app_open has already been recorded, which is the one event an
// opted-out learner would most notice.
//
// Since plan 218 the switch is ALSO the account's
// (user_profiles.analytics_off): the local flag alone stopped one
// browser, while the server's own events and every other device kept
// counting. The local flag stays, for the reason above -- it must be
// readable before the boot's first event -- and the account's answer is
// copied onto it on every boot (syncOptOut, from App.jsx).
import { useSyncExternalStore } from 'react'

const KEY = 'jp-trail-off'
// Set once a device has carried its pre-218 local switch up to the
// account, so the account is the one truth from then on.
const SYNCED_KEY = 'jp-trail-synced'

const listeners = new Set()

function read() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    // Safari in private mode throws on access rather than returning
    // null. Counting someone is the wrong way to fail, so: opted out.
    return true
  }
}

let off = read()

function emit() { listeners.forEach(fn => fn()) }

export function isOptedOut() { return off }

function setLocal(next) {
  off = !!next
  try {
    if (off) window.localStorage.setItem(KEY, '1')
    else window.localStorage.removeItem(KEY)
  } catch { /* the flag still holds for this tab */ }
  emit()
}

function markSynced() {
  try { window.localStorage.setItem(SYNCED_KEY, '1') } catch { /* asked again next boot */ }
}

/**
 * The learner's choice: this device at once, and the account when there
 * is a session to write it with (Settings passes one). A failed write
 * leaves the local switch standing -- the device still says no -- and
 * the next boot's syncOptOut carries it up.
 */
export function setOptedOut(next, session) {
  setLocal(next)
  if (!session) return
  // Loaded here rather than at the top, for the reason lib/track.js
  // loads it late: this store is read before anything else at boot.
  import('../lib/api').then(({ apiJson }) => apiJson('/api/profile/learning', session, {
    method: 'PATCH',
    body: JSON.stringify({ analyticsOff: !!next }),
  })).then(markSynced, () => {
    try { window.localStorage.removeItem(SYNCED_KEY) } catch { /* nothing to clear */ }
  })
}

/**
 * On boot, with the profile's `analyticsOff`. The account's answer wins,
 * except once: a device that said no before the account could hold the
 * answer (before plan 218) carries its no up, rather than being turned
 * back on by an account that was never asked.
 */
export function syncOptOut(accountOff, session) {
  if (typeof accountOff !== 'boolean') return
  let synced = false
  try { synced = window.localStorage.getItem(SYNCED_KEY) === '1' } catch { /* treated as not yet */ }
  if (!synced && off && !accountOff) {
    setOptedOut(true, session)
    return
  }
  markSynced()
  if (accountOff !== off) setLocal(accountOff)
}

export function useOptedOut() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => off,
    () => false,
  )
}
