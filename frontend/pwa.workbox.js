// ── 駅舎 — what the service worker is allowed to serve ──────────
// The `workbox` half of the VitePWA plugin (vite.config.js), kept as its
// own module because two of the rules below are the difference between
// an app that updates itself and one a learner cannot open at all, and
// that is worth pinning with pwa.workbox.test.js rather than a comment.
//
// The failure this policy is shaped by, seen twice on 2026-09-09:
//
//   Every precache entry is named by its own content -- index-<hash>.js,
//   index-<hash>.css -- except index.html, which is named by its route.
//   Answer a navigation from the precache (`navigateFallback`, the
//   plugin's default, which is why it is turned off below) and the
//   document a learner gets is a snapshot of some past deployment, held
//   for as long as the worker that precached it stays active. When the
//   live deployment has retired the bundle that snapshot names, the
//   module script 404s and NOTHING under src/ runs: no React, no
//   index.css, no error UI, an empty #root on a black page. Reloading is
//   handed the same snapshot, so it is black again.
//
//   And it could not be escaped, because the only path that promoted a
//   waiting worker was updateSW(true) in src/main.jsx -- inside the very
//   bundle that would not load. The worker holding the app shut was
//   reachable only through the app it was holding shut.
//
// So: the document always comes from the network (`navigation` below),
// and a new worker takes over without asking the bundle's permission
// (`skipWaiting`/`clientsClaim`). index.html carries a third guard for
// the case where a stale document reaches a learner anyway.

// ── 改札 — the document ──
// NetworkOnly, not NetworkFirst: a network-first cache would keep a
// third copy of the document, one that goes on naming a generation of
// assets after the worker holding those assets has been replaced --
// which is the same black page arriving by a longer road. There are
// exactly two sources here, and each is in step with itself: the live
// deployment while there is a network, and the precached shell of
// whatever worker is answering when there is not. The cost is one small
// edge request before first paint; the bundle it names still comes from
// the precache.
export const navigation = {
  // The listed paths are not app routes: two are proxied to the backend
  // by vercel.json, one is a static page. A top-level navigation to any
  // of them is the browser fetching that thing, not the app booting, so
  // they are left alone -- and must be, or an offline hit on one would
  // be answered with the app shell. This is the list navigateFallback
  // took as `navigateFallbackDenylist`; it is written out here, and not
  // read from a constant, because the matcher is serialised into the
  // worker and can close over nothing. pwa.workbox.test.js walks it.
  urlPattern: ({ request, url, sameOrigin }) =>
    sameOrigin &&
    request.mode === 'navigate' &&
    !['/api/', '/kanjivg/', '/exam-audio/', '/privacy'].some(p => url.pathname.startsWith(p)),
  handler: 'NetworkOnly',
  options: { precacheFallback: { fallbackURL: 'index.html' } },
}

export const workbox = {
  // The app shell: code, styles, icons, the Latin faces. Never
  // public/sounds (4.8 MB), never the 716 KB streak sprite sheet,
  // and never the ~240 Noto slices — all three arrive on demand
  // and are kept by the runtime rules below.
  globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
  globIgnores: ['**/noto-*.woff2', '**/sprites/**'],
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  // Off, deliberately: see the header. The plugin defaults it to
  // 'index.html', which registers a NavigationRoute served straight out
  // of the precache -- and it is registered BEFORE runtimeCaching, so
  // leaving it on would make the navigation rule below unreachable
  // rather than merely redundant. `navigateFallbackDenylist` went with
  // it -- the navigation rule carries that list itself.
  navigateFallback: undefined,
  // ── ダイヤ改正 — the handover ──
  // A new worker installs and takes over, rather than parking until the
  // app asks it to. It has to: an app that cannot boot cannot ask, and
  // that is precisely when the handover matters. Nothing reloads behind
  // the learner -- registerType stays 'prompt' for that reason, and the
  // note in components/ui/UpdateToast.jsx still lets them choose the
  // moment; it is raised by the handover now instead of by a parked
  // worker (src/main.jsx). The window it opens is the running page
  // keeping its loaded modules while the new worker serves the new
  // ones, which the note exists to close.
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    // First: the document, before anything path-shaped can claim it.
    navigation,
    // Closure-free functions: they are serialised into the worker.
    { urlPattern: ({ url, sameOrigin }) => sameOrigin && (url.pathname.startsWith('/sounds/') || url.pathname.startsWith('/sprites/')),
      handler: 'CacheFirst',
      options: { cacheName: 'media', expiration: { maxEntries: 200, maxAgeSeconds: 31536000 },
                 cacheableResponse: { statuses: [200] } } },
    { urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.woff2'),
      handler: 'CacheFirst',
      options: { cacheName: 'fonts', expiration: { maxEntries: 80, maxAgeSeconds: 31536000 },
                 cacheableResponse: { statuses: [200] } } },
    { urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/kanjivg/'),
      handler: 'CacheFirst',
      options: { cacheName: 'kanjivg', expiration: { maxEntries: 500, maxAgeSeconds: 2592000 },
                 cacheableResponse: { statuses: [200] } } },
    { urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/exam-audio/'),
      handler: 'CacheFirst',
      options: { cacheName: 'exam-audio', rangeRequests: true,
                 expiration: { maxEntries: 40, maxAgeSeconds: 2592000 },
                 cacheableResponse: { statuses: [200] } } },
    // Card-reading clips (/api/tts, backend/study/word_tts.py). Under
    // /api but not learner state: the clip is a reading out of a
    // shipped deck, the request carries no token, and the same text
    // always returns the same bytes — so it caches like the audio it
    // is rather than falling into the NetworkOnly rule below, which
    // would put a round trip in front of every replay.
    { urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/tts'),
      handler: 'CacheFirst',
      options: { cacheName: 'word-audio',
                 expiration: { maxEntries: 400, maxAgeSeconds: 2592000 },
                 cacheableResponse: { statuses: [200] } } },
    { urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/translations/'),
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'translations', expiration: { maxEntries: 8, maxAgeSeconds: 604800 },
                 cacheableResponse: { statuses: [200] } } },
    // Everything else under /api is the learner's own state behind
    // a bearer token, and the worker's cache is not partitioned by
    // user. Last, so the translations rule above wins.
    { urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
      handler: 'NetworkOnly' },
  ],
}
