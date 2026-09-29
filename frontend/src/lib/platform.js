// ── Where the app is running ──────────────────────────────────
// The one question the web build and the native shells (plan 076)
// answer differently: a WebView inside the store app can schedule a
// local notification, share a file, ask the OS for a permission; the
// browser cannot. Read through this module rather than sniffing
// `window.Capacitor` at the call site, so there is one place the
// bridge is wired and every branch on it is greppable.
//
// The shape: a pure decision or a web behaviour here, and the native
// half in lib/native.js, imported dynamically only once isNative() has
// said yes -- the web bundle never carries a plugin, and a web test
// never loads one.
export function isNative() {
  try {
    return window.Capacitor?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

/** A daily local reminder can be scheduled here (native only). */
export function canNudge() {
  return isNative()
}

/** 'ios', 'android' or 'web' -- where a shell's own words differ (the
 *  widget lives on the lock screen on one and the home screen on the
 *  other). */
export function nativePlatform() {
  try {
    return window.Capacitor?.getPlatform?.() ?? 'web'
  } catch {
    return 'web'
  }
}

const native = () => import('./native')

// ── The seams ─────────────────────────────────────────────────

/** The native splash hides once the app has painted its own wait. */
export async function hideSplash() {
  if (!isNative()) return
  const n = await native()
  await n.hideSplash()
}

/** An outside page: the system browser in the shell, a new tab on the web. */
export async function openExternal(url) {
  if (isNative()) {
    const n = await native()
    return n.openExternal(url)
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** A store's listing (config/stores.js, plan 167). In the shell a
 *  top-level navigation off the bundle is handed to the OS by Capacitor
 *  itself -- an ACTION_VIEW intent on Android, UIApplication.open on
 *  iOS -- and the OS opens the store's own app on it, which the in-app
 *  browser openExternal uses cannot do; the WebView stays where it is.
 *  On the web, a new tab. */
export function openStore(url) {
  if (isNative()) {
    window.location.assign(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** The web's download: an anchor with an object URL, revoked on the
 *  next tick (Safari reads the href after click() returns). */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** A file for the learner: downloaded on the web, written and handed
 *  to the share sheet in the shell. */
export async function saveBlob(blob, filename) {
  if (isNative()) {
    const n = await native()
    return n.saveBlob(blob, filename)
  }
  downloadBlob(blob, filename)
}

/** The OS's notification prompt -- the system's own words, never a
 *  drawing of them. Resolves false where there is nothing to ask. */
export async function requestNudgePermission() {
  if (!isNative()) return false
  const n = await native()
  return n.requestNudgePermission()
}

/** Whether the OS lets the app notify: 'granted', 'denied' or
 *  'prompt' (never asked). 'denied' on the web, which has nothing to
 *  schedule. */
export async function nudgePermission() {
  if (!isNative()) return 'denied'
  const n = await native()
  return n.nudgePermission()
}

/** 発車案内 (plan 156): the day's notifications, as lib/ahead.js planned
 *  them, replacing every one scheduled before -- an empty list cancels
 *  the lot. Resolves to what was scheduled. A no-op on the web. */
export async function syncNudges(nudges) {
  if (!isNative()) return []
  const n = await native()
  return n.scheduleNudges(nudges)
}

/** The widget's figures (lib/ahead.js's widgetPayload), handed to the
 *  shell's own plugin. A no-op on the web, and on a shell built before
 *  the widget existed. */
export async function updateWidget(payload) {
  if (!isNative()) return
  const n = await native()
  await n.updateWidget(payload)
}

/** The learner has signed out: no reminder of their cards, and a
 *  widget with nothing of theirs on it. Never throws (stores/account). */
export function clearAhead() {
  syncNudges([]).catch(() => {})
  updateWidget(null).catch(() => {})
}

/** Where a notification or the widget opened the app for: the handler
 *  receives { to, via } -- a path in the app, and 'notification' or
 *  'widget'. Resolves to the unbind function. */
export async function bindOpenings(handler) {
  if (!isNative()) return () => {}
  const n = await native()
  return n.onOpenings(handler)
}

/** The app back in front after being out of sight. Resolves to the
 *  unbind function. */
export async function bindResume(handler) {
  if (!isNative()) return () => {}
  const n = await native()
  return n.onResume(handler)
}

/** Android's back button; resolves to the unbind function. */
export async function bindBackButton(handler) {
  if (!isNative()) return () => {}
  const n = await native()
  return n.onBackButton(handler)
}

export async function exitApp() {
  if (!isNative()) return
  const n = await native()
  await n.exitApp()
}

// ── The decisions, pure ───────────────────────────────────────

// The five gates: back from one of them leaves the app, as on every
// Android app with a bottom bar.
export const TAB_ROOTS = ['/today', '/learn', '/practice', '/dictionary', '/profile']

/**
 * What Android's back button does: close an open sheet, else go back
 * in the history, else -- at a gate's root, or with nothing behind --
 * leave the app.
 */
export function backAction({ hasDialog, pathname, canGoBack = true }) {
  if (hasDialog) return 'close'
  if (TAB_ROOTS.includes(pathname) || !canGoBack) return 'exit'
  return 'back'
}

// The places a link from outside the app may open. Any app can fire
// the scheme, so it names a door, never an arbitrary path.
const OPEN_PATHS = { today: '/today' }

/** A deep link the widget opens the app with -- app.tsuji://open/today
 *  -- as the path it names, or null for any other link (the OAuth
 *  callback shares the scheme). */
export function openPath(url) {
  const m = /^app\.tsuji:\/\/open\/([a-z]+)\/?$/.exec(String(url ?? ''))
  return (m && OPEN_PATHS[m[1]]) || null
}

/** 'HH:MM' → { hour, minute }, or null for anything that is not a clock. */
export function nudgeAt(time) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(time ?? ''))
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}
