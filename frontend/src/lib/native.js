// ── 車両 — the Capacitor bridge (plan 076) ─────────────────────
// Everything the native shells can do that a browser cannot, behind
// one module that ONLY the shells ever load: lib/platform.js imports
// it dynamically after isNative() says yes, so the web bundle carries
// none of it and a web test never touches a plugin. Each function is a
// thin, forgiving call -- a plugin that is missing or refuses (an old
// OS, a denied permission) degrades to the web behaviour, never to a
// crash. The web halves of the same seams live in lib/platform.js.
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Share } from '@capacitor/share'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { nudgeAt } from './platform'

// One daily reminder, one id: rescheduling replaces it, never stacks.
const NUDGE_ID = 1

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

/** The daily reminder at the learner's hour, replacing whatever was
 *  scheduled; false when the OS has not allowed notifications. */
export async function scheduleNudge({ time, title, body }) {
  const at = nudgeAt(time)
  if (!at) return false
  await cancelNudge()
  const { display } = await LocalNotifications.checkPermissions()
  if (display !== 'granted') return false
  await LocalNotifications.schedule({
    notifications: [{
      id: NUDGE_ID,
      title,
      body,
      schedule: { on: { hour: at.hour, minute: at.minute }, allowWhileIdle: true },
    }],
  })
  return true
}

export async function cancelNudge() {
  try { await LocalNotifications.cancel({ notifications: [{ id: NUDGE_ID }] }) } catch { /* nothing scheduled */ }
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
