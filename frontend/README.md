# frontend

React + Vite frontend for the Japanese-learning app. See the repository root
`CLAUDE.md` for the full architecture; this file covers what's specific to
this package.

```bash
npm install
npm run dev       # Vite dev server, proxies /api -> localhost:8000
npm run build
npm run lint       # JS/JSX
npm run lint:css   # CSS -- see "Design conformance guards" below
npm run lint:scale # design-token scale ratchet -- see below
npm run lint:ink   # ink/ground structural rule -- see below
npm test           # vitest, two lanes (node + browser)
```

## Design conformance guards

Five guards, run by CI on every PR, exist because this project has 19,000
lines of CSS and no other tool looks at any of it. They do not enforce
taste; they enforce that a decision already made stays made.

1. **stylelint** (`npm run lint:css`) — catches duplicate selectors, values
   that are invalid for their property, and custom properties written
   without `var()`. It does not run raw: `scripts/stylelint-ratchet.mjs`
   compares the run against `.stylelint-baseline.json` and fails only when a
   violation count goes *up*. The stylesheet has a known, deliberately
   unfixed population of violations; mass-editing it is a bigger risk than
   the violations are. Use `npm run lint:css:report` to see them all.
   `.stylelintrc.json` also turns off a handful of `stylelint-config-standard`
   defaults (`selector-class-pattern`, `declaration-block-single-line-max-declarations`,
   `alpha-value-notation`, `color-function-alias-notation`,
   `color-function-notation`, `media-feature-range-notation`,
   `at-rule-empty-line-before`, `custom-property-empty-line-before`) — none of
   them catches a class of bug this repository has shipped, and left on they
   are over 90% of the raw violation count (this codebase's BEM class names
   alone trip `selector-class-pattern` 2000+ times), which would bury the
   five rules this plan actually cares about.

2. **The token contract** (`src/design-system.browser.test.jsx`) — runs in
   the chromium lane and asserts, against the real cascade, that every
   `:root` token resolves in both themes, that no token exists in one theme
   only, and that nothing references a custom property that was never
   defined. That last one is not hypothetical: `var(--text)` shipped and
   painted nothing for months. Enumerating declared custom properties walks
   `document.styleSheets`; note that modern Chromium's CSS Nesting support
   means every `CSSStyleRule` now carries its own (possibly empty)
   `.cssRules`, so branching recursion on `rule.cssRules` truthiness alone
   silently skips every leaf rule -- call the visitor on anything with a
   `selectorText` and separately recurse only when `cssRules.length` is
   nonzero.

3. **The scale ratchet** (`npm run lint:scale`) — reads
   `src/design-scale.json` and fails on a font-size, radius, gap or padding
   literal that is neither an approved token nor on the allowlist. The
   allowlist ships pre-populated with every literal that existed when the
   guard was added, so it was green on day one. **Its shrinking is the
   harmonisation metric.** Adding to it is allowed and is meant to be
   conspicuous. The scan strips `/* ... */` comments before matching --
   `index.css`'s comments quote real declarations and cite pixel values
   constantly, and a comment-blind scan reports violations that don't exist
   (a real example hit during development: a comment reading "...the
   plate's padding: the stripe is the plate's..." parses as a padding
   declaration under a naive line grep). The duplicate-`@keyframes` check is
   at-rule-aware for the same reason: `card-stamp-strike` and
   `card-stamp-strike-center` are each defined once at top level and once
   inside `@media (prefers-reduced-motion: reduce)` on purpose, and only a
   same-name pair sharing the *same* at-rule context is a real collision.

   **Two more surfaces (plan 047), because the four properties above missed
   most of the study screen's real type and space scale:**
   - a CSS **custom property** whose *value* is a bare `px`/`rem`/`em`
     length, e.g. `--card-pad-y: 40px;`. Classified by value, not by name
     (`--card-pad-y`, `--char-size`, `--ember-drift`, ... — names drift, a
     length doesn't stop being one). `var(...)`, `calc(...)`, `clamp(...)`
     and colours never match. Plan 047 reported every one of these as a
     single `custom-property-length` class, which meant it counted the
     scale's *own* token definitions (`--fs-caption-xs: 0.62rem`, `--sp-6:
     22px`) as violations — 74 of 101 occurrences on the commit plan 050
     measured it. Plan 050 split it by where the declaration lives:
     - **`design-token`** — declared inside a `:root` block: bare `:root`,
       or `:root` with an attribute selector, e.g.
       `:root[data-theme="light"]` or a cosmetics block like
       `:root[data-seal="seal_shu"], [data-seal-preview="seal_shu"] {
       --seal-radius: 6px; }`. This *is* the scale (and its per-cosmetic
       overrides). Reported every run, for visibility in a diff, but
       **never fails the build** — minting a token is a deliberate design
       act, not debt.
     - **`custom-property-length`** — the identical declaration shape
       anywhere else: a component overriding geometry with a literal
       instead of `var(...)`. This is the real target and stays fully
       ratcheted, exactly as the four properties above.

     **A rise in `design-token` is a new token and is fine. A rise in any
     other class is new debt and fails the build. Never widen a list to
     make a check pass.**
   - `js-inline-length` — the same kind of length, but written from
     `.jsx`/`.js` into a custom property: `style={{'--char-size':
     \`${size}px\`}}` (template literal) or `style={{'--front-size':
     '80px'}}` (string literal), including one buried inside a ternary
     (`'--front-size': (isF2B ? c.front : c.back)?.length === 1 ? '80px' :
     '32px'` reports both branches). **Deliberately out of reach**: a
     numeric prop like `size={100}` that is only *passed* to a component and
     becomes a px string somewhere else, in a different file. Tracing a prop
     back to its origin needs real dataflow analysis and isn't worth it --
     every one of those props eventually flows through a site of exactly the
     shape this scan already catches, so catching it there is enough. This
     boundary is deliberate, not an oversight; see the header comment in
     `check-design-scale.mjs`.

   **Occurrence counts, not just distinct values.** Each of the seven
   classes above (the original four properties, `design-token`,
   `custom-property-length`, `js-inline-length`) is tracked two ways: the
   allowlist (distinct values) and a **count** of how many times, in total,
   an off-scale value for that class occurs in the source. The allowlist
   only shrinks when the *last* use of a value disappears, so a migration
   that halves a value's occurrences without eliminating it entirely would
   otherwise look like no progress at all. The occurrence count catches
   that: for every class **except `design-token`**, it must never rise (a
   second `border-radius: 5px` added anywhere fails the guard even though
   `5px` was already allowlisted), and falling needs no allowlist edit at
   all. `design-token`'s count is reported the same way but is purely
   informational — it rises every time a token is minted, and that is
   expected, not a violation. `npm run lint:scale` prints both numbers for
   every class; `--write` re-seeds all of them, including `design-token`.

   **Shorthands are matched per component (plan 053).** `padding`, `gap`
   and `border-radius` can legitimately hold several scale values at once,
   but the scan compares a declaration's *whole* value against a set of
   approved strings, so `padding: var(--sp-4) var(--sp-6)` — both halves
   real tokens — read as one unrecognised literal and failed the build.
   For those three properties only (never `font-size`, which is
   single-valued), a value the whole-value check doesn't recognise is
   split into top-level components and accepted if **every** component is
   a token for that property, a top-level `/` (elliptical
   `border-radius`), or `0`. Three things about that are deliberate:
   - **`0` is the only non-token component accepted.** Not `0px` (`gap:
     0px` is off-scale today and stays so), and not the CSS-wide
     keywords a whole value may be — `padding: var(--sp-4) inherit`
     doesn't parse, so component-exempt is a strictly narrower set than
     value-exempt.
   - **Allowlisted literals are NOT accepted as components.** This is the
     tempting generalisation and it would erase 221 of 1,951 occurrences
     — 46.4% of all padding — because `10px` and `14px` are each
     separately allowlisted, so `padding: 10px 14px` would scan as
     on-scale. Debt does not stop being debt by being written twice on
     one line.
   - **The splitter is paren-aware**, so `clamp(24px, 3vw + 12px, 44px)
     var(--anl-pad-inline)` is two components, not five. No value in the
     file distinguishes this from a naive whitespace split today, which
     is exactly why it is worth stating.

   Escaping the ratchet by writing `padding-top: 13px` still works:
   `padding-block`, `padding-inline`, the physical padding longhands and
   `row-gap`/`column-gap` are entirely unscanned. Closing that needs
   `tokens[]` entries per property first, or it baselines correct
   declarations as debt — it is its own job, and it will make the metric
   jump *up* because measurement improved, not because debt grew.

   **The honest harmonisation metric, after plans 050 and 053**: 27
   `custom-property-length` occurrences (component-level lengths that
   should be tokens), 21 `js-inline-length` occurrences, and 1,951
   plain-CSS property occurrences across the four scale-ratcheted
   properties — all three can genuinely go to zero. `design-token`'s 74
   cannot and must not: it's the scale itself. Three different numbers
   circulate here and they are not interchangeable: the **allowlist
   length** (433 distinct literals), the **live occurrence count**
   (1,951), and the **stored ceiling** in `counts`. Say which one you
   mean. `--write` only ever unions, so the allowlist can never shrink on
   its own — any claim that it fell is a deliberate hand edit.

4. **Contrast** (`src/contrast.browser.test.jsx`) — the check DESIGN.md
   spent a section saying did not exist. Also in the chromium lane, and that
   is deliberate: the other text-scanning guards cannot answer "what colour
   is this". Every ground in the sheet is a `color-mix()` over tokens, which
   Chrome serialises as `color(srgb ...)`, so a script would have to
   reimplement CSS Color 4 mixing to find out what is on screen — and a
   guard that gets that subtly wrong is worse than none: it is the 3.48:1
   button passing again. Here Chromium resolves the colour and a canvas
   paint composites it, alpha and all.

   Two parts, because there are two ways to fail. The **contract matrix**
   measures the intended pairings (ambient inks on paper grounds, panel inks
   on sumi) and catches a token drifting under the floor. The **site sweep**
   renders real markup and walks real ancestors, which is the only way to
   catch a rule putting the *wrong* ink on a ground — a pair the contract
   does not contain, and the defect that had the Today strip at 2.80:1 in
   light theme while dark measured a healthy 6.51:1.

   Ratcheted against `src/design-contrast.json` like the others, with one
   extra move: an allowlisted pair that *clears* the floor also fails, so a
   fix cannot leave stale debt behind it. Theme flips are measured with
   transitions forced off — `.decks-filter-btn` transitions `color` and
   `.next-service` transitions `background`, so an immediate read returns a
   mid-animation colour that is on screen at no resting moment.

5. **The ink/ground rule** (`npm run lint:ink`) — the structural half of
   Guard 4. Guard 4 measures, but it can only measure what it has been
   shown: its site sweep renders a curated fixture, so it covers a sample of
   the app. This one covers the whole sheet, and asks a narrower question
   that needs no colour maths: *is this rule using an ink that belongs to a
   different ground than the one it sits on?*

   The sheet has two ink families and they are not interchangeable.
   `--text-primary`/`--text-secondary` flip with the theme;
   `--text-on-panel`/`-soft` never do, because sumi is dark in both. Put an
   ambient ink on sumi and **dark theme hides it completely** — it reads
   ~7:1 there — while light theme flips it dark-on-dark. That is how the
   Today strip shipped at 2.80:1 and two buttons at 3.04:1: every one of
   them looks correct to a reviewer working in dark mode.

   What makes this tractable statically, when "what is behind this element"
   generally is not, is that BEM naming already encodes containment. `.X--m`
   is the *same box* as `.X`; `.X__e` is inside it. So a block whose own rule
   paints a ground hands that ground to its modifiers and elements. The
   nearest painted ground wins — the rule's own, then the element's from any
   rule naming it, then the block's — and grounds are read from resting-state
   selectors only, since a `:hover` overlay is a tint on a ground rather than
   a different one.

   Two things it deliberately does not judge. A **pigment fill** is a third
   ground whose ink depends on the fill's lightness (DESIGN.md, "The primary
   button"); that is a measurement, so it belongs to Guard 4. And
   **indirection through a custom property** is invisible on purpose: where
   one element genuinely has two grounds, the fix is to name the pair once on
   the block and let children read it (`--ns-ink`/`--ns-ink-soft` on
   `.next-service`), and those children resolve to neither family by name.
   That is the intended escape hatch, not a hole.

   **One thing it cannot judge, as opposed to chooses not to.** The containment
   model is BEM, so it only relates an ink to a ground when the names say they
   meet. A **descendant selector spanning two unrelated blocks** — a ground
   painted by one, an ink set by the other — is outside it, and nothing in
   either name reveals the pairing. `.dict-entry-card .stage-badge` is the
   worked example: `.stage-badge` inks toward `--text-on-panel` under a comment
   asserting its host is sumi in both themes, which is true of the quiz card it
   was written for and false of the dictionary card, which is `--surface` and
   flips to pale washi. It measures **1.51:1 in light** and Guard 5 is clean on
   it. When you write an ink into a cross-block descendant selector, check the
   ground by hand — the guard will not.

   Allowlisted through `src/design-ink-ground.json`, entries removable only:
   a stale one fails, so a fix cannot leave debt behind it.

6. **The artboards** (`npm run lint:artboards`) — the only guard that does
   not watch the app. It watches the *mockups*, because the drift runs both
   ways: by the time it was written the Stats board still drew a streak the
   app had abandoned two rounds earlier, the Controls board still specified a
   primary button at a deepening that had since moved 88% → 70%, and 159
   pigment-as-text sites across the set sat under a contrast floor the app
   itself had already cleared. A contract nobody checks stops being a
   contract; the screens were being built to a picture that was quietly
   wrong.

   It measures three things, all of them true-or-false rather than matters of
   taste: inline `color:` against its ground at 4.5:1 (3:1 for large text and
   for icons, which are non-text content), font-size/gap/border-radius
   literals against the kit's scales, and a raw hex in the body where a token
   of that exact value is defined in the same file.

   **The artboards are not in this repo** — they live in the canvas artifact
   DESIGN.md links, and on disk only in whatever scratchpad holds them. So
   this cannot run in CI. With no directory it skips and exits 0; point it at
   the boards with `ARTBOARDS_DIR` or
   `npm run lint:artboards -- /path/to/mockups`.

   Judging a ground without a DOM is the hard part, and the failure mode is
   inventing failures rather than missing them — four separate measuring
   probes in the wave that produced this guard returned confident nonsense.
   So it stays conservative: a colour is judged only against a background set
   in the same style attribute, or the page card when that attribute sets
   none; a panel ink with no inline ground is skipped, because its real
   ground comes from a parent class; and a reading of exactly 1.00 is treated
   as "wrong ground", never as invisible text, since nobody draws that on
   purpose. Every run first proves the maths on white-on-black (must be
   exactly 21) and 50% white on black (must be 128) before trusting it on a
   pair whose answer is not known in advance.

If a guard fires on a change you believe is correct, change the baseline or
the allowlist in the same commit and say why in the message. The guards are
a ratchet, not a wall — the only thing they forbid is doing it silently.
