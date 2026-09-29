// ── 本屋 — the app shell's name on the web (plan 167) ──
// The landing page is the site's `/`. Vercel serves a file before any
// rewrite, and a build with an index.html at its root answers `/` with
// that file, so the landing could never be reached there while the
// app's document kept the name. The web build therefore writes the
// app's document as app.html: vercel.json's fallback serves it for
// every app route, the service worker falls back to it offline
// (pwa.workbox.js), and `/` is left to the landing's rewrite.
//
// The web production build only. `npm run dev` serves the source
// index.html as it always has, and the native shell's bundle keeps
// index.html, since Capacitor loads it by that name.

export const APP_SHELL = 'app.html'

/** The Vite plugin that renames the emitted index.html to APP_SHELL. */
export function appShell(mode) {
  return {
    name: 'tsuji:app-shell',
    apply: 'build',
    // After Vite's own HTML plugin has emitted the document.
    enforce: 'post',
    generateBundle(_options, bundle) {
      if (mode !== 'production') return
      const html = bundle['index.html']
      if (!html) return
      delete bundle['index.html']
      this.emitFile({ type: 'asset', fileName: APP_SHELL, source: html.source })
    },
  }
}
