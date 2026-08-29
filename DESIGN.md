# DESIGN

The visual language of this app. `CONTEXT.md` defines the words, `docs/adr/`
records decisions, `plans/` holds the work — this file says what the app
**looks like** and why.

Read this before writing any CSS or building any screen.

A visual reference exists too — 22 artboards covering the element library and
all 16 screens, at
`https://claude.ai/code/artifact/0b6dadc8-6b40-4f83-9238-69dd19b5e30e`. The
canvas is the **picture**; this file is the **rule**. Where they disagree,
this file wins — a canvas cannot be grepped and does not travel with a clone.

## The idea

The app is a Japanese railway station. Learning is a journey: sections are
**lines** (路線), screens are **stations**, choices are **platforms** (のりば),
your profile is a **commuter pass** (定期券), and the home screen is a
**departure board** (発車標).

This is not decoration. It is the reason the app can show eleven subjects
without a menu that looks like a menu, and the reason a colour can mean
something. Every visual decision should be answerable with "what would a
station do?"

## The one rule above all others

**Every name is a pair.** A Japanese term and a plain-language term, together,
in a fixed relationship: the Japanese is the heading, the Latin is its caption
— never the other way round.

```
    かな            ← reading, tracked wide, small, secondary ink
    あ              ← the name. Serif. This is the <h1>.
    KANA            ← caption. Display face, 700, uppercase, tracked, secondary ink
```

The Latin half is set at **1.7×–2.2× smaller** than the Japanese half, in
`--font-display` at `700`, `text-transform: uppercase`, `letter-spacing:
var(--tr-caption)`, colour `--text-secondary`.

The Latin line is **the section's plain-language title, never a
transliteration**. `解析` pairs with `ANALYZER`, not with `KAISEKI`.

Where a screen has no real Japanese term, it gets no pair — do not invent one,
and do not fall back to the unpaired serif heading, which is a retired form.

There is a second top-level rule, below, that outranks this one where they
collide — see "Say less."

## The second rule above all others

**Say less.** On screens, avoid unnecessary text and titles. Things should
speak for themselves and the layout should guide the user. Do not caption a
figure that adjacent content already explains. Do not label a button whose
action is obvious from where it sits. Do not add a heading where the content
is self-evident.

**This outranks the pairing rule where the two collide.** The pair names a
*place* — a station, a section, a line. It does not caption every number on
the screen.

## Colour

### Three families, and they never mix

| Family | Tokens | Means |
|---|---|---|
| **Places** | `--line-kana`, `--line-vocab`, … (11) | which section you are in |
| **People** | `--pass-ink` (藍鼠 slate) | this is *yours* — pass, IC card, stub |
| **States** | `--success`, `--warning`, `--danger`, `--state-*` | correct, due, learning, mastered |

An object about the user never wears a line colour. A figure about study state
never wears a line colour. This is why `--pass-ink` exists as a separate
pigment rather than borrowing one.

### One line, one colour

Each section owns exactly one pigment, and nothing else may use it. The
pigments walk the colour wheel so no two are confusable at roundel size, and
none doubles as a state colour — an earlier palette had grammar as `--success`
and decks as `--warning`, which made "grammar" and "correct" the same colour.

**One standing exception, decided deliberately**: the cosmetics block
(`index.css`, the `--seal-color` / livery / backdrop rules) repurposes nine
line pigments and two state colours as user-selectable card papers, seals,
rings and backdrops. It breaks the rule on paper. It stays, because it is an
opt-in decorative layer with its own coherent internal system, and because a
cosmetic the learner chose is not the app claiming a section.

Do not "fix" this, and do not cite it as precedent — it is the exception that
is allowed to exist *because* the rule is otherwise absolute. Any new use of a
line pigment outside its section is drift.

### Colour is an edge, a ring, or a numeral — never a fill

The pigment appears as:

- a **stripe** — under a plate, along a board's head, down a pass's right edge
- a **rail** — 3px down the left of a row, revealed on hover
- a **ring** — the roundel, 2–2.5px, unfilled
- a **numeral or glyph** — a platform number, a rank

It is never a card background, and it is **never on chrome**. The top bar
carries no line colour at all: it is sumi ink and two registers of text. The
frame stays quiet so the content can speak.

### The pigment is injected once

A screen shell sets `--line-color` / `--row-color`; everything below reads
`var(--line-color)`. No component should reference `--line-kana` and friends
directly.

## Type

Two Japanese faces, assigned by **job**, never by taste:

- `--font-serif` — **names and headings**. Station names, card titles, the
  holder's name on the pass.
- `--font-jp` — **readings, units, badges, glyph chips and specimens**. Kana
  readings, 番線, 種別, the sample characters on a card.

`--font-display` (Space Grotesk) carries **all Latin** and **all figures**.

### The scale

Nine sizes: `--fs-caption-xs` `--fs-caption` `--fs-sm` `--fs-body` `--fs-lead`
`--fs-title` `--fs-heading` `--fs-display`, plus three fluid tokens for
headings that must breathe.

**Never write a font-size literal.** The app reached 94 of them; that is what
this scale exists to stop. `rem` only — `px` is retired from type, because
`13px` and `0.8rem` are the same size written two ways and the app used both.

### Tracking runs inversely to size

Small uppercase captions are set widest (`--tr-caption`), kana readings wider
still (`--tr-reading`), hero names moderately (`--tr-name`), body-scale
Japanese barely (`--tr-term`).

Any tracked line on a left-flush or centred axis must also set `text-indent` to
the same value, cancelling the space the last letter's tracking adds.

### Figures

Every numeral: `--font-display`, `700`, `line-height: 1`, and
`font-variant-numeric: tabular-nums`. Formatting (`toLocaleString`) happens in
JSX, never in CSS.

A figure and its label form a fixed pair — large numeral, small unit inline,
caps label beneath at `--fs-caption-xs`.

## Surfaces

### One card, everywhere

```css
background: var(--surface);
border: 1px solid var(--surface-line);
border-radius: var(--r-card);
```

That is the app's raised object — a platform card, a deck, a stats panel, an
answer row. If a new surface differs from this, there must be a reason written
next to it.

### Two panel idioms, chosen by content

- **Hairline lattice** — a grid of bare figures. `display: grid; gap: 1px` on a
  `--surface-line` background, with a 1px outer border. The hairline *is* the
  gap; there are no inner padding boxes. Use for records, headline stats.
- **Surface panel** — anything with a progress bar or prose. The standard card
  above.

### Radii are assigned by weight

`--r-flat` (lattice, board rows) → `--r-plate` (the hanging plate) → `--r-card`
(cards and panels) → `--r-panel` (the two big panels) → `--r-identity` (pass,
IC card) → `--r-pill`.

### Elevation is rationed

Two shadows exist, and both mean **this object hangs**: `--elev-hang` for the
station plate, `--elev-board` for the departure board. Nothing else has a
shadow. Separation comes from `--surface-line`.

### The console, one everywhere

Decks, Dictionary and Today share **one console pattern**: a single surface
panel at `--r-panel`, two rows split by a `1px --surface-line` hairline. Row 1
holds the filter chips, with the single primary action pinned right. Row 2
holds search, with the result count pinned right. One console everywhere, not
three — a screen that needs filtering reaches for this, not a bespoke bar.

## Space

Nine rungs, `--sp-1` … `--sp-9`. The upper rungs carry meaning:

- `--sp-6` (22px) — the gap between choice cards
- `--sp-7` (28px) — a card's own padding
- `--sp-8` (44px) — a component's bottom margin
- `--sp-9` (52px) — the rhythm between blocks on a screen

**Never write a padding or gap literal.**

### The density contract

*This is now half correction to the current app, half the maintainer's own
ruling — the first bullet below was reversed once already, after review on the
mockups showed the original rule was wrong in practice.* The reference screens
are the best thing in the app and they share one weakness: cards are taller
than their content needs, and wide cards leave their right half empty. The
test throughout is **best use of the space available**.

So:

- Cards in a grid **share a height** — uneven cards break the flow of the page.
  But the fix for a short card is to give it **content**, never padding. If a
  card cannot fill the shared height with something real, the whole row is too
  tall: tighten it. Dead space is the failure, not unevenness.
- A card wider than ~440px must **earn** its width with a right-hand column
  (meta, a figure, a status). If it has nothing to put there, it should be
  narrower or the grid should have more columns.
- A grid of ≤5 short options is a grid, never a stack of full-width rows.

## Motion

- Lists arrive staggered: the shared `arrive` / `arrive-soft` animation,
  ~30ms between children, **capped at the eighth** — past that the last rows
  are waiting on an animation nobody is watching.
- Hover is a **1px lift**, a border-colour change to the line pigment, a
  roundel that inverts, and a `▶` that slides in from `-4px`. All at
  0.15–0.16s ease. No scale, no glow, no fill.
- Every `transition` and `animation` needs a `prefers-reduced-motion` answer
  that keeps opacity and drops transform.
- Every `:hover` rule needs a matching `:focus-visible`. Keyboard users get the
  same affordance, not just the global ring.

### Controls

- **The rating bar** — the most-used control in the app — is **one continuous
  instrument**, not a row of buttons. A single pill, its segments divided by
  hairlines rather than gaps, the Japanese quality term primary with the plain
  term beneath it. Colour is reduced to a `3px` bottom rule per segment,
  forming one ramp across the whole bar; only the selected segment fills, at
  ~14%.
- **The streak is a スタンプラリー stamp rally**, not a flame — a row of
  eki-stamp marks, one per day, today's freshly inked. It says what the
  learner *did* rather than decorating a number, and it is on-metaphor for a
  station.

## Structure

- **One `<h1>` per screen**, and it is the object that names the place — the
  station plate, the departure board, or the pass. A plated screen never prints
  a second heading.
- Section headings are `<h2>` inside the paired `SectionHeader`.
- Three column widths: `--board-w` (1040px) for the station column,
  `min(1240px, 100%)` for a plated selection screen, 720px for unplated prose.
- Japanese text carries `lang="ja"`. Always — it selects the right font
  fallbacks and it is how a screen reader knows.
- A chevron terminating a card or row is centred against the **full height**
  of that card, never against its first line of text.

## What not to do

- Do not create a new stylesheet. One file, namespaced selectors.
- Do not invent a size, space, radius or tracking value.
- Do not use a line pigment for anything that is not a section.
- Do not use a state colour decoratively.
- Do not put colour on chrome.
- Do not write the Latin line as a transliteration.
- Do not hand-copy a component's markup to get its look — use the component.
  Every near-copy in this app has drifted from its original within two
  features.

## The test

A new screen belongs not by imitating these specs but by **reusing the
components that already encode them**. `StationSign` is the same component at
both ends of a journey; the platform card is shared by modes, tiers, themes,
decks and exam papers; one contactless mark renders at three scales. The
repetition *is* the design.
