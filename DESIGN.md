# DESIGN

The visual language of this app. `CONTEXT.md` defines the words, `docs/adr/`
records decisions, `plans/` holds the work — this file says what the app
**looks like** and why.

Read this before writing any CSS or building any screen.

A visual reference exists too — 29 artboards, 6 of the element library and 23
of the screens, at
`https://claude.ai/code/artifact/0b6dadc8-6b40-4f83-9238-69dd19b5e30e`. The
canvas is the **picture**; this file is the **rule**. Where they disagree,
this file wins — a canvas cannot be grepped and does not travel with a clone.
Anything it shows of the profile predates the 定期入れ round and is history,
not a target; the round's own exploration (three directions, one chosen) is a
second canvas at
`https://claude.ai/code/artifact/2f8fcfaf-0c5a-447a-807d-ffad3903101f`, which
was likewise not updated after the decision. The code is the reference for
that screen.

## The idea

The app is a Japanese railway station. Learning is a journey: sections are
**lines** (路線), screens are **stations**, choices are **platforms** (のりば),
your profile is a **commuter pass** (定期券) in its **holder** (定期入れ), and
the home screen is the
**gate hall**: the day's reviews at the **fare gate** (改札), your pass under
them, and the **route map** (路線図) on the wall — every line of the app with
your own train somewhere along it. (It was a departure board, 発車標, until
the wall-map redesign; the map answers "how far have I come", which a board
of equal departures never could.)

The pass is a physical object, so it behaves like one. It has a front and a
back — the contract it was issued under, 乗車駅 · 行先 · 種別 · 発車時刻 ·
有効期限 · 発行日 — it carries the door to its own settings, because 設定 is
the card's own preferences and not a place you travel to, and the profile
screen is the **holder** it lives in: the card, and the inserts tucked behind
it. An insert is a stamp sheet, a rank plaque, a ledger, a row of tickets. It
does not need a caption, which is what lets that screen print no section
headings at all (see Structure).

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

**One standing exception, decided deliberately (2026-09-01)**: the analyzer's
*navigation* is Latin-first. The station plate keeps the full pair (解析 over
ANALYZER), and Japanese stays on the content and the small accents — but the
controls, the platform cards, the working rail and the history head lead with
the learner's own language and carry the Japanese as the quiet second register
(`History 運行履歴`, `Texte 文字`). The reasoning: a learner picking an intake
or filtering sentences should not need vocabulary to operate the tool that
teaches it. Owner-directed in the analyzer mockup round. Do not cite it as
precedent for other stations without the same argument.

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
| **People** | `--pass-ink` (消炭 charcoal) | this is *yours* — pass, IC card, stub |
| **States** | `--success`, `--warning`, `--danger`, `--state-*` | correct, due, learning, mastered |

An object about the user never wears a line colour. A figure about study state
never wears a line colour. This is why `--pass-ink` exists as a separate
pigment rather than borrowing one.

### The pass has two materials, and neither is a line

Charcoal (`--pass-ink`) is the card. **Gold (`--accent2`) is its metal** — the
balance bar, the 段位 stamp, the 有効期限 printed on the back, and the XP ring.

The ring was `--accent9` until the profile round, and `--accent9` is 瑠璃,
which in dark theme is the same value as `--line-honyaku`: the one object on
the screen that means *you* was wearing a section's pigment. The same
reasoning had already retired the top bar's XP arc; the profile's ring was the
last one holding out. `--accent9` itself is a leftover from when /profile was
modelled as a station with a pigment of its own, before `config/identity.js`
ruled that a pass is not a place.

`--accent2` and `--line-jisho` are also the same hex, in both themes. That is
not a hidden alias and it does not make gold a line pigment — the traditional
palette is small, so pigments coincide (`--accent` and `--line-kana` do too,
and `--rating-wrong` was minted precisely so a third meaning would not have to
borrow either). **The test is the object, not the hex.** A roundel on the 辞書
card wears 辞書's pigment; a bar on the pass wears the pass's metal; they
render identically and mean different things, and each reads its own token.
Never reach for the token that happens to match — reach for the one that
names what the object is.

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

**A second standing exception, decided deliberately**: the **primary button**
is a filled use of a line pigment — see *The primary button* under Surfaces.
It applies to **the one action on a screen**, and to nothing else. It is not
precedent for filling a card, a row, a chip, a header or a second button; a
screen with two filled buttons has misidentified which one is the action.
Like the cosmetics exception, it is allowed to exist *because* the rule is
otherwise absolute.

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

One rung sits above the nine, for one object only: `--fs-specimen-glyph`
(104px, a single kana or kanji) and `--fs-specimen-word` (72px, a word or
short phrase) size the study card's Japanese specimen and nothing else.

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
  gap; there are no inner padding boxes. Use for records, headline stats, and
  the profile's ledger of lines.
- **Surface panel** — anything with a progress bar or prose. The standard card
  above.

**A lattice's column count must divide its content**, at every breakpoint.
The seams are the background showing through the gaps, so a short last row
shows that background as a bare slab with nothing in it. Write the counts per
tier (4 → 2 → 1) rather than reaching for `repeat(auto-fit, minmax(…))`, which
looks right at the widths where the arithmetic happens to work and breaks at
the one in between — the ledger of four lines did exactly that at three
columns, and the three halls did it again between 560 and 1000px. Content that
is genuinely ragged, like a collection that is partly empty, does not belong
in a lattice at all: that is why the badges were separated tiles and are now
tickets.

### Radii are assigned by weight

`--r-flat` (lattice, board rows) → `--r-plate` (the hanging plate) → `--r-card`
(cards and panels) → `--r-panel` (the two big panels) → `--r-identity` (pass,
IC card) → `--r-pill`.

### Elevation is rationed

Two shadows exist, and both mean **this object hangs**: `--elev-hang` for the
station plate, `--elev-board` for the wall map's panel (the departure board's
successor). A third exists since the wall-map redesign and means something
else: `--elev-action`, a faint gold glow spent on `.btn-depart` alone — "this
is the thing to press". One object, by ruling; a fourth shadow needs the same
argument this one had. Nothing else has a
shadow. Separation comes from `--surface-line`.

### The console, one everywhere

Decks, Dictionary and Today share **one console pattern**: a single surface
panel at `--r-panel`, two rows split by a `1px --surface-line` hairline. Row 1
holds the filter chips, with the single primary action pinned right. Row 2
holds search, with the result count pinned right. One console everywhere, not
three — a screen that needs filtering reaches for this, not a bespoke bar.

### The ticket

A 記念乗車券 — the commemorative ticket a station hands out — is the app's
object for **a thing you earned**: a stub carrying one glyph, a body carrying
the occasion, and a punch hole through to the wall behind once it is spent. A
ticket not yet earned carries its progress where the hole would be, and any
ticket turns over on tap to say what it is for, because "7 / 10" means nothing
until you know what is being counted.

It replaced the badge medallion, which was the one object on the profile that
could have come from any app, and it fixed the same problem the lattice rule
above describes: a collection is partly empty by definition, so it cannot use
a device that only looks right when every row is full. The stub's ink is the
pass's gold mixed 55% toward the ambient ink, measured 6.25:1 dark and 4.81:1
light on its own 16% wash. At 60% — the mix every other gold figure in the
sheet uses — it read 4.43:1 in light theme, under the floor, and it was caught
only because the pair was measured rather than eyeballed. Guard 4 holds it now
as `.pf-stub`, along with the rest of the profile's mixes: an ink that is a
`color-mix` sitting on a ground that is another `color-mix` is exactly what
part 1's contract cannot predict, and every such pair belongs in the fixture.

### The primary button

One screen, one filled action — `.btn-primary`, the only class in the app that
fills with a line pigment. Everything beside it is a ghost: transparent, a
`--surface-line` border, `--text-primary`.

```css
background: color-mix(in srgb, var(--line-color, var(--accent)) 70%, var(--bg-panel));
color: var(--text-on-panel);
/* :hover lifts the fill to 79% — lighter, not a brightness filter */
```

The fill is **the section's own pigment, deepened 30% toward the panel ink**,
so a button on Decks is 蘇芳 and one on Today is 朱色 without either screen
inventing a colour. The deepening is not decoration: the raw pigment does not
carry the ink at 15.2px/600. It was 12% when this family was written, calibrated
on the only two pigments the button then wore; 松葉色 and 黄丹 both landed under
the floor when the study screens joined, so the whole family went deeper. **79%
is the ceiling** — it is the hover's value, and above it 黄丹 fails. Hover goes **lighter**, never darker — a `filter:
brightness()` is not the hover, and must be turned off where the bare `button`
rule supplies one. Disabled is `opacity: 0.45`, and there is only one disabled
treatment.

**The ink is chosen by the fill's lightness, not fixed.** At the 70/79
deepening, **eleven of the twelve line pigments carry `--text-on-panel`** in both
themes and both states; the worst of them, 黄丹 safflower, rests at 5.29:1 and
hovers at 4.53:1.

**山吹色 gold is the twelfth, and it is the exception.** It reaches only 3.90:1
resting and 3.24:1 hovering in dark theme, and no deepening within this family
saves it — a deepened yellow turns olive before it will carry a light ink. Gold
takes the dark ink, or a deeper mix of its own: the console's gold pill goes to
60% and keeps `--text-on-fill`. Gold is the 辞書 and 蔵 sections, so **a filled
action on either of those screens is not a plain `.btn-primary`.**

Assuming one ink for every pigment is exactly what produced the defect
this section was written for: the button shipped at 3.48:1 and every guard and
every test passed, because nothing in the app checked contrast. **Guard 4 now
does** (`src/contrast.browser.test.jsx`): it measures the intended ink/ground
pairings in both themes and re-measures a set of real call sites through their
real ancestors, ratcheted against `src/design-contrast.json`. It is not a
substitute for measuring a *new* pair yourself — 4.5:1 is the floor, the
mockups themselves do not always clear it, and the guard only knows the pairs
it has been told about.

Two rules the guard exists to keep, both learned by measurement:

- **The ambient inks flip; the sumi inks do not.** `--text-primary` and
  `--text-secondary` are paper inks in light theme, so putting either on a
  sumi ground works in dark and fails in light — the Today strip did exactly
  that and read at 2.80:1. Anything sitting on `--bg-panel`, or on a tint
  mixed into it, takes `--text-on-panel(-soft)`. Where one element has both
  grounds, name the pair once on the block and let the children read it (see
  `--ns-ink` / `--ns-ink-soft` on `.next-service`). Guard 5 (`npm run
  lint:ink`) enforces this one across the whole sheet, without needing a
  fixture — it is the rule that dark theme cannot show you is broken.
- **A mix toward `transparent` costs contrast in *both* themes.** It
  composites toward the ground, not toward the ink, so it is not a way to
  make a dim register — it is a way to fail dark mode too. Reach for a
  dimmer token, not a lower alpha.

## Space

Nine rungs, `--sp-1` … `--sp-9`. The upper rungs carry meaning:

- `--sp-6` (22px) — the gap between choice cards
- `--sp-7` (28px) — a card's own padding
- `--sp-8` (44px) — a component's bottom margin
- `--sp-9` (52px) — the rhythm between blocks on a screen

**Never write a padding or gap literal.** That includes hiding one inside a
custom property (`--card-pad-x: 14px` on a component rule is as much a
literal as `padding: 14px`) — `npm run lint:scale` catches both. Its
`custom-property-length` count is the honest harmonisation metric for this
rule: component-level lengths that should be tokens but aren't yet, distinct
from the scale's own `--sp-*`/`--fs-*`/etc. definitions in `:root`, which the
guard reports separately as `design-token` and never treats as debt. See
`frontend/README.md`, "Design conformance guards", for the full split.

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
  tall: tighten it. Dead space is the failure, not unevenness. Where a card
  really is stretched by its neighbour, hand the slack to the content's own
  spacing rather than to the box: the 段位 plaque is a flex column and its
  line takes `margin: auto 0`, so a taller neighbour opens the gaps around the
  drawing instead of pooling emptiness under it.
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
  instrument**, not a row of buttons. A single box, its segments divided by
  hairlines rather than gaps, the plain word alone as the label (the
  maintainer retired the Japanese term from the bar; see the rule's own
  comment in `index.css`) and a ring above each word carrying the colour:
  unfilled at rest, filled by the segment just pressed. That press is the
  bar's whole acknowledgement — the bar fades out with the ring still
  filled while the next card arrives, and nothing else says "rated". On a
  phone, four segments stay on **one row**, the shape a thumb sweeps along
  the bottom edge; only the six-segment bar wraps.
- **The streak is a スタンプラリー stamp rally**, not a flame — a row of
  eki-stamp marks, one per day, today's freshly inked. It says what the
  learner *did* rather than decorating a number, and it is on-metaphor for a
  station.
- **The rally has two sizes, and they are the same mark.** Seven days on the
  pass in the gate hall; five whole weeks, Monday to Sunday, as the profile's
  スタンプ帳. Same lacquer (`--daruma-aka`), same per-slot wobble, same press
  on today. The row answers "how many in a row"; the sheet answers "which
  days", which is the question the week's bar chart could never answer and
  the reason that chart is gone. A missing day is a dashed outline, not a
  gap — seven or thirty-five slots always exist, because the shape of the
  month is the information.
- **A segmented toggle is the rating bar's construction at chip size** — one
  pill, segments divided by hairlines rather than gaps, and the selected
  segment *washed* at ~14% rather than filled. The 番付's 今週/通算 switch is
  the first outside the quiz. Anything that picks one of two or three views of
  the same data reaches for this, not for two buttons that both look pressable.

### The study stage on a phone

The study screens are designed at phone width first and adapted up. Below
768px the viewport is the stage and nothing is centred in a column that
scrolls away:

- the deck's progress is a **hairline rule** at the top edge, three inks and
  no figures — the same inks the card's own seal wears, so the rule says how
  much of the deck is vermillion and how much is gold without a legend;
- the hint switches are a row of pills under it;
- **the card grows** to fill whatever the answer widget leaves, so a lone
  kana sits in the middle of a tall card and four choices under a kanji
  leave it its floor. The card's seal stays anchored to the card, not to the
  space around it;
- the rating bar is **docked**, stuck above the level HUD and clear of the
  home bar, with its space reserved from the first paint so revealing a card
  never moves it. `--hud-h` is the one number every docked thing clears by.

Above 768px the column is the centred `--card-w` it always was, with the
progress legend back.

### Rewards

Every card is rewarded, and none of it is a ceremony. Three moments, three
objects, and only one of them ever waits to be dismissed:

- **The fare** (運賃) — the XP a review earns — is reported on the object it
  was paid into: the **level HUD**. The roundel in the top bar pulses gold
  once and the amount rises off it; on a phone the bottom bar lights the span
  it gained and the figure rises off the XP count. There is no toast, no
  panel and nothing to dismiss; the figure is gold because XP is the pass's
  balance, never a state colour. `XpToast` still sounds the tick and tells a
  screen reader.
- **The press** (押印) — a card climbing a stage — is the card's own corner
  seal being struck: the new seal lands on the corner the resting one sits
  in, at the same size and in the equipped 印's form, one ring of ink bleeds
  out from under it, the card's edge answers in the seal's ink, and a caption
  in the pairing register names the stage. The graduation (極) is gold and
  lights the whole edge; a lapse re-inks the seal in vermillion with a
  shake. It holds the next card for under a second (`CardStamp.browser.test`
  pins every hold), because the moment is the press, not a pageant: the
  wash, the kumadori, the brush and the petals are gone.
- **The level** (進級) turns over on the **in-car display**: a sumi board
  docked across the top of a phone (the top bar is hidden while studying, so
  the edge is free and the docked rating bar stays usable) or under the top
  bar beside the roundel on a desktop, the number on split-flap drums. On a
  clock, never gating — it leaves by itself while the next card is already
  in hand.
- **The rank** (再発行) — the title changed, four times in the whole
  progression — is the one that takes the screen and waits to be claimed.

Only the rank holds the queue. Everything else plays over the next card,
because a learner who has just rated one card is already looking for the
next.

## Structure

- **One `<h1>` per screen**, and it is the object that names the place — the
  station plate, the wall map's masthead, or the pass. A plated screen never prints
  a second heading.
- Section headings are `<h2>` inside the paired `SectionHeader`.
- **A screen may be composed of inserts instead of sections, and then it
  prints no `SectionHeader` at all.** The profile is the worked example: the
  pass is the `<h1>`, and every block beneath it is an object that names
  itself — a stamp sheet with 九月 in its margin, a plaque that opens 三級, a
  ledger whose cells carry their own roundels, a row of tickets, three
  doorways, a 番付. It printed six `SectionHeader`s over six self-evident
  objects, which is the second rule's exact failure: a caption for a figure
  the layout already explains. **A block that needs a heading to be legible is
  not finished** — give it the mark that names it, the way each ledger cell
  carries its own roundel and 線 name instead of sitting under a "Lines" title.
- **A line with stops is how this app draws distance**, and it is one drawing
  shared by three screens: the wall map's four lines, the pass's ghost track,
  and the 段位 ladder, which was a progress bar until the profile round. Same
  parts every time — a rail, a filled run behind you, stops with labels, your
  train between two of them. Reach for it over a bar whenever the axis has
  named waypoints; keep the bar for a span that is only a percentage.
- **A forward-looking block on a backward-looking screen offers only what is
  actually in reach.** The profile is a record; 今夜 is its one exception, and
  it is bounded to what a single session can finish — a daily doll, a ticket
  within a hundred reviews, a rank within 500 XP — rendering nothing at all
  when nothing qualifies. Mastery badges never appear there however close they
  look, because intervals take weeks. A goal measured in weeks belongs on the
  pass's back, where the ghost train already measures it.
- Four column widths: `--board-w` (1040px) for the station column,
  `min(1240px, 100%)` for a plated selection screen, 720px for unplated prose,
  and `--card-w` (640px) for the study card column — the quiz prompt card,
  its progress bar, its MCQ list and its rating bar all share this one
  number, narrower than any of the other three on purpose (a single kana or
  kanji does not need a 1100px-wide slab). The drawing quiz is the one
  deliberate exception, at 700px, so its two side-by-side panels don't wrap.
- Japanese text carries `lang="ja"`. Always — it selects the right font
  fallbacks and it is how a screen reader knows.
- A chevron terminating a card or row is centred against the **full height**
  of that card, never against its first line of text.

## What not to do

- Do not create a new stylesheet. One file, namespaced selectors.
- Do not invent a size, space, radius or tracking value.
- Do not use a line pigment for anything that is not a section — and check the
  object, not the hex; several pigments coincide.
- Do not use a state colour decoratively.
- Do not put a heading on a block that already names itself.
- Do not give a flush lattice a column count its content cannot fill.
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
