# Plan 001: Initialize the theme once, before first paint, instead of per-screen after it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 39511f8..HEAD -- frontend/index.html frontend/src/main.jsx frontend/src/components/ui/NavControls.jsx frontend/src/screens`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `39511f8`, 2026-08-25

## Why this matters

This app has a fully-built light theme and OS-preference detection, and
neither reaches the users they were written for. Three separate symptoms,
one root cause — theme initialization is scattered across screens and runs
*after* first paint instead of once, before it:

1. **A new user whose OS is in light mode sees a dark app.** The only code
   that reads `prefers-color-scheme` is `getInitialTheme()` in
   `NavControls.jsx`, and it only runs inside the `ThemeToggle` component —
   which is rendered on exactly one screen, `SettingsScreen`. Until the user
   finds Settings, every screen is dark. (Verified in a real browser: OS set
   to light, no saved theme, `--bg-main` resolved to `#17151a`.)
2. **Six screens never restore a saved theme at all.** A user who has chosen
   light mode and then hard-refreshes or deep-links into `/today`, `/exam`,
   `/exam/:id`, `/exam/:id/results`, `/daruma`, or `/storehouse` gets the dark
   default. `/today` is the app's primary daily-use screen.
3. **Every screen flashes dark before correcting itself.** The 19 screens
   that *do* restore the theme do it in a `useEffect`, which by definition
   runs after the first paint.

After this plan: one small blocking snippet resolves the theme before the
app bundle loads, all 19 duplicated effects are deleted, and the six missing
screens are fixed for free because none of them need the snippet any more.

## Current state

### The theme mechanism

- `frontend/src/index.css:18` — `:root { ... }` defines the **dark** palette.
  It is the default; there is no `[data-theme="dark"]` selector.
- `frontend/src/index.css:227` — `:root[data-theme="light"] { ... }` overrides
  it. Light mode therefore requires the `data-theme="light"` attribute to be
  present on `<html>`.
- The chosen theme is persisted in `localStorage` under the key `jp-theme`,
  with the values `'light'` or `'dark'`.

### `frontend/index.html` (full file, 12 lines)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>frontend</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

Note: the `lang="en"` attribute and the `<title>` are **out of scope for this
plan** — plan 002 handles both. Do not change them here.

### `frontend/src/main.jsx` (full file)

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

No theme handling at all today.

### `frontend/src/components/ui/NavControls.jsx:11-18`

```jsx
const THEME_KEY = 'jp-theme'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  const saved = window.localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}
```

### `frontend/src/components/ui/NavControls.jsx:89-97`

```jsx
export function ThemeToggle() {
  const { t } = useLang()
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])
```

Two problems with this effect beyond the timing: it is the *only* place
`prefers-color-scheme` is consulted, and it **writes to `localStorage` on
mount**, which silently converts a detected OS preference into an explicit
saved choice. After one visit to Settings, later OS theme changes are ignored
forever.

`ThemeToggle` is imported and rendered in exactly one place:
`frontend/src/screens/SettingsScreen.jsx:7` (import) and `:36` (render).

### The duplicated per-screen snippet

This exact effect appears in **19** screen files:

```jsx
  useEffect(() => {
    const saved = window.localStorage.getItem('jp-theme')
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])
```

Present in (with the line of the `setAttribute` call):

| File | Line |
|---|---|
| `frontend/src/screens/AuthScreen.jsx` | 22 |
| `frontend/src/screens/DeckDetailScreen.jsx` | 236 |
| `frontend/src/screens/DecksScreen.jsx` | 47 |
| `frontend/src/screens/DictionaryScreen.jsx` | 55 |
| `frontend/src/screens/GrammarScreen.jsx` | 76 |
| `frontend/src/screens/HomeScreen.jsx` | 69 |
| `frontend/src/screens/KanaScreen.jsx` | 93 |
| `frontend/src/screens/KanjiScreen.jsx` | 119 |
| `frontend/src/screens/LandingScreen.jsx` | 46 |
| `frontend/src/screens/PhraseAnalyzerScreen.jsx` | — |
| `frontend/src/screens/ProfileScreen.jsx` | — |
| `frontend/src/screens/ReadingComprehensionScreen.jsx` | — |
| `frontend/src/screens/ReadingScreen.jsx` | — |
| `frontend/src/screens/RewardsPreview.jsx` | — |
| `frontend/src/screens/SettingsScreen.jsx` | — |
| `frontend/src/screens/StatsScreen.jsx` | — |
| `frontend/src/screens/StudyScreen.jsx` | — |
| `frontend/src/screens/TranslationScreen.jsx` | — |
| `frontend/src/screens/VocabScreen.jsx` | — |

(Lines left blank are the ones you should locate yourself with the grep in
Step 3 — they were not all recorded when this plan was written, and line
numbers shift as you delete.)

**Absent from these 6** — this is symptom 2 above:
`TodayScreen.jsx`, `ExamScreen.jsx`, `ExamRunner.jsx`, `ExamResult.jsx`,
`DarumaScreen.jsx`, `StorehouseScreen.jsx`.

⚠️ **`DictionaryScreen.jsx` is indented with tabs, not spaces**, and its
`setAttribute` line is indented one level shallower than the others. A
whitespace-exact find-and-replace across all files will miss it. Handle that
file individually.

### Repo conventions

- Plain JS + JSX, no TypeScript. ES modules, 2-space indent (except
  `DictionaryScreen.jsx`, noted above).
- There is an existing precedent for a render-nothing component that syncs
  `<html>` attributes from state: `CosmeticTheme`, imported in
  `frontend/src/App.jsx:37` and rendered at `:103`. Its comment reads:
  *"Renders nothing — keeps `<html>`'s data-paper/-ring/-seal attributes in
  step with the equipped loadout."* This plan deliberately does **not** use
  that pattern for the initial theme, because a React component still renders
  after first paint — the whole point here is to beat first paint. The
  blocking script is the right tool. Mention this reasoning in your commit
  message so a future reader does not "consolidate" the two.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd frontend && npm install` | exit 0 |
| Lint | `cd frontend && npm run lint` | exit 0, no errors (18 pre-existing warnings are expected and fine) |
| Test | `cd frontend && npm test` | all pass |
| Build | `cd frontend && npm run build` | exit 0 |
| Dev server | `cd frontend && npm run dev` | serves on http://localhost:5173 |

## Scope

**In scope** (the only files you should modify):
- `frontend/index.html` (add the blocking script only — do NOT touch `lang` or `<title>`)
- `frontend/src/components/ui/NavControls.jsx`
- The 19 screen files listed above (delete the duplicated effect from each)

**Out of scope** (do NOT touch, even though they look related):
- `frontend/index.html`'s `lang="en"` attribute and `<title>frontend</title>`
  — plan 002 owns both. Changing them here creates a merge conflict.
- `frontend/src/App.jsx`'s `CosmeticTheme` and the `data-paper`/`data-ring`/
  `data-seal` cosmetic attributes — a different mechanism with a different
  lifetime; leave it entirely alone.
- The colour values in `frontend/src/index.css`. This plan changes *when* and
  *where* `data-theme` is set, never what either theme looks like.
- The 6 screens that lack the snippet — you are not adding it to them. They
  are fixed by the blocking script; adding the effect would re-introduce the
  duplication this plan removes.

## Git workflow

- Branch: `advisor/001-centralize-theme-init`
- Commit style is conventional commits, scoped — recent examples from
  `git log`: `fix(frontend): resolve 2 high-severity react-router advisories`,
  `fix(backend): bound count/limit query params with Query(ge=1, le=N)`.
  Use `fix(frontend): ...` here.
- One commit for the whole change is fine.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the pre-paint theme resolution to `index.html`

Insert this `<script>` into `<head>`, **after** the `<title>` line and before
`</head>`. It must be a plain (non-`module`, non-`defer`) inline script so it
executes synchronously before the browser paints anything.

```html
    <!-- Resolves the theme before first paint. Deliberately a blocking
         inline script and not a React component: anything that runs in
         React runs after the first paint, which is exactly the flash
         this exists to prevent. Keep the 'jp-theme' key and the
         light/dark values in step with components/ui/NavControls.jsx. -->
    <script>
      (function () {
        try {
          var saved = localStorage.getItem('jp-theme')
          var theme = (saved === 'light' || saved === 'dark')
            ? saved
            : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
          document.documentElement.setAttribute('data-theme', theme)
        } catch (e) {
          /* localStorage can throw in private-mode/blocked-cookie contexts.
             Falling through leaves the :root default (dark) in place, which
             is a working app, so there is nothing to recover here. */
        }
      })()
    </script>
```

Note it sets `data-theme` for **both** values, including `"dark"`. That is
intentional and is what makes `ThemeToggle` in Step 2 able to trust the
attribute as the single source of truth.

**Verify**: `cd frontend && npm run build` → exits 0.

### Step 2: Make `ThemeToggle` read the resolved attribute and stop writing on mount

In `frontend/src/components/ui/NavControls.jsx`:

Replace `getInitialTheme` (lines 13–18) with a version that reads the
attribute the Step 1 script already set, rather than re-deriving it:

```jsx
function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  // index.html's blocking script has already resolved saved-or-OS
  // preference onto <html data-theme> before React ever ran, so the
  // attribute is the source of truth. Falling back to the localStorage
  // read only covers the case where that script was blocked.
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  const saved = window.localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}
```

Then change `ThemeToggle` so it only persists on an actual user action, not
on mount. Replace the `useEffect` at lines 93–96 and the `handleClick` with:

```jsx
export function ThemeToggle() {
  const { t } = useLang()
  const [theme, setTheme] = useState(getInitialTheme)

  // Applies the theme, but only for changes made here. The initial
  // value is already on <html> (see index.html) — writing it back on
  // mount is what used to freeze a detected OS preference into an
  // explicit saved choice, so later OS changes stopped being honoured.
  function apply(next) {
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    window.localStorage.setItem(THEME_KEY, next)
  }

  const isDark = theme === 'dark'

  function handleClick() {
    apply(isDark ? 'light' : 'dark')
    playToggle()
  }
```

Delete the now-unused `useEffect`. If `useEffect` becomes an unused import in
this file, remove it from the import list too — `npm run lint` will tell you.

**Verify**: `cd frontend && npm run lint` → exit 0, no *errors*.

### Step 3: Delete the duplicated effect from all 19 screens

Find every remaining occurrence:

```bash
cd frontend && grep -rn "jp-theme" src/screens
```

For each file, delete the whole `useEffect` block (the `useEffect(() => {`
line through the `}, [])` line) shown in "Current state". Delete only that
block — these files contain other `useEffect` calls that must stay.

After deleting, check each file for a now-unused `useEffect` import; `npm run
lint` reports these as `no-unused-vars` errors, so a clean lint run is your
gate.

Remember `DictionaryScreen.jsx` uses tabs and shallower indentation.

**Verify**:
```bash
cd frontend && grep -rn "jp-theme" src/screens | wc -l
```
→ `0`.

```bash
cd frontend && grep -rn "jp-theme" src | sort
```
→ exactly one match: the `THEME_KEY` constant in
`src/components/ui/NavControls.jsx`.

**Verify**: `cd frontend && npm run lint` → exit 0, no errors.

### Step 4: Confirm the three symptoms are actually gone

Start the dev server (`cd frontend && npm run dev`) and check each in a
browser at http://localhost:5173. Use DevTools' rendering pane to emulate
`prefers-color-scheme`.

1. **OS light, no saved theme** → app renders light.
   Clear it first with `localStorage.removeItem('jp-theme')`, then reload.
   Confirm in the console:
   ```js
   getComputedStyle(document.documentElement).getPropertyValue('--bg-main').trim()
   ```
   → `#f6f1e4` (the light value). Before this plan it was `#17151a`.
2. **OS dark, no saved theme** → app renders dark; same check returns
   `#17151a`.
3. **Saved light, hard refresh** → set light via Settings, then hard-refresh.
   No dark flash before the light theme appears, and
   `document.documentElement.getAttribute('data-theme')` is `'light'`
   immediately.

Record what you observed for each of the three in your final summary — this
is manual verification, so be explicit about what you actually did.

### Step 5: Run the full gate

**Verify**: `cd frontend && npm run lint` → exit 0
**Verify**: `cd frontend && npm test` → all pass
**Verify**: `cd frontend && npm run build` → exit 0

## Test plan

No new automated tests. This repo's frontend test suite
(`frontend/src/lib/api.test.js`, run by `vitest`) is currently node-environment
only — there is no DOM/component test setup, and adding one is a larger
decision this plan will not make unilaterally. Verification is therefore:

- The greps in Step 3 (zero duplicated snippets remaining, exactly one
  `jp-theme` reference left in the codebase).
- The three manual browser checks in Step 4, which cover precisely the three
  symptoms in "Why this matters".
- `npm run lint`, `npm test`, `npm run build` all still passing.

If you find yourself wanting a regression test for this, note it as a
follow-up in your summary rather than adding a DOM test environment here.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd frontend && grep -rn "jp-theme" src/screens | wc -l` → `0`
- [ ] `cd frontend && grep -rn "jp-theme" src | wc -l` → `1` (the `THEME_KEY` constant only)
- [ ] `cd frontend && grep -c "prefers-color-scheme: light" index.html` → `1`
- [ ] `cd frontend && npm run lint` exits 0 with no errors
- [ ] `cd frontend && npm test` exits 0
- [ ] `cd frontend && npm run build` exits 0
- [ ] `frontend/index.html` still contains `lang="en"` and `<title>frontend</title>`, unchanged (plan 002 owns them)
- [ ] All three Step 4 browser checks pass and are documented in your summary
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `:root` / `:root[data-theme="light"]` structure in `index.css` does not
  match "Current state" — if dark is no longer the bare-`:root` default, the
  blocking script's fallback behaviour is wrong and the whole approach needs
  re-thinking, not patching.
- Any screen's copy of the snippet differs meaningfully from the excerpt
  (reads a different key, applies a different attribute, has extra logic in
  the same effect). Skip that one file, finish the rest, and report which
  file and how it differed.
- After Step 3, a screen visibly renders in the wrong theme — that would mean
  something other than the blocking script was depending on those effects,
  which contradicts this plan's core assumption.
- `npm run lint` reports more than the 18 pre-existing warnings, or any
  error, and the cause is not an unused `useEffect` import you can remove.

## Maintenance notes

- **The `jp-theme` key and the `light`/`dark` values now live in two places**:
  the inline script in `index.html` and `THEME_KEY` in `NavControls.jsx`. That
  duplication is unavoidable — the script must run before any module loads, so
  it cannot import a shared constant. The comment in Step 1 flags it; keep
  them in sync, and if a third theme is ever added, both must learn about it.
- A reviewer should scrutinize: that the Step 1 script is **not** `type="module"`
  and has no `defer`/`async` attribute. Any of those make it non-blocking and
  silently reintroduce the flash, which is invisible in code review and only
  shows up as a flicker on a slow load.
- Deliberately deferred: syncing `data-theme` when the OS preference changes
  *while the app is open* (a `matchMedia` change listener). It is a real gap,
  but it only affects users who have never made an explicit choice, and adding
  a listener raises a question this plan should not answer alone — whether an
  explicit choice should ever be overridden by an OS change. Worth a separate,
  small plan.
- Once this lands, `CosmeticTheme` in `App.jsx` is the only remaining
  `<html>`-attribute syncing mechanism, and it stays a React component
  correctly: cosmetics change *during* a session in response to state, so
  post-paint is the right time for them.
