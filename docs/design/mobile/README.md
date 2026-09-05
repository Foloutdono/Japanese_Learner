# Mobile rework — the screens

The canvas: <https://claude.ai/code/artifact/760313f0-7c87-40e2-993f-708fdbf63bd0>
— fourteen artboards. Page *Screens*: thirteen phones at 390×844, the tabs and
what sits behind them. Page *Chrome*: the HUD, the tab bar and the fare gate in
every state. Every artboard carries a dark / light tweak.

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

## Assumed, to confirm

1. Practice, the dictionary and the analyzer do not spend credits.
2. The tab bar hides during a run (the thumb needs the bottom edge for the
   rating bar); a tab tap elsewhere is the only way to leave a run mid-way.
3. The plate for 実践 has no roundel and a hairline stripe: it is a register,
   not a station.
4. Tab captions are tracked at 0.1em, the value the map's Latin captions
   already use, because DICTIONARY does not fit a 78px gate at `--tr-caption`.
