/// <reference types="vitest/config" />
// Explicit import rather than the Node global: eslint.config.js gives
// every file browser globals only, and this config is the one file in
// src reach that legitimately runs in Node.
import process from 'node:process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
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

export default defineConfig({
  plugins: [react()],
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
});