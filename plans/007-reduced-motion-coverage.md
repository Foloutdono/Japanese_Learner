# Plan 007: Close the gaps in `prefers-reduced-motion` coverage

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 39511f8..HEAD -- frontend/src/index.css frontend/src/exam/exam.css`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (but see the note about plan 006's compound query)
- **Category**: bug
- **Planned at**: commit `39511f8`, 2026-08-25

## Why this matters

`prefers-reduced-motion` is a user telling the browser that motion makes them
unwell — for people with vestibular disorders, large sliding and scaling
animations can cause genuine nausea and dizziness. It is not a stylistic
preference.

This codebase handles it **better than most** and with real thought: there are
eight `@media (prefers-reduced-motion: reduce)` blocks, and they are curated
rather than blanket — e.g. the comment at `index.css:15231` reads *"The flaps
still turn — that is the content, not decoration — but nothing slides or scales
around them."* That is exactly the right instinct, and this plan must preserve
it.

The gap is coverage, not approach. There are **88 `@keyframes`** and 69
`animation:` declarations in `index.css`, and the reduced-motion blocks name
roughly 30 selectors. Several of the app's largest, most kinetic effects are
among the uncovered — the departure gate and train-door cutscenes that play
across navigation, the split-flap board, the daruma ritual, the XP toast. These
are precisely the full-screen sliding and scaling effects the media query
exists for.

## Current state

### The eight existing blocks

| Line | What it covers |
|---|---|
| `index.css:409` | Arrival animations: `.station`, `.platform-card`, `.route-stop`, `.board-row`, `.deck-card`, `.hall-card`, and the various `*-container` screens — replaced with a soft fade rather than removed |
| `index.css:2826` | `.burger-drawer` — swapped to a plain fade |
| `index.css:4519` | Kumadori streak effect |
| `index.css:4788` | Flashcard face fade |
| `index.css:5093` | Kumadori streak, embers, stage footlights |
| `index.css:5467` | `.card-stamp` family — collapsed to 10ms |
| `index.css:5546` | `.card-transition` family — collapsed to 10ms |
| `index.css:13531` | `.cos-ring__deco` and the train-door open animation |
| `index.css:15233` | `.fare-tick`, `.level-board`, `.reissue` family — collapsed to 1ms |
| `index.css:13658` | Compound: `max-width: 700px` **and** reduced-motion |

(That is nine rows for eight blocks plus the compound one — the compound query
at `:13658` is also in plan 006's scope for its *width* value. If plan 006 has
landed, its width may now read `768px`. That is expected; do not revert it.)

### The house patterns for neutralizing motion

Three distinct approaches are already in use, and which one applies depends on
what the animation *is*:

1. **Replace with a fade** — when the animation communicates arrival and
   removing it entirely would make content appear abruptly:
   ```css
   animation: arrive-soft 0.2s linear backwards;
   ```
2. **Collapse the duration** — when the animation is a transition between two
   states and both states must still be reached:
   ```css
   animation-duration: 1ms;   /* or 10ms */
   ```
3. **Remove and settle** — when the animation is pure decoration:
   ```css
   animation: none; opacity: 0;
   ```

Pick per animation. Do **not** apply a blanket
`*, *::before, *::after { animation: none !important }` — it would break every
animation whose end state carries meaning (a card that never finishes flipping,
a door that never opens), and it would throw away the deliberate curation this
file already has.

### What is known to be uncovered

Enumerated by inspection, but **not exhaustively** — Step 1 asks you to produce
the authoritative list, because a fragile grep is how a plan ships a wrong
table. Known-uncovered candidates worth checking first:

- `DepartureGate` (改札) — the departure cutscene, `components/station/DepartureGate.jsx`
- `TrainDoor` (扉) — the boarding animation. Note `index.css:13531` covers *part*
  of this already (there is a comment about the doors sitting closed without the
  open animation); check what remains.
- `SplitFlap` — `components/rewards/SplitFlap.jsx`
- `DarumaRitual` — `components/rewards/DarumaRitual.jsx`
- `PassWave` — `components/profile/PassWave.jsx`
- `XpToast` — `components/rewards/XpToast.jsx`
- `CosmeticUnlock` — `components/rewards/CosmeticUnlock.jsx`
- `StageFootlights` — partially covered at `:5093`; check what remains

### Repo conventions

- Plain CSS, no preprocessor. `index.css` is 15,565 lines, organized into
  sections with `/* ── Section name ── */` banner comments.
- Comments explain *why*, at length, and are an asset. Every reduced-motion
  block in this file already carries one explaining what was preserved and
  what was dropped. Match that — a new block with no comment is a regression in
  this file's standards even if the CSS is right.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd frontend && npm install` | exit 0 |
| Build | `cd frontend && npm run build` | exit 0 |
| Lint | `cd frontend && npm run lint` | exit 0 |
| Dev server | `cd frontend && npm run dev` | serves on http://localhost:5173 |
| Count keyframes | `cd frontend && grep -c "@keyframes" src/index.css` | 88 |
| Count reduced-motion blocks | `cd frontend && grep -c "prefers-reduced-motion" src/index.css` | rises from 10 |

## Scope

**In scope** (the only files you should modify):
- `frontend/src/index.css`
- `frontend/src/exam/exam.css`

**Out of scope** (do NOT touch, even though they look related):
- Any JSX file. This is CSS-only. If an animation can only be disabled from JS
  (e.g. a component that measures animation timing), report it rather than
  editing the component.
- The eight existing reduced-motion blocks' *decisions*. You may extend them
  with additional selectors, but do not change what they already do — each was
  written deliberately and several carry comments explaining the tradeoff.
- The compound query at `index.css:13658`'s width value — plan 006 owns that.
- Any `transition:` declaration. There are 109 of them, they are mostly short
  hover/colour transitions, and they are not what causes vestibular symptoms.
  Scope this plan to `animation`. If you find a *long* transform transition
  (>300ms, moving or scaling something large), note it in your summary as a
  follow-up rather than fixing it here.
- Adding a blanket `!important` override. See "The house patterns" above.

## Git workflow

- Branch: `advisor/007-reduced-motion-coverage`
- Commit style is conventional commits, scoped. Use `fix(a11y): ...`.
- **Commit per component family** (gate, door, split-flap, daruma, …), not one
  big commit — each is an independent judgment call about what to preserve.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Produce the authoritative coverage list

Do not trust a one-line grep for this — `animation` appears in shorthand and
longhand forms and inside multi-value declarations, and a naive extraction
produces a wrong list.

Build the list this way:

1. Extract every `@keyframes` name:
   ```bash
   cd frontend && grep -oE "@keyframes\s+[A-Za-z0-9_-]+" src/index.css | awk '{print $2}' | sort -u > /tmp/kf.txt && wc -l < /tmp/kf.txt
   ```
2. For each name in that file, find where it is *used* and which selector uses
   it:
   ```bash
   cd frontend && while read -r n; do echo "── $n"; grep -nE "animation(-name)?:[^;]*\b${n}\b" src/index.css | head -3; done < /tmp/kf.txt
   ```
3. For each selector found, check whether it (or an ancestor selector) appears
   inside any `prefers-reduced-motion` block:
   ```bash
   cd frontend && awk '/@media \(prefers-reduced-motion/,/^}/' src/index.css
   ```

Produce a table: **keyframe name → using selector → covered? (yes/no)**.

Two things this will surface that are fine and are not work:
- **Keyframes defined but never used.** Dead CSS. Note them in your summary as
  a cleanup candidate; do **not** delete them in this plan (deleting dead CSS
  from a 15.5K-line file is its own change with its own review needs).
- **Animations that are already covered indirectly**, because a reduced-motion
  block targets an ancestor or a shared class.

**Verify**: the table exists, its row count matches the number of *used*
keyframes, and it is included in your final summary. This table is the primary
deliverable of the plan.

### Step 2: Classify every uncovered animation

For each uncovered row, assign one of the three house patterns from "Current
state", plus a one-line reason:

- **Fade** — the animation communicates arrival/appearance; content would pop
  in jarringly without it.
- **Collapse duration** — the animation transitions between two meaningful
  states, both of which must still be reached (a door that opens, a flap that
  turns).
- **Remove and settle** — pure decoration; set `animation: none` and whatever
  static end state looks right (`opacity: 0` for a glow, `opacity: 1` for
  content that was fading in).

The test for "decoration versus content": **if the animation stopped mid-way,
would the user lose information?** If yes, it is content — collapse the
duration, never remove it. The existing comment at `index.css:15231` is exactly
this reasoning applied ("The flaps still turn — that is the content").

Record the classification and reason for every row in your summary.

### Step 3: Write the blocks

Add reduced-motion coverage per component family. Place each new block **next
to the CSS it modifies**, not in one lump at the end of the file — that is
where the existing eight live, and it is what makes them findable.

Each block gets a comment in the file's established style, stating what was
preserved and what was dropped. For example:

```css
/* 改札 — the gate still opens, because a gate that never opens is a
   dead end rather than a quieter transition. What goes is the panel
   sliding across the viewport, which is the part that moves a large
   area of the screen. */
@media (prefers-reduced-motion: reduce) {
  .departure-gate__panel { animation-duration: 1ms; }
  .departure-gate__sweep { animation: none; opacity: 0; }
}
```

(That is an illustrative shape, not the actual selectors — use whatever Step 1
found.)

**Verify** after each family: `cd frontend && npm run build` → exits 0.

### Step 4: Verify with reduced motion actually enabled

In Chrome DevTools: **⋮ → More tools → Rendering → Emulate CSS media feature
`prefers-reduced-motion` → `reduce`**.

With it enabled, exercise each animation you touched:

1. Navigate between screens (departure gate, train door).
2. Answer a card to trigger the card stamp and transition.
3. Trigger an XP gain / level-up (the split-flap board, the XP toast).
4. Open the daruma screen and any ritual animation.
5. Open the storehouse and equip a cosmetic (cosmetic unlock).

For each, confirm both:
- **Nothing large slides or scales across the viewport.**
- **The end state is still reached** — no half-open door, no card stuck
  mid-flip, no content left invisible.

The second is the one that breaks, and it breaks silently. Check it for every
single family you touched.

Record a pass/fail per family for both criteria in your summary.

### Step 5: Run the full gate

**Verify**: `cd frontend && npm run lint` → exit 0
**Verify**: `cd frontend && npm test` → all pass
**Verify**: `cd frontend && npm run build` → exit 0

## Test plan

No automated tests — this repo has no visual regression tooling and CSS media
feature emulation is not scriptable in the current setup.

Verification is Step 1's coverage table (which makes the gap measurable rather
than asserted), Step 2's classification with reasons, and Step 4's per-family
manual check with reduced motion actually enabled. The "end state is still
reached" half of Step 4 is the one that matters most — a reduced-motion rule
that leaves an element permanently invisible is worse than the animation it
replaced.

Note as a follow-up in your summary (do not act on it here): the
`@vitest/browser-playwright` and `playwright` packages are already in
`frontend/package.json`'s `devDependencies`. Playwright can emulate
`prefers-color-scheme` and `prefers-reduced-motion` directly, so a smoke test
that loads each screen under reduced motion and asserts no element has
`opacity: 0` after animations settle is genuinely achievable. It would need the
browser test environment to be configured first.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd frontend && grep -c "prefers-reduced-motion" src/index.css` → greater than `10`
- [ ] Step 1's coverage table (keyframe → selector → covered) is complete and in your summary
- [ ] Every row in that table is either covered, classified as intentionally-uncovered with a reason, or noted as a dead unused keyframe
- [ ] Every new `@media (prefers-reduced-motion: reduce)` block has an explanatory comment above it
- [ ] `cd frontend && grep -c "animation: none !important" src/index.css` → `0` (no blanket override)
- [ ] Step 4's per-family pass/fail (both criteria) is recorded in your summary
- [ ] `cd frontend && npm run lint` exits 0
- [ ] `cd frontend && npm test` exits 0
- [ ] `cd frontend && npm run build` exits 0
- [ ] No files outside `frontend/src/index.css` and `frontend/src/exam/exam.css` are modified (`git status`)
- [ ] `plans/README.md` status row for 007 updated

## STOP conditions

Stop and report back (do not improvise) if:

- An animation cannot be neutralized from CSS alone because a component reads
  its timing from JS (an `onAnimationEnd` handler that must fire, or a measured
  duration). Collapsing such an animation to 1ms usually still fires the event,
  but **removing** it with `animation: none` will not — the handler never runs
  and the UI can hang in an intermediate state. Report the specific component;
  `MobileLevelBar` in `components/ui/TopBar.jsx` uses `onAnimationEnd`, so it is
  a known instance of this shape.
- Under reduced motion, any element ends up permanently invisible or a
  transition never completes. Revert that specific rule and report it — this is
  the failure mode that turns an accessibility fix into a broken screen.
- Step 1's table shows that more than about 20 keyframes are genuinely
  uncovered *and* large-motion. That would make this an L-effort plan rather
  than M — report the count and let the operator decide whether to split it
  before proceeding.
- You find yourself wanting to edit a JSX file. That is out of scope; report
  what you found instead.

## Maintenance notes

- **The rule going forward**: a new `@keyframes` that moves or scales anything
  larger than an icon needs a reduced-motion decision in the same commit. The
  question to answer in the comment is always the same one — *if this stopped
  mid-way, would the user lose information?* — because that is what decides
  between collapsing the duration and removing the animation.
- A reviewer should scrutinize: every `animation: none` for whether the element
  ends up in a sensible static state. `animation: none` on something that
  animates *from* `opacity: 0` leaves it invisible forever, and that is
  invisible in a diff too.
- Deliberately deferred: the 109 `transition:` declarations. Almost all are
  short colour/hover transitions that pose no vestibular risk, and auditing
  them all would triple this plan's size for very little gain. Worth a quick
  targeted pass for long transform transitions specifically.
- Deliberately deferred: dead keyframes found in Step 1. Cleaning them up is
  worthwhile but belongs with a broader dead-CSS pass over this file.
