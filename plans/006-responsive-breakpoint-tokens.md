# Plan 006: Consolidate 13 ad-hoc responsive breakpoints onto a documented scale

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 39511f8..HEAD -- frontend/src/index.css frontend/src/exam/exam.css frontend/src/components/ui/TopBar.jsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (every change here is a layout change at some viewport width; the risk is entirely visual regression, and it is only manageable with the disciplined per-change verification in Step 3)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `39511f8`, 2026-08-25

## Why this matters

`frontend/src/index.css` (15,565 lines) and `frontend/src/exam/exam.css`
contain 38 width-based media queries using **13 distinct breakpoint values**,
with no tokens or documentation anywhere. Two values are clearly the intended
system — `560px` (used 15 times) and `768px` (8 times) — and the other eleven
are one-offs that accumulated: `400`, `480`, `640`, `700`, `820`, `900`, `1000`,
`1099`, `1100`.

The cost is not dramatic, which is why this is P3: nothing is visibly broken
today. The cost is that layout now changes at nine unpredictable widths, a
developer adding a responsive rule has no way to know which value is "the"
tablet breakpoint, and each new one-off makes the next one more likely. There
is also a JS breakpoint (`MOBILE_BREAKPOINT = 768` in `TopBar.jsx:15`) that has
to stay in step with the CSS by hand.

This plan does not chase a perfect scale. It documents the two real
breakpoints, migrates the one-offs that are clearly drift, and **deliberately
leaves alone** the ones that exist for a specific component's genuine layout
constraint.

## Current state

### Breakpoint census

| Value | Count | Verdict |
|---|---|---|
| `max-width: 560px` | 15 | **Keep** — the primary mobile breakpoint |
| `max-width: 768px` | 8 | **Keep** — the primary tablet breakpoint; matches `TopBar.jsx`'s JS constant |
| `max-width: 700px` | 3 | Migrate to 768px — investigate first |
| `max-width: 480px` | 3 | Migrate to 560px — investigate first |
| `min-width: 1100px` / `max-width: 1099px` | 1 each | **Keep as a pair** — complementary, deliberate, and correct |
| `min-width: 1000px` | 1 | Investigate |
| `min-width: 900px` | 1 | Investigate |
| `max-width: 900px` | 1 | Investigate |
| `max-width: 820px` | 1 | Investigate |
| `max-width: 640px` | 1 | Investigate |
| `max-width: 400px` | 1 | **Likely keep** — a genuine very-small-phone case |
| `min-width: 560px` | 1 | Keep — complements the 560 mobile breakpoint |

### Every media query, with its line

```
index.css:790   max-width: 768px      index.css:13075  max-width: 560px
index.css:1890  max-width: 560px      index.css:13198  max-width: 820px
index.css:1931  min-width: 1000px     index.css:13543  max-width: 768px
index.css:2002  max-width: 560px      index.css:13588  max-width: 1099px
index.css:2294  max-width: 768px      index.css:13632  max-width: 700px
index.css:5068  max-width: 480px      index.css:13658  max-width: 700px + reduced-motion
index.css:5618  min-width: 560px      index.css:13770  max-width: 560px
index.css:7744  max-width: 560px      index.css:13863  max-width: 700px
index.css:8068  max-width: 480px      index.css:13882  max-width: 768px
index.css:10285 max-width: 900px      index.css:13897  max-width: 560px
index.css:10414 max-width: 560px      index.css:13940  min-width: 1100px
index.css:10437 max-width: 768px      index.css:14061  min-width: 900px
index.css:10530 max-width: 768px      index.css:14104  max-width: 560px
index.css:10535 max-width: 640px      index.css:14159  max-width: 560px
index.css:10581 max-width: 560px      index.css:14255  max-width: 560px
index.css:10687 max-width: 480px      index.css:14822  max-width: 560px
index.css:10762 max-width: 400px      index.css:15225  max-width: 560px
index.css:11985 max-width: 768px      exam.css:468     max-width: 560px
index.css:11996 max-width: 768px      exam.css:886     max-width: 560px
```

### Two specific findings to know about

**The 900px pair is NOT a bug.** `index.css:10285` (`max-width: 900px`) targets
`.grid-4` / `.grid-3`, and `index.css:14061` (`min-width: 900px`) targets
`.syllabary-chart-group`. Different selectors, so despite both matching at
exactly 900px, they never conflict. Do not "fix" this; it was checked.

**`1099` / `1100` is a correct complementary pair.** `index.css:13588` is
`max-width: 1099px` and `:13940` is `min-width: 1100px`. That is the right way
to write a non-overlapping pair with integer pixels. Leave both.

### The JS breakpoint that must stay in sync

`frontend/src/components/ui/TopBar.jsx:15`:

```jsx
const MOBILE_BREAKPOINT = 768
```

Used by `useAutoHideTopBar` to decide whether the top bar auto-hides. Its
comment at `TopBar.jsx` notes *"CSS keeps it mobile-only — see the ≤768px query
in index.css"*, so it is knowingly coupled.

### Why CSS custom properties will NOT work here

This is the trap in this plan. **CSS custom properties cannot be used in media
query conditions.** `@media (max-width: var(--bp-mobile))` is invalid CSS and
silently does nothing. There is no native way to tokenize a breakpoint in plain
CSS, and this project uses plain CSS with Vite — no Sass, no PostCSS plugins
(confirmed: `frontend/package.json` has no CSS preprocessor in
`devDependencies`).

So "tokens" here means **a documented, enforced convention plus a single
comment block naming the scale** — not literal variables. Do not add a
preprocessor to solve this; that is a much larger change than the problem
justifies.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd frontend && npm install` | exit 0 |
| Build | `cd frontend && npm run build` | exit 0 |
| Lint | `cd frontend && npm run lint` | exit 0 |
| Dev server | `cd frontend && npm run dev` | serves on http://localhost:5173 |
| Breakpoint census | `cd frontend && grep -oE "\((max\|min)-width:\s*[0-9]+px\)" src/index.css src/exam/exam.css \| sort \| uniq -c \| sort -rn` | the table above |

## Scope

**In scope** (the only files you should modify):
- `frontend/src/index.css`
- `frontend/src/exam/exam.css`
- `frontend/src/components/ui/TopBar.jsx` (comment only — see Step 4)

**Out of scope** (do NOT touch, even though they look related):
- Adding Sass, PostCSS, or any CSS preprocessor. See "Why CSS custom
  properties will NOT work here" — the answer is not a build-tool change.
- The `1099`/`1100` pair and the `900`/`900` pair. Both were investigated and
  are correct as written.
- Any `@media (prefers-reduced-motion)` block — plan 007 owns those. The one
  compound query at `index.css:13658` (`max-width: 700px and
  prefers-reduced-motion`) is in scope **only** for its width value; leave its
  motion half alone.
- Splitting `index.css` into multiple files. It is 15.5K lines and that is a
  real conversation, but it is not this one, and doing both at once makes the
  visual regression risk unreviewable.
- Any change to what a layout looks like at 560px or 768px. Those are the
  breakpoints being standardized *on*, not changed.

## Git workflow

- Branch: `advisor/006-responsive-breakpoint-tokens`
- Commit style is conventional commits, scoped. Use `refactor(css): ...`.
- **One commit per migrated breakpoint value**, not one big commit. Each is an
  independent visual risk and a reviewer needs to be able to bisect them.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Document the scale

Add a comment block near the top of `frontend/src/index.css`, immediately
before the first media query (`index.css:790`) or in the file's existing header
area:

```css
/* ── Breakpoints ──────────────────────────────────────────
   Two, and they are the whole scale:

     560px — phone.  Below this, single column everywhere.
     768px — tablet. Also the boundary the top bar's auto-hide
             uses (MOBILE_BREAKPOINT in components/ui/TopBar.jsx —
             the two must move together).

   Anything else in this file is a specific component's own
   constraint, and if you add one it needs a comment saying which
   component and why. A one-off with no reason attached is how this
   file ended up with thirteen of them.

   The 1099/1100 pair below is deliberate: complementary bounds for
   the dictionary's docked panel, written as integers so they never
   both match. */
```

**Verify**: `cd frontend && grep -c "── Breakpoints ─" src/index.css` → `1`

### Step 2: Investigate each one-off before touching it

For each of these, read the rules inside the block and decide whether it is
drift (migrate) or a real component constraint (keep, and add a comment saying
why):

| Line | Value | Candidate target |
|---|---|---|
| `index.css:5068` | `max-width: 480px` | 560px |
| `index.css:8068` | `max-width: 480px` | 560px |
| `index.css:10687` | `max-width: 480px` | 560px |
| `index.css:10535` | `max-width: 640px` | 560px or 768px |
| `index.css:13632` | `max-width: 700px` | 768px |
| `index.css:13658` | `max-width: 700px` (compound) | 768px |
| `index.css:13863` | `max-width: 700px` | 768px |
| `index.css:13198` | `max-width: 820px` | 768px |
| `index.css:10285` | `max-width: 900px` | keep (see Current state) |
| `index.css:14061` | `min-width: 900px` | keep (see Current state) |
| `index.css:1931` | `min-width: 1000px` | investigate |
| `index.css:10762` | `max-width: 400px` | likely keep — very small phones |

**A breakpoint is drift if** the rules inside it would look correct at the
nearby standard value too — i.e. the specific number was arbitrary.

**A breakpoint is a real constraint if** the rules inside it exist because a
particular piece of content stops fitting at that exact width (a fixed-width
table, a grid with a known column count, a long untruncatable string). Keep
those, and add a one-line comment naming the constraint.

Record your verdict and reasoning for **each of the twelve** in your final
summary. This reasoning is the actual deliverable of this plan — the diff is
just its consequence.

**Verify**: no command; this step produces the decisions the rest execute.

### Step 3: Migrate, one value at a time, verifying each

For each breakpoint you decided to migrate:

1. Change the value.
2. Load the affected screen in the browser at **three widths**: 20px below the
   old value, between the old and new values, and 20px below the new value.
3. Confirm the layout is correct at all three. The middle width is the one that
   matters — it is the range whose behaviour you just changed.
4. Commit that single change with a message naming the old and new values.

Use the browser's device-toolbar to set exact widths. `620px`, `520px`, `440px`
are useful probes for the 480→560 migrations; `730px`, `700px` for the 700→768
ones.

**Verify** after each: `cd frontend && npm run build` → exits 0.

### Step 4: Cross-reference the JS constant

In `frontend/src/components/ui/TopBar.jsx:15`, extend the comment on
`MOBILE_BREAKPOINT` to point at the new CSS comment block, so the coupling is
documented from both ends:

```jsx
// Must stay in step with the 768px tablet breakpoint documented in
// index.css's "── Breakpoints ──" block. If one moves, both move.
const MOBILE_BREAKPOINT = 768
```

Do **not** change its value.

**Verify**: `cd frontend && grep -c "MOBILE_BREAKPOINT = 768" src/components/ui/TopBar.jsx` → `1`

### Step 5: Re-run the census and the full gate

**Verify**:
```bash
cd frontend && grep -oE "\((max|min)-width:\s*[0-9]+px\)" src/index.css src/exam/exam.css | sort | uniq -c | sort -rn
```
→ the distinct-value count has dropped from 13. Record the new census in your
summary alongside the old one.

**Verify**: `cd frontend && npm run lint` → exit 0
**Verify**: `cd frontend && npm test` → all pass
**Verify**: `cd frontend && npm run build` → exit 0

## Test plan

No automated tests — this repo has no visual regression tooling, and adding it
is a much larger project than this plan.

Verification is entirely the **three-width manual check per migrated
breakpoint** in Step 3. That is not optional and not summarizable as "checked
responsive" — record the specific widths you loaded and what you saw, per
change. A migration that was not visually verified at the in-between width has
not been verified at all, because that range is exactly what changed.

Note as a follow-up in your summary (do not act on it here): visual regression
snapshots at the two standard breakpoints would make future CSS work in a
15.5K-line file dramatically safer. `@vitest/browser-playwright` and
`playwright` are already in `devDependencies`, so the tooling is largely present
already — it is a real candidate for its own plan.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd frontend && grep -c "── Breakpoints ─" src/index.css` → `1`
- [ ] `cd frontend && grep -oE "\((max|min)-width:\s*[0-9]+px\)" src/index.css src/exam/exam.css | sort -u | wc -l` → fewer than `13`
- [ ] `cd frontend && grep -c "MOBILE_BREAKPOINT = 768" src/components/ui/TopBar.jsx` → `1`
- [ ] Every remaining non-standard breakpoint has a comment naming its component and constraint
- [ ] A verdict + reasoning is recorded for all twelve one-offs in your summary
- [ ] The three-width check is recorded for every migrated breakpoint
- [ ] `cd frontend && npm run lint` exits 0
- [ ] `cd frontend && npm test` exits 0
- [ ] `cd frontend && npm run build` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 006 updated

## STOP conditions

Stop and report back (do not improvise) if:

- More than **four** of the twelve one-offs turn out to be genuine component
  constraints. That would mean the premise of this plan is wrong — these are
  not drift but a legitimately complex responsive design — and consolidating
  further would be actively harmful. Report your findings and stop; the
  documentation from Steps 1 and 2 is still worth landing on its own.
- A migration produces a layout that is correct at both endpoint widths but
  broken somewhere in between. Revert that single migration, keep the original
  value, add a comment explaining the constraint you just discovered, and move
  on to the next.
- You find yourself wanting to change a rule *inside* a media block to make a
  migration work. That is out of scope — this plan moves boundaries, it does
  not redesign layouts. Revert and keep the original breakpoint.
- Any migration would require touching `560px` or `768px` blocks themselves.

## Maintenance notes

- **The rule going forward**: use 560px or 768px. A new value needs a comment
  naming the component and the constraint that forced it. The comment block
  from Step 1 states this; a reviewer seeing a bare new breakpoint should ask
  for the comment.
- A reviewer should scrutinize: each migration's in-between width. A diff
  showing `480px` → `560px` looks trivially safe and is not — it hands 80px of
  viewport width to a different layout, and nothing in the diff reveals what
  that layout looks like.
- Deliberately deferred: splitting `index.css`. At 15,565 lines it is the
  single largest maintainability issue in the frontend, and the breakpoint
  drift this plan addresses is a symptom of it rather than the disease. Worth
  its own plan, but it should come *after* visual regression coverage exists,
  not before.
- Deliberately deferred: `frontend/src/exam/exam.css` uses only `560px`
  already, so it needs no migration — but it was not otherwise audited.
