# Plan 004: Give every modal dialog real dialog semantics, Escape-to-close, and focus management

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 39511f8..HEAD -- frontend/src/components/decks frontend/src/components/dictionary frontend/src/components/rewards/QuickChange.jsx frontend/src/components/ui/BurgerMenu.jsx frontend/src/screens/ReadingScreen.jsx frontend/src/screens/DictionaryScreen.jsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (independent of 003, though both are accessibility work)
- **Category**: bug
- **Planned at**: commit `39511f8`, 2026-08-25

## Why this matters

The app has roughly six modal/overlay surfaces. Across them:

- `role="dialog"` appears on **one** (`QuickChange`).
- `aria-modal` appears on **none**.
- Escape-to-close is implemented on **two** (`QuickChange`, `BurgerMenu`).
- Focus is moved into the dialog on open on **none**, trapped inside it on
  **none**, and returned to the triggering control on close on **none**.

The concrete failures that follow: a keyboard user who opens the deck-import
dialog cannot close it without finding the × with the mouse or tabbing blindly.
A screen-reader user is never told a dialog opened, and their virtual cursor
stays on the page behind it, reading content that is visually covered. Tab
cycles out of the dialog and into the page underneath, where clicks do nothing
because a scrim is intercepting them. WCAG 2.1.2 (No Keyboard Trap — the
inverse problem, focus escaping when it should not) and 4.1.2 (Name, Role,
Value).

`QuickChange` is already most of the way there and is the pattern to
generalize. This plan extracts what it does into one reusable hook and applies
it uniformly.

## Current state

### The exemplar — `frontend/src/components/rewards/QuickChange.jsx:64-91`

```jsx
  // Escape closes it, the same as the burger drawer — this can be open
  // over a live quiz and the keyboard is already where your hands are.
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  ...
  return createPortal(
    <div className="quick-drawer-overlay" onClick={close}>
      <div className="quick-drawer" onClick={e => e.stopPropagation()} role="dialog" aria-label={t.quickChange}>
```

It has the Escape handler, `role="dialog"`, an accessible name, a scrim that
closes on click, and `stopPropagation` on the panel. It lacks `aria-modal`,
focus-on-open, a focus trap, and focus restoration.

### The scrim + panel pattern, repeated

Every overlay in this app uses the same shape — a full-screen scrim `<div>`
with `onClick={onClose}`, containing a panel `<div>` with
`onClick={e => e.stopPropagation()}`. That pattern itself is fine and standard;
it is not what this plan changes.

The six surfaces and what each is missing:

| # | Component | Location | `role` | Escape | Focus mgmt |
|---|---|---|---|---|---|
| 1 | `QuickChange` | `components/rewards/QuickChange.jsx:90` | ✅ `dialog` | ✅ | ❌ |
| 2 | `BurgerMenu` drawer | `components/ui/BurgerMenu.jsx:207` | ❌ | ✅ | ❌ |
| 3 | `BrowseCardsMenu` | `components/decks/BrowseCardsMenu.jsx:131` | ❌ | ❌ | ❌ |
| 4 | `ImportCardsMenu` | `components/decks/ImportCardsMenu.jsx:67` | ❌ | ❌ | ❌ |
| 5 | `DictionaryLookupSheet` | `components/dictionary/DictionaryDetail.jsx:701` | ❌ | ❌ | ❌ |
| 6 | `ReadingScreen` detail sheets | `screens/ReadingScreen.jsx:951` and `:960` | ❌ | ❌ | ❌ |

**#4 `ImportCardsMenu` is the worst of them** — its scrim has no `onClick` at
all, so there is no click-outside-to-close *and* no Escape. The only way out is
the × button:

```jsx
  return (
    <div className="import-overlay">
      <div className="import-modal">

        {/* Header */}
        <div className="import-header">
          <div className="import-header__title">{t.importTitle}</div>
          <button onClick={() => { playClick(); onClose() }} className="import-header__close" aria-label={t.close}>
```

**#5 `DictionaryLookupSheet`** is a portal rendered over a live quiz:

```jsx
export function DictionaryLookupSheet({ term, category, session, onClose }) {
  const { t, lang } = useLang()
  const { entry, loading, error } = useDictionaryLookup(session, term, category, lang, true)

  return createPortal(
    <div onClick={onClose} className="dict-sheet__scrim">
      <div onClick={e => e.stopPropagation()} className="dict-sheet">
```

**#6 `ReadingScreen`** has two variants (sheet on narrow, side panel on wide):

```jsx
      <div onClick={onClose} className="detail-overlay-sheet">
        <div onClick={e => e.stopPropagation()} className="card detail-sheet">
  ...
    <div onClick={onClose} className="detail-overlay-side">
      <div onClick={e => e.stopPropagation()} className="card detail-side">
```

Also note `frontend/src/screens/DictionaryScreen.jsx:613` — a scrim already
correctly marked `aria-hidden="true"`, which is right for a pure scrim and is
**not** something to change:

```jsx
			<div className="dict-dock__scrim" onClick={onClose} aria-hidden="true" />
```

### Repo conventions

- Plain JS + JSX, no TypeScript. 2-space indent, except `DictionaryScreen.jsx`
  (tabs).
- Hooks live in `frontend/src/hooks/` — there is exactly one today,
  `frontend/src/hooks/useCardSession.js`. Follow its file shape: a leading
  comment block explaining the *why*, then a single named export.
- Overlays that must escape their parent's stacking context use
  `createPortal` from `react-dom` (see `QuickChange.jsx` and
  `DictionaryDetail.jsx`). Ones that do not, don't. Do not change which is
  which.
- `eslint-plugin-react-hooks` is enabled with its newer strict rules
  (`set-state-in-effect`, `refs`, `immutability`). Several files carry targeted
  `eslint-disable-next-line` comments with a written justification — that is
  the house style when a disable is genuinely warranted, but prefer restructuring.

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
- `frontend/src/hooks/useDialog.js` (create)
- `frontend/src/components/rewards/QuickChange.jsx`
- `frontend/src/components/ui/BurgerMenu.jsx`
- `frontend/src/components/decks/BrowseCardsMenu.jsx`
- `frontend/src/components/decks/ImportCardsMenu.jsx`
- `frontend/src/components/dictionary/DictionaryDetail.jsx`
- `frontend/src/screens/ReadingScreen.jsx`
- `frontend/src/locales/fr/index.js` and `frontend/src/locales/en/index.js`
  (only if a dialog needs a new accessible-name key)

**Out of scope** (do NOT touch, even though they look related):
- `frontend/src/screens/DictionaryScreen.jsx:613`'s `.dict-dock__scrim`. It is
  a bare scrim with `aria-hidden="true"` already, which is correct. The docked
  panel it belongs to is **not** a modal — on a wide screen it sits beside the
  results rather than over them — so do not give it dialog semantics.
- The `<div onClick={...}>` scrim pattern itself. It is standard
  click-outside-to-close. The finding is the missing Escape and focus
  management, not the div.
- Any visual change to any dialog. This plan adds attributes and behaviour, not
  styles. The one exception is the `:focus-visible` styling that plan 005 owns —
  do not do it here.
- Converting any of these to the native `<dialog>` element. It would be a
  defensible choice, but it changes stacking, backdrop styling, and scroll
  behaviour all at once across six surfaces, and this app's overlays have
  hand-tuned CSS. That is a separate, larger decision.
- `frontend/src/exam/` — the exam UI has its own full-screen flow that is not
  a modal.

## Git workflow

- Branch: `advisor/004-modal-dialog-accessibility`
- Commit style is conventional commits, scoped. Use `fix(a11y): ...`.
- Commit the hook (Step 1) separately from its adoption (Steps 2–3) so a
  reviewer can read the shared behaviour once and then check six call sites
  against it.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write the shared `useDialog` hook

Create `frontend/src/hooks/useDialog.js`. Follow the file shape of the existing
`frontend/src/hooks/useCardSession.js` — leading comment block explaining why,
then the named export.

```js
import { useEffect, useRef } from 'react'

// ── Modal behaviour, in one place ─────────────────────────
// Every overlay in this app was already a scrim with a panel and a
// close button. What none of them had was the part a mouse user never
// notices: Escape, focus moving into the dialog when it opens, focus
// staying inside while it is open, and focus going back to whatever
// opened it when it closes. QuickChange had the Escape half and was
// the model for the rest.
//
// Returns a ref to attach to the dialog panel (not the scrim).
//
//   const dialogRef = useDialog(onClose)
//   <div className="scrim" onClick={onClose}>
//     <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={...}>
//
// The trap is deliberately a Tab-wrap rather than an inert-background
// approach: `inert` would be cleaner but needs every sibling of the
// portal root enumerated, and these dialogs mount in several different
// places in the tree.
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useDialog(onClose) {
  const ref = useRef(null)
  // Captured at mount, before focus moves into the dialog, so it is
  // genuinely the control the user was on when they opened this.
  const returnTo = useRef(null)

  useEffect(() => {
    returnTo.current = document.activeElement

    const node = ref.current
    if (node) {
      const first = node.querySelector(FOCUSABLE)
      // Fall back to the panel itself so focus lands *somewhere* inside
      // even in a dialog that is still loading and has no controls yet.
      if (first) {
        first.focus()
      } else {
        node.setAttribute('tabindex', '-1')
        node.focus()
      }
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !ref.current) return

      const items = [...ref.current.querySelectorAll(FOCUSABLE)]
        .filter(el => el.offsetParent !== null)
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      // Only restore if focus is still somewhere we put it — if the
      // user has since clicked elsewhere, yanking them back is worse
      // than leaving them alone.
      const active = document.activeElement
      if (returnTo.current && (!active || active === document.body)) {
        returnTo.current.focus?.()
      }
    }
  }, [onClose])

  return ref
}
```

⚠️ Note the `onClose` dependency. Every call site must pass a **stable**
`onClose` — one wrapped in `useCallback`, or a prop that does not change
identity every render. An inline arrow function will re-run this effect on
every render, which re-runs the focus-on-open and makes the dialog steal focus
continuously. Check this at each call site in Steps 2–3; if a call site passes
an inline arrow, wrap it in `useCallback` there.

**Verify**: `cd frontend && npm run lint` → exit 0, no errors.

### Step 2: Adopt it in the two dialogs that are already partly correct

**2a. `QuickChange.jsx`** — delete its own Escape `useEffect` (lines 64–70),
call the hook, and add `aria-modal`:

```jsx
  const dialogRef = useDialog(close)
  ...
      <div ref={dialogRef} className="quick-drawer" onClick={e => e.stopPropagation()}
           role="dialog" aria-modal="true" aria-label={t.quickChange}>
```

`close` is defined at `QuickChange.jsx:72` as a plain function declaration, so
it is a new identity each render — wrap it in `useCallback` (with `onClose` as
the dependency) before passing it to the hook.

Keep the explanatory comment about Escape; move it to sit above the
`useDialog` call so the reasoning survives.

**2b. `BurgerMenu.jsx`** — delete its own Escape `useEffect` (around line 168–174),
call the hook on the drawer, and add the dialog attributes:

```jsx
          <div ref={dialogRef} className="burger-drawer" onClick={e => e.stopPropagation()}
               role="dialog" aria-modal="true" aria-label={t.menu}>
```

If there is no suitable existing locale key for the drawer's accessible name,
add `menu` to both locale files (`'Menu'` in both is fine — it is the same word).

**Verify**: `cd frontend && grep -c "addEventListener('keydown'" src/components/rewards/QuickChange.jsx src/components/ui/BurgerMenu.jsx` → `0` for both.

**Verify** in a browser: open the burger menu and the quick-change drawer;
Escape closes each; Tab cycles within each and does not reach the page behind.

### Step 3: Adopt it in the four dialogs that have nothing

For each of `BrowseCardsMenu`, `ImportCardsMenu`, `DictionaryLookupSheet`, and
both `ReadingScreen` detail variants:

1. Call `const dialogRef = useDialog(onClose)`.
2. Put `ref={dialogRef}` on the **panel** element (the inner one with
   `stopPropagation`), never the scrim.
3. Add `role="dialog"`, `aria-modal="true"`, and an accessible name to that
   same panel. Prefer `aria-labelledby` pointing at the dialog's existing
   title element (give the title an `id`); use `aria-label` only where there
   is no visible title.
4. For `ImportCardsMenu` **only**: also add `onClick={onClose}` to its
   `.import-overlay` scrim and `onClick={e => e.stopPropagation()}` to its
   `.import-modal` panel, matching every other overlay in the app. It is the
   one missing click-outside-to-close.

Titles available to reference for `aria-labelledby`:
- `BrowseCardsMenu` — `.import-header__title` at `BrowseCardsMenu.jsx:134`
- `ImportCardsMenu` — `.import-header__title` at `ImportCardsMenu.jsx:72`
- `DictionaryLookupSheet` — no stable title (content is async); use
  `aria-label` with a term-based name.
- `ReadingScreen` detail sheets — inspect for a title; use `aria-label` if none.

**Verify**: `cd frontend && grep -rc "aria-modal" src/components src/screens | grep -v ":0" | wc -l` → at least `5` files.

**Verify**: `cd frontend && grep -rn "role=\"dialog\"" src --include=*.jsx | wc -l` → at least `6`.

### Step 4: Verify the behaviour, per dialog, in a browser

Start the dev server. For **each** of the six dialogs, confirm all four:

1. Opening it moves focus inside it (check `document.activeElement` in the
   console — it should be within the dialog panel).
2. **Escape closes it.**
3. Tab and Shift+Tab cycle within the dialog and never reach the page behind.
4. Closing it returns focus to the control that opened it.

Record a pass/fail per dialog per behaviour — a 6×4 grid — in your final
summary. This is the substance of the plan; a summary that says "tested, works"
is not sufficient.

### Step 5: Run the full gate

**Verify**: `cd frontend && npm run lint` → exit 0
**Verify**: `cd frontend && npm test` → all pass
**Verify**: `cd frontend && npm run build` → exit 0

## Test plan

No new automated tests. The frontend suite runs in a node environment with no
DOM, so focus-management assertions are not expressible without introducing a
DOM test environment — outside this plan's scope.

Verification is the greps in Steps 2–3 and the 6×4 manual behaviour grid in
Step 4. The grid is the real test; run it honestly.

Note as a follow-up in your summary (do not act on it here): `useDialog` is
exactly the kind of unit that *is* testable once a DOM environment exists —
mount a fixture with three buttons, assert focus lands on the first, that Tab
from the last wraps to the first, and that unmounting restores focus. Worth
writing the moment that environment lands.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `frontend/src/hooks/useDialog.js` exists and exports `useDialog`
- [ ] `cd frontend && grep -rn "role=\"dialog\"" src --include=*.jsx | wc -l` → at least `6`
- [ ] `cd frontend && grep -rn "aria-modal" src --include=*.jsx | wc -l` → at least `6`
- [ ] `cd frontend && grep -rn "useDialog(" src --include=*.jsx | wc -l` → at least `6`
- [ ] `cd frontend && grep -c "addEventListener('keydown'" src/components/rewards/QuickChange.jsx` → `0`
- [ ] `cd frontend && grep -c "addEventListener('keydown'" src/components/ui/BurgerMenu.jsx` → `0`
- [ ] `cd frontend && grep -c "onClick={onClose}" src/components/decks/ImportCardsMenu.jsx` → at least `1`
- [ ] `cd frontend && npm run lint` exits 0 with no errors
- [ ] `cd frontend && npm test` exits 0
- [ ] `cd frontend && npm run build` exits 0
- [ ] The 6×4 behaviour grid from Step 4 is complete and recorded in your summary
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report back (do not improvise) if:

- A dialog begins stealing focus repeatedly, or the app enters a focus loop.
  That is the unstable-`onClose` problem described in Step 1. Fix it by
  wrapping that call site's `onClose` in `useCallback` — but if wrapping it
  requires restructuring the parent component's state, stop and report which
  component, rather than restructuring it here.
- Escape inside a dialog also triggers something else (e.g. closes an
  underlying screen as well). The hook calls `stopPropagation`, but a handler
  registered in the capture phase would still see it. Report which two handlers
  are colliding.
- `useDialog`'s Tab trap prevents reaching a control that is genuinely inside
  the dialog — most likely a custom control with no `tabindex` that the
  `FOCUSABLE` selector misses. Report the specific control rather than
  broadening the selector to `*`.
- `BurgerMenu`'s drawer turns out not to be modal in some state (e.g. it stays
  open while the page behind is still meant to be interactive). Trapping focus
  in a non-modal drawer is worse than leaving it alone — report it.

## Maintenance notes

- **Every new overlay should call `useDialog`.** The pattern to match is: scrim
  `<div onClick={onClose}>`, panel `<div ref={dialogRef} onClick={stopPropagation}
  role="dialog" aria-modal="true" aria-labelledby={...}>`. A reviewer seeing a
  new scrim/panel pair without the hook should ask why.
- A reviewer should scrutinize: that `ref={dialogRef}` is on the **panel** and
  not the scrim. On the scrim, the focus trap would include the whole page
  behind it and silently do nothing — and that mistake looks completely
  correct in a diff.
- A reviewer should also check each call site's `onClose` is stable. This is
  the one real footgun in the hook, and its symptom (focus stealing) only shows
  up when interacting, never in review.
- Deliberately deferred: migrating to the native `<dialog>` element and
  `showModal()`, which would give the focus trap and backdrop for free. It is
  the better long-term shape, but it changes stacking and backdrop styling
  across six hand-tuned overlays at once. Revisit as its own plan if the
  overlay CSS is ever reworked anyway.
- Deliberately deferred: `aria-expanded` on the burger toggle and `aria-current`
  on the active nav link. Adjacent, small, and worth a follow-up.
