# Plan 002: Give the document a correct `lang`, a real per-route `<title>`, and fix two locale gaps

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 39511f8..HEAD -- frontend/index.html frontend/src/LangContext.jsx frontend/src/config/navLinks.js frontend/src/components/dictionary/DictionaryDetail.jsx frontend/src/locales`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-centralize-theme-init.md (only to avoid a merge
  conflict — both plans edit `frontend/index.html`. Land 001 first, or rebase.)
- **Category**: bug
- **Planned at**: commit `39511f8`, 2026-08-25

## Why this matters

Three small, independent, user-visible defects in the document shell, all
verified in a real browser:

1. **`<html lang="en">` while the app's default language is French.** A screen
   reader picks its speech synthesizer from `lang`, so by default it reads
   French UI text with an English voice — largely unintelligible. The attribute
   is also never updated when the user switches language. WCAG 3.1.1 (Level A).
2. **`<title>` is still the Vite scaffold default, `"frontend"`.** Every
   browser tab, every bookmark, and every browser-history entry for this
   deployed app reads "frontend", and it is the first thing a screen reader
   announces on load. It is never set, and never varies by route.
3. **Two locale gaps that render wrong-language or blank text.** English users
   see a blank description on the Home card of the main nav, and see the French
   word "Exemples" in the dictionary panel.

None of these is hard. Together they are the difference between a shell that
looks unfinished and one that doesn't.

## Current state

### 1. `frontend/index.html` (full file, 12 lines)

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

If plan 001 has landed, this file will also contain a `<script>` block in
`<head>` that resolves the theme. Leave that block alone.

### 2. `frontend/src/LangContext.jsx` (full file)

```jsx
import { createContext, useContext, useState, useEffect } from 'react'
import { translations } from './i18n'
import { getTranslations } from './lib/translationCache'

const LangContext = createContext()

export function LangProvider({ children }) {
    const [lang, setLang]         = useState(localStorage.getItem('lang') || 'fr')
    const [contentMaps, setContentMaps] = useState({ kanji: {}, vocab: {} })

    useEffect(() => {
        getTranslations(lang).then(setContentMaps)
    }, [lang])

    function switchLang(code) {
        setLang(code)
        localStorage.setItem('lang', code)
    }

    const t = translations[lang] ?? translations.fr

    return (
    <LangContext.Provider value={{ lang, switchLang, t, contentMaps }}>
        {children}
    </LangContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components -- useLang is the standard companion hook for this Context; splitting it into its own file would ripple across every importer for no behavioral benefit.
export function useLang() {
    return useContext(LangContext)
}
```

Note the default is `'fr'`, and note this file is indented with **4 spaces**,
unlike most of the codebase. Match the file you are editing.

`document.documentElement.lang` is never assigned anywhere in `src/`
(confirmed: `grep -rn "documentElement.lang" src` returns nothing).

### 3. Route → title building blocks that already exist

`frontend/src/config/stations.js:111` exports `sectionFor(path, t)`, which
returns the localized section for a path — an object with a `title` — using a
longest-prefix match so nested routes like `/decks/<id>` still resolve. It
returns `null` for a path with no station, **including the identity routes**,
which is by design.

`frontend/src/config/identity.js:33` exports `identityFor(path, t)`, covering
exactly `/profile` and `/settings`, returning `{ path, glyph, title, sub }` or
`null`.

Together they cover every route. `frontend/src/components/ui/TopBar.jsx`
already uses exactly this pair the same way:

```jsx
  const identity = identityFor(pathname, t)
  const section = identity ? null : sectionFor(pathname, t)
```

`t.appTitle` is `'日本語'` in both locales (`frontend/src/locales/fr/index.js:3`
and `frontend/src/locales/en/index.js:3`).

### 4. The two locale gaps

**Gap A** — `frontend/src/config/navLinks.js:28`:

```jsx
    { icon: '家',   title: t.homeTitle,       desc: t.homeDesc,       path: '/', color: 'var(--accent8)', scope: 'home', showcase: false },
```

`homeDesc` exists in `fr` (`'Retour au menu principal'`) but **not** in `en`,
and there is no `??` fallback on this line. React renders `undefined` as
nothing, so an English user sees the Home card with an empty description.

**Gap B** — `frontend/src/components/dictionary/DictionaryDetail.jsx:516`:

```jsx
              {t.examples ?? 'Exemples'}
```

`examples` is missing from **both** locales, so the hardcoded fallback always
fires — and it is French. English users see "Exemples".

Compare with line 471 of the same file, which handles the identical situation
correctly and is the pattern to follow if you need one:

```jsx
              {t.senses ?? (lang === 'fr' ? 'Sens (JMdict)' : 'Senses (JMdict)')}
```

The locale files are flat objects of `key: 'string'` (plus some function
values for interpolated strings). Keys are grouped under `//` section comments.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd frontend && npm install` | exit 0 |
| Lint | `cd frontend && npm run lint` | exit 0, no errors (18 pre-existing warnings are fine) |
| Test | `cd frontend && npm test` | all pass |
| Build | `cd frontend && npm run build` | exit 0 |
| Dev server | `cd frontend && npm run dev` | serves on http://localhost:5173 |

## Scope

**In scope** (the only files you should modify):
- `frontend/index.html`
- `frontend/src/LangContext.jsx`
- `frontend/src/App.jsx` (add one render-nothing component; see Step 3)
- `frontend/src/locales/en/index.js`
- `frontend/src/locales/fr/index.js`
- `frontend/src/components/dictionary/DictionaryDetail.jsx`

**Out of scope** (do NOT touch, even though they look related):
- `frontend/src/config/stations.js` and `frontend/src/config/identity.js` —
  you are *calling* `sectionFor`/`identityFor`, never changing them.
- `frontend/src/components/ui/TopBar.jsx` — the on-screen title is already
  correct; this plan is about the *document* title. Do not refactor TopBar to
  share code with the new component; they have different lifetimes and the
  coupling is not worth it.
- The theme `<script>` block in `index.html` if plan 001 has landed.
- The ~40 other `t.X ?? 'literal'` sites across the codebase. They were
  audited: only the two named above ever actually fire, and the rest are dead
  defensive code. Removing them is a separate cleanup, not this plan.
- The 9 French-only keys with no consumers (`switchLang`, `readingHiragana`,
  `readingHiraganaDesc`, `readingKatakana`, `readingKatakanaDesc`,
  `readingMixed`, `readingMixedDesc`, `readingComprehensionFetchError`, and
  `homeDesc`'s siblings). They are dead, not broken. Do not delete them here.

## Git workflow

- Branch: `advisor/002-document-language-and-title`
- Commit style is conventional commits, scoped — recent examples from
  `git log`: `fix(frontend): resolve 2 high-severity react-router advisories`.
  Use `fix(frontend): ...`.
- One commit is fine, or one per step.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Change the static `lang` default to match the app's default

In `frontend/index.html`, change:

```html
<html lang="en">
```

to:

```html
<html lang="fr">
```

This is the correct static default because `LangContext` defaults to `'fr'`.
Step 2 makes it dynamic; this line is what applies before React runs.

**Verify**: `cd frontend && grep -c 'html lang="fr"' index.html` → `1`

### Step 2: Set a real default `<title>`

In the same file, change:

```html
    <title>frontend</title>
```

to:

```html
    <title>日本語 — Apprendre le japonais</title>
```

This is the pre-React default that shows during load and in a no-JS context.
Step 3 makes it per-route and localized.

**Verify**: `cd frontend && grep -c "<title>日本語" index.html` → `1`

### Step 3: Sync `lang` and `document.title` from the router

Add a render-nothing component to `frontend/src/App.jsx`. This app already
has exactly this pattern — `CosmeticTheme`, imported at `App.jsx:37` and
rendered at `:103`, whose comment reads *"Renders nothing — keeps `<html>`'s
data-paper/-ring/-seal attributes in step with the equipped loadout"*. Follow
it.

Add near the top of `App.jsx`, after the existing imports:

```jsx
import { useLocation } from 'react-router-dom'
import { sectionFor } from './config/stations'
import { identityFor } from './config/identity'
```

(`useLang` is already imported indirectly via `LangProvider`; you will need
`import { useLang } from './LangContext'` as well — check the existing import
line for `LangProvider` and extend it if they come from the same module.)

Then add the component:

```jsx
// Renders nothing — keeps <html lang> and document.title in step with
// the current route and language. Beside <Routes/> rather than inside
// it for the same reason DepartureGate is: every screen would otherwise
// need to remember to set its own title, and the six that forgot the
// theme snippet are the evidence for how that goes.
//
// The route's own title comes from the same pair TopBar uses —
// sectionFor for stations, identityFor for the two pass routes — so a
// new station added to stations.js gets a document title for free.
function DocumentHead() {
  const { t, lang } = useLang()
  const { pathname } = useLocation()

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  useEffect(() => {
    const identity = identityFor(pathname, t)
    const section = identity ? null : sectionFor(pathname, t)
    const screen = identity?.title ?? section?.title
    document.title = screen ? `${screen} — ${t.appTitle}` : t.appTitle
  }, [pathname, t])

  return null
}
```

Render it **inside** `<BrowserRouter>` (it calls `useLocation`, so it must be
within the router) and beside `<Routes>`, next to the existing
`<DepartureGate />` and `<TrainDoor />` at `App.jsx:142` and `:150`:

```jsx
        <DocumentHead />
```

⚠️ `App.jsx` has **three** separate return branches — the `/dev/rewards`
branch (~line 65), the `!session` branch (~line 87), and the main authenticated
branch (~line 97). Only the `/dev/rewards` branch and the main branch mount a
`<BrowserRouter>`; the `!session` branch renders `LandingScreen`/`AuthScreen`
with no router at all.

Add `<DocumentHead />` to the **main authenticated branch only**. For the
`!session` branch, the static `<title>` from Step 2 is already correct and no
component is needed — do not add a router there just to set a title.

The `lang` sync, however, matters on the unauthenticated screens too (the
landing page is the most-read French text in the app). Handle that by putting
the `lang` effect in `LangProvider` itself rather than in `DocumentHead`, since
`LangProvider` wraps all three branches. In `frontend/src/LangContext.jsx`,
add inside `LangProvider` (remember: **4-space indent** in this file):

```jsx
    // <html lang> drives which voice a screen reader uses. It has to
    // follow the UI language, not sit at the index.html default.
    useEffect(() => {
        document.documentElement.lang = lang
    }, [lang])
```

and then **remove** the `lang` effect from `DocumentHead`, leaving it
responsible for the title only.

**Verify**: `cd frontend && npm run lint` → exit 0, no errors.

### Step 4: Fix locale gap A — `homeDesc` missing in English

In `frontend/src/locales/en/index.js`, add a `homeDesc` key next to the
existing `homeTitle` key, matching the surrounding formatting:

```js
  homeDesc:          'Back to the main menu',
```

(French already has `homeDesc: 'Retour au menu principal'`.)

**Verify**:
```bash
cd frontend && node --input-type=module -e "const en=(await import('./src/locales/en/index.js')).default; console.log(JSON.stringify(en.homeDesc))"
```
→ prints the English string, not `undefined`.

### Step 5: Fix locale gap B — `examples` missing in both locales

Add an `examples` key to **both** locale files, near the other dictionary
keys:

- `frontend/src/locales/fr/index.js`: `examples:          'Exemples',`
- `frontend/src/locales/en/index.js`: `examples:          'Examples',`

Then in `frontend/src/components/dictionary/DictionaryDetail.jsx:516`, replace:

```jsx
              {t.examples ?? 'Exemples'}
```

with:

```jsx
              {t.examples}
```

The `??` fallback is no longer needed once the key exists in both locales, and
leaving a French literal as the fallback is what caused the bug.

**Verify**:
```bash
cd frontend && node --input-type=module -e "const fr=(await import('./src/locales/fr/index.js')).default, en=(await import('./src/locales/en/index.js')).default; console.log(fr.examples, '/', en.examples)"
```
→ prints `Exemples / Examples`.

### Step 6: Confirm in a browser

Start the dev server (`cd frontend && npm run dev`) and check:

1. On first load, `document.documentElement.lang` is `'fr'` and
   `document.title` is not `"frontend"`.
2. Switch the language to English in Settings. Confirm
   `document.documentElement.lang` becomes `'en'` **without a reload**.
3. Navigate between two screens (e.g. `/kana` → `/vocab`) and confirm the
   browser tab title changes to match each screen.
4. Visit `/profile` and confirm the title uses the identity route's title
   rather than falling back to the bare app name.
5. With the language set to English, confirm the Home card in the nav shows a
   description rather than a blank, and the dictionary detail panel shows
   "Examples" rather than "Exemples".

Document what you observed for each in your final summary.

### Step 7: Run the full gate

**Verify**: `cd frontend && npm run lint` → exit 0
**Verify**: `cd frontend && npm test` → all pass
**Verify**: `cd frontend && npm run build` → exit 0

## Test plan

No new automated tests. The frontend suite (`vitest`, currently just
`src/lib/api.test.js`) runs in a node environment with no DOM, so
`document.title` / `documentElement.lang` assertions are not expressible
without introducing a DOM test environment — a decision outside this plan.

Verification is the two `node --input-type=module` locale assertions in Steps
4–5, the greps in Steps 1–2, the five manual browser checks in Step 6, and the
standing lint/test/build gate.

Note as a follow-up in your summary (do not act on it here): a locale-parity
test — one that asserts the `fr` and `en` key sets match — would have caught
both of these gaps automatically and would be cheap to write in the existing
node test environment, since it only needs to import the two modules.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd frontend && grep -c 'html lang="fr"' index.html` → `1`
- [ ] `cd frontend && grep -c "<title>frontend</title>" index.html` → `0`
- [ ] `cd frontend && grep -rc "documentElement.lang" src/LangContext.jsx` → `1`
- [ ] `cd frontend && grep -rn "document.title" src/App.jsx | wc -l` → `1`
- [ ] `cd frontend && node --input-type=module -e "const en=(await import('./src/locales/en/index.js')).default; if(!en.homeDesc||!en.examples) process.exit(1)"` → exits 0
- [ ] `cd frontend && node --input-type=module -e "const fr=(await import('./src/locales/fr/index.js')).default; if(!fr.examples) process.exit(1)"` → exits 0
- [ ] `cd frontend && grep -c "t.examples ?? 'Exemples'" src/components/dictionary/DictionaryDetail.jsx` → `0`
- [ ] `cd frontend && npm run lint` exits 0 with no errors
- [ ] `cd frontend && npm test` exits 0
- [ ] `cd frontend && npm run build` exits 0
- [ ] All six Step 6 browser checks pass and are documented in your summary
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `sectionFor` or `identityFor` no longer has the signature in "Current state"
  (`(path, t)` returning an object with `title`, or `null`) — the title
  derivation in Step 3 depends on it exactly.
- `App.jsx` no longer has the three-branch structure described in Step 3.
  Getting `<DocumentHead />` into a branch with no `<BrowserRouter>` will throw
  at runtime (`useLocation` outside a router), so if the structure has changed,
  report it rather than guessing which branch is right.
- Adding the `useEffect` to `LangProvider` trips the
  `react-hooks/set-state-in-effect` lint rule. It should not — the effect sets
  a DOM property, not React state — but this repo has that rule enabled and
  strict (see the many `eslint-disable` comments referencing it). If it does
  fire, report the exact message rather than adding a disable comment.
- `t.appTitle` is not `'日本語'` in both locales, which would make the title
  format in Step 3 wrong.

## Maintenance notes

- **A new route gets a document title for free** as long as it is registered in
  `stations.js`'s section registry or `identity.js`'s `ROUTES`. A route in
  neither falls back to the bare app name — acceptable, and better than a
  stale title, but worth knowing when adding a route and wondering why its tab
  says only 日本語.
- A reviewer should scrutinize: that the `lang` effect ended up in
  `LangProvider` and **not** in `DocumentHead`. `DocumentHead` only mounts in
  the authenticated branch, so a `lang` sync living there would silently not
  apply to the landing and auth screens — which are the screens an
  unauthenticated screen-reader user actually meets first.
- Deliberately deferred: a `<meta name="description">`, Open Graph tags, and
  anything else SEO-shaped for the public landing page. Real, but a different
  concern from document accessibility, and it needs product input on the copy.
- Deliberately deferred: the locale-parity test described in "Test plan". It
  is the durable fix for this whole class of bug and should be its own small
  plan.
