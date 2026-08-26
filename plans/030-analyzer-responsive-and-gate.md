# Plan 030: 車内案内 — the responsive layout, the motion, and the gate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat de78f11..HEAD -- frontend/src/screens/AnalyzerScreen.jsx frontend/src/components/analysis frontend/src/index.css`
> This plan is the last of the wave. If 027, 028 and 029 are not all merged,
> STOP — it lays out components the others create.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MEDIUM — layout and motion only, but it is the plan that decides
  whether the screen works on a phone
- **Depends on**: 027 (**hard**), 028 (**hard**), 029 (**hard**)
- **Category**: UX / accessibility
- **Planned at**: commit `de78f11`, 2026-08-26

## Why this matters

Plans 028 and 029 build a two-part screen — a line of stops and a stage showing
one of them — and render it in one column at every width. That is correct as an
intermediate state and wrong as a final one, in both directions:

- **On a desktop** the line and the stage stack, so a 1052px column shows a
  narrow list of stops with an enormous amount of unused width beside it, and the
  learner scrolls past the whole route to reach the sentence they are reading.
- **On a phone** a vertical route diagram of fifty stops is a wall between the
  intake and the result.

The app has already solved this exact problem once, in the dictionary, and
recorded what it learned. `index.css:14085`:

```css
.dict-dock {
  flex: 0 0 clamp(340px, 30vw, 440px);
  position: sticky;
  top: 84px;
  max-height: calc(100dvh - 108px);
  overflow-y: auto;
  overscroll-behavior: contain;
```

with the comment above it:

> The scroll lives on the dock itself. That is the correction to the original
> side panel, which was pinned to the viewport with no overflow of its own and
> therefore could not hold an entry with a dozen senses — the reason it was
> abandoned for a modal.

**A sticky route rail with fifty stops and no overflow of its own is that bug
again.** This plan copies the working shape rather than rediscovering the broken
one.

And the horizontal case is solved too — `.stroke-rail` (`index.css:14470`) is a
sticky, wrapping thumb rail with a gradient fade, built so "an index that only
jumps is half an index". The mobile stopping-pattern strip is the same object.

## The breakpoint contract

`index.css` is explicit about this, and the rule is binding:

> Two, and they are the whole scale:
>   560px — phone. Below this, single column everywhere.
>   768px — tablet. Also the boundary the top bar's auto-hide uses
>           (MOBILE_BREAKPOINT in components/ui/TopBar.jsx — the two must
>           move together).
> Anything else in this file is a specific component's own constraint, and if
> you add one it needs a comment saying which component and why.

This plan adds **one** one-off — the 1100/1099 pair — and it must carry that
comment. It is the same pair the dictionary already uses, written as integers so
the two bounds can never both match.

| Width | Layout |
|---|---|
| ≥ 1100px | Two columns: sticky route rail left, stage right |
| 768–1099px | One column; the route becomes a sticky horizontal strip |
| 561–767px | Same, tighter padding; the player sticks under the strip |
| ≤ 560px | Same; tiles stack, the rail's signs drop to kanji + latin |

## Steps

### Step 1 — The two-column layout

Add to `index.css`, after plan 029's block.

```css
/* ── The stage and the line, side by side ─────────────────
   ONE one-off breakpoint, per the rule in the Breakpoints block
   above: the component is .anl-results, and the reason is that the
   route rail plus a readable breakdown need ~1040px of content
   before they stop fighting for the same column. 1100/1099 is the
   same complementary integer pair .dict-dock uses, for the same
   reason — written as integers so both bounds can never match. */
@media (min-width: 1100px) {
  .anl-results {
    display: flex;
    align-items: flex-start;
    gap: var(--anl-gap);
  }

  /* The scroll lives on the rail itself. A sticky column pinned to
     the viewport with no overflow of its own cannot hold a fifty-stop
     Passage — that is the mistake .dict-dock's comment records, and
     it is the same mistake here. */
  .anl-line {
    flex: 0 0 clamp(260px, 24vw, 340px);
    position: sticky;
    top: 24px;
    max-height: calc(100dvh - 48px);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 4px;   /* room for the scrollbar, so no stop sits under it */
  }

  .anl-stage {
    flex: 1;
    min-width: 0;         /* without this a long Japanese line refuses to
                             shrink and pushes the rail off the screen */
  }
}
```

`min-width: 0` on the flex child is not optional. A flex item's default
`min-width: auto` refuses to shrink below its content, and a `.phrase-line` of
unbroken Japanese is exactly the content that triggers it.

**Verify:** at ≥1100px, the rail is beside the stage, sticks while the stage
scrolls, and scrolls internally once the Passage is long enough.

### Step 2 — The 停車駅 strip, below 1100

The same `PassageLine` data, laid horizontally. `orientation="strip"` was built
in plan 028; this is where the screen actually chooses it — pass
`orientation={isWide ? 'vertical' : 'strip'}` driven by a
`matchMedia('(min-width: 1100px)')` listener, **not** by a resize handler
counting pixels in JS. Subscribe on mount, unsubscribe on unmount.

```css
/* ── 停車駅案内 — the stopping-pattern strip ───────────────
   The band above a train door: the same stops, laid along the
   direction of travel, with where-you-are lit. Sticky like
   .stroke-rail and for the same stated reason — a route map you can
   only jump from is half a route map. */
@media (max-width: 1099px) {
  .anl-line--strip {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    flex-direction: row;
    gap: 0;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
    padding: 10px 0 12px;
    background: linear-gradient(180deg,
      var(--bg-main) 0%, var(--bg-main) 78%, transparent 100%);
  }
  .anl-line--strip .anl-stop {
    flex: 0 0 auto;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 84px;
    padding: 22px 6px 8px;
  }
  /* The rail runs left-right now, threaded through the markers. */
  .anl-line--strip .anl-stop__rail {
    left: -50%;
    right: -50%;
    top: 12px;
    bottom: auto;
    width: auto;
    height: 3px;
  }
  .anl-line--strip .anl-stop--first .anl-stop__rail { left: 50%; }
  .anl-line--strip .anl-stop--last  .anl-stop__rail { right: 50%; }
  .anl-line--strip .anl-stop__marker { left: 50%; top: 6px; margin: 0 0 0 -6px; }
  .anl-line--strip .anl-stop__text {
    width: 100%;
    text-align: center;
    font-size: 0.78rem;
  }
}
```

The active stop's `scrollIntoView({ block: 'nearest' })` from plan 028 works
unchanged in this orientation — `nearest` is what makes it correct in both.

**Verify:** at 900px and at 375px, the strip is horizontal, sticks to the top
while the stage scrolls, and scrolls horizontally to the active stop on its own.

### Step 3 — The player, on a phone

A video Passage on a phone puts the player above the stage. Scrolling the
breakdown must not scroll the video off the screen — reading the sentence and
watching the clip are one act.

```css
@media (max-width: 1099px) {
  .anl-player {
    position: sticky;
    /* Under the strip, not over it: the strip is sticky at top: 0 and
       is ~64px tall at this width. Two sticky siblings at the same
       offset overlap. */
    top: 64px;
    z-index: 4;
    background: var(--bg-main);
    padding-bottom: 8px;
  }
}
```

If the strip's height changes, this number changes with it. Leave the comment —
it is the only thing that makes the coupling visible.

**Verify:** on a video Passage at 375px, scroll the breakdown. The player and the
strip both stay, and they do not overlap.

### Step 4 — Motion, and its absence

Every animated element on this screen needs a reduced-motion fallback. The
convention here is `arrive` → `arrive-soft` (fade in place, no `translateY`), the
same pair `.dict-dock` uses:

```css
.anl-panel,
.anl-results { animation: arrive 0.28s cubic-bezier(0.22, 0.68, 0.32, 1) backwards; }

@media (prefers-reduced-motion: reduce) {
  .anl-panel,
  .anl-results { animation: arrive-soft 0.2s linear backwards; }
}
```

**Do not add a stagger to `.anl-stop`.** The `nth-child` delays at
`index.css:400-407` exist for lists of five to eight; a fifty-stop Passage
staggered at 30ms takes a second and a half to finish drawing, and the last stops
arrive after the reader has already started scrolling.

Audit the whole wave in one pass:

```bash
grep -n "transition\|animation" frontend/src/index.css | sed -n '/anl-/p'
```

Every rule that appears must be covered by a `prefers-reduced-motion` block.
Plans 027–029 each added one; confirm none was missed.

**Verify:**

```bash
cd frontend && npm run build
```

### Step 5 — Headings, landmarks and focus

Plan 003 established the rule this screen must not break: **one `<h1>` per
screen**, and it comes from the station plate (`StationSign`'s `__name` renders
the `<h1>`; `SectionHeader`'s `title` renders an `<h2>`).

Check the tree:

- `<StationHeader />` supplies the only `<h1>`. The analyzer must not add one.
- 現在の停車駅 and 運行履歴 are `<SectionHeader>` — `<h2>`s.
- `<main id="main-content">` is present (the skip link targets it).
- The tablist is `role="tablist"`; each panel is `role="tabpanel"` with
  `aria-labelledby` pointing at its tab, and **only the active panel is in the
  DOM**, so focus can never land inside a hidden one.
- `PassageLine`'s stops are `<button>`s (plan 028) with `aria-current`.
- `.anl-slip:focus-within` carries the focus ring (plan 029), since the textarea
  inside it is borderless — plan 005's rule.

**Verify** in the browser console on `/analyzer` with a result on screen:

```js
document.querySelectorAll('h1').length            // 1
document.querySelectorAll('main').length          // 1
document.querySelectorAll('[role="tabpanel"]').length  // 1
document.querySelectorAll('.anl-stop:not(button)').length // 0
```

### Step 6 — The responsive browser test

Create `frontend/src/screens/AnalyzerScreen.responsive.browser.test.jsx`.

The browser lane exists for exactly this — `vite.config.js`:

> the browser lane exists for anything that needs a real DOM — focus management,
> heading structure, computed styles under a media feature.

Four cases:

1. **One `<h1>`.** Render with a multi-Sentence Passage; assert
   `container.querySelectorAll('h1').length === 1`. This is the assertion that
   catches somebody adding a screen title above the plate.
2. **Only the active tab panel exists.** Assert exactly one `[role="tabpanel"]`,
   and that its `aria-labelledby` names the tab with `aria-selected="true"`.
3. **Arrow keys drive the rail.** Focus tab 1, dispatch `ArrowRight`, assert
   `aria-selected` moved to tab 2 and that tab 2 is `document.activeElement`.
4. **Stops are buttons and carry `aria-current`.** Exactly one
   `[aria-current="true"]`, and it matches the focused Sentence.

Mock `../lib/api`, `useMining` (spread from `importOriginal` — a bare factory
breaks `buildCloze`, the trap recorded in the polling test) and `VideoPlayer`,
exactly as `AnalyzerScreen.polling.browser.test.jsx` does. Wrap in
`<LangProvider>` and stub `globalThis.fetch`, or the provider's translation fetch
produces an unhandled rejection that pollutes the run.

Do **not** try to assert a layout by reading `getBoundingClientRect` at a
simulated width — the browser lane runs one viewport and a media-query assertion
there is a test that passes for the wrong reason. Layout is verified by hand in
the test plan below.

**Verify:**

```bash
cd frontend && npm test -- --run src/screens/AnalyzerScreen.responsive.browser.test.jsx
```

Expected: 4 passing.

### Step 7 — The gate

```bash
cd frontend && npm test -- --run && npm run lint && npm run build
```

Expected: every test passes, lint 0 errors (pre-existing warnings fine), clean
build.

Then update `plans/README.md`: mark 027–030 DONE and add an execution note
recording anything that turned out differently — especially any breakpoint number
you had to change, since the next person will trust the table in this plan.

## STOP conditions

- **You need a second one-off breakpoint.** The contract allows the 1100/1099
  pair and nothing else in this wave. If the layout seems to need a third, the
  layout is wrong — clamps scale continuously and are almost always the answer.
- **The sticky rail has no `max-height`/`overflow-y`.** That is the exact bug
  `.dict-dock`'s comment records. A long Passage will run off the bottom of the
  viewport with no way to reach its last stops.
- **`MOBILE_BREAKPOINT` in `TopBar.jsx` no longer matches the 768px in
  `index.css`.** They are documented as moving together. Do not change either in
  this plan.
- **A second `<h1>` appears on the screen.** Plan 003 paid for this; do not undo
  it.
- **A `prefers-reduced-motion` block is missing** for any `.anl-*` transition or
  animation.

## Boundaries

**In scope**: `index.css` (additive), the orientation switch in
`AnalyzerScreen.jsx`/`PassageLine.jsx`, and the new responsive browser test.

**Out of scope**: `TopBar.jsx` and its breakpoint constant, `.page-pad`,
`.container`, `.card`, the dictionary's own rules, and every component's
behaviour — this plan moves boxes and guards motion, it does not change what
anything does.

One known oddity is **deliberately left alone**: `.page-pad` adds
`padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px))` below 768px to
clear `.mobile-level-bar`, which the analyzer never renders. The analyzer
therefore has ~72px of unused bottom padding on a phone. It is harmless, the rule
is global, and narrowing it belongs to a plan that can check all six screens that
depend on it.

## Done criteria

```bash
cd frontend && npm test -- --run && npm run lint && npm run build
```

- All tests pass, lint 0 errors, build clean.
- `grep -n "@media (min-width: 1100px)\|@media (max-width: 1099px)" frontend/src/index.css`
  shows the new blocks carrying the required "which component and why" comment.
- The four console assertions in Step 5 hold.
- At 1440 / 1024 / 768 / 414 / 360px, in **both** themes, with a video Passage
  and with a ten-Sentence text Passage: nothing overlaps, nothing is clipped, the
  page never scrolls horizontally, and no element touches a panel edge.

## Test plan

Automated: Step 6's four cases, plus the whole existing suite.

Manual — the widths are the test, so do all of them:

1. **1440px**: rail left, stage right. Scroll the stage; the rail stays. Analyze
   a fifty-stop Passage; the rail scrolls internally and the page does not grow a
   second scrollbar.
2. **1100px exactly**: two columns (the bound is inclusive). **1099px**: one
   column, strip. Neither width shows both layouts or neither.
3. **768px**: strip sticks to the top; the top bar's auto-hide still behaves.
4. **414px**, video Passage: the strip and the player both stick, stacked, not
   overlapping. The active stop scrolls itself into view as the video plays.
5. **360px**: the three platform signs still read — number, kana, kanji, latin —
   without wrapping into two lines or clipping. The photo tiles are stacked.
6. **Both themes** at 360 and 1440. Check specifically that the strip's gradient
   fade matches `--bg-main` in each; a gradient to a hard-coded colour is visible
   the moment the theme flips.
7. **Reduced motion on**: panels fade rather than slide, the strip jumps rather
   than glides, nothing else moves.
8. **Keyboard only, 1440 and 375**: Tab from the top bar through the rail, the
   intake, the stops, and the stage. Focus is visible at every step and never
   enters a hidden panel.

## Maintenance note

`.anl-player`'s `top: 64px` is coupled to the strip's rendered height. Anything
that changes the strip's padding or font size must revisit that number; the
comment in the rule is the only warning the next reader gets.

The 1100/1099 pair now appears twice in this file — the dictionary's dock and the
analyzer's rail. If a third consumer arrives, that is the moment to promote it to
a named token in the Breakpoints block rather than write it a third time.

Watch in review: any new `@media` in the analyzer's rules without a comment
naming the component and the reason; any sticky element without a `max-height`;
and any JS resize listener added where `matchMedia` would do.
