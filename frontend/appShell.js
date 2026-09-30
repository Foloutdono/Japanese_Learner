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
//
// The dev server and `vite preview` route as the deployment does
// (siteRoutes, below), so `/` is the landing page there too.

import { statSync } from 'node:fs'
import { join, resolve } from 'node:path'

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

// ── 路線図 — the deployment's routes, on the dev server and preview ──
// The dev server mirrors production (vite.config.js, server.proxy), and
// production's `/` is the landing page: without this, `npm run dev`
// opened the app at `/`, and `vite preview`, which falls back to an
// index.html the build no longer writes, answered every app route with
// a 404. So both read vercel.json's own table, as Vercel does: a file
// that exists is served as it is; then the redirects, then the local
// rewrites in order, each only where its destination is there to serve.
// The proxied paths are left to the proxy, and on the dev server the
// catch-all's app.html is not there, so Vite serves the source
// index.html for every app route as it always has.

/** A rule's source as a matcher: an exact path, or a pattern. */
function matcher(source) {
  if (!/[:(*]/.test(source)) return path => path === source
  const re = new RegExp(`^${source}$`)
  return path => re.test(path)
}

// A malformed escape or a missing file is no file.
const isFile = (dir, path) => {
  try { return statSync(join(dir, decodeURIComponent(path))).isFile() } catch { return false }
}

/**
 * The middleware that routes a request by `table` (vercel.json's shape)
 * over the files in `dir` -- public/ on the dev server, the build on
 * preview.
 */
export function routeLike(table, dir) {
  const proxied = table.rewrites
    .filter(r => /^https?:/.test(r.destination))
    .map(r => r.source.split(':')[0])
  const redirects = (table.redirects ?? []).map(r => ({ ...r, test: matcher(r.source) }))
  const rewrites = table.rewrites
    .filter(r => r.destination.startsWith('/'))
    .map(r => ({ ...r, test: matcher(r.source) }))
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    const [path, query] = req.url.split(/\?(.*)/s)
    const tail = query ? `?${query}` : ''
    if (proxied.some(prefix => path.startsWith(prefix))) return next()
    if (isFile(dir, path)) return next()
    const moved = redirects.find(r => r.test(path))
    if (moved) {
      res.statusCode = moved.permanent === false ? 307 : 308
      res.setHeader('Location', moved.destination + tail)
      return res.end()
    }
    const rewrite = rewrites.find(r => r.test(path) && isFile(dir, r.destination))
    if (rewrite) req.url = rewrite.destination + tail
    return next()
  }
}

/** The Vite plugin that puts routeLike before the servers' own routes. */
export function siteRoutes(table) {
  return {
    name: 'tsuji:site-routes',
    configureServer(server) {
      server.middlewares.use(routeLike(table, server.config.publicDir))
    },
    configurePreviewServer(server) {
      server.middlewares.use(routeLike(table, resolve(server.config.root, server.config.build.outDir)))
    },
  }
}
