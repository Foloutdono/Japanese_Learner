# Plan 010: Restore the lost `hanko-ink-bleed` keyframe and correct a misleading motion comment

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat a3c6597..HEAD -- frontend/src/index.css`
> On any mismatch with the "Current state" excerpts, treat it as a STOP
> condition. **Re-locate every rule by content/selector, not by line number.**

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `a3c6597`, 2026-08-25

## Why this matters

Two independent defects in `frontend/src/index.css`, both surfaced while
executing plan 007 and both since confirmed by reading the code and the git
history.

**1. A visual effect on the core review loop never renders.**
`.card-stamp::after` — the ink-bleed ripple around the promotion stamp a
learner sees when a card graduates — declares
`animation: hanko-ink-bleed 560ms ease-out 420ms forwards` on an element with
`opacity: 0`. **The `hanko-ink-bleed` keyframe does not exist anywhere in the
file.** A `forwards` animation with an undefined name never runs and never
applies a fill, so the element sits at `opacity: 0` permanently, in every
state and every motion mode. The effect is simply absent.

Git history shows exactly how: commit `8f28dc1` added both the keyframe and
its usage; commit `11877a8` (a rename refactor, `hanko-*` → `card-stamp-*`)
deleted the keyframe; commit `0756427` later re-introduced a *usage* of the
now-deleted name. A stale reference resurrected against a removed definition.
**The original keyframe is recoverable verbatim from history** — so this is a
restore, not a redesign.

**2. A load-bearing comment describes a mechanism that does not exist.**
A comment block above one of the reduced-motion sections claims that three
keyframes — `xp-toast-arrive`, `xp-toast-fall`, `level-up-banner-settle` — are
what `XpToast.jsx` listens to via `onAnimationEnd`, and that they are
"redeclared here as near-instant, motion-free versions."

None of that is true. Those three keyframe names exist nowhere in the file
(0 occurrences each). `XpToast.jsx` actually listens for `fare-tick-out`,
`level-board-out`, and `reissue-out`. And the reduced-motion block directly
below the comment contains **no keyframe redeclarations at all**.

The real mechanism *does* work, but by a completely different route (see
"Current state"). That makes the comment worse than merely wrong: a maintainer
who trusts it could "fix" the missing redeclarations, or refactor the actual
mechanism away believing it is not what is holding the behaviour up. This is a
documented trap on a subtle piece of cascade behaviour.

## Current state

### Defect 1 — `.card-stamp::after`

Locate by searching for `.card-stamp::after {`. Current content:

```css
.card-stamp::after {
  content: '';
  position: absolute;
  inset: -12px;
  border-radius: 18px;
  border: 2px solid var(--state-learning);
  opacity: 0;
  animation: hanko-ink-bleed 560ms ease-out 420ms forwards;
}
```

Confirmed: `grep -c "@keyframes hanko-ink-bleed" src/index.css` → **`0`**.

Two variants override it (both by content, not line):

```css
.card-stamp--demoted::after {
  animation-delay: 1510ms;
}
```
```css
.card-stamp--mastered::after {
  inset: -18px;
  border-radius: 50%;
  border-color: var(--state-mastered);
  animation-delay: 560ms;
  animation-duration: 700ms;
}
```

Neither overrides `animation-name`, so **all three variants are equally
broken** — they all reference the missing keyframe.

### The original keyframe, recovered from commit `8f28dc1`

```css
@keyframes hanko-ink-bleed {
  0%   { opacity: 0.5; transform: scale(0.3); }
  100% { opacity: 0;   transform: scale(2.2); }
}
```

Note it **ends at `opacity: 0`** — this is a transient expanding ripple that
fades out, not a ring that persists. That matters: restoring it changes the
element from "never visible" to "brief ripple, then invisible again", which is
exactly the intended behaviour and is why the base rule's `opacity: 0` is
correct as written.

The element it originally styled (`.hanko-stamp::after`, since renamed to
`.card-stamp::after`) used `inset: -10px; border-radius: 12px; border: 2px
solid var(--accent);` — the current values are a deliberate restyle. **Only
the keyframe was lost; the element's own styling is current and correct.** Do
not revert the element's styling to the historical values.

### Defect 1's existing reduced-motion coverage — leave it alone

Inside a reduced-motion block there is already:

```css
  .card-stamp::after,
  .card-stamp-wash,
  ...
  .petal { animation: none; opacity: 0; }
```

This keeps the ripple suppressed under reduced motion. That is correct and
must stay correct after the keyframe is restored — the ripple is decoration,
and `opacity: 0` is its right static state (the animation's own end state is
`opacity: 0` too, so nothing is lost).

### Defect 2 — the false comment

Locate by searching for `xp-toast-arrive`. The comment reads (excerpt):

```
   Two of the animations below (xp-toast-arrive, xp-toast-fall,
   level-up-banner-settle) are also the exact ones XpToast.jsx
   listens to via onAnimationEnd to know when to advance — so instead
   of just disabling them, they're redeclared here as near-instant,
   motion-free versions that keep the *same* animation-name and still
   fire a real animationend. That's what lets the component's timing
   stay driven entirely by real CSS completion events in both motion
   modes, rather than needing a separate reduced-motion code path in
   the JS.
```

Confirmed false on every count:

- `grep -c "@keyframes xp-toast-arrive" src/index.css` → `0` (same for
  `xp-toast-fall` and `level-up-banner-settle`)
- `frontend/src/components/rewards/XpToast.jsx` listens via
  `onExitEnd('fare-tick-out')`, `onExitEnd('level-board-out')`,
  `onExitEnd('reissue-out')`
- The reduced-motion block immediately below the comment contains only
  `.kumadori-streak`, `.ember`, `.stage-footlights__glow`, and
  `.stage-footlights--big::before` rules — zero `@keyframes` redeclarations

### How the mechanism *actually* works (this is what the comment should say)

The exit animations are applied on `--leaving` modifier classes:

```css
.fare-tick--leaving   { animation: fare-tick-out 260ms ease-in forwards; }
.level-board--leaving { animation: level-board-out 300ms ease-in forwards; }
.reissue--leaving     { animation: reissue-out 340ms ease-in forwards; }
```

And a *later* reduced-motion block sets duration on the **base** classes:

```css
/* The flaps still turn — that is the content, not decoration — but
   nothing slides or scales around them. */
@media (prefers-reduced-motion: reduce) {
  .fare-tick,
  .level-board,
  .reissue,
  ... {
    animation-duration: 1ms;
  }
}
```

`XpToast.jsx` renders both classes together, e.g.
``className={`fare-tick fare-tick--q${...}${leaving ? ' fare-tick--leaving' : ''}`}``.

Both selectors have specificity (0,1,0) — a media query adds none — so
**source order decides**, and the reduced-motion block comes later in the
file. Result: `animation-name` survives from the `--leaving` shorthand while
`animation-duration` is overridden to `1ms`. The animation still runs and
still fires a real `animationend` carrying the right `animationName`, just
almost instantly. The component's timing therefore needs no reduced-motion
branch in JS.

That is genuinely elegant and genuinely fragile — moving either block would
break it silently — which is precisely why the comment needs to describe it
accurately.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Build | `cd frontend && npm run build` | exit 0 |
| Lint | `cd frontend && npm run lint` | exit 0, 0 errors, 18 warnings |
| Test | `cd frontend && npm test` | all pass |
| Dev server | `cd frontend && npm run dev` | serves |

## Scope

**In scope** (the only file you should modify):
- `frontend/src/index.css`
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):
- `frontend/src/components/rewards/XpToast.jsx` and
  `frontend/src/components/study/CardStamp.jsx`. Both are correct. This plan
  fixes CSS and a comment, not component logic.
- The `--leaving` rules and the `animation-duration: 1ms` reduced-motion
  block. They work. Defect 2 is a comment fix; changing the mechanism it
  describes is explicitly not the goal.
- The element styling of `.card-stamp::after` / `--demoted` / `--mastered`
  (inset, border-radius, border-color). Current values are a deliberate
  restyle; only the keyframe was lost.
- The existing `.card-stamp::after { animation: none; opacity: 0; }`
  reduced-motion rule. Correct as-is.
- Any other undefined-keyframe references you may find. If you find more,
  **report them** — a systematic sweep is worth its own plan, and bundling it
  here makes this diff unreviewable.

## Git workflow

- Branch: `advisor/010-card-stamp-ripple-and-stale-comment`
- Conventional commits, scoped. Use `fix(css): ...` for defect 1 and
  `docs(css): ...` for defect 2.
- **Two commits**, one per defect — they are unrelated and a reviewer should be
  able to take one without the other.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm both defects before fixing either

```bash
cd frontend
grep -c "@keyframes hanko-ink-bleed" src/index.css          # expect 0
grep -c "animation: hanko-ink-bleed" src/index.css          # expect 1
for n in xp-toast-arrive xp-toast-fall level-up-banner-settle; do
  echo "$n: $(grep -c "@keyframes $n" src/index.css)"       # expect 0 each
done
grep -n "onExitEnd(" src/components/rewards/XpToast.jsx     # expect fare-tick-out/level-board-out/reissue-out
```

**Verify**: all counts as annotated. If `@keyframes hanko-ink-bleed` returns
`1`, the defect has already been fixed — STOP and report.

### Step 2: Restore the keyframe

Add the recovered definition immediately **after** the `.card-stamp::after`
rule block, so the definition sits beside its only consumer:

```css
/* Restored from commit 8f28dc1. The hanko-* -> card-stamp-* rename in
   11877a8 deleted this keyframe, and 0756427 later re-introduced a
   reference to it on .card-stamp::after — leaving a `forwards`
   animation pointing at nothing, so the ring sat at its declared
   opacity: 0 forever and the ripple never rendered at all.
   A transient bleed, not a persistent ring: it ends at opacity 0,
   which is why the base rule starts there too. */
@keyframes hanko-ink-bleed {
  0%   { opacity: 0.5; transform: scale(0.3); }
  100% { opacity: 0;   transform: scale(2.2); }
}
```

Do not change the `.card-stamp::after` rule itself, or either variant.

**Verify**: `cd frontend && grep -c "@keyframes hanko-ink-bleed" src/index.css` → `1`
**Verify**: `cd frontend && npm run build` → exit 0

### Step 3: Verify the ripple actually renders now

The stamp fires when a card is promoted — reaching that live needs an
authenticated session and a real review. Do what you can:

**Preferred (live)**: log in, review a card to promotion, and confirm a brief
expanding ring appears around the stamp and then fades. Confirm it is *brief*
— a persistent ring would mean the `forwards` fill is holding a wrong state.

**Fallback (isolated)**: in the browser console on any screen, inject a probe
element carrying the class and read back its computed animation, e.g. confirm
`getComputedStyle(el, '::after').animationName` resolves to `hanko-ink-bleed`
rather than `none`. This proves the reference now binds.

**Also verify reduced motion**: with Chrome DevTools' `prefers-reduced-motion:
reduce` emulation on, confirm the ripple does **not** play (the existing
`animation: none; opacity: 0` rule should still win). This is the check that
catches a restored animation accidentally escaping its motion suppression.

State clearly in your summary which path you used and what you observed.

### Step 4: Correct the false comment

Replace the inaccurate paragraph with an accurate description of the real
mechanism. Keep the surrounding comment's other content (the parts about
cascade ordering and `@keyframes` redeclaration being an easy trap are
correct and worth keeping). Target replacement for the false paragraph:

```
   XpToast.jsx drives its own timing off real animationend events —
   it listens for fare-tick-out, level-board-out and reissue-out (see
   onExitEnd there). Those exit animations are declared on the
   --leaving modifier classes further down this file, and the
   reduced-motion block near them sets animation-duration: 1ms on the
   *base* classes (.fare-tick/.level-board/.reissue). Same specificity,
   later in source order, so duration is overridden while
   animation-name survives from the --leaving shorthand: the animation
   still runs and still fires a real animationend with the right
   animationName, just almost instantly. That is what keeps the
   component's timing identical in both motion modes with no
   reduced-motion branch in the JS -- and it is why moving either of
   those two blocks relative to the other would break it silently.
```

**Verify**: `cd frontend && grep -c "xp-toast-arrive" src/index.css` → `0`
**Verify**: `cd frontend && grep -c "fare-tick-out" src/index.css` → at least `2`
(the keyframe/usage plus the new comment reference)

### Step 5: Run the full gate

**Verify**: `cd frontend && npm run lint` → exit 0, 0 errors, 18 warnings
**Verify**: `cd frontend && npm test` → all pass
**Verify**: `cd frontend && npm run build` → exit 0

## Test plan

No automated tests — CSS with no test harness for animation behaviour.
Verification is the greps in Steps 1/2/4 plus the live-or-isolated check in
Step 3, including the reduced-motion case.

Note as a follow-up (do not act on it here): once plan 008's browser test lane
exists, a test asserting that **every `animation-name` referenced in
`index.css` has a matching `@keyframes`** would catch this entire class of
defect mechanically — and would have caught this one the moment `0756427`
landed. That is a genuinely valuable, cheap CI check and is the strongest
follow-on this plan implies.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd frontend && grep -c "@keyframes hanko-ink-bleed" src/index.css` → `1`
- [ ] `cd frontend && grep -c "xp-toast-arrive" src/index.css` → `0`
- [ ] `cd frontend && grep -c "xp-toast-fall" src/index.css` → `0`
- [ ] `cd frontend && grep -c "level-up-banner-settle" src/index.css` → `0`
- [ ] The `.card-stamp::after` rule block itself is unchanged (`git diff` shows no edit to its declarations)
- [ ] The existing `.card-stamp::after { animation: none; opacity: 0; }` reduced-motion rule is unchanged
- [ ] Step 3's observation (live or isolated, plus the reduced-motion check) is recorded in your summary
- [ ] `cd frontend && npm run lint` exits 0, `npm test` passes, `npm run build` exits 0
- [ ] Exactly two commits, one per defect
- [ ] No files outside `frontend/src/index.css` and `plans/README.md` modified
- [ ] `plans/README.md` status row for 010 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `@keyframes hanko-ink-bleed` already exists — someone fixed it first.
- Restoring the keyframe makes the ring **persist** rather than fade. That
  would mean something overrides the `100% { opacity: 0 }` end state, and the
  right response is to report what, not to add an `opacity: 0 !important`.
- Under reduced-motion emulation the ripple now plays. The existing
  suppression rule should prevent it; if it does not, the cascade has changed
  and that is worth understanding rather than patching.
- You find additional `animation:` references to keyframes that do not exist.
  Report the full list — that turns the follow-on CI check from "nice to have"
  into "needed now", and a sweep belongs in its own plan.
- The `--leaving` rules or the `animation-duration: 1ms` block have moved
  relative to each other since this plan was written, such that the mechanism
  described in Step 4's replacement comment is no longer accurate. Verify the
  source order before writing the comment; describe what is actually true.

## Maintenance notes

- **The class of bug here is "reference outlives definition."** It survived a
  rename refactor and a later resurrection, and nothing in lint, build, or
  tests catches it — an undefined `animation-name` is not a CSS error, it just
  silently does nothing. The mechanical check described in "Test plan" is the
  durable fix; this plan only repairs the one instance.
- A reviewer should scrutinize: that the ripple is *transient*. The animation
  ends at `opacity: 0` and uses `forwards`, so the final computed state is
  invisible — that is correct and intended, not a bug to "fix" later.
- The comment corrected in defect 2 documents a cascade dependency between two
  physically distant blocks in a 15K-line file. If `index.css` is ever split
  (deferred from plan 006), **this is one of the pairs that must not be
  separated into files that load in a different order.** Worth carrying into
  that plan when it happens.
