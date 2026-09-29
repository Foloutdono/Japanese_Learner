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

**The app is called 辻 — Tsuji.** A 辻 is a crossroads, which is exactly what
the gate hall is: the point the five 改札口 meet. The name is also the mark —
one glyph, five strokes, a 十 inside 辶 drawing the intersection it names — so
the icon, the masthead and the plate at the origin station (辻駅, TJ, つじ) are
one thing rather than three. It is a 国字, a character invented in Japan and
absent from Chinese dictionaries, with no on'yomi at all — a fair thing for an
app about Japanese writing to be called. `Tsuji` is the Latin half, and it carries the places the OS and the
stores print a name: the PWA `short_name`, the store listing, the bundle id
`app.tsuji`, the notification header.

**The mark is drawn, not set** (plan 158). It is 辻 in Noto Serif JP Black
with one dot on 辶 — the five strokes above, a form the font cannot set (it
draws the two-dot 辻 of JIS2004), so the mark is cut from the font's own
outlines, the 十 of 辻 and the 辶 of 込 (`frontend/scripts/build-mark.py`).
辶's sweep — the road the radical stands for — is in the pass's metal
(`--accent2`); the rest is the ground's ink, paper on the icon's sumi. It
replaced a serif 辻 over a gold underline: the underline became the
character's own stroke. One drawing, `components/ui/Mark.jsx`, wherever the
app names itself — the icon and the splash (`frontend/brand/`), the rail's
masthead, the Welcome and the sign-in, the boot screen, a notification's
icon — set at 1em where the text glyph stood. Where 辻 is a *name* rather than
the mark (the document title, 辻駅's plate, the dictionary's entry for 辻,
which teaches its six strokes) it stays type, in the font's two-dot form.

The app is a Japanese railway station. Learning is a journey: sections are
**lines** (路線), screens are **stations**, choices are **platforms** (のりば),
your profile is a **commuter pass** (定期券) in its **holder** (定期入れ), and
the home screen is the
**gate hall**: the day's reviews at the **fare gate** (改札), your pass under
them, and behind the Learn and Practice gates a column of **station plates**
(駅名標), one per line, each printing the stop you have reached and the one
ahead. (The Learn gate was a departure board, 発車標, then a wall-mounted
route map, 路線図, with a train on every line; the plates replaced the map
on 2026-09-20 — see Structure. The map answered "how far have I come" with
five labels a line at one weight; the plate answers "what is next" with one.)

The pass is a physical object, so it behaves like one. It has a front and a
back — the contract it was issued under, 乗車駅 · 行先 · 種別 · 発車時刻 ·
有効期限 · 発行日 — it carries the door to its own settings, because 設定 is
the card's own preferences and not a place you travel to, and the profile
screen is the **holder** it lives in: the card, and the inserts tucked behind
it. An insert is a stamp sheet, a lattice of records, a ledger of lines, a
ranking board. It does not need a caption, which is what lets that screen
print no section headings at all (see Structure).

This is not decoration. It is the reason the app can show a dozen subjects
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

**A second standing exception (2026-09-11): the Library is "Library" alone.**
Its block under 教材's grid, its own screen and the public deck page print the
learner's word and no Japanese heading at all. This is not the rule above
being broken but the rule above being applied — a library of decks other
learners wrote has no Japanese term in the app's own vocabulary, and 書庫 /
文庫 / 貸出 were all names that would have had to be invented for it. The
蘇芳 pigment stays, because a line colour is not a name: it is what keeps the
library reading as part of 教材 rather than a twelfth line. `SectionHeader`'s
own unpaired form is what draws the heading. Owner-directed. Same caveat as
above — this is one section's argument, not a licence to drop pairs elsewhere.

**A third (2026-09-21): only a place gets a pair.** The rule had spread to
everything with a label — a lesson's steps (規則 RULE), a figure in the
balance sheet (+30 毎日), a chart in the dictionary (五十音 MAIN SYLLABARY),
a toast (ダイヤ改正), a guide note (等級), a form's field (音読み ON'YOMI), a
button (臨時列車 EXTRA TRAIN). None of those is a station, a section or a
line; each was a caption, in a language the reader is here to learn, over the
half of the pair that was doing the work. Owner-directed, app-wide: where the
Japanese named a part rather than a place, it is gone and the plain-language
half inherits what it wore — the rung, the ink, the position (`.dict-mark`,
`.dict-gate__name`, `.ride__plate-cap`). A **mark drawn rather than written**
went the same way where it was standing in for a word: the analyzer's 済 is a
✓ from the icon set and the Today strip's 済 pill is gone outright, the count
past its target having already said it. The ride's own call (出発進行, 定期券
at `--fs-display`) went with them, and its sentence is the call now.

What stays: every station and section name, the plates and sheet headings that
carry them, the brand, a glyph that is a chip's icon (部, a deck type's
roundel, a stamp's seal, the 定期券 printed on the pass in the gate
cutscene), and all study content.

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
the screen, and as of 2026-09-21 it does not caption a lesson's steps, a
chart, a toast, a guide note or a form's fields either (see the third
standing exception above).

## Colour

### Three families, and they never mix

| Family | Tokens | Means |
|---|---|---|
| **Places** | `--line-kana`, `--line-vocab`, … (one per section) | which section you are in |
| **People** | `--pass-ink` (消炭 charcoal) | this is *yours* — pass, IC card, stub |
| **States** | `--success`, `--warning`, `--danger`, `--state-*` | correct, due, learning, mastered |

An object about the user never wears a line colour. A figure about study state
never wears a line colour. This is why `--pass-ink` exists as a separate
pigment rather than borrowing one.

### The pass has two materials, and neither is a line

Charcoal (`--pass-ink`) is the card. **Gold (`--accent2`) is its metal** — the
balance bar and the 有効期限 printed on the back.

It was the XP ring's too, round the holder's initial, until plan 143 took
the ring off: the balance row's bar measures the same climb with its figure
beside it, so the ring said it a second time. The ring had been `--accent9`
until the profile round, and `--accent9` is 瑠璃, which in dark theme is the
same value as `--line-honyaku`: the one object on the screen that means *you*
was wearing a section's pigment. The same reasoning had already retired the
top bar's XP arc. `--accent9` itself is a leftover from when /profile was
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

There is no standing exception to this any more. The cosmetics block once
repurposed nine line pigments as user-selectable papers, seals, rings and
backdrops; it was retired with the storehouse, and nothing outside a section
wears its pigment now. Any new use of a line pigment outside its section is
drift.

### Colour is an edge, a ring, or a numeral — never a fill

The pigment appears as:

- a **stripe** — under a plate, along a board's head, down a pass's right edge
- a **rail** — 3px down the left of a row, revealed on hover
- a **ring** — the roundel, 2–2.5px, unfilled
- a **numeral or glyph** — a platform number, a rank

It is never a card background, and it is **never on chrome**. The top bar
carries no line colour at all: it is sumi ink and two registers of text. The
frame stays quiet so the content can speak.

**The mark carries its own metal.** The road in the rail's masthead is gold on
the chrome, and it is not a line's pigment there: it is the mark's material,
the pass's `--accent2`, drawn the same on every ground (plan 158). It licenses
nothing else — any other part of the chrome stays sumi and its two inks.

**One standing exception, decided deliberately**: the **primary button** is a
filled use of a line pigment — see *The primary button* under Surfaces. It
applies to **the one action on a screen**, and to nothing else. It is not
precedent for filling a card, a row, a chip, a header or a second button; a
screen with two filled buttons has misidentified which one is the action. It
is allowed to exist *because* the rule is otherwise absolute.

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
short phrase) size the study card's Japanese specimen and nothing else. The
one other place the word rung appears is the dictionary's entry plate, for a
lone character (`.dict-plate__word--glyph`, decided 2026-09-05): it is the
same specimen, read instead of quizzed, opened from a catalogue plate whose
glyph is already 44px — a reading view cannot set it smaller than the card it
came from. A word on that plate takes `--fs-display`, a long expression
`--fs-heading`.

**Both specimen rungs are ceilings rather than sizes**, in the two places
the type has to fit a box it did not choose.

The catalogue's tile was the first. At 72px a 168px tile takes two characters
to a line, so テープレコーダー printed one character per line over four of
them and grew its whole row to 390px. The tile is a query container and its
headword divides that width by its own character count (`--len`, set by the
screen), clamped between `--fs-caption` and the word rung: a lone 駅 is the
specimen it always was, エアコンディショナー lands near 15px, and nothing
wraps.

The study card is the second, on the same instrument down to the 96cqw
(`.char-display`, decided 2026-09-09). The rung had been a flat size there,
and the specimen is one nowrap line, so a box sized to its own text simply
grew past the card and spilled the word off both edges — とうもろこし is
~440px against the 290px text column of a 390px phone, and printed with its
head and its tail off the screen. It is now fitted the same way (46px there,
28px for コンビニエンスストア) and the card is the query container. **Fitted,
not wrapped**: the specimen box is a fixed multiple of its own rung tall so
the card cannot resize under the learner on a flip, and a second line would
leave that height the way the word left its width. Prose on a card is a
different object and takes a different component — the meaning-first
direction hands its gloss to `MeaningDisplay`, which wraps.

These are the only off-scale font sizes in the app that are not literals to
be harmonised away — the two ends of each clamp are rungs and the middle is a
measurement of the box — and they are allowlisted in `design-scale.json` as
such. Reach for the instrument only where the type must fit a box it cannot
choose; everywhere else the nine rungs decide, and anything too long even for
the floor is cut at the edge of its box rather than shrinking further.

### Tracking runs inversely to size

Small uppercase captions are set widest (`--tr-caption`), kana readings wider
still (`--tr-reading`), hero names moderately (`--tr-name`), body-scale
Japanese barely (`--tr-term`).

Any tracked line on a left-flush or centred axis must also set `text-indent` to
the same value, cancelling the space the last letter's tracking adds.

**Unless the line is not the only ink in its box.** A chip opens with a roundel
or an icon, so the ink's left edge is not the label's — an indent moves the
label and leaves that edge where it was, and the pill still reads a half
tracking off centre. There the trailing space comes off the box instead:
`padding-inline-end: calc(<the pad> - <the tracking>)`, which centres both the
chip that shrink-wraps and the chip that is stretched and centres its content.
Where a rule zeroes its padding altogether (`.platform-sign__dests .chip`) the
same half tracking is added as a *leading* pad, which moves centred content by
half its own width.

Measured, at 8x over four sub-pixel phases: the dictionary's 部 RADICAUX chip
sat 1.16px left of centre, `.seg__opt-latin` 1.10px, `.card-row__badge` 1.02px.
None of them is above half a pixel now.

### Figures

Every numeral: `--font-display`, `700`, `line-height: 1`, and
`font-variant-numeric: tabular-nums`. Formatting (`toLocaleString`) happens in
JSX, never in CSS.

**A figure centred in a roundel is the exception to the `line-height: 1`.** A
roundel centres the LINE BOX, not the ink, so whatever leading the line box
carries decides where the glyph lands — and neither of the two the app reaches
for by habit is right. The sheet's inherited `1.6` set the figure 0.55px high
in every 30px roundel; the figures' own `line-height: 1` set it 0.81px high in
the HUD's level and 0.42px high on the platform card. A roundel takes
`line-height: normal` — the font's own box, which is the box its ink was drawn
in — which lands the HUD's figure within a tenth of a pixel and no roundel in
the app further off its centre than half of one. The roundels that already
inherited `normal` (anything inside a `<button>` that does not restate it, e.g.
`.mcq-row__index`) measured true before the sweep, which is the same finding
from the other side.

A roundel holding a **Japanese** glyph takes `line-height: 1` instead: a CJK
glyph is drawn to fill the em square, so the em box IS the ink box
(`.chip__glyph`, `.stamp-rally__stamp`). Do not read this as a licence to tune
leading by eye — those are the only two values, and which one applies is
decided by the script in the roundel, not by taste.

A figure and its label form a fixed pair — large numeral, small unit inline,
caps label beneath at `--fs-caption-xs`.

### French punctuation does not start a line

French sets a space before `:` `;` `!` `?` and inside `« »`, and that space is
**insécable** — the mark belongs to the word in front of it and the line may
not be cut between the two. Written as a plain space it is exactly a break
opportunity, and on a phone the browser takes it. The arrival screen printed
its lead as *"…, pour vous"* / *":"*, a colon alone on a line under the
projection.

So the French string table is welded on the way out
(`locales/frenchSpacing.js`): every such space becomes U+00A0 as the table is
exported, including inside sentences a screen assembles at call time — which
is where this one came from. NBSP and space set the same width, so nothing
moves; only the break disappears. `locales.test.js` holds the whole table to
the rule, so new copy cannot bring the orphan back.

Do not hand-type NBSPs into the tables — an invisible character no reviewer
can see, in a file where the next writer will forget it. Write the plain
space and let the weld do it.

Paragraphs of copy take `text-wrap: pretty` (`.brd__q`, `.brd-lead`) so the
last line is not left a scrap either. That is the other half: welding decides
what may not be split, `pretty` decides where the sentence would rather break.

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
  the profile's ledger of lines (one column of rows since plan 143, the rows
  sharing their columns through a subgrid so every rail starts where the
  others do).
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
in a lattice at all. A lattice with one cell to spare fills it with something
real rather than leaving it bare — the profile's records were two figures and
two doors, four cells two by two, until plan 143 printed the best perfect run
the API had always counted: three figures three across, and the doors a
lattice of two of their own.

### Radii are assigned by weight

`--r-flat` (lattice, board rows) → `--r-plate` (the hanging plate) → `--r-card`
(cards and panels) → `--r-panel` (the two big panels) → `--r-identity` (pass,
IC card) → `--r-pill`.

### Elevation is rationed

Two shadows exist, and both mean **this object hangs**: `--elev-hang` for the
station plate (and the gates' line plates, which are that plate), `--elev-board`
for the sumi panel (the departure board's, then the wall map's; no screen hangs
one today). A third exists since the wall-map redesign and means something
else: `--elev-action`, a faint gold glow spent on `.btn-depart` alone — "this
is the thing to press". One object, by ruling; a fourth shadow needs the same
argument this one had. Nothing else has a
shadow. Separation comes from `--surface-line`.

### The spot and the note

The guide (plan 100) has two objects, and neither is a fourth shadow or a
third panel idiom:

- **The spot** frames a thing that is already on the screen. It is one
  element over the anchor's rect, `box-shadow: 0 0 0 100vmax` in the scrim's
  ink — the shadow *is* the scrim, so the ration above holds: the spot hangs
  nothing and lifts nothing, it dims everything else. It wears the anchor's
  own corner (`--r-pill` for a roundel, `--r-plate` for a plate, `--r-card`
  for a card, `--r-identity` for the pass) and takes no pigment: the thing
  it frames is already in its line's colour, which is the point.
- **The note** (`.guide-callout`) is the panel ink speaking — sumi, like the
  docked rating bar and the sheets — one sentence, and on the guide two 44px
  controls. It opened with a Japanese word naming the stop until 2026-09-21
  (see the third standing exception under the pairing rule); the sentence is
  the note. The ride's notes have no controls and
  take no pointer events, so the card under one is tapped through it. It is
  centred on the column and measured only vertically: under the spot, or
  above it when the spot is in the lower half.

The note is not a tooltip and the spot is not a highlight: both exist for
a lesson that runs once per gate, and a screen that needs one at every
visit has a layout problem, not a guide problem ("Say less").

### The entry plate, and a body that names itself

The dictionary opens an entry as **the catalogue plate at reading size**:
reading over headword over plain-language caption (the first gloss, or a
kana's romaji), the stage word and the JLPT numeral in one corner, three ghost
roundels (speak, add to a deck, close) in the other, and 辞書's gold as the 3px
stripe along its bottom edge — the one colour on it.

**The caption prints only where the body does not repeat it** (plan 089). It
used to be the first gloss always, clamped to two lines because the whole list
lived below — so 土's plate said SOIL a rung above a line reading "Soil ·
earth · ground · Turkey". A title the next line repeats in full is carrying
nothing. Where the gloss line does print, the caption stands down; where it
does not — a kanji with one meaning, a kana (whose caption is its romaji), a
grammar point — the caption is the only copy, and it is therefore no longer
clamped either.

**The ＋ is on every kind of entry, and it is the server that says so.** The
roundel writes the entry into one of the learner's decks through the analyzer's
own mine write; `app_card` on the row is what decides whether it exists
(`routes/dictionary.py`). Never the entry's type, and never its raw id — a
JMdict pool word has a raw id so its stage can be looked up, and no app card
for a deck to link to. The same field is what "review this card" boards, which
is why it is not called `mine`. A kanji's plate prints **two
readings**, the first on'yomi and the first kun'yomi, each behind its 音/訓
mark, and a `+N` door: 生 has twenty readings and a plate is not the place
for them. The door opens a **sheet of its own** over the entry — the lookup
sheet's shell, stacked above whatever opened it — listing every reading with
the words that use it (grouped backend-side by `study/kanji_words.py`).

**One register at a time, behind two gates.** The sheet prints a gate per
register under its stripe — CHINESE READING, JAPANESE READING, each with the
count of readings behind it — and the open one's readings below. Each gate
led with 音読み and captioned it until 2026-09-21, when the ornamental half
of every such pair went (third standing exception, above): the name carries
the gate now, at the rung the term held. A reading is a **band of sumi** carrying the register's 音/訓
mark and the reading in the raw pigment, sticking to the top of the list
while its words pass under it in the ledger's own rows; the readings no word
demonstrates close the list as one row of quiet pills, under a caption that
says what they are. A kanji with a single register gets no gates: a
segmented control with one segment is a label pretending to be a choice.

This replaced one column holding both registers, each headed once by a 22px
carved 音/訓 at `--fs-caption-xs`, with every reading set at `--fs-lead` in
`--text-primary` — the rung and the ink of the word rows under it. Neither
division survived being looked at: the register was named to nobody who could
not already read 音, and the head of a group was the quietest thing in it.
**Ground and place divide them now, not a rung**, which is why the sheet is
the one shell here that scrolls its body rather than itself — a band cannot
stick under a sticky plate whose height it has no way to know.

Nothing of that list is on the entry itself. The four-word "used in these
words" ledger stays, and its four words demonstrate four different readings
where the deck has them, the kanji picked out in each row in the entry's
ink so the reading it uses is what the eye lands on. **The sheet's rows are
that same row, unchanged** — the kanji picked out in the same ink there as
here. A round of this redesign took the gold off them, on the reasoning that
gold under a gold heading outranks the heading; the owner reversed it, and
the reversal is the sounder reading of the screen. Ground is what divides a
reading from its words now, and sumi against surface is not a distinction the
rows can dilute the way a shared rung was. One mark means one thing wherever
the row is drawn, which is worth more than the rivalry was worth avoiding.
**A word read as a whole keeps the mark on its kanji and not on its
reading**: 今朝 is けさ, and け is no reading of 今 (熟字訓, 当て字), so the
aligner keeps one ruby over the word. The row picks 今 out inside it, leaves
the ruby in the row's own ink, since that reading belongs to the word, and
sets 熟 beside the word in the plate's 音/訓 square. It is the one row that
shows the character without showing any of its readings, and it comes last:
such a word fills a ledger slot only once every reading has run out of
words. The plate is `position: sticky`
inside whichever shell scrolls it, so the word stays in view while its
examples pass under it; on a phone the shell is the whole screen and this is
the reading view. Under the stripe, blocks divided by hairlines and **no
section headings**: a numbered list is a definition, a sentence over its
translation is an example, strokes drawn on washi in a lattice beside their
stroke count are how the character is written, and the reader's four figures
are the profile's own `.record` cells.

Three rulings inside that body, all from plan 089:

- **A block says one thing, once.** A word's kanji were a row of bare tiles
  between the definition and the record — a glyph in a box each, under no
  heading, which is a block that needs a heading to be legible. They are the
  ledger rows the kanji panel already uses for the words a character appears
  in, the other way round: the character, the reading it takes *in this word*,
  its own gloss, a chevron. One component, two directions. JMdict's duplicate
  senses fold the same way — two rows carrying the same glosses and differing
  only by a frequency tag are one definition, and print as one.
- **A state belongs to the figure that owns it.** "Due now" was a right-flush
  caption hanging over a lattice it was not part of, beside a cell saying the
  next review was two days ago: one state, said twice, with the arithmetic
  left to the reader. The next-review cell says it, in the due ink.
- **A due card names the one thing to do about it** — a ghost across the foot
  of the record block, boarding that one card in every mode it owes
  (`/today/run?only=…`). It prints only where a caller can offer the run: over
  a quiz there is nothing to board, and an action with nowhere to go is a dead
  control, not the inert fact a printed row is.

A kana's form lattice is the kanji's, not a slab of its own: the washi sheet,
its stroke count (counted off the diagram the app ships —
`content/kana_strokes.py`, since nothing else knows a kana's), and its
opposite-script twin as a door. A kanji's radical cell carries the radical's
own glyph and 部首名 rather than its Kangxi filing number; the number is still
where the door leads. Each block carries its name as an
`aria-label` only. The pigment arrives as `--line-color` from the shell
(`.dict-dock`, `.dict-sheet`) and is spent as the stripe, a rail on a word
row, a ring on hover, and the sense numerals — mixed 60% toward the ambient
ink, because raw 山吹 reads 2.9:1 on light paper.

**A grammar lesson reads for its shape** (plan 146, the owner's pick B
of three drawn directions). The lesson prints in four places (the
dictionary's plate body, the sheet behind a card, the gate before a new
card, the grammar station on the desk) and is one component in all of
them:

- **The steps divide by one hairline each**, the mark (RULE, USE,
  CAREFUL) at the caption rung with no rule under it: a rule under every
  mark drew three lines where two divide. The rule is the lead, a rung
  up, because it is the sentence every other block explains. The trap
  stands on a 2px rail of the due ink, an edge.
- **The Japanese in the prose is set as Japanese**: `lang="ja"` for the
  face and the glyph forms, in the entry's ink (`--dict-ink`, which the
  lesson names for itself where it is not inside an entry), and never
  cut. A run of up to twelve characters does not break at all; a
  sentence-length run breaks at its 、 first. A formula keeps its
  placeholders (A は B です is one unit), a term that opens a sentence
  keeps the word after it, and French punctuation is welded as the
  string tables are.
- **A use is its saying over its forms.** Nine use lines in ten are "what
  it is for : the forms". The colon goes; the forms print on their own
  line at the sentences' rung, each whole, its gloss beside it in the
  secondary register. A paradigm (Négatif : …. Passé : ….) is its labels
  beside its forms. A line that reads neither way prints as prose, and
  the parser (`components/study/lessonText.js`) is held to losing no
  character of Japanese over the whole catalogue.
- **The sentences are numbered rows**, hairline-divided, the translation
  under each. A sentence in another register than a register-bound point
  carries its register as a ring-drawn tag (この店はしずかだ, FAMILIER,
  under the polite です／だ). Under a neutral point nothing is tagged:
  every sentence is polite or casual by nature there.
- **Furigana sit over the word.** A word's kanji share one reading,
  centred, so 学生 is not printed 学 生 -- one word's, never two
  words' side by side (the parts carry the `word` they came from), so
  毎年軽井沢 reads まいとし and かるいざわ, with a space between them.
  A reading may overhang the kana on either side by half a reading
  character only where there is kana on both sides, and a lone kana
  for one reading only: never over a kanji or another reading, so two
  readings never meet, whatever width the face sets a kana. Closing
  punctuation rides on the part before it, so no line opens on 。.
  This is `ExampleSentence`, so it holds wherever an example sentence
  is printed.

### The console, one everywhere

Decks, Dictionary, Today and the Library share **one console pattern**: a
single surface panel at `--r-panel`, two rows split by a `1px --surface-line`
hairline. Row 1 holds the filter chips, with the single primary action pinned
right. Row 2 holds search, with the result count pinned right. One console
everywhere, not four — a screen that needs filtering reaches for this, not a
bespoke bar. The Library is what that rule is for: it had a row of its own
(`.lib-controls`, an ordering and a tally at either end), which was half a
console written out by hand, drawing its own count in a face nothing else on
the screen used, on no surface at all. Giving it the real one gained the
search it never had.

Row 1 is **what you are looking at**; row 2 is **how you are asking**. A
control that changes the question rather than the shelf belongs in row 2, at
its trailing edge, past the count — the dictionary's 部 index is the one that
does (`.console__toggle`): it is a second way of reading the kanji collection,
not a sixth collection, and as a chip in row 1 it read as the latter. Same
object either way: a `.chip`, saying whether it is chosen — but in row 2 a
**key beside the field** (plan 157), the field's 44px and square at
`--r-card`, as the question field's send stands beside its well, **carrying
its glyph alone**. A label in row 2 is paid for out of the field, and 部 over
a kanji dictionary is a body that names itself; the word stays in the `title`
and the `aria-label`, for the pointer and the reader the glyph does not serve.
The glyph is set bare: the key is the target, and a `.chip__glyph` roundel
inside it would draw the target twice.

Row 2's field is the search well (below, "The field, one well"): the mark,
what you type, the clear and the count are inside it; the keys that act on it
stand beside it.

**A control that applies to the whole answer is a BAND, at the head.** Rows 1
and 2 both narrow: the chips cut the shelf down, the field asks it a question.
An ordering does neither — it arranges the whole of what is left — so it is
neither a chip nor a key in the field, and the Library's Newest / Most followed
is the case the rule was written for. `.console__band` is the object: the
console's full width, options divided by its own `--surface-line` hairline
rather than set in a pill of their own, the chosen one **washed at 14% in the
line's pigment** — the rating bar's construction at console width, and the same
on state `.chip--on` wears. It sits **above row 1**, over everything it orders.

A pill was tried first and is what the band replaced. The chips take the full
width, so a `Seg` wrapped to a line of its own and sat at the trailing edge
with two thirds of that line empty beside it — a third band's worth of height
for one control, reading as a filter that had been left unpressed. **Width is
meaning here**: a control that fills the row is about everything under it, one
that shrink-wraps is one choice among the row's others.

**And chips are drawn only for what the shelf actually holds**: "All" beside a
lone "Vocabulary" is a choice between everything and everything, so under two
kinds there is no chip row at all — and no row either, because a console whose
first row holds nothing is a hairline drawn for its own sake.

Where the two meet on a narrow screen, **the figure gives before the control
does**. Under 560px the count is not printed beside a toggle: the count is
meta and the toggle is a way through, and a field squeezed between them is
cut before anything has been typed into it. And a row 2 with nothing to type
into keeps its rail and its control rather than going and taking the way back
with it.

### The field, one well

A field is **a well**: a step through whatever it sits on to the page
beneath (`.field`, `--bg-main`, no border at rest, `--r-card`, 44px). The
question field of a practice run (問) is the one the owner pointed at, and
every other field is drawn from it (plan 157, the owner's pick A of three on
the canvas "Tsuji — input fields"). On the page itself there is nothing
beneath to show, so the well steps **up** to `--surface` (`.field--page`);
on sumi it is `.field--panel`. The well is always **one step away from its
ground** — a page well on a card is `--surface` on `--surface`, a placeholder
with no field round it, and that is what the run's entry, the guest's claim
and the analyser's rail search were on the desk until the two guards
(`fields.browser.test.jsx` at a phone's width, `fields.desktop.test.jsx` at
the desk's) measured the mount.

**A search is the same well holding its mark** (`.field--search`): the
magnifier, the bare input, and at its trailing edge what the search carries —
the clear, the count. **A key that acts on the field stands beside it**, not
in it: 問's send, the console's search options and 部, a run's Check (on the
desk, the entry and Check are one row). Focus is the gold ring on the well,
flush, and nothing else: never a hairline box, never a line's pigment round a
field — a line's colour is a place.

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
treatment (outside the boarding's gate button, whose outline is its own — see
"The gate button").

**The ink is chosen by the fill's lightness, not fixed.** At the 70/79
deepening, **every line pigment but one carries `--text-on-panel`** in both
themes and both states; the worst of them, 黄丹 safflower, rests at 5.29:1 and
hovers at 4.53:1. A new pigment has to be measured against that pair before it
is minted — 常磐 tokiwa, added with 書取, rests at 5.56:1 and hovers at 4.74:1,
and 紫 murasaki, added with 作文 (plan 125), rests at 7.70:1 and hovers at
6.84:1 (8.68:1 and 7.99:1 on the light theme's value), measured by the
contrast guard's own sites rather than by hand.

**山吹色 gold is the one exception among the thirteen.** It reaches only 3.90:1
resting and 3.24:1 hovering in dark theme, and no deepening within this family
saves it — a deepened yellow turns olive before it will carry a light ink. Gold
takes the dark ink, or a deeper mix of its own: the console's gold pill goes to
60% and keeps `--text-on-fill`. Gold is the 辞書 section, so **a filled action
on that screen is not a plain `.btn-primary`.**

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

### The gate button

The boarding's one action — **Board** on the Welcome, **Continue** on every
question and at the end of a first ride (`Continue` in
`components/boarding/BoardFrame.jsx`), and the sign-in's own action in
Board's place (plan 168, phone and desk alike) — and Today's **Depart** on the fare
gate (`components/station/GateCard.jsx`, owner-directed after plan 164) are
drawn by one component, `components/ui/GateButton.jsx` (`.btn-depart--gate`),
as a ticket gate you tap your pass on (改札, plan 164: the owner's pick D of four
directions drawn for "more vibrant, the user must notice it and want to
press it"):

- **A gold pill**, 66px on the 844px phone (56px under 800px of frame, 52px
  under 740px, 66px always on the desk), its fill a top-lit ramp of 山吹
  (`--gate-gold-lit` → `--gate-gold` → `--gate-gold-deep`) that holds the
  same value in both themes, inked `--text-on-fill` (6.9:1 in the middle,
  5.3:1 at the deep end).
- **A sumi reader** at its left holding the pass's own contactless mark
  (`PassWave`) in `--gate-lamp`; two ripples leave it, and pressing lights
  it (`--text-on-panel`), the gate's ピッ. The word stands on the pill's
  centre line; on the desk the printed Enter takes the right end.
- **It breathes**: a halo that swells and settles every 2.8s.
- **Not yet is its outline**, not a faded fill: `--surface`, a
  `--surface-line` ring, the word and the reader's mark in
  `--text-secondary`, nothing moving.
- **A pick wakes it**: the fill fades in over the outline and the pill
  overshoots once (0.97 → 1.035 → 1). Only on that change — a gate that
  arrives ready does not pop.
- **An idle nudge**: ready and not pressed for four seconds, the reader
  steps toward the way on twice, then rests.
- **A list that scrolls under it fades** into the foot (the body's last
  `--sp-7`, driven by the body's own scroll, so nothing when it does not
  scroll).
- **One gate, in one place** (plan 168, the owner's word on the built
  boarding: the buttons are the feature that matters most). In the
  boarding the gate is the foot's last row, so from Board to the pass it
  stands at the same height and width on every screen; a quiet way — the
  sign-in, Not now, the account already held, the offer — stands a rung
  over it, never under, and is drawn as a quiet way (`.brd__link`), never
  as a second button. Its word is short enough to hold one line beside
  the reader at the gate's own size: a screen whose word will not fit
  gets a shorter word ("Activer le rappel", not a smaller one). Held by
  `src/boarding.phone.test.jsx`.

It stands outside three rulings on purpose, and nowhere else: the motion
rule's "no scale, no glow" (the halo, the wake), `--elev-action`'s single
shadow (the halo is its shadow), and the family's one disabled treatment
(opacity 0.45). None of the three is precedent: every other `.btn-depart`
is the primary button above. On Today the gate is closed (its outline) when
nothing is chosen or the balance cannot pay, and wakes when a lane is
switched back on; on the desk it takes the fare's right column, or the row's
width under the fare's figures when the gate is too narrow for both.

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
  spacing rather than to the box: a records lattice stretched to a taller
  neighbour centres each cell's figure, so the neighbour opens the room
  around the number instead of pooling emptiness under it.
- A card wider than ~440px must **earn** its width with a right-hand column
  (meta, a figure, a status). If it has nothing to put there, it should be
  narrower or the grid should have more columns.
- A grid of ≤5 short options is a grid, never a stack of full-width rows.
- **Air gives way before content does.** A screen laid out at one phone's
  height meets shorter ones, and a fixed pad cannot yield: it pushes the last
  choice off the bottom while its own emptiness stays. Where a block rhythm
  stands between a screen's parts, spend it as a flex spacer rather than a
  padding or a margin — the rung is then a maximum, collapsing (never past the
  container's own gap) until the room runs out, and only a screen genuinely
  too short for its content scrolls. The boarding's frame is the worked
  example (the question and its drawing stand on auto margins, the rung
  between them is a shrinking spacer, `.brd__air`, and a short frame then
  draws the drawing shorter, `--ys`, before anything scrolls), and centring
  a body that might overflow takes auto margins or a pair of grow-only
  spacers, never `justify-content: center`, whose overflow spills off both
  ends with the top unreachable.

## Motion

- Lists arrive staggered: the shared `arrive` / `arrive-soft` animation,
  ~30ms between children, **capped at the eighth** — past that the last rows
  are waiting on an animation nobody is watching.
- Hover is a **1px lift**, a border-colour change to the line pigment, a
  roundel that inverts, and a `▶` that slides in from `-4px`. All at
  0.15–0.16s ease. No scale, no glow, no fill. (The one exception is the
  boarding's gate button — see "The gate button".)
- Every `transition` and `animation` needs a `prefers-reduced-motion` answer
  that keeps opacity and drops transform.
- Every `:hover` rule needs a matching `:focus-visible`. Keyboard users get the
  same affordance, not just the global ring.

### Controls

- **The rating bar** — the most-used control in the app — is **one continuous
  instrument**, not a row of buttons, and it is **chrome**: the same sumi as
  the top bar and the level HUD, with the panel inks. A single panel, its
  segments divided by hairlines rather than gaps, the plain word alone as the
  label (the maintainer retired the Japanese term from the bar; see the
  rule's own comment in `index.css`) and a dot above each word carrying the
  colour: three-quarters strength at rest, full with a halo on the segment
  just pressed. That press is the bar's whole acknowledgement — the bar
  fades out with the mark still full while the next card arrives, and
  nothing else says "rated". On a phone it **docks straight onto the level
  HUD, edge to edge**, so the bottom of the screen is one console and the
  paper card is the only bright thing on it; four segments stay on **one
  row**, the shape a thumb sweeps along that edge, and only the
  six-segment bar wraps. Chosen from three forms drawn side by side in the
  study-mode redesign (a board row with the ramp as a rule, this dock, a
  hairline pill).
- **The streak is a スタンプラリー stamp rally**, not a flame — a row of
  eki-stamp marks, one per day, today's freshly inked. It says what the
  learner *did* rather than decorating a number, and it is on-metaphor for a
  station.
- **The rally has two sizes, and they are the same mark.** Seven days on the
  pass in the gate hall; five whole weeks, Monday to Sunday, as the profile's
  スタンプ帳. Same lacquer (`--stamp-ink`), same per-slot wobble, same press
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

A card taller than the screen scrolls the page behind that docked edge —
except for **a card that is a page of prose**, which is bounded to the screen
and scrolls inside itself. Reading comprehension's passage is the case that
named it (`.prompt-card--passage`, 2026-09-11): a card that is always taller
than the phone read as a sentence cut in half by the foot's own ground, with
the card's bottom edge somewhere off the page. The scroll is the **body's**,
never the card's — the foot strip is what names the card, and it has to stay
on screen. A prompt keeps the ordinary ruling; only a passage is bounded.

Above 768px the column is the centred `--card-w` it always was, with the
progress legend back — on the desk too, where the run also prints its keys
(see *The desk*).

### Rewards

Every card is rewarded, and none of it is a ceremony. Three moments, three
objects, and not one of them waits to be dismissed:

- **The fare** (運賃) — the XP an answer earns — is reported on the object it
  was paid into: the **level HUD** on a tab screen, where the roundel pulses
  gold once and the amount rises off it, and the **level bar** on a run
  (`components/chrome/LevelBar.jsx`), docked on the bottom edge under the
  rating bar, where the span it gained lights gold and the figure rises off
  the XP count. There is no toast, no panel and nothing to dismiss; the
  figure is gold because XP is the pass's balance, never a state colour.
  `XpToast` still sounds the tick and tells a screen reader. Every play mode
  pays: a card review through the scheduler, and a practice answer —
  reading, translation, comprehension, dictation, the exam — at a review's
  base rate through `srs.award_practice`, into the ledger rather than the
  review log, so the level and the 番付 move and nothing that counts
  reviews does.
- **The press** (落款) — a card climbing a stage — is the card being
  signed. Every card carries its stage as a **word** in its top corner
  (new · in progress · mastered, caption register, the stage's ink), not a
  hanko. The dictionary's plate carries the same word (decided
  2026-09-05; the hanko it wore is retired, so one vocabulary says the
  same SRS state everywhere it is written out). **The catalogue's tile
  is the one place it is not written out**: at 168px "IN PROGRESS" ran
  nearly the full width in the caption's tracking, pushed the reading
  off centre, and changed length card by card, so no two tiles read as
  the same object. The stage is that card's own bottom edge instead —
  the state's ink, the card's plain hairline where the schedule has
  never seen it — and the word stays for a screen reader. Owner's
  ruling, from a rendered comparison of six directions; the JLPT level
  the edge used to carry is read from the badge in the corner. A mark
  that only a colour carries is the exception here, not the rule: it is
  allowed on a wall of tiles where the word is one tap away, never
  where the state is the only thing being said. On a promotion a 落款
  impression — the new stage's glyph at the specimen's size, framed as a
  seal — is pressed into the **lower** corner,
  clear of the work, where a signature seal sits on a finished piece; the
  word in the top corner turns over to the new stage; the card's edge
  answers in the same ink. The impression is **faint by ruling**, under a
  fifth of full opacity: a detail on the card, never a poster over the
  specimen. The graduation (極) is gold, a double-line seal, the edge lit in
  full; a lapse re-inks the impression in vermillion with a shake. It holds
  the next card for under a second (`CardStamp.browser.test` pins every
  hold and the faintness), because the moment is the press, not a pageant:
  the wash, the kumadori, the brush and the petals are gone.
- **The level** (進級) is **clipped on the pass** (改札鋏, plan 142): the
  learner's 定期券 comes down, in its own material (the charcoal-into-sumi
  ground, hairline and sheen of `.pass`), the old figure is read for a
  beat, then the gate's punch bites its top edge — a real hole the ground
  shows through, the chip falling away, the punch's snip on the frame the
  bite opens — the old figure is struck, the new one printed in the pass's
  gold, and the balance empties to what the new level already holds. It is
  the People family throughout: no line pigment, no board. On a phone it
  hangs across the top inside the stage's gutters (the top bar is hidden
  while studying, so the edge is free and the docked rating bar stays
  usable) and the stage steps down under it by `--levelup-h`; wider, it
  floats at the screen's right at a phone's content width; on the desk it
  docks in a run's column (see *The desk*). On a clock, never gating — it
  leaves by itself while the next card is already in hand. It replaced a
  sumi board whose split-flap drums turned while it was still sliding in,
  so the one moment it existed for was half missed; the owner's pick of
  four directions drawn side by side (the board retimed, a hanging station
  plate, the in-car route, this). Under reduced motion the cut still
  happens — the bite, the figures, the balance — but nothing drops, jolts,
  scales or falls.

There was a fourth, **the rank** (再発行): the level bands each carried a
title (見習い → 浪人 → 侍 → 師範 → 免許皆伝), and crossing one re-issued the
pass in a board that took the whole screen and waited to be claimed. The
titles are retired — a placeholder ladder saying nothing the level number
did not — and the board went with them.

So nothing holds the queue. Every reward plays over the next card, because
a learner who has just rated one card is already looking for the next.

## Structure

### The chrome (the mobile canvas, plan 068)

- **Two chromes, one line** (owner's call, 2026-09-22; ADR 0018). Below
  1100px it is the phone's: the HUD across the top (level roundel ·
  goal-status panel · commuter pass), the five gates across the bottom
  (Learn · Practice · Today · Dictionary · Profile), the screen between
  them; between 769 and 1099 the same frame is a centred column of
  `--board-w`. At 1100px and up it is **the desk** (below): a rail down
  the left edge that is the HUD and the tab bar in one column. The line
  is `hooks/useDesk.js`'s, and the phone never crosses it — below it
  every screen renders what it rendered before the desk existed. This
  replaced "one chrome at every width", which answered an app whose wide
  screen had a burger drawer, an auto-hiding top bar and a concourse home
  of its own; the desk shares every part with the phone but the frame,
  which is what keeps the two from drifting as those did.
- **Both bars are sumi with the two panel inks and no line colour.** The
  pigment belongs to the screen's own bar (`.bar`): roundel, title, sub,
  aside, and a 2px stripe in the section's colour under it. A screen that
  is not a place on a line (the halls behind the pass) takes the
  `--register` bar: no roundel, a hairline.
- **A gate prints no bar** (owner's call, 2026-09-20). Today, Learn,
  Practice and Dictionary opened on the concourse's bar — 辻 over the
  gate's name, a caption or the date at the far end — under a HUD, over a
  tab bar that already captions the gate you are on: the same place named
  twice within a thumb's reach. The screen begins with its content; the
  name stays as the screen's one `<h1>`, clipped (`.sr-only`), so a screen
  reader still lands somewhere named. A *station* behind a gate keeps its
  bar — that is where the pigment and the way out live.
- **Japanese is content, not chrome.** The interface speaks the learner's
  language; a word, a sentence, a deck's name, a card's stage are
  Japanese. The
  bilingual JP + Latin pairing the desktop chrome used does not apply to
  the mobile chrome — and, since this rule was written, not even to the
  tab bar, which was its one exception: the gates were a kanji where a
  pictogram goes, with the plain word under each.
- **A gate is a pictogram, and only the gate you are on is captioned** —
  on the phone's row. (The desk's rail is a column with the room for every
  word, so there all five are captioned.)
  *Owner's ruling, from a rendered comparison of six directions.* Five
  gates are 78px on a 390px phone; `DICTIONNAIRE` is 94 and
  `AUJOURD'HUI` 87, so in French two captions printed straight over
  their neighbours — and no treatment of the type fixes that (tracked
  out, the widest word is still 4px too long; the canvas got away with
  it because it was drawn in English). So the row of words went. The
  five glyphs are drawn to the shared icon convention
  (`components/chrome/GateIcon.jsx`) and sit on one line; the lit gate
  takes the width its word needs and the other four share what is left.
  Every gate keeps its word as its accessible name, printed or not.
  **A caption that only the selected item carries is the pattern to
  reach for wherever a fixed row must hold a word in every language** —
  the alternative is type small enough to be unreadable, or copy chosen
  to fit rather than to be right.
- **The tab bar is not the only way along the row of five** — on the
  phone. (The desk has no flick: its gates are a column in their own
  order, so there is no row to walk.) A sideways
  flick across a gate's own screen moves one gate along it — left for the
  next, right for the one before — and the arriving gate pulls in from the
  side the flick came from. The bar is untouched and is still what *says*
  where you are; this is the same row read with a thumb. Three rules, and
  each is a decision rather than a detail: it is live on **every screen the
  chrome carries**, not on the five gate screens alone — a station, a
  platform picker, a deck, a settings page — and it lands on the **gate**
  rather than on a sibling station, because the gate is where the next
  choice is made; the **bar's own order**, because that is the order on
  screen; and it **does not wrap**, because past Learn and past Profile
  there is no next gate and wrapping would turn one over-eager flick into a
  jump across the app.
  Anything modal, a field, a rail that scrolls sideways, the strip down
  each edge where the OS keeps its own back gesture, and a departure
  already in flight all outrank it (`hooks/useGateSwipe.js`).
- **A run leaves the chrome.** Both bars go; the level bar takes the bottom
  edge (sumi, the level, the gold track, the XP figure — the fare's home once
  the HUD has left), the rating bar (or the field) docks on top of it and
  `‹ Gate` in the stage head is the way out. Everything docked reads
  `--dock-bottom` — the tab bar plus the safe-area inset under the shell, the
  level bar plus the inset on a stage — never a number of its own.
- **One filled action per screen**, gold, 52px, docked at the foot and
  rising with the keyboard; a selection is a gold ring; disabled is
  `opacity: 0.45` and nothing else; loading is three gold dots, never a
  spinner (`components/ui/Loading.jsx`); an empty state names the missing
  thing and the one thing to do about it (`components/ui/Empty.jsx`).
- **Between boarding screens the train pulls**: the leaving screen slides
  left as the next arrives from the right, 260ms ease-out; never a
  cross-fade. Under reduced motion only the rest state is drawn. (The
  desk pulls a shorter way; see *The desk*, "First contact is the
  crossroads".)
- **On a phone the boarding is drawn as maps** (plan 168; the owner's pick
  A of the canvas "Onboarding on the phone"). ‹ and the track at the
  head — a stop per question, the reveal the kana's second half, the level
  a stop only for a reader of both scripts — and the gate docked at the
  foot. Between them each question is set centred over its answers, a
  rung (`--sp-8`) apart, and the pair stands on the middle of the room —
  the owner's word on the first build, whose questions stood pinned under
  the head over a gulf: titles centred, and not always at the top. Each
  question draws its answers as roads out of a hub
  numbered as its stop — the name's plate on a pole, a junction of six
  reasons, the two words at a crossing, the line climbing through the
  levels, three lines fanning out of the kana — or as the thing they are:
  a departure board of four trains, the flap board turned by hand over its
  three services, a week of bells, the arrival first with the ride under
  it, the ticket an account keeps, the pass over the gate's reader. The
  Welcome is the crossroads: 辻 in its hub, the app's seven lines out of
  it and the gold road down into Board's reader; Log in draws the sign-in
  in the promise's place, the crossroads smaller over it and the road
  round the form into its action. Building is gone: the hour (or the
  nudge) goes on to the plan under its signboard, and the three arrival
  screens stand with no head. A drawing is laid on the canvas's 358px
  stage and scaled to the phone (`.brd-map`: a point's x a share of the
  width, its y in px), and a short frame draws it shorter (`--ys`) before
  anything scrolls. A pick is the pass's gold: its road, its ring, a wash
  under it with the gold a rung deeper as ink on it.
- The chrome's tokens: `--hud-h` (48px), `--tabbar-h` (50px),
  `--dock-bottom`, and the desk's `--desk-rail-w` (256px). The class map
  from the canvas to `index.css` is `docs/design/mobile/README.md`; the
  desk's is `docs/design/desk/README.md`.

### The desk (机, plans 113–123)

The computer's design, at 1100px and up. Everything above holds unless a
line here says otherwise. Plan 113 drew the chrome; plan 114 laid the
screens out for the width, so that nothing on a computer reads as a phone
set down on a desk; plan 115 took the remaining second screens and sheets
into the page and gave a session its keys; plan 120 went through every
dialog left and moved the ones that do not interrupt into their columns;
plan 122 drew first contact for a desk, and plan 123 made the workspace
answer a keyboard and a pointer one way everywhere. Plan 130 had the two
plated gates take the window; plan 140 laid first contact down the left
as the rail it arrives at, and plan 163 drew it again as the crossroads:
the question at the paper's top-left corner, the journey a strip of named
stops at the floor's left end, the floor in the bottom-right corner, and
each question drawing its answers between them.

- **The rail is the chrome.** One sumi column down the left edge,
  `--desk-rail-w`, with the HUD's own lit edge turned to face the screen:
  辻 over TSUJI at its head, the five gates, and the learner's pass at its
  foot. It is chrome, so it wears no line pigment — the one colour in the
  rail's own ink is Today's due count, a state's.
- **The rail's foot is the learner's pass** (定期券, plan 127; the owner's
  pick of five drawn directions, the canvas "Rail foot directions"). The
  HUD's three instruments set as the phone draws them were three shapes on
  three alignments, none on the rail's column; on the desk they are one
  card, the rail's other bookend — the origin station's plate at its head,
  your pass at its foot. The profile pass at pocket size: its charcoal
  sheen and identity corner, gold as its metal. Three doors on the card,
  each the HUD's own with its guide anchor: the face (the HUD's roundel,
  the fare still paid into it, and the climb to the next level as the
  run's level bar draws it), the purse (the balance, captioned with what
  it counts, or, spent, when it comes back), and the stub (the journey's
  word and drift under a perforation, lit by a lamp in the state's ink).
  The card's edge is the balance's, as the pocket pass's was. The pass is
  the learner's object, not the chrome's, so its gold and its state inks
  are the pass's materials rather than colour on chrome; the phone keeps
  the three apart on its HUD.
- **Every gate is captioned, Today first.** A column has the room the
  phone's row lacked, so the pictogram carries its word; and with no thumb
  to set Today under, it opens the list the way `/` opens on it
  (`config/tabs.js`, `DESK_TAB_IDS`). The lit gate is full ink on the
  lozenge's wash with the bar's 2px rule on the rail's edge.
- **The lit gate's stations hang under it, on a drawn line.** A stop per
  station, the one you are standing in filled — the map's own drawing (a
  rail, stops, where you are) in the panel's inks. The halls behind the
  pass list its settings too.
- **A screen gets a layout only where the width earns it, and what fills
  the width has a job.** A second column holds something the phone had to
  put behind a tap — a sheet, a toggle, a second screen — never a
  decoration found to fill it. The plates go two by two with the odd fifth
  across the row (a lattice with no short last row); the profile opens the
  holder flat, the pass and its stamps at the side column's width beside the
  record — its lines drawn with a rail per stop, both rankings at once, and
  no door to Statistics or Settings, which hang under the lit gate on the
  rail (plan 143); Settings sets its column (the pass and the
  list, plan 139) beside the open page, neither printing a title.
- **The canvas is `--desk-board-w` (1240px)**, the width a plated screen
  was always allowed, and a second column is **`--desk-side-w` (360px)** —
  a phone's content width, so a phone-born component set in it (the pass's
  back, a dictionary entry, a sentence's breakdown, a list of platforms) is
  drawn at the width it was designed at. `components/chrome/DeskSide.jsx`
  is the column; it is sticky and scrolls on its own when it is taller than
  the window. Scrolling on its own must not cut what it holds: the column
  (and every list that scrolls beside a page) keeps a gutter inside its
  clip edge and gives it back outside, so a row's hover lift, its focus
  ring and its arrival are drawn whole and no row moves for it. No box
  prints a scrollbar only while something arrives in it: not the page, a
  screen rising into a window it fits (the frame clips a movement, never
  what is laid out), and not a boarding step's body, sized to its answers
  on the desk (it keeps the rung under them as room).
- **The gates, with their companion beside them.** Today sets the pass's
  strip and its back (the journey) beside the fare gate; the back was a
  sheet. Since plan 135 the gate takes the window's height: each line is a
  band, its switch in a 230px column beside its lanes three across as
  tiles, so the line chips go, and the screen runs the whole width the
  rail leaves (the canvas's cap lifted for Today, as A·2 drew it); the head holds the run's length (20 / 50 / 100 / all,
  a `Seg` drawn square on the paper with its words as written,
  remembered per browser) and what the run will take in minutes
  (from the learner's own pace); each lane prints its share of the run —
  dealt the way the queue deals — and whether it boards (free, or a dashed
  edge and the next credit's hour when nothing paid can ride); the foot counts
  what boards, what waits and the balance beside Depart; and the side
  column, the window's height, ends on the week ahead — a bar a day,
  today's the gate's own total in gold, and what a shorter run leaves for
  tomorrow. Plan 116's two lanes across is retired with it. The
  dictionary's dock is open from the first frame on the first result, and
  every door in an entry opens inside the dock; ←/→ walk the catalogue.
  Since plan 128 the catalogue (the analyser's door, the console, the
  results) is one column and the entry stands beside all of it from the
  page's top, at `--desk-entry-w` (440px), never past the window's foot: a
  character's entry reads whole with no scroll, its plate laid across (the
  glyph at the left, its readings and gloss centred beside it), the stroke
  sheet and its figures in one row and the record four across. A word and
  a grammar point keep the plate stacked — a pattern cannot stand beside
  its readings at that width — and their longer bodies scroll inside the
  column, never the page. The column is held while a page loads; the
  radical index alone takes the width. The grammar collection turns the
  split round: its points one to a row in the side column (the pattern
  over its gloss), the entry across the rest and never narrower than
  `--desk-entry-w`, its plate laid left with the marks beside the pattern
  (over it, for a pattern of seven characters or more), the record flush
  under the stripe and the lesson in two columns where each holds
  `--desk-run-col-min`, each column its own (plan 146): the rule, its
  uses and its trap down the left, the sentences over the rivals down
  the right — never one flow balanced across the two, which opened the
  sentences at the left column's foot. The kana charts show the whole syllabary at once:
  three columns of charts, unmarked (each grid keeps its name for a
  screen reader), every cell one width between `--sp-8` and `--sp-9` and
  its kana at the title rung, each cell marked with where the learner
  stands — a gold wash and foot mastered, a vermillion foot in progress,
  the kana in the secondary ink not yet met — and the short kana entry at
  `--desk-side-w`. On the narrowest desk the columns wrap rather than
  shrink the cells.
- **The plated gates take the window** (plan 130, the owner's pick of
  three rendered options). Learn and Practice stood a third of the way
  down a 950px window with the rest empty; their plates now fill the room
  the page has, the rows sharing it, and the room goes to each plate's
  body, never to air in the box (the density contract). A Learn plate's
  foot draws the whole line **upright**: the novice's stop at the top,
  then a row per level with its stretch of the rail filled as far as the
  leg is ridden, its station at the leg's end, a bar of the level's
  make-up (learned in the line's pigment, met but not learned in half of
  it) and its learned / total, the bars sharing one column so each starts
  where the others do. Every row is a door to its stop. A Practice
  plate's grades are **rows**, each with what the learner has done at
  that grade (sentences, texts or papers, and the share right, from
  `/api/practice/record`) or "not yet", the learner's own grade in the
  chip's --here look; a row departs as its chip does. Practice goes three
  across once three hold a French name whole, and its six then stand in
  two rows. The shelf keeps its own height, having no body. Both feet are
  lists, one tab stop each, walked with ↑/↓. A window too short for the
  plates scrolls rather than squeezing a row below its content.
- **Learn is the lines beside the shelf** (plan 132, the owner's pick of
  three drawn layouts). The four lines stand in one column, each drawn
  **across** its plate: the novice's stop, then a column per level — its
  name, its ring on the rail, its learned / total — the stop being ridden
  in the lead rung, every stop a door. Beside them, a column at
  `--desk-entry-w` (giving down to `--desk-side-w` on the narrowest desk)
  holds the learner's decks over the library: every deck a row with what
  it is and what it is due, New deck and See all at its foot; then the
  library's most followed or newest three, Follow on each row, and a
  search that opens the library on its answer. A library row opens the
  deck's **preview** in the panel's place — who wrote it, three of its
  cards as tiles, its blurb, Follow and the way to all its cards — with
  the way back at its head. The phone keeps its fifth plate. The rail
  gains the library as a station under Learn.
- **The library before a deck is opened** (plan 132) stands three
  sections beside its list, where it used to open the first deck for
  you: **À la une** (the deck with the most new followers this week,
  drawn as the gate's preview), **Abonnements** (the decks you follow,
  each with the cards its author added since you last opened it) and
  **Tes publications** (your public decks, their followers and a bar a
  week for eight weeks). A deck opened from the list shows three of its
  cards as tiles over the full list.
- **A station is two panes.** Levels, sets or grades stand upright on the
  left and the chosen stop's platforms on the right, each platform with its
  own figures (due now, and the composition bar the statistics draw); the
  bare list opens on the learner's own stop, and another stop swaps the
  page by *replacing* the URL, so Back is never a walk through every stop
  looked at. A mock exam's grade is in its URL. A route that boards
  directly (a sentence station's levels) is drawn across as a line. The
  second screens fold the same way (plan 115): a grammar level's points
  beside the open point's lesson (←/→ walk them), a theme's bands and the
  frequency tiers beside the open one's platforms, figured from the stats
  route each run opens on, the library's shelf beside the open deck's page
  (the shelf keeping its search and its place), and a deck's platform screen
  gives way to the deck's page. Since plan 154 (the owner's pick B of four
  drawn layouts, the canvas "Tsuji — the shelf (教材) layout") the
  learner's own shelf does the same: its decks a list beside the open
  deck's page, the bare shelf opening on its first deck, another deck
  swapping the page in place, the shelf's two doors at the list's foot.
  A long list scrolls in its own column; the
  stops are one tab stop, walked with ↑/↓. Every row of the lists above is
  a link to what it opens (plan 117), the exam review's question included,
  so it opens in a new tab as well as beside the list — and it wears the
  button's face it replaced, to the pixel; the phone keeps its buttons.
  A radical's page (plan 118) stands the radicals index beside the lesson
  and its platforms, on the stroke page the radical is on, and another
  radical swaps the page in place; the family's door no longer takes the
  lesson's place but swaps the index for the family, in the list, and
  back. The bare index opens on its page's biggest family.
- **A line's station takes the window** (plan 137, the owner's pick A of
  the station screens canvas). A kana set or a JLPT level of vocab, kanji
  or grammar stood a third of the way down the window, its stops
  wrapping their names and its platforms 850px wide with nothing between
  the description and the figures. Both columns now fill the window,
  the rows sharing it the way the gates' plates do, never below their
  content. A **stop** is its code and name on one line, the first things
  it teaches under them (a few kana, the level's commonest words, its
  first grammar points), the Learn plate's bar of its make-up, then
  "you are here" and its figure. A **platform** carries, in a well
  between its description and its figures, **the card it will ask** —
  何 → quoi on Word → meaning, quoi → 何 on Meaning → word, the sentence
  and its gap among the rivals on Which one fits — drawn from the open
  stop's own card, so N1's platforms show an N1 word. The well is the
  paper the run's card lies on, seen through the platform; it is
  decorative for a screen reader, the description saying the same. The
  wells need a platform row a third of which is at least a side column,
  so they are drawn only where the page is 720px or wider — measured,
  not set at a window width — and a laptop keeps its descriptions whole
  instead. The figures add what is in progress when nothing is due (the
  bar's red sliver, named). The **fast review**, which rates nothing,
  and the grammar level's **points**, which open rather than board, are
  doors at the page's foot, one row. The bar names no level: the open
  stop does.
- **Vocabulary's sources are three plates** (plan 137, the owner's pick
  S2). /learn/vocab was three cards across the top of an empty window,
  each opening a list of its own. Each source now hangs as a plate the
  window's height (the gates' plate, `--elev-hang`) with its whole list
  on it — JLPT's five levels as a line sharing the plate, the frequency
  tiers under their pool and size with the cards met in each, the
  themes under their filter — and every row is a link that pushes to
  its stop's platforms. The lists scroll inside their plates, never the
  page. The phone keeps its three cards.
- **A practice station takes the window** (plan 159, the owner's picks A
  and S1 of the canvas "Practice screens — layout options"). Reading and
  translation opened on three source cards across the top of an empty
  window, the one-axis platforms on their five grades in one short row,
  the mock exam on four paper names. Each is now a line's split filled
  as plan 137 fills the Learn stations. The **list**: reading's and
  translation's source is a switch at its head (JLPT · Fréquence · Mes
  cartes), so the page that only chose a source is gone on the desk;
  under it the grades share the column's height, each with a sentence
  (or the texts, the points, the papers) of its own bank, the bar of the
  grade's words (the exam's: the papers sat) and the learner's record at
  the foot ("24 phrases · 83 % justes"), "you are here" beside the name;
  or the tiers; or the learner's own cards. The **page** is the open
  stop's, the window's height beside the list: the stop's name and what
  the run asks over Board (the one filled action, and Enter), the
  exercise as the run will ask it in a well at the run's own size (the
  bank's sentence under the clock over the rōmaji field; the English to
  say in Japanese; a text beside its question; a clip; a point), four
  figures in the profile's lattice (done, right, the grade's words, the
  last ride), then two panels sharing what is left — the newest misses
  (comprehension: the texts read, with their score) and the grade's
  grammar points, those studied at Learn ringed and dotted, or a tier's
  words — each scrolling inside itself. The mock exam's page is its
  papers, a row each: the name with the JLPT's (語彙), the kinds of
  question it holds, a question of the kind drawn from the grade's own
  content, the questions and minutes, the last score and "Different
  paper"; Board is the next paper not sat. Under 600px (measured) the
  page stacks and scrolls; under 720px the papers draw no well. The
  phone keeps its screens.
- **Every platform's specimen hangs on the Practice gate** (plan 165, the
  last board of the same canvas). The six plates were five grade rows
  each, most of them "Not yet", the record and the grades a plate opens
  onto since plan 159. Each plate now shows what its platform asks: a
  line saying it, then the run's own card in a well at the learner's
  grade, as the stop's page draws it a rung down — the timed sentence
  over the rōmaji field, the English to put into Japanese, a text over
  its question and choices, the clip heard twice, the point to write
  with, and the mock exam's 漢字読み with the paper's own four readings
  (the reading and three of the generator's near-misses). The plate is
  one door: the well stands inside its head, so a click on the picture
  departs as the name does, and the line is the button's description.
  Measured: three rows deep (the desk's tightest) a plate draws no line
  and comprehension's text stands alone, so every card is whole and the
  gate still takes the window without a scroll. The Japanese name the
  canvas printed beside each title (読書, 翻訳 …) stays off: the owner
  cut it from these plates as a second name for a thing already named,
  and the roundel still carries the station's code. The phone keeps its
  chips.
- **The statistics are the four lines** (plan 138, the owner's pick B of
  four drawn directions, the canvas "Statistics rework — options"). A
  strip of four figures across the top — retention with its line beside
  it, the reviews behind the stop the line is asked about, the misses of
  the last thirty days, the strength ladder — over a plate per line,
  two by two. A plate is its line's answer to the screen's one question:
  its retention, a grid of retention by exercise and by deck (a row per
  exercise ridden, a column per deck, the one cell furthest under the
  learner's own average in the danger ink, every cell a door to that
  run) and its most-missed cards as tiles, beside the grid while both
  fit and under it when not. A row of plates is as tall as its taller
  plate and no taller: a plate has no body to give the window's height
  to the way a gate's upright line has, and a card stretched past its
  grid holds air, so the page ends where the record does. The line is
  drawn 1:1 at its cell's width, and in days while it would draw three
  weeks or fewer. The phone stands the same plates in one column; there
  is no sheet at either width.
- **Settings is the pass's contract, beside the page it opens** (plan
  139, the owner's pick of B and C on the canvas "Settings rework —
  options", with the titles off on the desk). The column is the pass at
  `--desk-entry-w` (giving down to `--desk-side-w`) over the list, sticky
  and bounded; the open page takes the rest of the width, its slips
  cards running to its edge. Where the page holds two at 310px each
  (measured on the page, not set at a window width) they stand in rows
  of two (plan 145): a row's cards at the taller's height with their
  actions at its foot, so a page ends level rather than in two columns
  of different lengths, and a page pairs what belongs together. A card
  of one action that takes the width lies across it, its words in the
  left half and its action in the right, under the row's actions at
  their width, so no action runs past `--card-w`; the guest's claim sets
  its two ways in side by side the same way. **No title on
  either**: the rail's lit station names the screen and the lit door --
  a field of the pass in its gold wash and rail, a stop in its gold ring,
  a row in the list's gold rail -- names the page; both headings stay,
  clipped. The bare column opens on the destination.
- **A run is a workspace.** The card is centred in what the run's side
  leaves; the side (StudyStage's `side`, fixed to the right edge, in the
  run's own pigment) is the entry's place: on a card run it holds **the
  revealed card's dictionary entry** — docked by the reveal and never
  before it, because the entry is the answer — and the cards that went
  badly so far (at the run's end too), each opening its entry; on a browse
  (the fast review), that entry alone — a browse rates nothing, so it has
  no misses, and an empty one stands no side; on a graded practice run,
  the sentence's breakdown, with no toggle. This run's three records are
  on the floor (below, plan 124); they stood at the side's head until
  then. The level bar keeps the stage's width.
- **A run fits a laptop.** Its stage starts at the top of the window; the
  card and its choices (or the prompt and the writing board, the board in
  the wide column) stand side by side, the head spanning both; answered,
  the unused choices keep their place unseen instead of collapsing, so
  nothing under them moves. **The foot follows its content** (plan 123):
  a run's action — Next, Check, the exam's Previous, flag and Next —
  stands under what it acts on and sticks at the dock line when the
  window is short, never on the window's floor half a screen away; only a
  browse's ← → keep their place, being pressed over and over.
- **Above about 1460px the workspace is centred** (plan 123): the card and
  the run's side stand together, the window's spare width shared equally
  either side of the pair (`--desk-run-inset`) rather than poured between
  them, and the level bar spans the workspace only.
- **A level docks in the run's column** (plan 142): the level-up's pass
  comes out of the top edge of the run's left column on three panels —
  this run's panel, whose level bar it just topped off — or of the side
  where a run has the side alone, and the column steps down under it by
  the pass and its gap, as a phone's stage does. Sticky, so a scrolled
  column still shows it; no shadow, being docked rather than hung. It
  never stands over the card's details (plan 123 had docked the board it
  replaced across the side's top for the same reason).
- **A card run stands on three panels** (三面, plan 126; it replaced the
  console plan 124 had set on the floor). Three columns of surface
  panels, the owner's own layout: at the left **this run** — the three
  figures (rated, good or better, XP earned), the level bar as a row of
  the panel rather than a strip on the floor, the deck's legend, the
  remaining count, which leaves the head's pill — over **the card
  panel**: the card's state on a line with stops (new, learning,
  learned, the train at the stage it is in), every verdict of the
  learner's own scale as a tile, two by two, each a figure — when the
  card comes back as the large numeral and its unit (3 min, 1 jour, 3
  sem.), the verdict's word as its label beneath, the digit that presses
  it in the corner (off the card's own `review_preview`, so nothing waits
  on a round trip) — the keys the elements no longer print, and the
  rhythm on a sumi foot. **No captions on either panel**
  and no line under a tile's interval saying what the rating does — the
  owner cut them for room: the figures, the stops and the tiles name
  themselves, and the remaining count is a fourth figure. Where the
  column is too narrow for the run's labels (a laptop's 300px), the
  figures stand bare, the labels kept for a screen reader — measured, not
  set at a width, since their length is the language's. In the
  middle **the card**, the tiles framed in a surface row under it,
  **unlit and inert before the reveal** rather than unseen, with no
  digits in their corners. At the right **the card's details**: before
  the reveal one sealed panel with a ? and nothing else — the entry is
  the answer — and after it the entry in its band layout, the top panel
  the card and your numbers (the glyph at the left, readings and meaning
  beside it, level, state and the actions at the right, the accuracy and
  the reviews under the stripe — the interval and the next review are
  the tiles' to say), the bottom the dictionary alone, the stroke sheet
  growing into what the senses and the words leave and never below twice
  the specimen: short of that the panel scrolls. The columns share
  `--desk-run-w` 28 | 42 | 30 (482 | 722 | 516 at the owner's 1877px),
  stand centred past it and give down to 300 | 400 | 300 on a laptop
  without a second width query. The elements print no key caps there
  (`RunPanelsContext`) but the flashcard's "Espace pour révéler". A run with no rating bar (a browse, the
  rides) keeps its side alone, the level strip on the
  floor and the plate's own layout; a run that failed or ended with
  nothing rated shows no figures, and the misses stand at its end.
- **A practice run stands on the same three panels** (plan 129; the
  owner asked for the practice modes to be reworked as the learning ones
  were, and picked the left panel from three drawn candidates). Reading,
  translation, dictation, composition and comprehension: at the left
  **this run** — sentences (or questions) rated, good or better, XP
  earned, the level bar as a row; the head's score pill goes — over **the
  run's lines**: every sentence so far with the grade it got as a dot in
  its verdict's ink, the one on the stage last, and any passed sentence a
  door back to its breakdown in the right column (on a phone, and on the
  desk before this, a sentence was gone the moment Next was pressed). The
  row on the stage is an ellipsis until the answer is in — the list
  stands beside the card, and before the answer the sentence is the
  card's to show or to cover (reading's clock) and dictation's to
  withhold; the row whose breakdown the column shows is lit in gold, Esc
  stepping back to the sentence on the stage. The keys at the panel's
  foot and the rhythm on its sumi. A sentence has no forecast to print:
  it does not come back the way a card does, and the tiles' figure — what
  a verdict pays — was rejected because a price beside a self-grade
  invites the learner to inflate it. In the middle **the exercise**, the
  card grown to what its floor leaves and the floor one framed row, as
  the tiles' is: the field and Check, the tiles, then Next. At the right
  **the breakdown**, sealed until the grade (the breakdown is the
  answer), then the column's one panel; composition's lesson and
  comprehension's text stand there the same way. Comprehension's lines
  are its questions — asked so far, never ahead of the one on the stage,
  a record rather than doors — and on its review every one with its
  verdict: the open one's card in the middle with its options marked,
  the sentence it quotes in the breakdown, the first miss open on
  arrival, the score in the figures. The elements print no key caps; the
  lines list them. The mock exam keeps its paper (below), and has no
  lines: it is sat, not practised.
- **The asking (問): one short question, a precise answer** (plan 131;
  the owner's "limited to small questions and only precise answers").
  It stands in the practice run's lines panel, the list and the asking a
  half each so neither moves when the other grows, and it opens when the
  breakdown does — after the grade, comprehension on its results —
  because before that "what does this mean?" is the answer key. Sealed
  until then: the field drawn, disabled, under the line that says when
  it opens. A question is a line (200 characters), a sentence keeps five
  and a day forty; the answer is three short sentences at most, names the
  Japanese it explains in 「 」 with its reading, and is grounded in what
  is on the three panels — the sentence or the text, its translation,
  the learner's answer, the point, the tutor's review, the breakdown's
  words. A question off the exercise is declined in the learner's own
  words. The thread is the sentence's: the questions under 問 in the
  page's second ink, the answers under 答 in its first, the gold of the
  lit row on the mark; a line reopened from the list keeps its own
  thread. Enter in the field asks, and the run's Enter waits for the
  field to be left. The send is an arrow, named for a screen reader and
  on hover, because a laptop's column needs the room for the field.
  Nothing the learner typed is kept, and the mock exam never asks.
- **A graded sentence's breakdown is the analyser's, numbered** (plan 160,
  the owner's pick A of five drawn on the canvas "Tsuji Breakdown Panel";
  every width, the phone's behind its toggle). The sentence line frames
  each rule on its words under its number, in a well of its own; under
  the translation the words, one row each, named as the dictionary names
  them (話す はなす where the sentence wrote 話し), glossed in the
  learner's language, the endings they were written with (ます, た) a
  quiet tag after the meaning; then a numbered card per rule — the
  particles' markers and the constructions, in the sentence's order —
  with the words it is made of as chips, the word it attaches to unlit.
  A particle, the copula and a word a construction is written on with no
  card of its own are no rows: they are the rule's, and a row with no
  meaning was what 〜てはいけません's て and は drew. On the desk the
  explanation, or the Explain that buys it, stands on the panel's floor.
- **A door opens in the column, never over it.** A word, a kanji or a rule
  pressed in a docked breakdown opens its entry in that column
  (`SideLookup`), the sentence's line kept above it so the next word is one
  click, Esc or ✕ bringing the breakdown back where it was scrolled. The
  analyser's result is three columns (plan 134, the owner's drawing): the
  Passage's sentences over the focused one's grammar, numbered; the video,
  the sentence as its subtitle and the player's bar as one sumi object,
  with the sentence's words beside the word in focus under it and Explain
  at their foot; and the card in focus in the runs' band on the right,
  following the token walked to (←/→) and the doors pressed, Explain
  standing the explanation in its description's place with a swap on the
  column's edge. The desk's rail steps aside for this one screen, so the
  three columns have the window at the drawing's shares (410 | 830 | 541);
  under the desk the same result is one column, drawn by the owner too.
  A typed or photographed Passage has no video, and its sentence takes the
  video's place (plan 161, the owner's picks B and B′): the sumi object to
  the middle column's foot, the sentence at `--fs-display-fluid`, its
  translation under it once Explain has bought it, Explain under that; no
  card beside the words, the entry being that card and its deck action on
  the word's row; one sentence's words over its grammar on the left,
  several sentences' words under the sentence; every panel as tall as it
  holds.
  Before a Passage, the analyser is the learner's passages (plan 136, the
  owner's pick C of three drawn directions): the one console over a card
  each, and the intake the column beside them at a phone's width -- the
  three sources on one control, the video's a column with one filled
  action (the fetch where the server can, else the bookmark's setup until
  it has been used, else the video on YouTube). A file dropped anywhere
  on the page is taken by the intake that reads it. Under the desk it is
  one line to paste into over a row per passage, the video and photo
  intakes opening as sheets.
  A deck's Browse and More open in the deck page's slot, a
  gate lesson's rival in the run's side, the grab's walkthrough in the
  intake's place, a kanji's readings in the entry's own place, the iOS install
  steps in the settings page (plan 120). A panel that takes a column's
  place (Browse, More, the walkthrough, a deck's card form) wears
  `DeskDock`'s caption and the entry's own roundel ✕ over the phone's own
  body, and the column's tenant comes back on ✕, on Esc, or on the lit chip
  that opened it pressed again. The dock takes the focus in (the field to
  type in, else its caption) and gives it back to what opened it; a door
  opened from a breakdown or in the dictionary's dock does the same, the
  entry coming back where it was scrolled (plan 123). A dialog is kept for
  what must interrupt: a
  confirmation (the deck's deletion, taking a followed deck, unfollowing,
  a level change, the exam's finish with blanks and its way out), an
  import, a creation that leaves the page (a new deck), a report, a
  refusal (the offer, a run stopped at an empty balance), a failure the
  learner has to answer (a paper that did not submit), the question an
  action asks before it can finish (which deck to mine into), and a guide
  note. The rail's own doors — the balance, the pass's back — stay dialogs
  too: they are the chrome's, open the same over every screen, and no page
  has a column that is theirs. Sheet by sheet, with the reason for each:
  `docs/design/desk/README.md`, "Dialogs on the desk". A kept dialog is
  drawn for a desk (plan 123): it opens on its way back (Cancel, the way
  out), never on the irreversible act; its actions share a row; a ✕ stands
  where the body has no way out of its own; and the rail's own sheets stand
  beside the rail at the side column's width.
- **Comprehension and the mock exam are sat, not scrolled.** The text
  stands whole beside its questions; a reading passage stands flat on a
  card of its own beside the questions it serves and stays put across
  them; the exam's answer sheet — clock, count, every question, Finish —
  stands in the run's side the whole paper. The review is a list beside
  the open question's revealed card, the first miss open on arrival.
- **The way up is a crumb, and the rail is the way around.** A screen's ‹
  way out to a place the rail opens (a gate, the lit gate's stations) is
  not drawn on the desk; any other is a small crumb over the title, never
  the phone's pill in the bar's corner. A way out is written as `<Leave
  to>` when it is a place, which is how the bar can tell. A run keeps its
  pill: it has no rail.
- **`/` is the dictionary's search from anywhere the rail is**, and the
  Dictionary gate prints the key. The shelf's list (plan 154) is the
  index field over the types as glyph chips with their counts, a row per
  deck (its glyph, its name, its cards and whose it is, what it is due),
  the open one on the card's surface with its type's rail, and the two
  doors at its foot. The deck's page, past a hairline, is one column: its
  head (the roundel, the type and the count as a caption, the name, Edit
  — the selection — and More); its cards as four figures in a hairline
  lattice, due, new, learning and mastered, each card's `state` from the
  server, four across or two by two, never three and one; its modes as
  cards, each with what the day's queue holds for it; its first six cards
  as a table on the page's ground, each with its state, and the way to all
  of them; and at the foot Add cards beside the one filled action — the
  deck's lanes of the day's queue ("Réviser 12 cartes"), or, with nothing
  due, its first mode. The card form, Browse and More take the modes'
  place (it was the page's second column until the shelf stood beside
  it). Both columns are the window's height and nothing leaves it: the
  list's rows scroll between its console and its doors, the page's
  cards between its head and its foot, so the ride is always on the
  screen. A page too narrow or too short for the mode cards (measured,
  `useBoxSize`, since the desk's sheet answers one query) sets its modes
  as a row of chips over the foot; a narrow one also sets Edit as its
  pencil, Add as its short word and a card's reading under its word. A
  new deck is a dialog over the shelf that ends on the new deck's page,
  its first card's form open (plan 123).
- **A sheet is a dialog.** The bottom edge is where a thumb is; on a
  computer it is a long way from the pointer. The same panel is set in
  the middle of the screen — every corner, no handle, a fade. Only the
  sheets that interrupt are left to be drawn so (above).
- **A run still leaves the chrome, and prints its keys.** The rail goes
  as both bars go. The digits that rate and answer and the space bar that
  turns the card are drawn where they act — a cap in each rating tile's
  corner (reversed, as the handler reads them: 1 is the best, at the
  right), the choice's index as the digit that answers it, "Espace pour
  révéler" — because on a desk the hands are on the keys; on a card run's
  panels (plan 126) only the card's "Espace pour révéler" prints, since
  the card panel lists every key and the digit stands on each verdict's
  tile. A whole session
  needs no pointer (plan 115): Enter departs from Today's gate and takes a
  finished run's one filled action, Esc leaves a run (never over a dialog,
  never when a docked entry has taken the key), C shows the choices, A–D
  or 1–4 then Enter answer a comprehension question, Space plays a
  listening clip, Ctrl/⌘+Enter analyses; a reading, a translation or a
  dictation line goes type, Enter, digit, Enter (plan 123). Every cap is
  printed on what it presses (`.desk-kbd`) and named in
  `aria-keyshortcuts`.
- **Esc belongs to the innermost thing that holds it** (plan 123): a list
  open in an entry, a door opened inside a docked entry, a dock or a
  lookup in a column, the level-up's pass — and only then the run. A field
  with text in it spends the first Esc leaving the field. The run's head
  stops printing its Esc while a door holds the key, since the cap would
  say "leave" while Esc closed the door.
- **Lists are walked one way, and places are links** (plan 123). Every
  list beside a page — a station's stops, the grammar points, the tiers,
  the library's shelf, the exam's review, Settings, Browse's results — is
  one tab stop, walked with ↑/↓, Home and End, Space opening the row; the
  dictionary's grid is one stop walked in two dimensions, ↓ from the
  search entering it. Everything that is a place is a link wearing its
  button's face: Settings' pages (replacing, so seven pages looked at cost
  one Back; the pass's fields and the list's rows are one walk), the shelf's decks, a radical page's tiles, a bar's way up,
  the profile's halls and lines. A radio group is one stop whose arrows
  move and check — or move alone where a choice is a save or a question
  (the level, the pace, the hour, the rating scale), Space choosing — and
  every hover has its focus twin.
- **A copy and a pointer get what they expect** (plan 123): a selection on
  a card is not a turn, ruby readings stay out of a copy, the retention
  line answers a mouse passing over it, and a screenshot goes into the
  analyser by paste or drop.
- **A guide note stands beside its anchor.** An anchor in the rail has its
  note to its right, one in a side column to its left, and one in the page
  on the anchor itself, as wide as it between a column and a card; the
  notes that teach a key or point at something say so on the desk (the
  `…Desk` copy — no "tap" is printed there). → and Enter go on; Today's
  stops walk down the rail first (plan 123).
- **First contact is the crossroads** (plan 163; the owner's pick D of
  the canvas "Tsuji — onboarding, new directions", with option 3, 空の弧,
  for the hour; plans 122, 140 and 155 before it). 辻 is a crossroads, so
  first contact is drawn as one, on the paper whole: plan 140's sumi
  column down the left edge, and the rail's masthead at its head, are
  gone.
  - *The Welcome is the crossroads itself.* 辻 in its hub right of the
    paper's middle — the app's name — and out of it the app's seven
    lines, each in its pigment to its sign and its name (the kana, the
    words, the kanji, the grammar, reading, translation, dictation), and
    the eighth road, gold, running left to the way in at the paper's
    margin: the promise over Board, Board a rung under the paper's middle.
    The corner holds the other way in, a plain button: Log in stands the
    sign-in in the promise's place — Google, the two fields in the page's
    wells, its own action where Board stood, ‹ back to the promise under
    it — and the corner then offers Board. A pass that could not be issued
    opens it on Sign up, both sides named. The drawing is the paper's own:
    the lines as long as the paper leaves them. The phone draws its own
    crossroads down the screen (plan 168).
  - *Three places never move.* The question at the paper's top-left
    corner at the display rung; the journey a strip of named stops at the
    floor's left end, on the line Back and Continue stand on (the ones
    ridden filled, the one asked lit with the phone track's gold ring, a
    stop behind a door back to its question while there is a way back,
    the answer given said in its name rather than printed); the floor in
    the bottom-right corner, Back beside Continue — a ticket wide, giving
    way before it meets the strip. The strip stands outside the cars, so
    it holds still while a question pulls.
  - *Each question draws its answers as the thing they are*, out of a
    hub that prints its place on the strip. The name is the first
    station: its plate, a pole down to the hub, the line leaving it for
    the next stop. The six reasons are six roads out of the hub to their
    pictograms in rings, the pick's road in gold. The kana are the two
    words, large, over a tree to the four answers, each drawn as what it
    reads (a word read a solid chip, one not yet a dashed one); the
    reveal reads each word sign by sign and names the first stop and its
    day. The level and the goal are one line climbing a step a level from
    the hub — the novice's stop, then N5 up to N1 — the pick called out
    ("You are here", or the arrival's month). The lines are three cards
    in their pigments, each with what it carries on this ride, under the
    kana's ticket (on every ticket, so no answer), the arrival's month
    under them. The rhythms are four roads out of today on one calendar,
    each as long as its ride. The hour is the day's arc — sunrise at the
    left, noon at the top, night at the right, 朝 昼 夜 on it as stations
    — the train riding it a half hour at a time, dragged or by its keys,
    over the departure board in the bowl. The plan is the ride to scale,
    today to the terminus, every stop where its day falls, and under a
    rule what the terminus holds beside what the ride is for. A guest's
    account is its form beside the ticket it keeps, the route printed on
    it and the welcome's credits on its stub; riding on without one is
    offered under the ticket. Every drawing is measured off its own box,
    so it fits a laptop's 1100x800 and a wide window alike.
  - *Every answer keeps its key.* Its digit in the slot its check is read
    from, turned over to the gold check once picked; Enter goes on from
    any step; the digits pick (a level its own number, N5 on 5, the
    novice's stop on 0); Esc does nothing — the way out of the boarding
    signs the guest out. Building is skipped and the pass's own screen
    folds away: the plan is the last screen and enters the station,
    unless a guest is offered the account first, which then enters. The
    first ride after it stands on the runs' three panels (plan 133).
  - *The desk's pull is a short one* (plan 155): the leaving car a rung
    (`--sp-9`) the way it goes, fading, in 180ms; the arriving car the
    same rung from the other side once it has all but gone — never two
    questions read over each other — settling in 520ms, its answers a
    beat apart behind it; Back runs both the other way. A full-width pull
    across 1,200px of paper was a smear, not a train. The leaving car is
    kept until the arriving one's answers have landed.
  - *The wait is drawn on the paper.* Board pulls the way in, the hub and
    the map a rung to the left, fading, and the boot screen's dots are
    drawn alone on the paper's middle a beat after the press — first on
    the Welcome while the pass is issued, then carried on by the wait
    after it. A pass that could not be issued brings the Welcome back.
    The plan's arrival signboard stands on the paper's middle with its
    scrim over the paper.
  - *A field's focus is one edge*: the name (and the account's two
    fields) take 1.5px of the pass's gold when typed in, with no second
    ring outside it, and rest on the answers' hairline, filled or not.
  - *A hover is the name field's edge and nothing else*: an answer
    under the pointer takes the name field's 1.5px of gold on its own
    ground — no wash, no lift — while a pick keeps its wash and its
    check, so the two never read alike; the sheet's bare `button:hover`
    brightness, which lit a paper tile cream and a picked one yellow, is
    cancelled on the boarding and on the Welcome's plain buttons.
- **Every desk rule is in one place.** The last section of `index.css`,
  one media block, names written nowhere else; `src/desk.css.test.js`
  holds it. Never write a desk rule anywhere else, and never let a phone
  rule be desk-aware: the line is the only door.

- **One `<h1>` per screen**, and it is the object that names the place — the
  station plate, the pass, or the screen's bar. A plated screen never prints
  a second heading.
- Section headings are `<h2>` inside the paired `SectionHeader`.
- **A screen may be composed of inserts instead of sections, and then it
  prints no `SectionHeader` at all.** The profile is the worked example: the
  pass is the `<h1>`, and every block beneath it is an object that names
  itself — the doors to 統計 and Settings straight under it, a stamp sheet
  titled with its month, a lattice of records, a ledger whose rows carry
  their own roundels, a 番付. It printed six `SectionHeader`s over six self-evident
  objects, which is the second rule's exact failure: a caption for a figure
  the layout already explains. **A block that needs a heading to be legible is
  not finished** — give it the mark that names it, the way each ledger cell
  carries its own roundel and 線 name instead of sitting under a "Lines" title.
- **Settings opens on the pass, printed with its contract** (plan 139). The
  profile's card (`.pass`) with the route where the holder goes — the
  level it boards at → the destination — and the fields a 定期券 prints
  where the balance goes: service, daily ride, lines, and the validity in
  the pass's gold. Every printed field is the door to the page that
  changes it; the validity opens nothing, being what the rest add up to.
  The daily pace is one field: it was on two pages over one number. Under
  the card the rest is a list whose rows **draw what they are set to**
  beside their words (`RowSpecimens`: the theme's grounds, the mixer's
  levels, the rating bar's dots, the reading pace's clock), and every
  page draws what it sets:
  each stop ahead with the date the service reaches it, each service as
  a line to the destination on one time axis with the learner's own pace
  of the last fortnight dashed beside them, the themes as screens at
  thumbnail size (drawn from the inks that do not flip, so the light one
  stays light under the dark theme), a language saying the gates' names
  in itself, the three rating bars as the bar itself (`RatingBar`'s
  `specimen`), and each reading pace as the reading run's clock at the
  length it gives a short sentence (`ReadingTimer`). A choice's consequence is printed beside it before it is
  made, never only once it is chosen. A selection in Settings is a gold
  ring, the pass's metal. Sign out is printed once, on the account page,
  whose second half is the learner's data.
- **The two gates hang one plate per line** (plan 094, `LinePlate`): the
  roundel, the name in the learner's language and nothing under it, the
  section's aside at the trailing edge (a due count), a foot, and the
  line's pigment as the 4px stripe along the bottom. The name is left-flush
  beside the roundel and ellipses before the aside moves, so a chip never
  pushes one plate's title off the line the others share. The foot is what
  a real 駅名標 prints under the name: on a Learn line the stop reached in
  the middle with the stop behind and the stop ahead at the edges, the
  stripe filling with the leg being ridden; on a Practice platform the five
  grades its trains leave for. Chosen from five directions drawn side by
  side (plates, the platform card, the map upright, the ledger, the next
  train), and drawn without the reading and the caption the mockup gave
  it — a plate that prints かな over Kana over KANA names one thing three
  times. On a phone the column takes the gate and every plate gets one
  share, the shelf too. On the desk the lattice takes the window the same
  way, and the plate's body grows into the room: the whole line upright on
  Learn (plan 130, "The desk" above); on Practice, since plan 165, the
  platform's own exercise in a well under a line saying what it asks, the
  head the whole plate — the station it opens carries the grades and the
  learner's record at each.
- **A line with stops is how this app draws distance**, and it is one drawing
  shared by two places: the level picker's route diagram and the pass's ghost
  track (the wall map was the third, and went with the plates). Same parts
  every time — a rail, a filled run behind you, stops with labels, your
  train between two of them. Reach for it over a bar whenever the axis has
  named waypoints; keep the bar for a span that is only a percentage.
  The pass's track draws those parts its own way since the 区間・新幹線
  round (2026-09-25, the owner's pick of drawn options): the rail is cut
  into legs, one per level, and a stop is the cut at the end of its leg
  with its name under the line, passed in the state's ink, the next in
  full ink; your train is a Shinkansen in profile standing on the legs,
  its nose at your position, waiting on a siding before 発 until the
  first item is done (`components/journey/GhostTrack.jsx`).
  **A stop stands at the END of the leg it names, and the line opens at
  初, the novice's stop** — so reaching a stop is finishing the thing it is
  named for, never starting it, and a learner who has done nothing is drawn
  standing at 初 rather than on the first level's platform. The wall map had it
  the other way round once: N5's station sat at the START of N5's work, which
  handed a learner that level for boarding the train and left the last stop one
  leg short of the terminus. The plate's foot reads the same rule
  (`domain/lineProgress.stopsAround`): the stop in the middle is the last level
  finished, never the one being ridden.
  Three rules the 進捗が主役 round settled on the pass's copy of it, and they
  hold wherever the drawing goes: your train **rides above the rail and reaches
  it on a stem**, so the x it claims is exact and it never covers a stop — a
  floating car cannot say which side of a stop it stands on; a second mark that
  stands against it (a promise, a target, where you *should* be) is a **dashed
  marker across the rail**, never a second car on a second lane, because a line
  has no width to collide with and so needs neither a lane nor a caption saying
  which car is which; and where the two marks disagree, **hatch the stretch
  between them** in the state's pigment — the shortfall as an area, not a
  bracket the reader has to measure.
- **A backward-looking screen stays backward-looking.** The profile is a
  record of what was done. It once carried a 今夜 list of what a session could
  still finish; that went with the goals and the badges it counted. A goal
  measured in weeks belongs on the pass's back, where the ghost train already
  measures it, and the day's work belongs at the fare gate.
- Four column widths — and, on the desk, the rail's `--desk-rail-w`
  (256px) beside them, the canvas grown to `--desk-board-w` (1240px), a
  second column at `--desk-side-w` (360px) and the dictionary's entry at
  `--desk-entry-w` (440px, plan 128): `--board-w` (1040px) for the station column,
  `min(1240px, 100%)` for a plated selection screen, 720px for unplated prose,
  and `--card-w` (640px) for the study card column — the quiz prompt card,
  its progress bar, its MCQ list and its rating bar all share this one
  number, narrower than any of the other three on purpose (a single kana or
  kanji does not need a 1100px-wide slab). The drawing quiz sits in the same
  column since its stroke-order reference moved onto the board; it once
  carried 700px for two panels side by side.
- Japanese text carries `lang="ja"`. Always — it selects the right font
  fallbacks and it is how a screen reader knows.
- A chevron terminating a card or row is centred against the **full height**
  of that card, never against its first line of text.
- **The first ride** (plans 097–100) is the stage's first use and the
  gates' first opening, and it adds no screen of its own kind: 試乗 / TEST
  RIDE and 案内 / GUIDE are the two pairs, `.ride-*` and `.guide-*` the two
  namespaces, and everything a lesson draws is the production component
  fed a literal (ADR 0017). The one screen the rides own outright — the
  done screen and the pass plate — is the stage with its words centred by
  two grow-only spacers and its one filled action on the floor, the
  boarding's own room.

## What not to do

- Do not create a new stylesheet. One file, namespaced selectors. The one
  exception is outside the app: the landing page (plan 167,
  `frontend/landing/landing.css`) is a static page that cannot load
  `index.css`. It copies the tokens it uses, and a test holds the copy
  equal. Its type, space and radii are those tokens; the few pixel figures
  it names are the canvas's columns and the device frames it draws.
- Do not invent a size, space, radius or tracking value.
- Do not use a line pigment for anything that is not a section — and check the
  object, not the hex; several pigments coincide.
- Do not use a state colour decoratively.
- Do not put a heading on a block that already names itself.
- Do not give a flush lattice a column count its content cannot fill.
- Do not put colour on chrome.
- Do not write a desk rule outside the 机 section, and do not make a phone
  rule aware of the desk — the 1100px line is the only door between them.
- Do not write the Latin line as a transliteration.
- Do not hand-copy a component's markup to get its look — use the component.
  Every near-copy in this app has drifted from its original within two
  features.

## The test

A new screen belongs not by imitating these specs but by **reusing the
components that already encode them**. `Bar` is the same masthead on every
tab screen; the platform card is shared by modes, tiers, themes, decks and
exam papers; one contactless mark renders at three scales. The repetition
*is* the design.
