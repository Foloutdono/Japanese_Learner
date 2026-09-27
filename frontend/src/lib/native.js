// ── 車両 — the Capacitor bridge (plan 076) ─────────────────────
// Everything the native shells can do that a browser cannot, behind
// one module that ONLY the shells ever load: lib/platform.js imports
// it dynamically after isNative() says yes, so the web bundle carries
// none of it and a web test never touches a plugin. Each function is a
// thin, forgiving call -- a plugin that is missing or refuses (an old
// OS, a denied permission) degrades to the web behaviour, never to a
// crash. The web halves of the same seams live in lib/platform.js.
import { registerPlugin } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Share } from '@capacitor/share'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { openPath } from './platform'
import { LEGACY_NUDGE_ID, NUDGE_IDS } from './ahead'

// 発車案内 — the shells' own plugin (plan 156): it hands the widget its
// figures (android/.../TsujiWidgetPlugin.java, ios/App/App/
// TsujiWidgetPlugin.swift) and asks the OS to redraw it.
const TsujiWidget = registerPlugin('TsujiWidget')

// --bg-panel / --bg-main per theme, for the system bars (stores/theme.js
// carries the same pair for the web's theme-color meta).
const BAR_COLOR = { dark: '#100e13', light: '#f6f1e4' }

/** The splash stays up until the app has painted its own wait
 *  (screens/AppLoading.jsx): one wait, not two. */
export async function hideSplash() {
  try { await SplashScreen.hide() } catch { /* already hidden */ }
}

/** The status bar follows <html data-theme>: light glyphs on sumi, dark
 *  on paper. The background colour is Android's alone; iOS ignores it. */
export async function setStatusBarTheme(theme) {
  try {
    await StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark })
    await StatusBar.setBackgroundColor({ color: BAR_COLOR[theme] ?? BAR_COLOR.dark })
  } catch { /* not every platform has a bar to paint */ }
}

/** An outside page (the privacy policy, a YouTube link) opens in the
 *  system's in-app browser, never inside the WebView the app lives in. */
export async function openExternal(url) {
  await Browser.open({ url })
}

// ── 改札 — the OAuth round trip, outside the WebView ─────────────
// The WebView's origin IS the bundle, so a page that navigates to
// Google can never come home. The authorization page opens in the
// system browser instead — a real browser, with the learner's own
// Google session and its own address bar, which is also the only place
// Google is willing to be signed into — and the answer comes back as a
// deep link on the app's scheme (lib/oauth.js's NATIVE_REDIRECT,
// registered in AndroidManifest.xml and Info.plist).
//
// `scheme` is passed in rather than imported so this module and
// lib/oauth.js do not have to import each other; oauth owns the one
// copy of the redirect the manifests are written against.
//
// Resolves with the callback URL, or null if the learner closed the
// browser instead of finishing. Both listeners are always removed:
// leaving an appUrlOpen handler behind would have the NEXT sign-in
// resolved by the previous attempt's promise.
export function openAuthTab(url, scheme) {
  return new Promise((resolve) => {
    let settled = false
    const handles = []
    const finish = (value) => {
      if (settled) return
      settled = true
      for (const h of handles) h.then(l => l.remove()).catch(() => {})
      resolve(value)
    }

    handles.push(App.addListener('appUrlOpen', ({ url: back }) => {
      if (!back?.startsWith(scheme)) return
      // The browser stays open over the app until it is told to go.
      Browser.close().catch(() => {})
      finish(back)
    }))
    // Dismissing the browser is an answer too — "no" — and without
    // this the caller would wait on a promise nothing can settle.
    handles.push(Browser.addListener('browserFinished', () => finish(null)))

    Browser.open({ url }).catch(() => finish(null))
  })
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.readAsDataURL(blob)
  })
}

/** A file the web would download (a deck's CSV, the progress export) is
 *  written to the app's cache and handed to the share sheet -- the
 *  WebView has no downloads folder of its own. */
export async function saveBlob(blob, filename) {
  const data = await blobToBase64(blob)
  const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache })
  await Share.share({ title: filename, url: uri })
}

/** The OS's own prompt, once, from the boarding's Allow. */
export async function requestNudgePermission() {
  try {
    const { display } = await LocalNotifications.requestPermissions()
    return display === 'granted'
  } catch {
    return false
  }
}

/** 'granted', 'denied' or 'prompt' (not asked yet). */
export async function nudgePermission() {
  try {
    const { display } = await LocalNotifications.checkPermissions()
    return display === 'granted' || display === 'denied' ? display : 'prompt'
  } catch {
    return 'denied'
  }
}

/** Every reminder this app has ever scheduled, the repeating one of
 *  plan 076 included, cancelled. */
async function cancelNudges() {
  try {
    await LocalNotifications.cancel({
      notifications: [LEGACY_NUDGE_ID, ...NUDGE_IDS].map(id => ({ id })),
    })
  } catch { /* nothing scheduled */ }
}

/** The day's notifications (lib/ahead.js), replacing whatever was
 *  scheduled; nothing when the OS has not allowed them. Android lists
 *  the lanes in the expanded notification (its inbox style); iOS has
 *  them in the body already. */
export async function scheduleNudges(nudges) {
  await cancelNudges()
  if (!nudges.length) return []
  const { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted') return []
  await LocalNotifications.schedule({
    notifications: nudges.map(n => ({
      id: n.id,
      title: n.title,
      body: n.body,
      ...(n.lines.length ? { inboxList: n.lines } : {}),
      schedule: { at: n.at, allowWhileIdle: true },
      extra: n.extra,
    })),
  })
  return nudges
}

/** The widget's figures, and the OS asked to redraw it. A shell built
 *  before the widget has no plugin to answer: the call fails quietly. */
export async function updateWidget(payload) {
  try {
    // null is a signed-out device: the widget empties.
    await TsujiWidget.update({ data: payload ? JSON.stringify(payload) : '' })
  } catch { /* no widget in this build */ }
}

/** A tap on a nudge, and a link from the widget -- while the app runs,
 *  or the one it was started with. The same link can arrive both ways
 *  on a cold start; it is taken once. */
export function onOpenings(handler) {
  let last = null
  const take = (to, via, key) => {
    const now = Date.now()
    if (last && last.key === key && now - last.at < 3000) return
    last = { key, at: now }
    handler({ to, via })
  }
  const pending = [
    LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
      const to = notification?.extra?.to
      if (to === '/today') take(to, 'notification', `n${notification.id}`)
    }),
    App.addListener('appUrlOpen', ({ url }) => {
      const to = openPath(url)
      if (to) take(to, 'widget', url)
    }),
  ]
  App.getLaunchUrl()
    .then(launch => {
      const to = openPath(launch?.url)
      if (to) take(to, 'widget', launch.url)
    })
    .catch(() => {})
  return () => { for (const p of pending) p.then(h => h.remove()).catch(() => {}) }
}

/** The app back in front. */
export function onResume(handler) {
  const pending = App.addListener('appStateChange', ({ isActive }) => { if (isActive) handler() })
  return () => { pending.then(h => h.remove()).catch(() => {}) }
}

/** Android's back button. The handler receives { canGoBack }; the
 *  returned function removes the listener. */
export function onBackButton(handler) {
  const pending = App.addListener('backButton', handler)
  return () => { pending.then(h => h.remove()).catch(() => {}) }
}

export async function exitApp() {
  try { await App.exitApp() } catch { /* iOS has no exit; the button does not exist there */ }
}

/** Boot-time wiring: the status bar follows the theme from the first
 *  paint and on every flip (index.html resolves data-theme before React
 *  runs; stores/theme.js rewrites it on a choice or an OS change). */
export function initNative() {
  const root = document.documentElement
  setStatusBarTheme(root.getAttribute('data-theme'))
  const observer = new MutationObserver(() => setStatusBarTheme(root.getAttribute('data-theme')))
  observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
}
