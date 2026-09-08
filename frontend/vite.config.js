/// <reference types="vitest/config" />
// Explicit import rather than the Node global: eslint.config.js gives
// every file browser globals only, and this config is the one file in
// src reach that legitimately runs in Node.
import process from 'node:process';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { playwright } from '@vitest/browser-playwright';

// One browser project per viewport, from one helper, so the two lanes
// cannot drift apart in anything but the viewport they run at.
//
// The optimizer that matters here is the browser project's own -- a
// root-level optimizeDeps does not reach it, which was verified the hard
// way.
//
// `react-dom/client` is reached only from inside vitest-browser-react,
// so the initial scan of the test files never sees it and it was
// bundled AFTER the run had begun:
//
//     [optimizer] scanning dependencies...
//     dependency optimized: react-dom/client
//     optimized dependencies changed. reloading
//
// That reload re-evaluates a module graph that is already live, which
// leaves two copies of React in the page -- `Invalid hook call` and
// `Cannot read properties of null (reading 'useState')` out of tests
// that do nothing unusual. Which file loses varies between runs.
//
// It only ever bit a COLD cache, so it was invisible locally after the
// first run and permanent in CI, where every run is cold.
const BROWSER_OPTIMIZE = {
  include: [
    'react',
    'react-dom',
    'react-dom/client',
    'react/jsx-dev-runtime',
    'vitest-browser-react',
  ],
};

function browserProject(name, include, viewport) {
  return {
    optimizeDeps: BROWSER_OPTIMIZE,
    test: {
      name,
      globals: false,
      include,
      browser: {
        enabled: true,
        headless: true,
        // A French device. The app follows navigator.language on a first
        // launch (lib/locale.js), and headless chromium reports en-US;
        // every browser test was written against the French default the
        // app had before that rule and pins French copy, so the lane
        // runs as the phone those tests describe. A test that wants
        // English switches the language, as a learner would.
        provider: playwright({ contextOptions: { locale: 'fr-FR' } }),
        instances: [{ browser: 'chromium', ...(viewport ? { viewport } : {}) }],
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  // The one knob the native shell has, refused everywhere else (ADR
  // 0008). loadEnv merges process.env.VITE_* over the .env files —
  // exactly the path a Vercel dashboard variable takes, and how a
  // leftover one out-prioritised the tracked .env.production on
  // 2026-09-01. `mode !== 'native'` rather than `=== 'production'`: a
  // dev server carrying it would be just as wrong (dev is same-origin
  // through the proxy below), and vitest's mode `test` never sets it.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (mode !== 'native' && env.VITE_API_ORIGIN) {
    throw new Error(
      `VITE_API_ORIGIN=${env.VITE_API_ORIGIN} is set in mode "${mode}". The web build is ` +
      'same-origin by design (src/lib/origin.js, docs/adr/0008); the variable belongs to ' +
      '.env.native alone. Remove it from the environment and from the Vercel dashboard.',
    );
  }

  return {
  plugins: [
    react(),
    // ── 駅舎 — the installable app (plan 065) ──
    // The web build only: the native shell's WebView (custom scheme on
    // iOS) has no service worker and its assets ARE the bundle, and a
    // dev server serving yesterday's cache is a debugging trap, so the
    // plugin is off everywhere but a production web build. `prompt`,
    // not autoUpdate: a new worker waits until the learner taps the
    // ダイヤ改正 note (components/ui/UpdateToast.jsx) — a reload behind
    // their back mid-exam would race the exam draft.
    VitePWA({
      disable: mode !== 'production',
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        // The store name is the owner's to pick (plans/README.md, wave
        // 14); until then the app's own masthead.
        name: '日本語 — Apprendre le japonais',
        short_name: '日本語',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#100e13',       // --bg-panel, dark: the sumi chrome
        background_color: '#17151a',  // --bg-main, dark
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: '本日 — Today', short_name: '本日', url: '/today' },
          { name: 'かな — Kana', short_name: 'かな', url: '/kana' },
        ],
      },
      workbox: {
        // The app shell: code, styles, icons, the Latin faces. Never
        // public/sounds (4.8 MB), never the 716 KB streak sprite sheet,
        // and never the ~240 Noto slices — all three arrive on demand
        // and are kept by the runtime rules below.
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
        globIgnores: ['**/noto-*.woff2', '**/sprites/**'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // The SPA fallback must not swallow the proxied backend paths or
        // the static policy page.
        navigateFallbackDenylist: [/^\/api\//, /^\/kanjivg\//, /^\/exam-audio\//, /^\/privacy/],
        runtimeCaching: [
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
      },
    }),
  ],
  // The Noto slices are tiny and would be base64-inlined into the CSS
  // bundle under Vite's default 4 KB threshold — the opposite of the
  // on-demand loading the unicode-range split exists for.
  build: {
    assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
  },
  server: {
    // Vite does not read PORT on its own, and 5173 is only a default:
    // when two Claude Code sessions share this folder, the preview
    // system assigns a free port through the PORT env (autoPort in
    // .claude/launch.json) so the second session's dev server can
    // start at all. A CLI --port flag still wins over this (the
    // frontend-sounds launch entry passes one), and a plain
    // `npm run dev` with no PORT set lands on 5173 exactly as before.
    port: Number(process.env.PORT) || 5173,
    // Same three path families vercel.json proxies in production —
    // the app is same-origin everywhere, and dev mirrors prod.
    proxy: {
      '/api': 'http://localhost:8000',
      '/kanjivg': 'http://localhost:8000',
      '/exam-audio': 'http://localhost:8000'
    }
  },
  test: {
    // Two lanes on purpose. The node lane is what api.test.js has
    // always run in and must keep running in; the browser lane exists
    // for anything that needs a real DOM — focus management, heading
    // structure, computed styles under a media feature. A single
    // merged environment would make one of the two lie.
    //
    // Routing: a file named `*.browser.test.jsx` runs in the browser
    // lane (chromium via Playwright); everything else runs in the
    // node lane.
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          globals: false,
          include: ['src/**/*.test.{js,jsx}'],
          exclude: ['src/**/*.browser.test.{js,jsx}', 'src/**/*.phone.test.{js,jsx}'],
        },
      },
      browserProject('browser', ['src/**/*.browser.test.{js,jsx}']),
      // The phone lane. The browser lane runs at chromium's default
      // viewport and deliberately asserts no LAYOUT (see
      // AnalyzerScreen.responsive.browser.test.jsx); a file named
      // `*.phone.test.jsx` runs here instead, at 390×844 from the first
      // paint, so a rule under a max-width query can be read back with
      // getComputedStyle and a screen can be checked for horizontal
      // overflow. Config-level, not page.viewport() mid-test: a CDP
      // metrics change does not fire matchMedia's `change`
      // (useMediaQuery.browser.test.jsx), so a page that STARTS at
      // 390px is the only honest setup.
      browserProject('phone', ['src/**/*.phone.test.{js,jsx}'], { width: 390, height: 844 }),
    ],
  },
  };
});