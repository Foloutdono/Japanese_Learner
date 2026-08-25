/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
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