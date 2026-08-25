# Plan 003: Give every screen a real heading hierarchy, a `<main>` landmark, and a skip link

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 39511f8..HEAD -- frontend/src/components/station/StationSign.jsx frontend/src/components/selection/SelectionScreen.jsx frontend/src/components/ui/SectionHeader.jsx frontend/src/screens frontend/src/index.css`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MED (visual regression is the real risk, not logic — see Step 1's CSS note)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `39511f8`, 2026-08-25

## Why this matters

This 25-screen application contains **seven** heading elements in total across
121 JSX files: one `<h1>`, two `<h2>`, one `<h3>`, three `<h4>`, spread over
four files. `role="heading"` is used nowhere. Verified in a browser: the entire
landing page exposes exactly one heading; every section title, every feature
card title, every screen title renders as a `generic` node.

The practical consequence: screen-reader users navigate long pages by jumping
between headings — it is the primary navigation mechanism, the equivalent of
scanning a page with your eyes. In this app there is nothing to jump to. No
screen announces its own name. Combined with the absence of a `<main>` landmark
on 23 of 25 screens and no skip link, a keyboard or screen-reader user tabs
through the burger menu and top bar on every single navigation, with no way to
skip ahead and no structural signposts once they arrive. This is WCAG 1.3.1
(Level A, Info and Relationships) and 2.4.6 (Level AA, Headings and Labels).

What makes this worth fixing rather than merely worth noting: **the intent is
already in the code, only the markup is missing.** `SectionHeader`'s own
comment says the count is a separate slot *"so it can be typeset as data
(tracked, tabular) while the title stays a heading"* — and then renders the
title as a `<span>`. `SelectionScreen` takes a prop literally named `heading`
and renders it into a `<div>`. The design already knows what these elements
are. This plan makes the DOM agree.

The leverage is high because the titles are centralized: three shared
components cover 17 of 25 screens.

## Current state

### The three shared title components

**`frontend/src/components/station/StationSign.jsx:37-53`** — the 駅名標 plate.
This is the screen's own name, and it is rendered on 17 screens (via
`StationHeader` on 7, via `SelectionScreen` on 10):

```jsx
    <div className={`station-sign station-sign--${size}`} style={{ '--line-color': color }}>
      <div className="station-sign__head">
        <div className="station-sign__names">
          ...
            <span className="station-sign__roundel" aria-hidden="true">{station.code}</span>
          <span className="station-sign__stack">
            <span className="station-sign__kana" lang="ja">{station.kana}</span>
            <span className="station-sign__name" lang="ja">{name}</span>
            {latin && <span className="station-sign__romaji">{latin}</span>}
```

**`frontend/src/components/selection/SelectionScreen.jsx:129-133`** — the
fallback header used when a screen has no station plate:

```jsx
        ) : (eyebrow || heading || subtitle) && (
          ...
            {heading && <div className="selector-header__title">{heading}</div>}
            {subtitle && <div className="selector-header__subtitle">{subtitle}</div>}
```

**`frontend/src/components/ui/SectionHeader.jsx:20-31`** — used at 24 call
sites, the in-page section divider:

```jsx
export function SectionHeader({ jp, title, count }) {
  return (
    <div className={`section-header${jp ? ' section-header--paired' : ''}`}>
      <div className="section-header__mark">
        {jp && <span className="section-header__jp" lang="ja">{jp}</span>}
        <span className="section-header__title">{title}</span>
      </div>
      {count != null && <div className="section-header__count">{count}</div>}
      <div className="section-header__rule" />
    </div>
  )
}
```

### Which screen renders which masthead

| Group | Masthead | Screens |
|---|---|---|
| A | `<StationHeader>` (→ `StationSign`) | `DarumaScreen`, `DeckDetailScreen`, `DecksScreen`, `DictionaryScreen`, `StatsScreen`, `StorehouseScreen`, `TodayScreen` |
| B | `<SelectionScreen>` (→ `StationSign` **or** `.selector-header__title`) | `ExamScreen`, `GrammarScreen`, `KanaScreen`, `KanjiScreen`, `ReadingComprehensionScreen`, `ReadingScreen`, `StudyScreen`, `TranslationScreen`, `VocabScreen` |
| C | Neither — bespoke markup | `AuthScreen`, `HomeScreen`, `LandingScreen`, `ExamResult`, `ExamRunner`, `PhraseAnalyzerScreen`, `ProfileScreen`, `RewardsPreview`, `SettingsScreen` |

Groups A and B (17 screens) are fixed entirely by editing the shared
components in Step 1. Group C needs a per-screen sweep (Step 4).

Several Group B screens render `<SelectionScreen>` more than once (e.g.
`VocabScreen` five times). These are **sequential views** — level picker, then
mode picker, then the quiz — not simultaneous, so only one is mounted at a
time. Do not try to "fix" the multiple-`h1` that isn't happening.

### Why the CSS risk is small, and where it isn't

Every class you will convert already sets `font-family`, `font-weight`,
`font-size`, and `line-height` explicitly, so the UA's heading typography is
fully overridden already:

- `frontend/src/index.css:1328` — `.station-sign__name` (font-size `2.5rem`)
- `frontend/src/index.css:479` — `.selector-header__title` (font-size `2.4rem`)
- `frontend/src/index.css:805` — `.section-header__title` (font-size clamped)

The **only** UA styles that will actually leak through are:

1. **`margin`** — headings get block margins; `<span>`/`<div>` do not. You must
   add `margin: 0` to each converted class. This is the one that will visibly
   break layout if missed.
2. **`display`** — a `<span>` is inline, a heading is block. This matters only
   where the parent is not a flex/grid container. Checked for you:
   `.station-sign__stack` (`index.css:1295`) is `display: flex; flex-direction:
   column`, so its children are blockified either way and the `<span>` →
   `<h1>` swap is layout-neutral there. Verify the same for any element you
   convert in Group C.

### Landmarks and skip link

`<main>` appears in exactly two files: `frontend/src/screens/HomeScreen.jsx:180`
and `frontend/src/screens/LandingScreen.jsx:73`. No skip link exists anywhere
(`grep -rni "skip" src` finds nothing relevant).

`LandingScreen` is the best-structured screen in the app and is the exemplar to
follow — it already uses `<header>` (`:64`), `<main>` (`:73`), `<section>`
(`:76`), `<footer>` (`:137`), and a real `<h1>` (`:66`).

### Repo conventions

- Plain JS + JSX, no TypeScript. 2-space indent (except `DictionaryScreen.jsx`
  and `LangContext.jsx`, which use tabs and 4 spaces respectively).
- Components are function declarations with named exports.
- Comments in this codebase explain *why*, often at length, and are a genuine
  asset. When you change a component's element type, extend its existing
  comment rather than replacing it — `SectionHeader`'s comment in particular
  already claims the title is a heading, so it should now be accurate rather
  than aspirational.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd frontend && npm install` | exit 0 |
| Lint | `cd frontend && npm run lint` | exit 0, no errors (18 pre-existing warnings are fine) |
| Test | `cd frontend && npm test` | all pass |
| Build | `cd frontend && npm run build` | exit 0 |
| Dev server | `cd frontend && npm run dev` | serves on http://localhost:5173 |
| Count headings | `cd frontend && grep -roE "<h[1-6][ >]" src --include=*.jsx \| wc -l` | rises from 7 |

## Scope

**In scope** (the only files you should modify):
- `frontend/src/components/station/StationSign.jsx`
- `frontend/src/components/selection/SelectionScreen.jsx`
- `frontend/src/components/ui/SectionHeader.jsx`
- `frontend/src/index.css` (margin resets and the skip-link styles only)
- The nine Group C screen files listed above
- `frontend/src/components/ui/TopBar.jsx` (skip-link target only — see Step 3)

**Out of scope** (do NOT touch, even though they look related):
- **`TopBar`'s `.top-bar__title`** (`TopBar.jsx`, styled at `index.css:3668`).
  It stays a `<span>`. It is persistent chrome that repeats on every screen,
  not the page's own heading — making it an `<h1>` would put a heading in the
  navigation bar and give screens two competing `<h1>`s. This is a deliberate
  decision, not an oversight; do not "finish the job" by converting it.
- Any change to what a title *says*. This plan changes element types and adds
  landmarks. Copy changes are a different concern.
- Colour, spacing, or font changes beyond the `margin: 0` resets Step 1
  requires. If a conversion looks visually off, the fix is a margin/display
  reset, not a redesign.
- `aria-label` / `aria-labelledby` wiring on the modals — plan 004 owns that.
- The `station-sign__kana` and `station-sign__romaji` spans. Only the
  `__name` becomes a heading; the reading and the romaji are alternate
  renderings of the same name, and marking all three as headings would
  announce every screen title three times.

## Git workflow

- Branch: `advisor/003-heading-hierarchy-and-landmarks`
- Commit style is conventional commits, scoped — recent examples from
  `git log`: `fix(frontend): resolve 2 high-severity react-router advisories`.
  Use `fix(a11y): ...` for these.
- **Commit per step**, not one big commit — Step 4's per-screen sweep is much
  easier to review and to bisect if it is its own commit.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Convert the three shared components

Apply the heading level rule:

- **`<h1>`** — the screen's own name (one per screen).
- **`<h2>`** — an in-page section divider.

**1a. `StationSign.jsx`** — change the `__name` span to an `<h1>`:

```jsx
            <h1 className="station-sign__name" lang="ja">{name}</h1>
```

Add to the component's existing comment block a line explaining that the
station name is the screen's `<h1>` because the plate *is* how this app names
the screen you are on.

**1b. `SelectionScreen.jsx:132`** — change the heading div to an `<h1>`:

```jsx
            {heading && <h1 className="selector-header__title">{heading}</h1>}
```

**1c. `SectionHeader.jsx`** — change the title span to an `<h2>`:

```jsx
        <span className="section-header__title">{title}</span>
```
becomes
```jsx
        <h2 className="section-header__title">{title}</h2>
```

**1d. Add the margin resets** in `frontend/src/index.css`, to each of the three
existing rule blocks (do not create new blocks):

- `.station-sign__name` at `index.css:1328` → add `margin: 0;`
- `.selector-header__title` at `index.css:479` → add `margin: 0;`
- `.section-header__title` at `index.css:805` → add `margin: 0;`

**Verify**: `cd frontend && npm run build` → exits 0.

**Verify**: `cd frontend && npm run lint` → exit 0, no errors.

**Verify visually** — start the dev server and load a Group A screen and a
Group B screen. Compare against `git stash` / unstash if you need a
before-and-after. The plate and the section dividers must look *identical* to
before. If anything shifted, it is a margin you missed, not a reason to change
the design.

### Step 2: Confirm Groups A and B now have exactly one `<h1>`

With the dev server running, open a Group A screen (e.g. `/decks`) and a Group
B screen (e.g. `/kana`) and run in the browser console:

```js
JSON.stringify({
  h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()),
  h2: [...document.querySelectorAll('h2')].map(h => h.textContent.trim()),
})
```

Expected: exactly one `h1` naming the screen, and one `h2` per visible section
divider. If a screen shows **two** `h1`s, report it (see STOP conditions) —
that would mean a screen renders both a `StationSign` and a
`selector-header__title` at once, which contradicts this plan's model.

### Step 3: Add the skip link and the `<main>` landmark to the shared chrome

**3a.** In `frontend/src/components/ui/TopBar.jsx`, add a skip link as the very
first element inside the returned fragment, before the `<div className="top-bar">`:

```jsx
      {/* First thing in the tab order on every screen that has chrome.
          Visually hidden until focused — see .skip-link in index.css.
          Targets #main-content, which each screen's <main> carries. */}
      <a href="#main-content" className="skip-link">{t.skipToContent}</a>
```

Add the `skipToContent` key to both locale files:
- `frontend/src/locales/fr/index.js`: `skipToContent:     'Aller au contenu',`
- `frontend/src/locales/en/index.js`: `skipToContent:     'Skip to content',`

**3b.** Add the skip-link styles to `frontend/src/index.css`. Place them near
the top, with the other utility classes around `index.css:770` (`/* ── Utility
classes ── */`):

```css
/* Visually hidden until focused, then pinned to the top-left. The one
   control in the app that must be reachable before anything else and
   invisible until it is. */
.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 100;
  padding: 10px 16px;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--accent2);
  border-radius: 0 0 8px 0;
  text-decoration: none;
}
.skip-link:focus {
  left: 0;
}
```

**3c.** Give each screen's main content region a `<main id="main-content">`.
For Group A and B screens, the cleanest place is the container the screen
already renders its body into, immediately after the masthead. Convert the
existing wrapper `<div>` rather than adding a new nesting level — e.g. a
screen with `<div className="stats-container">` becomes
`<main id="main-content" className="stats-container">`.

`HomeScreen.jsx:180` and `LandingScreen.jsx:73` already have a `<main>`; just
add `id="main-content"` to each.

**Verify**: `cd frontend && grep -rc "id=\"main-content\"" src/screens/*.jsx | grep -c ":0$"` → `0`
(every screen file has at least one).

**Verify** in a browser: load any screen, press Tab once from the address bar,
and confirm the skip link appears. Press Enter and confirm focus moves past the
navigation.

### Step 4: Sweep the nine Group C screens

These screens have bespoke markup and need individual attention. For each, add
exactly one `<h1>` naming the screen, and `<h2>` for any in-page section title
currently rendered as a `div`/`span`:

| Screen | Note |
|---|---|
| `LandingScreen.jsx` | Already has `<h1>` at `:66`, `<main>` at `:73`. Only needs its **section titles** → `<h2>` and its **feature-card titles** (`.landing-feature__title`, `:86`) → `<h3>`. Add `margin: 0` to those classes. |
| `HomeScreen.jsx` | Has `<main>` at `:180`. Needs an `<h1>`. |
| `AuthScreen.jsx` | Needs `<h1>` and `<main>`. No TopBar, so it needs its own skip link or none — none is acceptable here; the form is the first thing in the tab order already. |
| `ProfileScreen.jsx` | Needs `<h1>`. |
| `SettingsScreen.jsx` | Needs `<h1>`; section titles → `<h2>`. |
| `PhraseAnalyzerScreen.jsx` | Needs `<h1>`. |
| `ExamScreen.jsx` | Uses `SelectionScreen` — likely already covered by Step 1. Verify, don't assume. |
| `ExamRunner.jsx` | Needs `<h1>` (the exam's name). Already has `<h4>` elements — check they form a sensible order under the new `<h1>`. |
| `ExamResult.jsx` | Needs `<h1>`. Already has heading elements — same check. |

For each converted element, add `margin: 0` to its CSS class if the class does
not already set a margin.

**Verify** per screen, in the browser console:

```js
[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => h.tagName + ': ' + h.textContent.trim().slice(0, 40))
```

Expected for every screen: exactly one `h1`, no level skipped (no `h3` without
a preceding `h2`), and the order matches the visual reading order.

### Step 5: Run the full gate

**Verify**: `cd frontend && npm run lint` → exit 0
**Verify**: `cd frontend && npm test` → all pass
**Verify**: `cd frontend && npm run build` → exit 0

## Test plan

No new automated tests. The frontend suite runs in a node environment with no
DOM (`vitest`, currently just `src/lib/api.test.js`), so heading-structure
assertions are not expressible without introducing a DOM test environment —
outside this plan's scope.

Verification is:
- The heading count rising from 7 (Done criteria).
- The per-screen console check in Steps 2 and 4, run against **every one of the
  25 screens**, with results recorded in your summary. This is the real test
  and it is manual; do not skip screens.
- The visual before/after comparison in Step 1, which is what catches a missed
  `margin: 0`.
- Lint, test, and build all still passing.

Note as a follow-up in your summary (do not act on it here): once a DOM test
environment exists, a single test that renders each screen and asserts "exactly
one `h1`, no skipped levels" would lock this in permanently. That needs the
test-environment decision made first.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd frontend && grep -roE "<h1[ >]" src --include=*.jsx | wc -l` → at least `10`
- [ ] `cd frontend && grep -roE "<h[1-6][ >]" src --include=*.jsx | wc -l` → at least `40`
- [ ] `cd frontend && grep -c "station-sign__name" src/components/station/StationSign.jsx` → `1`, and that line contains `<h1`
- [ ] `cd frontend && grep -c "selector-header__title" src/components/selection/SelectionScreen.jsx` → `1`, and that line contains `<h1`
- [ ] `cd frontend && grep -c "section-header__title" src/components/ui/SectionHeader.jsx` → `1`, and that line contains `<h2`
- [ ] `cd frontend && grep -c "top-bar__title" src/components/ui/TopBar.jsx` → `1`, and that line still contains `<span` (deliberately unchanged)
- [ ] `cd frontend && grep -rl "id=\"main-content\"" src/screens/*.jsx | wc -l` → `25`
- [ ] `cd frontend && grep -c "skip-link" src/index.css` → at least `2`
- [ ] `cd frontend && npm run lint` exits 0 with no errors
- [ ] `cd frontend && npm test` exits 0
- [ ] `cd frontend && npm run build` exits 0
- [ ] All 25 screens checked per Step 4 and the results recorded in your summary
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any screen ends up with **two or more `<h1>` elements simultaneously
  visible**. That contradicts this plan's model (one masthead per screen) and
  means either a screen renders two mastheads at once or a Group C screen got
  an `<h1>` it did not need. Report which screen and which two headings —
  do not resolve it by demoting one to `<h2>` on a guess.
- Converting an element visibly breaks a layout and adding `margin: 0` does not
  fix it. That means a `display` change is biting (an inline element became
  block in a non-flex parent). Report the specific element rather than
  reaching for `display: inline` on a heading, which is its own accessibility
  smell.
- A Group C screen has no obvious candidate for its `<h1>` — no visible text
  that names the screen. Report it rather than inventing a title or hiding one
  with `.sr-only`; what that screen should be called is a product question.
- `npm run lint` reports errors you cannot resolve, or the warning count rises
  above the 18 pre-existing warnings.

## Maintenance notes

- **The rule to keep**: the station plate (or `SelectionScreen`'s `heading`
  prop) is the screen's `<h1>`; `SectionHeader` is `<h2>`; `TopBar`'s title is
  chrome and stays a `<span>`. A new screen that renders `StationHeader` or
  `SelectionScreen` gets its `<h1>` automatically — a new screen with bespoke
  markup does not, and that is the case to watch in review.
- A reviewer should scrutinize: every converted class having `margin: 0`. A
  missed one is invisible in the diff and shows up as a subtly-shifted layout
  on one screen. Diffing screenshots of a Group A and a Group B screen before
  and after is the cheap way to catch it.
- Deliberately deferred: `aria-current` on the burger-menu link for the active
  route, and `aria-expanded` wiring on the burger toggle. Both are real gaps,
  both are navigation-semantics rather than document structure, and plan 004's
  modal work is the more natural home for that class of fix.
- Deliberately deferred: heading structure inside the exam question renderer
  (`frontend/src/exam/QuestionRenderer.jsx`), which already has `<h4>`s of its
  own. Step 4 checks their ordering but does not restructure them; a timed exam
  UI has enough of its own constraints to deserve its own pass.
