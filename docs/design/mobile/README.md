# Mobile rework — the screens

The canvas: <https://claude.ai/code/artifact/760313f0-7c87-40e2-993f-708fdbf63bd0>
— forty-nine artboards, one page per tab, the screens in the order a learner
walks them, all at 390×844; a last page holds the chrome (the HUD, the tab bar
and the fare gate in every state) and the states sheet (loading, empty, error,
no results, a wrong answer, the closed gate, the six-grade bar). Every artboard
carries a dark / light tweak. The onboarding is left out on purpose — it is
being redrawn — so the arrival page holds only the sign-in.

| Page | Artboards |
|---|---|
| Today | the gate · the gate with no credits · a run (choices) · flashcard · fill in · draw · readings · fast review · level up · the rank reissued · out of credits mid-run · run complete |
| Learn | the route map · a station's level line · its frequency tiers · its platforms · my decks · create a deck · a deck · a new card |
| Practice | the four platforms · reading practice · comprehension and its result · translation, writing and feedback · the exam's papers · the runner · finish with blanks · the result |
| Dictionary | the console and the analyzer's door · an entry · all readings · the analyzer (text, photo, video) · a sentence · add to deck |
| Profile | the pass · the inserts · the status sheet · the balance sheet · statistics · settings · settings › learning · settings › destination |
| Sign in | sign in |
| Chrome | the HUD and the tab bar in every state, the three gates · the states sheet |

The sources here regenerate it: `node build.mjs` writes the `.dc.html`
artboards and `canvas.json`; `node preview.mjs` writes plain-HTML previews of
each one (screenshot them at 390×934 — a 844-tall headless window leaves the
last band unpainted). `parts.mjs` holds the chrome and the shared pieces (HUD,
tab bar, header, track, stamp rally, pass); `screens2.mjs` and `screens3.mjs`
hold the second and third waves. `css.mjs` is a near-verbatim subset of
`frontend/src/index.css` — same tokens, same class names, same values — so a
rule in the mockup can be diffed against the real sheet; `css2.mjs` carries
the card faces, the sessions, the settings and, as CSS4, the dictionary rework
that landed on `main` in parallel. Class names mirror `index.css` wherever the
object already exists (`.pass`, `.board`, `.wmap-*`, `.gate-card`,
`.btn-depart`, `.jour-*`, `.stamp-rally`, `.platform-card`, `.mcq-row`,
`.rating-bar`, `.prompt-card`, `.sbook`, `.records`, `.pf-line`, `.banzuke`,
`.dict-entry-card`, `.dict-plate`, `.dict-block`, `.stage-mark`). The rest is
new to the mockup — `.hud`, `.tabbar`, `.bar` (the compact header), `.lane`,
`.console`, `.chip`, `.route`, `.stage`, `.sheet`, `.balance`, `.offer`,
`.anl-card`, `.fare-slip` — and its values are still the app's own tokens, or
literals `index.css` already uses.

## The backbone (owner's sketch, 2026-09-05)

- **Top bar — `.hud`.** Level roundel · station panel · commuter pass, 48px
  under a 28px band left to the phone's own status bar. The panel states the
  goal in English only, with the drift in days beside it: AHEAD · 9d, ON TIME,
  LATE · 9d (SUSPENDED after 14 days without study). The pass is the IC card
  at pocket size with the balance printed inside: 30/50 on a free pass, ∞ on
  a subscription. Sumi, no line colour.
- **Bottom bar — `.tabbar`.** Learn · Practice · Today · Dictionary · Profile,
  50px over a 24px home band. The kanji is the icon, the English word its
  caption — the one place Japanese stands in for an icon; the due count rides
  Today as the map's own due chip, the glyph stepping aside for it.
- **Balance.** 1 credit = 1 review. Free: +30 every day at 00:00, holds up to
  50. Subscription: unlimited.

## The mobile ruling on the pairing (2026-09-05)

DESIGN.md pairs every Japanese term with its Latin caption. On the phone that
pairing is suspended: **the interface speaks English, Japanese is content** —
a word, a kanji, a sentence, a deck's name, a rank's glyph, a deck type's
glyph (単 漢 文 札) — never a label, never a heading, never a button. Space is
the reason: the busy screens (the run, the analyzer, the dictionary, the
gate) could not afford a second line per label. Two consequences for the
implementation:

- **One header, one row — `.bar`.** Roundel · title (serif, `--fs-title`) ·
  sub (a caption) · aside, on a 2px stripe in the line's pigment. The title
  never truncates; the sub does. A register (Practice, Settings, Learning,
  Destination) drops the roundel and prints a hairline instead.
- **Sessions leave by name.** ‹ Gate from a run, ‹ Kanji from a station's
  fast review, ‹ Practice from a session, ‹ Analyzer from a sentence,
  ‹ Dictionary from an entry.

## What each tab is

- **Learn** is the route map itself — the four lines with your train on each,
  and your own decks under them. A line opens its station: the level line
  (*You are here*), then the platforms on the service ladder (Rapid · Express
  · Ltd. exp. · Review, with pips).
- **Practice** is a register of four platforms: reading practice ·
  comprehension · translation · mock exam, each on its own pigment.
- **Today** is the fare gate. The lanes are the run's picker (each row
  toggles); the gate prices the run — the fare against the balance — before
  departure. A run longer than the balance stops at the balance and says so.
  During a run both bars leave and the rating bar docks on the bottom edge
  (DESIGN.md, *The study stage on a phone*); ‹ Gate top-left is the way out,
  beside the remaining count and the balance.
- **Dictionary** opens the analyzer from a card set directly under its header
  — the KS roundel, the name, and the three intakes (text · photo · video) as
  icon doors — with the one console below it (the mode chips wrap, the index
  row holds the field, its clear button and the count). The results are the
  catalogue cards of the rework on `main` (two columns on the phone). The
  analyzer itself is one workbench: the intake switch, the field, the one
  filled action, the history.
- **Profile** is the pass and its inserts, unchanged in kind. The pass gains
  one line: the ride balance (credits · refill), under the journey line it
  already prints. The stamp book heads with its month and keeps the three
  figures under the grid.

## The dictionary rework, on the phone

The entry is the catalogue plate at reading size, full-screen: back, the
stage mark and the JLPT level in one corner, the speak roundel in the other;
reading over headword over the uppercase caption (the first gloss); a kanji
prints its two readings (音 / 訓) with a "+N" door to the readings sheet; a
3px gold stripe closes the plate. The body is hairline-divided blocks with no
headings: numbered senses with nested examples, the stroke form on the washi
lattice beside the stroke count and the radical door, "used in these words"
as a four-row ledger with the kanji highlighted in `--dict-ink`, the records
2×2 with the "Due now" note. The readings sheet is the 音 / 訓 registers:
each reading with the words that use it, the leftover readings as quiet
pills, Close.

## The second wave — how each remaining feature adapts

- **Sessions** (reading practice, comprehension, translation, the exam) behave
  like a run: both bars leave, ‹ Practice is the way out, and the field, the
  rating bar or the exam's nav docks on the bottom edge. None of them spends
  credits.
- **The drawing quiz** stacks instead of sitting side by side: the prompt, a
  square canvas with a cross grid, Erase, then Reveal answer; the stroke-order
  reference appears under the canvas after the reveal.
- **Readings** are one field per reading with "add a reading"; Submit docks.
- **Level up** docks the split-flap board across the top while the card below
  is signed in its lower corner — both moments on one screen, neither gating
  the next card.
- **The exam runner** keeps the answer sheet as a docked strip (7 / 21, two
  rows of chips, Finish); tapping it opens the full sheet. Previous · flag ·
  Next sit in one row above it; the instructions fold into a row.
- **Decks** list as platform cards with the count in the aside; Create deck
  is the header's aside (Cancel while the form is open) so the console holds
  only the chips and the search. Study lives on the deck's own page as its
  one filled action, and the desktop actions become three chips (Add card ·
  Select · More).
- **Statistics** puts the six plaques in a 2×3 lattice, the calendar fourteen
  weeks wide (it scrolls), the forecast as seven bars; the three rhythm panels
  stack below.
- **Settings** is a list of the six slips, each opening its own screen; the
  learning slip shows the level strip (only the current stop names its
  level), the pace chips and the rating-bar choice.
- **The analyzer's stage** shows one sentence at a time (a stepper with the
  passage's stops), every token underlined in its state ink, one token card
  with Add to deck, a furigana switch and Explain.

## The third wave — what the verification pass asked for

- **The paywall moments**: the gate with an empty balance (depart disabled at
  0.45, the one remaining action is Go unlimited, "+30 at 00:00" in the
  notice) and the balance running out mid-run (a sheet over the run: cleared
  count, what waits for tomorrow, back to the station, go unlimited).
- **The rank**: the one reward that takes the screen and waits — the pass
  reissued from Rōnin to 侍 Samurai at level 12, claimed with one button. The
  level board on the same page turns 11 → 12, which is where every other
  board stands.
- **Two more faces**: fill in (a grammar cloze, the field docked) and fast
  review (ungraded: both sides shown, Previous · Next, no rating bar, no
  credits).
- **Deck authoring**: the create form under the console (name, four types,
  Create), a new card's form on the deck (front · kana · back · note); a
  kanji deck's form adds readings and a radical picked from a sheet by stroke
  count. Add-to-deck from the analyzer is a picker sheet (decks by glyph and
  count, New deck).
- **The exam's papers** (numbered cards, "Different paper" as a slot under a
  sat paper) and the finish-with-blanks confirm — the confirm pattern for
  every destructive or irreversible tap (leave an exam, delete a deck, sign
  out, reprint the pass): a sheet, the safe move filled, the rest ghosts.
- **The analyzer's other intakes**: photo (Shoot · Choose, the cropper frame,
  the OCR text to check, Analyze) and video (the link, the subtitles note with
  Choose a file, the section window).
- **Settings › destination**: the goal the HUD reports on — destination
  chips, the service, the daily ride, the pass's date and where it moves to,
  Reprint as the filled action, Hand it back as the ghost.

## Inherited, left as they are

- Today wears gold (`--accent2`) because `navLinks.js` gives it that colour;
  the Practice register has no pigment and its header prints none.
- Filter chips wash at 12% as `.decks-filter-btn--active` does; segmented
  toggles and selected cards at 14%, DESIGN.md's figure.
- The app's 30px chips and toggles are drawn at 36px here; every control
  extends its hit area to 44px invisibly. The stage's leave chip, the gear,
  the stepper and the entry's actions are 40–44px outright.
- The price on the offer stays a bracketed placeholder; the purchase itself
  is the store's own sheet. The subscriber's ∞ pass is drawn on the chrome
  sheet only — the sample learner is on the free pass throughout.
- The ranking's "me" row takes `--pass-ink` here where `index.css` still uses
  `--accent`; the analyzer's unknown tokens take `--state-new`, off-deck a
  dashed rule, and never the due ink. "Kept" on a passage is the stamp ink —
  it is a hanko, not a warning.
- Not drawn: the onboarding (being redrawn), the analyzer's explanation
  prose, the lapse seal, the six settings slips other than learning and
  destination (plain forms on the same pattern), the dictionary's radical and
  syllabary modes (the two charts stack), import and export (behind More).

## Assumed, to confirm

1. Practice, the dictionary and the analyzer do not spend credits.
2. The tab bar hides during a run (the thumb needs the bottom edge for the
   rating bar); a tab tap elsewhere is the only way to leave a run mid-way.
3. The Practice header has no roundel and a hairline stripe: it is a
   register, not a station.
4. Tab captions are tracked at 0.1em, the value the map's Latin captions
   already use, because DICTIONARY does not fit a 78px gate at `--tr-caption`.
5. The kanji tab icons stay (学習 実践 本日 辞書 定期券) — they are the one
   Japanese the chrome keeps, as icons; swap them for glyphs if the store's
   reviewers read them as untranslated labels.
