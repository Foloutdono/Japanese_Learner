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
npm test           # vitest, two lanes (node + browser)
```

## Design conformance guards

Three guards, run by CI on every PR, exist because this project has 19,000
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
   - `custom-property-length` — a CSS **custom property** whose *value* is a
     bare `px`/`rem`/`em` length, e.g. `--card-pad-y: 40px;`. Classified by
     value, not by name (`--card-pad-y`, `--char-size`, `--ember-drift`, ...
     — names drift, a length doesn't stop being one). `var(...)`,
     `calc(...)`, `clamp(...)` and colours never match. This also, correctly,
     catches the scale's own token *definitions* in `:root` (e.g.
     `--fs-caption-xs: 0.62rem;`) — those are permanent, legitimate
     allowlist residents, not something to migrate away.
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

   **Occurrence counts, not just distinct values.** Each of the six classes
   above (the original four properties plus these two) is tracked two ways:
   the allowlist (distinct values) and a **count** of how many times, in
   total, an off-scale value for that class occurs in the source. The
   allowlist only shrinks when the *last* use of a value disappears, so a
   migration that halves a value's occurrences without eliminating it
   entirely would otherwise look like no progress at all. The occurrence
   count catches that: it must never rise (a second `border-radius: 5px`
   added anywhere fails the guard even though `5px` was already
   allowlisted), and falling needs no allowlist edit at all. `npm run
   lint:scale` prints both numbers for every class; `--write` re-seeds both.

If a guard fires on a change you believe is correct, change the baseline or
the allowlist in the same commit and say why in the message. The guards are
a ratchet, not a wall — the only thing they forbid is doing it silently.
