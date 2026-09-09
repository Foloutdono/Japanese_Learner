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
// belt to that brace. `prompt`: the new worker waits until the learner
// taps the ダイヤ改正 note (components/ui/UpdateToast.jsx).
if (import.meta.env.MODE !== 'native' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    onNeedRefresh() { swUpdate.offer(() => updateSW(true)) },
    onRegisterError(err) { console.warn('[sw] registration failed', err) },
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
