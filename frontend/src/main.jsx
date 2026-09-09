import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// ── The faces, shipped with the app (plan 065) ──
// Space Grotesk carries every Latin string, Noto Serif JP the names and
// headings (--font-serif), Noto Sans JP the readings and specimens
// (--font-jp). These replace the Google Fonts @import that opened
// index.css, so the app renders the same offline and in the native
// shell. Weight 400 of Space Grotesk must stay: see the html, body,
// #root rule in index.css for what silently happens without it. The
// Noto files are the sliced builds — one @font-face per unicode-range,
// fetched only for glyphs a page actually draws — not the single
// japanese-*.css file, which is the whole font at once.
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/noto-serif-jp/600.css'
import '@fontsource/noto-serif-jp/700.css'
import '@fontsource/noto-sans-jp/400.css'
import '@fontsource/noto-sans-jp/500.css'
import '@fontsource/noto-sans-jp/700.css'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'
import { swUpdate } from './stores/swUpdate'
import { isNative } from './lib/platform'

// The dead-bundle guard in index.html sets this before reloading; that
// this module is running at all is the proof it worked, and clearing it
// lets a later stale load in the same tab get its one retry too.
try { sessionStorage.removeItem('jp-bundle-reload') } catch { /* private mode */ }

// ── The service worker (plan 065) ──
// Web build only. vite-plugin-pwa is disabled for the native mode (a
// custom-scheme WebView has no worker, and the bundle IS the app) and
// for dev, and the virtual module is then a no-op — this guard is the
// belt to that brace.
//
// The worker no longer parks waiting to be let in (pwa.workbox.js): it
// installs and takes over, because the code that used to let it in was
// this file, and a worker serving a document whose bundle 404s is
// holding shut the only door to itself. What the learner still chooses
// is the RELOAD, offered by the ダイヤ改正 note
// (components/ui/UpdateToast.jsx) — a reload behind their back mid-exam
// would race the exam draft.
//
// Two signals, because either can be the one that arrives:
//   onNeedRefresh — a worker is parked, and only a SKIP_WAITING message
//     promotes it, which is what updateSW(true) sends. Ours does not
//     park, but a generation that predates that change can.
//   controllerchange — a new worker has claimed this page, and the
//     running bundle is now the odd one out. A plain reload is the
//     whole fix. Guarded on having been controlled already: the first
//     visit's claim is the app arriving, not an update.
if (import.meta.env.MODE !== 'native' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    onNeedRefresh() { swUpdate.offer(() => updateSW(true)) },
    onRegisterError(err) { console.warn('[sw] registration failed', err) },
  })
  const wasControlled = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (wasControlled) swUpdate.offer(() => window.location.reload())
  })
}

// ── The shell (plan 076) ──
// Inside the Capacitor WebView the bridge module is loaded -- and only
// there: lib/native.js and every plugin stay out of the web bundle.
// It wires the status bar to the theme; the splash hides once
// screens/AppLoading.jsx has painted.
if (isNative()) {
  import('./lib/native').then(n => n.initNative()).catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
