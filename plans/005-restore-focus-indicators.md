# Plan 005: Restore a visible focus indicator everywhere `outline: none` removed one

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 39511f8..HEAD -- frontend/src/index.css`
> If this file changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `39511f8`, 2026-08-25

## Why this matters

This app's focus styling is mostly good — there are 34 `:focus-visible` rules
and a solid house pattern established for buttons. But `outline: none` appears
at six places in `index.css`, and at three of them it removes the browser's
focus ring without providing an adequate replacement:

1. **Every `<input>` in the app** loses its outline via a global element rule,
   replaced only by a 1px border-colour change — and on `:focus` rather than
   `:focus-visible`, so it also fires on mouse click where the house pattern
   would not. A 1px colour shift is a much weaker signal than the 2px outline
   every button gets, on the app's login form among others.
2. **The deck-import textarea** has `outline: none` and **no focus rule at
   all** — zero visible indication when it is focused.
3. **The volume sliders** in Settings have `outline: none` and their thumbs
   have a `:hover` style but no `:focus` style. They are keyboard-operable with
   arrow keys, with nothing showing they are the thing being operated.

WCAG 2.4.7 (Focus Visible, Level AA). The fix is to apply the pattern this
codebase already established for buttons.

## Current state

### The house pattern — `frontend/src/index.css:331-334`

```css
button:focus-visible {
  outline: 2px solid var(--accent2);
  outline-offset: 2px;
}
```

`--accent2` is `#c99a3e` (a warm gold) in dark mode. This is the pattern to
reuse — do not invent a different one.

### Problem 1 — global input rule, `frontend/src/index.css:751-760`

```css
input {
  font-family: inherit;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.2s;
}
input:focus { border-color: var(--accent2); }
```

### Problem 2 — `frontend/src/index.css:10222-10236`

```css
.import-textarea {
  width: 100%;
  height: 180px;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  font-size: 14px;
  resize: vertical;
  font-family: monospace;
  outline: none;
}
```

`grep -n "import-textarea" src/index.css` returns exactly **one** match — this
block. There is no `:focus` rule for it anywhere.

### Problem 3 — `frontend/src/index.css:3490-3500`

```css
.master-volume-slider-wrap input[type="range"],
.vol-slider-wrap input[type="range"] {
  width: 100%;
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
  outline: none;
  cursor: pointer;
  position: relative;
  z-index: 2;
  margin: 0;
}
```

Their thumbs (`index.css:3517`, `:3534`, and the `::-moz-range-thumb` variants
at `:3565`, `:3574`) have `:hover` rules but no `:focus` or `:focus-visible`
rules.

### The three `outline: none` sites that are FINE — do not change them

- `frontend/src/index.css:7940-7956` — carries an explicit comment: *"`outline:
  none` is not redundant: the equipped seal skin draws its own…"*. Deliberate.
- `frontend/src/index.css:8886` — `.decks-index-bar__input:focus { border: none;
  outline: none; }`. This one is fine because the **wrapper** shows focus:
  `.decks-index-bar:focus-within` (at `index.css:8880`) changes its background.
  That is a valid focus indicator on the composite control.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd frontend && npm install` | exit 0 |
| Lint | `cd frontend && npm run lint` | exit 0, no errors |
| Build | `cd frontend && npm run build` | exit 0 |
| Dev server | `cd frontend && npm run dev` | serves on http://localhost:5173 |

## Scope

**In scope** (the only file you should modify):
- `frontend/src/index.css`

**Out of scope** (do NOT touch, even though they look related):
- `frontend/src/exam/exam.css` — not audited for this; a separate pass.
- The two deliberate `outline: none` sites listed above (`:7940` seal skin,
  `:8886` decks index bar). Both have working alternatives; changing them would
  double up indicators.
- Any JSX file. This plan is CSS-only.
- The existing 34 `:focus-visible` rules. They work; leave them.
- Colour token values. If `--accent2` has insufficient contrast against some
  surface, that is a real finding but a separate one — do not start adjusting
  palette values here.

## Git workflow

- Branch: `advisor/005-restore-focus-indicators`
- Commit style is conventional commits, scoped. Use `fix(a11y): ...`.
- One commit is fine.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Give inputs the house focus ring

In `frontend/src/index.css`, replace line 760:

```css
input:focus { border-color: var(--accent2); }
```

with:

```css
/* Keep the border tint — it is a nice ambient cue on mouse focus —
   but add the same ring every button gets, on :focus-visible only, so
   keyboard focus is as legible on a field as it is on a control.
   The `outline: none` above is what made this necessary. */
input:focus { border-color: var(--accent2); }
input:focus-visible {
  outline: 2px solid var(--accent2);
  outline-offset: 2px;
}
```

Also add a matching rule for `textarea`, which the global `input` rule never
covered:

```css
textarea:focus-visible {
  outline: 2px solid var(--accent2);
  outline-offset: 2px;
}
```

**Verify**: `cd frontend && npm run build` → exits 0.

### Step 2: Give the import textarea a focus indicator

Immediately after the `.import-textarea` block (ending at `index.css:10236`),
add:

```css
.import-textarea:focus-visible {
  outline: 2px solid var(--accent2);
  outline-offset: 2px;
}
```

The `outline: none` inside `.import-textarea` can stay — `:focus-visible` is
more specific and wins, and leaving it keeps the mouse-focus appearance
unchanged.

**Verify**: `cd frontend && grep -c "import-textarea" src/index.css` → `2`.

### Step 3: Give the volume slider thumbs a focus indicator

A range input's thumb is a pseudo-element, so the focus style goes on the
thumb pseudo-selectors, matching how the existing `:hover` rules are written.
Add after the existing thumb rules (around `index.css:3560`):

```css
/* The thumb is the control, so the ring goes on the thumb — an outline
   on the input itself would draw a rectangle around the whole track. */
.master-volume-slider-wrap input[type="range"]:focus-visible::-webkit-slider-thumb,
.vol-slider-wrap input[type="range"]:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--accent2);
  outline-offset: 2px;
}
.master-volume-slider-wrap input[type="range"]:focus-visible::-moz-range-thumb,
.vol-slider-wrap input[type="range"]:focus-visible::-moz-range-thumb {
  outline: 2px solid var(--accent2);
  outline-offset: 2px;
}
```

⚠️ WebKit and Firefox pseudo-element selectors **cannot be combined in one
rule** — a selector list containing a vendor pseudo-element the browser does
not recognise invalidates the entire rule. That is why these are two separate
blocks. Do not merge them.

**Verify**: `cd frontend && npm run build` → exits 0.

### Step 4: Verify each in a browser, using the keyboard only

Start the dev server. Using **Tab only, never the mouse**, confirm a clearly
visible ring appears on:

1. The email and password fields on the sign-in screen.
2. The search field on the dictionary screen.
3. The deck-import textarea (Decks → a deck → import).
4. Each volume slider in Settings — and confirm arrow keys change the value
   while the ring is showing.

Then confirm with the **mouse**: clicking into a text field should *not* show
the 2px ring (only the border tint), because `:focus-visible` excludes mouse
focus. If the ring appears on mouse click, the rule was written as `:focus`
rather than `:focus-visible`.

Record what you observed for each of the four, plus the mouse check, in your
final summary.

### Step 5: Run the full gate

**Verify**: `cd frontend && npm run lint` → exit 0
**Verify**: `cd frontend && npm test` → all pass
**Verify**: `cd frontend && npm run build` → exit 0

## Test plan

No new automated tests — this is pure CSS, and the repo has no visual
regression or DOM test setup. Verification is the greps in the Done criteria
and the keyboard-only walkthrough in Step 4.

The mouse check in Step 4 is the one that catches the most likely mistake
(writing `:focus` instead of `:focus-visible`), so do not skip it.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd frontend && grep -c "input:focus-visible" src/index.css` → at least `1`
- [ ] `cd frontend && grep -c "textarea:focus-visible" src/index.css` → at least `1`
- [ ] `cd frontend && grep -c "import-textarea:focus-visible" src/index.css` → `1`
- [ ] `cd frontend && grep -c "focus-visible::-webkit-slider-thumb" src/index.css` → at least `1`
- [ ] `cd frontend && grep -c "focus-visible::-moz-range-thumb" src/index.css` → at least `1`
- [ ] `cd frontend && grep -cE "outline:\s*(none|0)" src/index.css` → `6` (unchanged — this plan adds rules, it does not remove the `outline: none` declarations)
- [ ] `cd frontend && npm run lint` exits 0
- [ ] `cd frontend && npm test` exits 0
- [ ] `cd frontend && npm run build` exits 0
- [ ] The Step 4 keyboard walkthrough and mouse check are documented in your summary
- [ ] No files outside `frontend/src/index.css` are modified (`git status`)
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `--accent2` ring is not clearly visible against some field's background
  in either theme. That is a colour-contrast question, not a focus-ring
  question — report which field and which theme rather than picking a different
  colour, since changing the ring colour for one case would break the
  consistency this plan exists to establish.
- Adding `input:focus-visible` visibly changes any *existing* screen's
  appearance on mouse interaction. It should not — `:focus-visible` excludes
  mouse focus in every current browser. If it does, report where.
- The slider thumb rules have no visible effect. Some browsers do not support
  `outline` on `::-webkit-slider-thumb`. If so, report it — the fallback is a
  `box-shadow` ring on the thumb, but confirm before switching, and use the
  same 2px/`--accent2` values so it still matches the house pattern.

## Maintenance notes

- **The house focus pattern is `outline: 2px solid var(--accent2);
  outline-offset: 2px;` on `:focus-visible`**, established at `index.css:331`.
  Any new interactive element should use it. Any new `outline: none` should
  come with either a replacement in the same commit or a comment explaining
  what shows focus instead — the two existing legitimate cases (`:7940`,
  `:8886`) both do exactly that, and that is the standard to hold to.
- A reviewer should scrutinize: `:focus-visible` versus `:focus` in every added
  rule. Using `:focus` is the easy slip and produces rings on mouse clicks,
  which reads as a visual bug and tends to get "fixed" by deleting the rule
  entirely — putting the app right back where it started.
- Deliberately deferred: `frontend/src/exam/exam.css` (892 lines) was not
  audited for focus handling. Worth a follow-up pass, especially since the exam
  is a timed flow where keyboard use is likeliest.
- Deliberately deferred: verifying the ring's contrast ratio against every
  surface it can land on (WCAG 1.4.11 requires 3:1 for non-text). `--accent2`
  on the standard card background is comfortable, but the app has nine cosmetic
  "paper" backgrounds that change surface colours, and checking the ring
  against all of them is its own task.
