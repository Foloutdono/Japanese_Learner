# 0007 — One stylesheet, and a token scale for size, space, radius and tracking

- **Status**: accepted
- **Date**: 2026-08-28

## Context

This repo has an unusually good **colour** system — eleven line pigments, one
per section, documented at length in `index.css`'s header comments — and no
system at all for **size, space, radius or tracking**. A measurement pass
across `frontend/src/index.css` found 94 distinct `font-size` literals
resolving to ~78 distinct computed pixel values for what is really about nine
sizes; 236 distinct `padding` declarations, 130 of which appear exactly once;
42 `gap` values; and `border-radius` literals outnumbering the radius tokens
115 uses to 20.

That hole is why the drift accelerates. When a feature needs a spacing value
there is nothing to reach for, so it invents one — and twice now it has
invented a whole private family: `--anl-gap` / `--anl-pad-block` /
`--anl-pad-inline` / `--anl-radius` in the analyser's styles (created
2026-08-27) and `--card-pad-x` / `--card-pad-y` / `--card-pad-top` in the
onboarding flow's styles (created 2026-08-28). Two features, two days, two
parallel design systems.

Plans 041 and 042 (this same wave) had already merged what were four
stylesheets back into the single `frontend/src/index.css`, and removed dead
tokens and collisions between them. That made the second half of the problem
visible: even with one file, nothing stopped the next feature from doing the
same thing again, because there is nowhere written down that says not to, and
no scale to reach for instead.

The second half of the problem is that the direction is **written nowhere**.
`CLAUDE.md` briefs every session in detail on backend layout, data flow and
deployment, and said nothing about the station metaphor, the pigment rules or
the bilingual pairing. `CONTEXT.md` is an excellent glossary that explicitly
delegates design decisions to `docs/adr/` — and no ADR covered the visual
language. So every session reconstructed the look from whichever CSS rule it
happened to open, and reconstructed it slightly differently each time.

## Decision

Two decisions, made together because the second only holds if the first does.

**All CSS stays in one file, `frontend/src/index.css`, with namespaced
selectors.** No per-feature stylesheet. A feature that needs its own rules
gets its own prefix (`.exam-*`, `.anl-*`, `.onb-*`) inside the one file, not a
new `import`. This is what plan 041 already established; this ADR records it
as a standing rule rather than a one-time cleanup, so the next feature does
not reopen the question.

**`:root` gains four new scales — type, tracking, space and radius — plus two
elevation tokens and a `--font-serif` token**, added purely additively
alongside the existing colour tokens. Every value in the new scales is lifted
verbatim from a reference screen that already uses it, so adopting a token on
an existing call site is a no-op rather than a resize. `DESIGN.md`, added in
this same change, writes down the rationale — the station metaphor, the
colour-family rules, the bilingual name pairing, and how each scale is meant
to be used — and `CLAUDE.md` now points every session at it before any CSS or
screen work.

Migrating existing call sites onto the new tokens is deliberately **out of
scope here** — that is a later plan's job, screen by screen, with visual
review, because a mass find-and-replace would change hundreds of rendered
sizes at once with no way to review it.

## Consequences

- New CSS has a scale to reach for, so a feature that needs a spacing value no
  longer has to invent one or start a private token family.
- `DESIGN.md` plus the `## Visual design` section in `CLAUDE.md` mean the
  artistic direction is loaded into every session automatically, not
  reconstructed from whichever file happens to be open.
- The `--anl-*` and `--card-pad-*` private families are not touched by this
  decision. They still exist, still work, and are explicitly left for a later
  plan to promote onto the new scale or retire.
- `--radius` and `--gap`, the two pre-existing size tokens, are not retired
  here even though the new scale supersedes them — they are still referenced
  and retiring them changes rendered output, which is out of scope for a
  purely additive change.
- A future conformance test can check that new `font-size` / `padding` / `gap`
  / `border-radius` declarations reference a token rather than a literal,
  because the tokens now exist to check against.

## Alternatives considered

**Keep four stylesheets, one per feature area.** Rejected already by plan 041:
it is what let the two private token families happen unnoticed, since nobody
reviewing `analysis.css` had `onboarding.css` open at the same time.

**Migrate call sites onto the new tokens in the same change that adds them.**
Rejected. It would touch hundreds of declarations across dozens of components
with no visual regression test to catch a mistake, turning a zero-risk,
purely-additive change into a high-risk one. Splitting "add the scale" from
"adopt the scale" keeps the former reviewable in minutes and the latter doable
screen by screen.

**Write the design direction as a comment block in `index.css` instead of a
separate `DESIGN.md`.** Rejected because the file is already 19,000 lines and
a design rationale document is not CSS — it needs to be read before a screen
is built, not scrolled past while looking for a selector. A top-level
`DESIGN.md`, wired into `CLAUDE.md`, is loaded automatically the way the
comment block never would be.
