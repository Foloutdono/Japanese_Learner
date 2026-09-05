# Mobile rework — the screens

The canvas: <https://claude.ai/code/artifact/760313f0-7c87-40e2-993f-708fdbf63bd0>
— thirty-three artboards, one page per tab, the screens in the order a learner
walks them, all at 390×844; a last page holds the chrome (the HUD, the tab bar
and the fare gate in every state). Every artboard carries a dark / light tweak.

| Page | Artboards |
|---|---|
| 本日 Today | the gate · a run (choices) · flashcard · draw · readings · level up · run complete |
| 学習 Learn | the route map · a station's level line · its platforms · my decks · a deck |
| 実践 Practice | the four platforms · reading practice · comprehension · translation · exam runner · exam result |
| 辞書 Dictionary | the console and the analyzer's door · an entry · the analyzer · a sentence |
| 定期券 Profile | the pass · the inserts · the status sheet · the balance sheet · statistics · settings · settings › learning |
| みどりの窓口 Arrival | sign in · boarding station · destination and the departure board |

The sources here regenerate it: `node build.mjs` writes the `.dc.html`
artboards and `canvas.json`; `node preview.mjs` writes plain-HTML previews of
each one. `css.mjs` is a near-verbatim subset of `frontend/src/index.css` —
same tokens, same class names, same values — so a rule in the mockup can be
diffed against the real sheet. Class names mirror `index.css` wherever the
object already exists (`.pass`, `.board`, `.wmap-*`, `.gate-card`,
`.btn-depart`, `.jour-*`, `.stamp-rally`, `.platform-card`, `.mcq-row`,
`.rating-bar`, `.prompt-card`, `.sbook`, `.records`, `.pf-line`, `.banzuke`).
The rest is new to the mockup — `.hud`, `.tabbar`, `.plate` (the `--sm`
station sign), `.lane`, `.console`, `.chip`, `.route`, `.stage`, `.sheet`,
`.balance`, `.offer`, `.dict-entry`, `.seal`, `.anl-card`, `.fare-slip` — and
its values are still the app's own tokens, or literals `index.css` already
uses.

## The backbone (owner's sketch, 2026-09-05)

- **Top bar — 運行案内, `.hud`.** Level roundel · station panel · commuter
  pass. The panel states the goal in the learner's own language only, with the
  drift in days beside it: AHEAD · 9d, ON TIME, LATE · 9d (SUSPENDED after 14
  days without study). The pass is the IC card at pocket size with the balance
  printed inside: 30/50 on a free pass, ∞ on a subscription. Sumi, no line
  colour. The station name the bar used to carry moved to each screen's own
  plate (`StationHeader --sm`), so one `<h1>` per screen still holds.
- **Bottom bar — 改札口, `.tabbar`.** 学習 Learn · 実践 Practice · 本日 Today ·
  辞書 Dictionary · 定期券 Profile. Kanji as the mark, the plain word as its
  caption; the due count rides 本日 as the map's own due chip.
- **Balance.** 1 credit = 1 review. Free: +30 every day at 00:00, holds up to
  50. Subscription: 定期券, unlimited.

## What each tab is

- **学習** is the 路線図 wall map itself — the four lines with your train on
  each, and 教材 (your own decks) under them. A line opens its station: the
  level line (the route diagram, *You are here*), then the platforms on the
  種別 ladder.
- **実践** is a register of four platforms: 読書 · 理解 · 翻訳 · 模試, each on
  its own pigment.
- **本日** is the fare gate. The lanes are the run's picker (each row toggles);
  the gate prices the run — 運賃, the fare, against 残高, the balance — before
  departure. A run longer than the balance stops at the balance and says so.
  During a run both bars leave and the rating bar docks on the bottom edge
  (DESIGN.md, *The study stage on a phone*); ‹ 改札 top-left is the way out,
  beside the remaining count and the balance.
- **辞書** opens the analyzer from a card set directly under its plate — the
  KS roundel, the name, and the three intakes (text · photo · video) as icon
  doors — with the one console below it. The analyzer itself is one
  workbench: the intake switch (Text · Photo · Video), the field, the one
  filled action, the history.
- **定期券** is the pass and its inserts, unchanged in kind. The pass gains one
  line: the ride balance (回数券 coupon tickets · credits · refill), under the
  journey line it already prints.

## The two sheets the HUD opens

- **Station panel → the pass turns over.** The panel reads the journey
  model's five states in their inks (順調 / 定刻 on `--success`, やや遅れ on
  `--warning`, 遅延 / 運転見合わせ on `--danger`) but prints only the English
  word and the days; the Japanese words stay on the pass. The sheet says it
  in the drawing, with no Japanese and no sentence: the station panel, the
  track with You and Plan and the gap between them in days, four bare figures
  (last 14 days · promised · arrival at this pace · the date on the pass), and
  the two moves.
- **Commuter pass → the balance sheet.** The figure inside the pocket pass is
  gold, the pass's metal, never a line pigment; the card's edge goes warning at
  ≤5 and danger at 0. The sheet is where the refill and the cap are explained
  (the screens themselves never mention the 00:00 refill): the figure, the
  refill and cap, and the 定期券 offer as the one filled action. The price is
  a placeholder.

## The second wave — how each remaining feature adapts

- **Sessions** (reading practice, comprehension, translation, the exam) behave
  like a run: both bars leave, ‹ 実践 is the way out, and the field, the
  rating bar or the exam's nav docks on the bottom edge. None of them spends
  credits.
- **The drawing quiz** stacks instead of sitting side by side: the prompt, a
  square canvas with a cross grid, Erase, then Reveal answer; the stroke-order
  reference appears under the canvas after the reveal.
- **Readings** are one field per reading with "add a reading"; Submit docks.
- **Level up** docks the split-flap board across the top (68px, the stage
  slides down by that much) while the card below is signed in its lower corner
  — both moments on one screen, neither gating the next card.
- **The exam runner** keeps the answer sheet as a docked strip (7 / 21, two
  rows of chips, Finish); tapping it opens the full sheet. Previous · flag ·
  Next sit in one row above it; the もんだい instructions fold into a row.
- **Decks** list as platform cards with the count in the aside; Study lives
  on the deck's own page as its one filled action, and the six desktop actions
  become four chips (Add card · Browse · Select · More).
- **Statistics** puts the six plaques in a 2×3 lattice, the calendar fourteen
  weeks wide (it scrolls), the forecast as seven bars; the three rhythm panels
  stack below.
- **Settings** is a list of the six slips, each opening its own screen; the
  学習 slip shows the level strip, the pace chips and the rating-bar choice.
- **The ticket office** redraws the departure board as service rows (service
  · stopping pattern · pace and arrival), not a four-column table; the
  calling-at line folds into the honest sentence under the board.
- **The dictionary entry** is full-screen: the sumi plate with the vertical
  type mark, badges, speak and close, the headword, readings; then meaning,
  examples, stroke order beside its two tiles, and four card-stat tiles.
- **The analyzer's stage** shows one sentence at a time (a stepper with the
  passage's stops), every token underlined in its state ink, one token card
  with Add to deck, a furigana switch and Explain.

## Assumed, to confirm

1. Practice, the dictionary and the analyzer do not spend credits.
2. The tab bar hides during a run (the thumb needs the bottom edge for the
   rating bar); a tab tap elsewhere is the only way to leave a run mid-way.
3. The plate for 実践 has no roundel and a hairline stripe: it is a register,
   not a station.
4. Tab captions are tracked at 0.1em, the value the map's Latin captions
   already use, because DICTIONARY does not fit a 78px gate at `--tr-caption`.
