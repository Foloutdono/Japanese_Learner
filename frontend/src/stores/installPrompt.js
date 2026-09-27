import { useSyncExternalStore } from 'react'

// ── ホーム画面に追加 — the install offer ─────────────────────
// Chromium fires `beforeinstallprompt` once the page qualifies as
// installable and hands over the prompt to call later; the event only
// comes once per page load and before anything is mounted, so it is
// caught here at module scope rather than in a component. Settings
// draws the row when a prompt is in hand (or on iOS, which has no
// event and needs the Share → Add to Home Screen sheet instead), and
// hides it once the app runs standalone.
let deferred = null
const listeners = new Set()

function emit() { listeners.forEach(fn => fn()) }

// Module scope, so React sees one subscribe function and does not
// unsubscribe and resubscribe on every render.
function subscribe(cb) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    deferred = e
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

export function useInstallPrompt() {
  return useSyncExternalStore(
    subscribe,
    () => deferred !== null,
    () => false,
  )
}

export async function promptInstall() {
  const e = deferred
  if (!e) return null
  e.prompt()
  // An event prompts once, whatever the answer: prompt() on it again
  // rejects, and the row would be a button that does nothing. Dropped
  // on either outcome, so the row hides until the browser hands over a
  // new one.
  deferred = null
  emit()
  const { outcome } = await e.userChoice
  return outcome
}

// iOS Safari never fires the event; the only install path is the
// share sheet, so the row explains it. iPadOS reports itself as a Mac
// with a touch screen, hence the second clause.
export function isIosSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  return ios && /safari/i.test(ua) && !/crios|fxios/i.test(ua)
}
