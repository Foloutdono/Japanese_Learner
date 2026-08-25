# Plan 008: Stand up a browser test environment, proven with the `useDialog` test

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a3c6597..HEAD -- frontend/package.json frontend/vite.config.js frontend/src/hooks/useDialog.js`
> On any mismatch with the "Current state" excerpts, treat it as a STOP
> condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (adds a test lane; touches no application source)
- **Depends on**: none
- **Category**: dx / tests
- **Planned at**: commit `a3c6597`, 2026-08-25

## Why this matters

This is the keystone follow-up. **Five of the seven plans in the first UI/UX
backlog deferred a test to "once a DOM test environment exists."** Plans 002,
003, 004, 006, and 007 each identified a specific, valuable regression test and
each had to settle for manual verification instead. Manual verification is also
what repeatedly failed in practice: several plans could not be live-verified at
all and fell back to code review.

The tooling is **already installed and completely unused**:

- `playwright@1.61.1` — in `devDependencies`
- `@vitest/browser-playwright@4.1.10` — in `devDependencies`
- `vitest@4.1.10` — configured for `environment: 'node'` only

So the gap is configuration, not procurement.

This plan deliberately does **not** write all five deferred tests. It stands up
the environment and proves it with exactly one — `useDialog` — chosen because
it is the most self-contained (a hook with no network, no router, no auth) and
because plan 004 explicitly named it as "exactly the kind of unit that *is*
testable once a DOM environment exists." Once this lands, the other four
deferred tests become small independent follow-ons rather than blocked work.

## Current state

### `frontend/vite.config.js` (full file)

```js
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  },
  test: {
    environment: 'node',
    globals: false,
  },
});
```

### `frontend/package.json` — the relevant parts

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "@vitest/browser-playwright": "^4.1.10",
    "@vitest/coverage-v8": "^4.1.10",
    "playwright": "^1.61.1",
    "vitest": "^4.1.10"
  }
```

There is **no** `@testing-library/react`, no `jsdom`, no `happy-dom`, and no
`vitest-browser-react`.

### The one existing test

`frontend/src/lib/api.test.js` — the only test file in the repo. It is a
node-environment test (no DOM), and it must keep passing unchanged. Read it
before starting to match its style (plain `describe`/`it`, explicit imports —
`globals: false` means no ambient `describe`/`expect`).

### The provider API, confirmed against the installed package

`node_modules/@vitest/browser-playwright/dist/index.d.ts:47` declares:

```ts
declare function playwright(options?: PlaywrightProviderOptions): BrowserProviderOption<PlaywrightProviderOptions>;
```

and line 123 exports it: `export { PlaywrightBrowserProvider, playwright };`

So the provider is a **called function**, imported by name:

```js
import { playwright } from '@vitest/browser-playwright'
// ...
provider: playwright(),
```

⚠️ This differs from older Vitest versions, where `provider` was the string
`'playwright'`. Do not use the string form — it will not work with 4.1.10.
The surrounding config shape (`browser.enabled`, `browser.instances`) is
inferred from this version's types; **verify it against the installed
package's own types/docs** rather than trusting this plan, and report if it
differs (see STOP conditions).

### The subject under test — `frontend/src/hooks/useDialog.js`

Landed by plan 004. Read the whole file before writing the test. Its contract:

- Returns a ref to attach to the **dialog panel**.
- On mount: records `document.activeElement`, then focuses the first focusable
  descendant (or the panel itself, with `tabindex="-1"`, if there are none).
- While mounted: `Escape` calls `onClose()`; `Tab`/`Shift+Tab` wrap focus
  within the panel.
- On unmount: removes the listener and restores focus to the recorded element
  **only if** focus is currently on `document.body` or nowhere.

Its `FOCUSABLE` selector, verbatim from the file:

```js
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')
```

Note the Tab-wrap handler also filters by `el.offsetParent !== null` (visible
elements only) — a test fixture must therefore render **actually visible**
elements, not `display: none` ones, or the trap will see zero items and no-op.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd frontend && npm install` | exit 0 |
| Install browsers | `cd frontend && npx playwright install chromium` | downloads/verifies chromium |
| Test (all) | `cd frontend && npm test` | all pass |
| Lint | `cd frontend && npm run lint` | exit 0, 18 pre-existing warnings, 0 errors |
| Build | `cd frontend && npm run build` | exit 0 |

## Scope

**In scope** (the only files you should create or modify):
- `frontend/vite.config.js`
- `frontend/package.json` (scripts and/or one new devDependency — see Step 2)
- `frontend/package-lock.json` (regenerated by npm)
- `frontend/src/hooks/useDialog.browser.test.jsx` (create)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- **Any application source file.** This plan adds a test lane. If a test fails
  because of a genuine bug in `useDialog`, **report it — do not fix it here.**
  That is a separate, reviewable change.
- `frontend/src/lib/api.test.js` — it must keep passing untouched. If the
  config change breaks it, that is a STOP condition, not a file to edit.
- The other four deferred tests (locale parity, per-screen headings,
  reduced-motion smoke, visual regression). Each is its own follow-on. Landing
  five tests at once makes the config change unreviewable.
- Any CI workflow. There is no `.github/workflows` in this repo currently;
  wiring the new lane into CI is a separate decision.

## Git workflow

- Branch: `advisor/008-browser-test-environment`
- Conventional commits, scoped. Use `test(frontend): ...` or `chore(test): ...`.
- Commit the config change separately from the test file, so a reviewer can
  see the environment stand up on its own.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm the baseline before changing anything

```bash
cd frontend && npm test
```

**Verify**: 1 test file, 5 tests, all passing. Record the exact numbers — this
is the "must not regress" baseline for Step 4.

### Step 2: Decide and install the React rendering helper

The `useDialog` test needs to render a React component into a real DOM. Two
viable options:

1. **`vitest-browser-react`** — the Vitest-browser-native renderer. Pairs
   directly with browser mode and needs no extra DOM shim.
2. **`@testing-library/react`** — the widely-known option; works in browser
   mode too.

**Recommended: `vitest-browser-react`**, because this repo is standing up
Vitest browser mode specifically, and it avoids pulling in the Testing Library
ecosystem for a single test. Install whichever you choose as a
`devDependency` and say which and why in your summary.

If neither installs cleanly against the pinned versions, that is a STOP
condition — report the resolution error rather than downgrading `vitest`.

**Verify**: `cd frontend && npm install` → exit 0, and the chosen package
appears in `package.json`'s `devDependencies`.

### Step 3: Configure a two-project test setup

The existing node test and the new browser test need different environments,
so they must be separate Vitest projects rather than one merged config. Keep
`api.test.js` on node; put browser tests on chromium.

Target shape for `frontend/vite.config.js` (adapt to the installed version's
actual API — verify, don't assume):

```js
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
```

The `*.browser.test.jsx` naming convention is what routes a file to the browser
lane. State it in a comment so it is discoverable.

Install the browser binary:

```bash
cd frontend && npx playwright install chromium
```

**Verify**: `cd frontend && npm test` → the node lane still reports **5 passing
tests** (matching Step 1's baseline), and the browser lane runs with 0 tests
(no browser test files exist yet) rather than erroring.

### Step 4: Write the `useDialog` test

Create `frontend/src/hooks/useDialog.browser.test.jsx`.

Render a fixture that mirrors the real usage shape — a scrim div wrapping a
panel div carrying the ref, with **three visible buttons** inside (visible
matters; see "Current state" on the `offsetParent` filter):

Cover exactly these four behaviours, one `it` each:

1. **Focus moves into the dialog on mount** — after render,
   `document.activeElement` is the first button in the panel.
2. **Escape calls `onClose`** — dispatch a `keydown` with `key: 'Escape'` on
   `window`; assert the `onClose` spy was called once.
3. **Tab wraps from last to first** — focus the last button, dispatch a `Tab`
   keydown, assert `document.activeElement` is the first button. Then focus the
   first, dispatch `Shift+Tab`, assert it lands on the last.
4. **Unmount restores focus to the opener** — render a button outside the
   dialog, focus it, mount the dialog, unmount it, assert focus returned to
   that outside button.

⚠️ For test 4, note the hook only restores focus when
`document.activeElement` is falsy or `document.body`. After unmount the panel
is gone, so focus naturally falls to `body` — but if your rendering helper
leaves focus elsewhere, the restore will (correctly) not fire. If test 4 fails
for that reason, that is a **test-fixture** problem, not a hook bug; adjust the
fixture, and say so in your summary rather than changing the hook.

Match `api.test.js`'s import style — `globals: false` means you must import
`describe`, `it`, `expect`, and `vi` explicitly from `vitest`.

**Verify**: `cd frontend && npm test` → node lane 5 passing (unchanged),
browser lane 4 passing.

### Step 5: Run the full gate

**Verify**: `cd frontend && npm test` → all pass, both lanes
**Verify**: `cd frontend && npm run lint` → exit 0, 0 errors, 18 warnings
**Verify**: `cd frontend && npm run build` → exit 0

Lint matters here: `eslint.config.js` may not know about test globals in the
new file. If it reports `no-undef` for test functions, prefer explicit imports
(which `globals: false` requires anyway) over adding a globals override.

## Test plan

- **New**: `frontend/src/hooks/useDialog.browser.test.jsx` — 4 tests, listed in
  Step 4. These are the first tests in this repo that exercise real DOM
  behaviour.
- **Unchanged**: `frontend/src/lib/api.test.js` — 5 tests, must still pass in
  the node lane. A change in its result is a STOP condition.
- Verification: `npm test` reports both lanes green, with the node lane's count
  exactly matching Step 1's baseline.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd frontend && npm test` exits 0, node lane count matches the Step 1 baseline, browser lane reports 4 passing
- [ ] `cd frontend && grep -c "browser" vite.config.js` → at least `1`
- [ ] `frontend/src/hooks/useDialog.browser.test.jsx` exists
- [ ] `cd frontend && grep -c "@vitest/browser-playwright" vite.config.js` → `1`
- [ ] `cd frontend && grep -c "provider: 'playwright'" vite.config.js` → `0` (the string form is wrong for 4.1.10)
- [ ] `cd frontend && npm run lint` exits 0 with 0 errors
- [ ] `cd frontend && npm run build` exits 0
- [ ] `git status` shows no application source file modified (only config, lockfile, the new test, and `plans/README.md`)
- [ ] `plans/README.md` status row for 008 updated

## STOP conditions

Stop and report back (do not improvise) if:

- **A `useDialog` test fails in a way that indicates a real bug in the hook.**
  Report the exact failing assertion and what it implies. Do not fix
  `useDialog` here — this plan must not change application behaviour, and a
  hook fix deserves its own review. (This is the single most valuable possible
  outcome of this plan; do not paper over it by loosening the assertion.)
- `frontend/src/lib/api.test.js` stops passing, or its test count changes. The
  node lane must be untouched by this work.
- The Vitest 4.1.10 browser config API differs from Step 3's shape. Report the
  actual required shape from the installed package's types rather than
  guessing across versions.
- `npx playwright install chromium` cannot download a browser (sandboxed or
  offline environment). Report it — the config can still land and be verified
  by a human with network access, but say clearly that the browser lane was
  never actually executed.
- Standing up browser mode requires downgrading or upgrading `vitest`,
  `vite`, or `playwright`. Version churn on the build toolchain is a bigger
  decision than this plan.

## Maintenance notes

- **The naming convention is load-bearing**: `*.browser.test.jsx` routes to the
  browser lane, everything else to node. A test needing a DOM but named
  `*.test.js` will run in node and fail confusingly. The comment in Step 3's
  config is what makes this discoverable.
- A reviewer should scrutinize: that the node lane's test count is *identical*
  to before. It is easy for a project-based config to accidentally include or
  exclude the wrong files, and the symptom (a test silently not running) looks
  exactly like success.
- **This unblocks four follow-ons**, each now cheap and independent:
  per-screen heading structure (plan 003's deferral), reduced-motion settle
  smoke test (plan 007's deferral), visual regression snapshots at 560/768
  (plan 006's deferral), and `App.jsx` mount smoke (plan 009's original note).
  Do not write them here; land the environment first.
- Playwright can emulate `prefers-reduced-motion` and `prefers-color-scheme`
  directly via `contextOptions`. That is what makes plan 007's and plan 001's
  deferred tests possible — worth knowing when picking those up.
