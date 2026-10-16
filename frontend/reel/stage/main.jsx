// ── The stage's entry (plan 210) ───────────────────────────────────
// src/main.jsx without what a reel has no use for: no service worker,
// no native bridge, no landing entry. boot.js comes first, and must:
// the session, the backend and the sound recorder are each read by the
// app as its modules load.
import './boot'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/space-grotesk/latin-400.css'
import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-600.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/noto-serif-jp/600.css'
import '@fontsource/noto-serif-jp/700.css'
import '@fontsource/noto-serif-jp/900.css'
import '@fontsource/noto-sans-jp/400.css'
import '@fontsource/noto-sans-jp/500.css'
import '@fontsource/noto-sans-jp/700.css'
import '../../src/index.css'
import App from '../../src/App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
