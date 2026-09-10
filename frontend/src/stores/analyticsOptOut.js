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
import { useSyncExternalStore } from 'react'

const KEY = 'jp-trail-off'

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

export function setOptedOut(next) {
  off = !!next
  try {
    if (off) window.localStorage.setItem(KEY, '1')
    else window.localStorage.removeItem(KEY)
  } catch { /* the flag still holds for this tab */ }
  emit()
}

export function useOptedOut() {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb) },
    () => off,
    () => false,
  )
}
