// The no-op `virtual:pwa-register` the test runs import.
//
// vite-plugin-pwa is off outside a production web build (vite.config.js),
// and main.jsx's `import { registerSW } from 'virtual:pwa-register'` then
// has nothing to resolve to. Nothing imports main.jsx in a test — but
// vitest's browser lanes run a Vite dev server rooted here, and the
// server warms up the root index.html, whose one <script> is main.jsx.
// Every warm-up logged a "Failed to resolve import" pre-transform error,
// 448 of them in a CI run, for a module no test ever calls.
//
// Aliased in for mode `test` alone, so a real build still gets the
// plugin's own module and the guard in main.jsx keeps its meaning.
export function registerSW() {
  return () => Promise.resolve();
}
