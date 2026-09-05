# Mobile rework — the screens

The canvas: <https://claude.ai/code/artifact/760313f0-7c87-40e2-993f-708fdbf63bd0>
— fourteen artboards. Page *Screens*: thirteen phones at 390×844, the tabs and
what sits behind them. Page *Chrome*: the HUD, the tab bar and the fare gate in
every state. Every artboard carries a dark / light tweak.

The sources here regenerate it: `node build.mjs` writes the `.dc.html`
artboards and `canvas.json`; `node preview.mjs` writes plain-HTML previews of
each one. `css.mjs` is a near-verbatim subset of `frontend/src/index.css` —
same tokens, same class names, same values — so a rule in the mockup can be
diffed against the real sheet. `.hud`, `.tabbar`, `.lane`, `.route`, `.stage`,
`.sheet`, `.balance` and `.offer` are the new families; everything else exists.

## The backbone (owner's sketch, 2026-09-05)

- **Top bar — 運行案内, `.hud`.** Level roundel · goal status · credit balance.
  Sumi, two registers of ink, no line colour. The station name it used to carry
  moved to each screen's own plate (`StationHeader --sm`), so one `<h1>` per
  screen still holds.
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
- **辞書** keeps the one console; 解析 is its filled action (gold, dark ink —
  DESIGN.md's ruling for 辞書's pigment) and opens the analyzer concourse.
- **定期券** is the pass and its inserts, unchanged in kind. The pass gains one
  line: the ride balance (回数券 coupon tickets · credits · refill), under the
  journey line it already prints.

## The two sheets the HUD opens

- **Goal status → the pass turns over.** The status pill reuses the journey
  model's five states and inks (順調 / 定刻 on `--success`, やや遅れ on
  `--warning`, 遅延 / 運転見合わせ on `--danger`) — the sketch's Ahead / On time /
  Late. The sheet is the pass's back: the track, the honest sentence, the two
  moves.
- **Balance → the balance sheet.** The pill wears the pass's metal (`.pass__issuer`'s
  gold ring), never a line pigment; warning ring at ≤5, danger at 0; a
  subscriber's pill reads 定期 UNLIMITED. The sheet: the figure, the refill
  and cap, and the 定期券 offer as the one filled action. The price is a
  placeholder.

## Assumed, to confirm

1. Practice, the dictionary and the analyzer do not spend credits.
2. The tab bar hides during a run (the thumb needs the bottom edge for the
   rating bar); a tab tap elsewhere is the only way to leave a run mid-way.
3. The plate for 実践 has no roundel and a hairline stripe: it is a register,
   not a station.
4. Tab captions are tracked at 0.1em, the value the map's Latin captions
   already use, because DICTIONARY does not fit a 78px gate at `--tr-caption`.
