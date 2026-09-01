/// <reference types="vitest/config" />
// Explicit import rather than the Node global: eslint.config.js gives
// every file browser globals only, and this config is the one file in
// src reach that legitimately runs in Node.
import process from 'node:process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';

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
          exclude: ['src/**/*.browser.test.{js,jsx}'],
        },
      },
      {
        // Vite config for THIS project. The optimizer that matters here is
        // the browser project's own -- a root-level optimizeDeps does not
        // reach it, which was verified the hard way.
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
        optimizeDeps: {
          include: [
            'react',
            'react-dom',
            'react-dom/client',
            'react/jsx-dev-runtime',
            'vitest-browser-react',
          ],
        },
        test: {
          name: 'browser',
          globals: false,
          include: ['src/**/*.browser.test.{js,jsx}'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});