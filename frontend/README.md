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

If a guard fires on a change you believe is correct, change the baseline or
the allowlist in the same commit and say why in the message. The guards are
a ratchet, not a wall — the only thing they forbid is doing it silently.
