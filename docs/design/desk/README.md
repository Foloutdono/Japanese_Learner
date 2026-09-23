# The desk (机) — class map

The app's computer design (plans 113–120, ADR 0018). At **1100px and up**
(`frontend/src/hooks/useDesk.js`, `DESK_QUERY`) the Shell draws the rail
instead of the HUD and the tab bar, and the screens that the width serves
are laid out for it. Below that width nothing here exists. The phone's
design is `../mobile/README.md` and it is untouched.

All of it lives in one place in `frontend/src/index.css`: the **机 section,
the last in the file**, one `@media (min-width: 1100px)` block.
`src/desk.css.test.js` holds that section to its contract:

- it is the file's tail;
- it is under that one query;
- its names are written nowhere else;
- it contains no `!important`.

The JavaScript half renders the desk only when `useDesk()` says so, so
below the line the DOM is the phone's. The phone lane's "draws no desk"
checks this, and so does the branch-against-base identity pass the plan
was verified with.

## The frame

| Class | What | Component |
|---|---|---|
| `.phone--desk` | the Shell's frame on the desk. It reserves `--desk-rail-w` on the left; `.phone__content` grows to `--desk-board-w` (1240px) and centres in what is left | `components/chrome/Shell.jsx` |
| `.desk-side` | a screen's second column: `--desk-side-w` (360px, a phone's content width), sticky, scrolling on its own when taller than the window | `components/chrome/DeskSide.jsx` |
| `:root[data-chrome="shell"]` (in the block) | `--dock-bottom` is the inset alone, because there is no tab bar | `components/chrome/useChrome.js` |

## The rail

| Class | What | Component |
|---|---|---|
| `.desk-rail` | the sumi column down the left edge: fixed, `--desk-rail-w`, the HUD's `--chrome-edge` on its right | `components/chrome/DeskRail.jsx` |
| `.desk-rail__mast`, `__glyph`, `__name` | 辻 over TSUJI, the origin station's plate | 〃 |
| `.desk-rail__list` | the gates' list, inside `nav[data-guide="tabbar"]` (the tab bar's label and guide anchor) | 〃 |
| `.desk-gate`, `--on`, `__ico`, `__label`, `__due` | a gate: `GateIcon` plus its word, always captioned. The lit gate has the lozenge's wash and a 2px rule on the rail's edge. Today's due count is warning ink, the rail's only colour | 〃 |
| `.desk-gate__key` | the `/` cap on the Dictionary gate: the dictionary's search from anywhere the rail is (plan 114) | 〃 |
| `.desk-rail__stations`, `.desk-sec`, `--on` | the lit gate's stations as stops on a drawn line, the one you stand in filled. `config/tabs.js`'s `getDeskSections` supplies them | 〃 |
| `.desk-rail__foot` | the HUD's three instruments (`HudInstruments`): level and pass on one line, the status panel under them | `components/chrome/Hud.jsx` |

The order is `config/tabs.js`'s `DESK_TAB_IDS` (Today first). `TAB_IDS` is
still the phone's row and the flick's order. The rail has no flick.

## The screens

| Selector | What | Where |
|---|---|---|
| `.learn > .plates`, `.practice > .plates` | two by two; the fifth plate (the shelf, the exam) takes the row | `screens/LearnScreen.jsx`, `screens/PracticeScreen.jsx` |
| `.desk-line`, `__origin`, `__leg` (`--done`, `--here`), `__track`, `__stop`, `__fig` | a Learn plate's foot as the whole line: 初, then a leg per level, filled as far as it is learned. Each leg is a button to its stop, the ridden one `aria-current="location"` (plan 115) | `components/station/LinePlate.jsx` (`LineFoot`) |
| `.learn > .platform-grid` | two across; an odd last slot takes the row; exactly three go three across | `components/selection/ModeSelector.jsx` and the source pickers |
| `.learn > .route` | a route that boards directly, drawn across as a line | `components/selection/RouteStops.jsx` |
| `.today` | the gate on the left; `.desk-side` on the right with the pass's strip and its back | `screens/TodayScreen.jsx` |
| `.desk-journey`, `__head`, `__name`, `__word` | the pass's back beside the gate: the status sheet's body on sumi | `components/journey/JourneyPanel.jsx` (body: `JourneyBody.jsx`) |
| `.desk-split`, `__list`, `__page`; `.desk-stop--open` | a station as two panes: the stops (sticky, scrolling in their own column) beside the chosen stop's platforms; the open stop in gold, one tab stop walked with ↑/↓ (`hooks/useListWalk.js`) | `components/selection/StationSplit.jsx`; Vocab, Kanji, Kana, Grammar, Exam; since plan 115 the grammar points, the tiers, a theme's bands, the exam's review |
| `.desk-lesson` | a grammar point's lesson as the page beside the level's points, on the card's surface | `screens/GrammarScreen.jsx`, `components/study/GrammarLesson.jsx` (`GrammarLessonBody`) |
| `.desk-split--shelf`, `.desk-shelf-page` | the library's shelf beside the open deck's page, half and half | `screens/LibraryScreen.jsx`, `components/decks/PublicDeckPage.jsx` (`PublicDeckPane`) |
| `.desk-mode-fig`, `__due`, `__unit`, `__count` | a platform's own figures: due now, the composition bar, mastered / total — from /api/stats (`ModeFigures`) or a scoped stats route (`ScopeFigures`, plan 115) | `components/selection/ModeFigures.jsx` |
| `.desk-stats`, `__holds`, `__leaks` | the statistics in two columns: the line (1:1), the ladder and the lines; the misses and every trouble card | `screens/StatsScreen.jsx` |
| `.desk-lines`, `__line` (`--open`), `__levels` | the lines as one table (a subgrid), the open line's levels hung from its roundel | `components/stats/LineRows.jsx` (`inline`) |
| `.desk-run`, `.desk-run__side`, `__note` | a run with a side: the side fixed to the right edge in the run's pigment (`RunSide`), the stage top-aligned; card and choices, or prompt and board, side by side; unused choices keep their place | `components/study/StudyStage.jsx` (`side`, `RunSide`) |
| `.desk-tally`, `.desk-entry`, `.desk-misses`, `__list`, `.desk-miss` | the session panel: this run's three records, the revealed card's entry; at a section run's end the misses as chips. A browse (the fast review) passes `records={false}`: the entry alone, no tally (plan 116) | `components/study/SessionPanel.jsx`, `stores/runTally.js` (`tallyMisses`); the browse's side in `screens/KanaRun.jsx`, `VocabRun.jsx`, `KanjiRun.jsx` |
| `.desk-lookup` | a door opened in a docked breakdown: the entry in the column, the breakdown kept beside it; since plan 120 also a grammar run's side, for the rival a gate lesson names | `components/analysis/SideLookup.jsx`, `screens/GrammarRun.jsx` |
| `.desk-run--paper`, `.desk-answers`, `__fig`, `__cap`, `__finish`; `.desk-paper`, `__text`, `__ask` | the mock exam: the answer sheet in the side; a reading passage flat beside its questions | `screens/ExamRunner.jsx`, `exam/ExamCard.jsx`, `exam/QuestionRenderer.jsx` (`PassageText`) |
| `.desk-anl-dock`, `__keys` | the analyser's second column: the dictionary on the stage's token | `components/analysis/AnalyzerDock.jsx` |
| `.anl-results:focus-visible` | no ring round the result while ←/→ walk it (its arrival focus is a target, not a tab stop; the phone's copy of the rule was lost before plan 113) | `screens/AnalyzerScreen.jsx` |
| `.desk-intake`, `__main` | the analyser's intake beside its history | `screens/AnalyzerScreen.jsx` |
| `.desk-dock`, `__head` | a door opened in a column: its caption and ✕ over the phone's own body, in place of the column's tenant until ✕ or Esc; focus goes back to what opened it (plan 120) | `components/chrome/DeskDock.jsx` |
| `.desk-browse` | a deck's Browse, docked in the deck page's side (the result row stacked, as on a phone) | `components/decks/BrowseCardsMenu.jsx` (`BrowseCardsDock`) |
| `.desk-more` | a deck's More — import, export, the library — in the deck page's side; the deck's deletion asks in a dialog of its own (plan 120) | `screens/DeckDetailScreen.jsx` |
| `.desk-tut` | the grab's walkthrough in the intake's column, in place of the history; its copy button shares the panel's state (plan 120) | `components/analysis/GrabTutorial.jsx` (`GrabTutorialDock`), `useBookmarkletCopy.js`, `screens/AnalyzerScreen.jsx` |
| `.desk-readings` | a kanji's every reading in the entry's own place, whatever holds the entry (a dock, a run's side, a lookup dialog); ✕ or Esc steps back to the entry (plan 120) | `components/dictionary/DictionaryDetail.jsx` (`ReadingsInPlace`) |
| `.desk-install` | the iOS install steps in the settings page, under the row that asked (`aria-expanded`) (plan 120) | `components/settings/DisplayPage.jsx`, `components/ui/InstallSheet.jsx` (`InstallSteps`) |
| `.desk-crumb`, `__up` | the way up: a ‹ way out the rail does not already open, as a crumb over the title (`DeskCrumb`, also over the analyser's result and the dictionary's radical header) | `components/chrome/Bar.jsx` |
| `.desk-deck`, `__main`, `__study`, `__cap` | a deck's cards beside its platforms, or the form while a card is written | `screens/DeckDetailScreen.jsx`, `components/decks/DeckPlatforms.jsx` |
| `.desk-profile`, `__col` | the holder opened flat: the pass and stamps at `--desk-side-w`, beside the record | `screens/ProfileScreen.jsx` |
| `.desk-banzuke`, `.desk-bz__period` | both rankings at once, side by side where the column holds two | `components/profile/Banzuke.jsx` (`both`) |
| `.desk-settings`, `__list`, `__page`; `.stg-row--on` | the list (sticky, the one `<h1>`) beside the open page (a pane, `<h2>`, no way back). The open row is marked in gold. The bare list opens its first page | `screens/SettingsScreen.jsx`, `components/settings/SettingsPage.jsx`, `components/settings/pane.js` |
| `.sheet`, `.sheet--sumi`, `.sheet__handle` | a sheet is a centred dialog: all four corners, no handle, a fade. It is centred by `inset` and `margin: auto`, never a transform, because the drag owns that | `components/chrome/Sheet.jsx` |
| `.phone--desk .dict-dock` | the dictionary's dock, `--desk-side-w` wide, open on the first result from the first frame | `screens/DictionaryScreen.jsx` |
| `.phone--desk .anl-railcol` | the analyzer's rail on the right of the stage, away from the desk's rail | `screens/AnalyzerScreen.jsx` |
| `.stage > .stage__head`, `__foot`, `.timer`, … | a run's head, foot and field share the card's `--card-w` column | the runs |
| `.dock-note`, `.guide-callout` | the docked note spans the screen, not the rail (nor a run's side); the guide's note centres on the screen, or stands beside an anchor in the rail or a side column (`data-place="right"`/`"left"`) | `components/ui/UpdateToast.jsx`, `components/guide/Guide.jsx` |

## The keys

| Class | What | Component |
|---|---|---|
| `.desk-kbd` | a key cap in `currentColor`, the caption register | — |
| `.rating-bar__btn > .desk-kbd` | each rating tile's digit in its corner (1 is the best, at the right) | `components/study/RatingBar.jsx` |
| `.mcq-row__index` (desk: the bare digit) | the choice's index is the key that answers it, with `aria-keyshortcuts` | `components/study/QuizComponents.jsx` |
| `.flashcard__hint .desk-kbd` | "Espace pour révéler" | 〃 |
| (plan 115) | Enter departs from Today and takes a finished run's action; Esc leaves a run (`DepartKey`, `EnterKey`, `LeaveKey`); C shows the choices; A–D/1–4 and Enter answer comprehension; Space plays a listening clip; Ctrl/⌘+Enter analyses; ←/→ walk the grammar points, the exam's review, the analyser's tokens. Each cap on what it presses, with `aria-keyshortcuts` | `components/chrome/DeskKeys.jsx`, `components/study/HintBar.jsx`, `screens/ComprehensionRun.jsx`, `exam/AudioPlayer.jsx`, `components/analysis/WritingSlip.jsx` |

## Tests

| File | Lane | What |
|---|---|---|
| `src/desk.css.test.js` | node | the section's contract, and the width written once |
| `src/chrome.desktop.test.jsx` | desktop (1100×800) | the rail: order, captions, stations, due, instruments, geometry, no line pigment, a run without it |
| `src/chrome.wide.test.jsx` | wide (1440×900) | the column capped at `--board-w` and centred beside the rail |
| `src/sheet.desktop.test.jsx` | desktop | the centred dialog |
| `src/gates.desktop.test.jsx`, `src/profile.desktop.test.jsx`, `src/settings.desktop.test.jsx` | desktop | the screens |
| `src/keys.desktop.test.jsx` | desktop | the keys |
| `src/components/chrome/Shell.desk.browser.test.jsx` | browser | a resize across 1100 keeps the screen |
| `src/lattices.desktop.test.jsx`, `src/today.desktop.test.jsx`, `src/dictionary.desktop.test.jsx`, `src/stations.desktop.test.jsx`, `src/stats.desktop.test.jsx`, `src/runs.desktop.test.jsx`, `src/header.desktop.test.jsx`, `src/decks.desktop.test.jsx` | desktop | plan 114, one file a phase |
| `src/breakdown.desktop.test.jsx`, `src/comprehension.desktop.test.jsx`, `src/folds.desktop.test.jsx`, `src/exam.desktop.test.jsx`, `src/shelf.desktop.test.jsx`, `src/analyzer.desktop.test.jsx`, `src/laptop.desktop.test.jsx`, `src/session.desktop.test.jsx` | desktop | plan 115, one file a phase |
| `src/browse.desktop.test.jsx` | desktop | plan 116: the browse's side — the entry docked on reveal, no tally, no column over an empty browse |
| `src/grammar.desktop.test.jsx`; blocks of `src/shelf.desktop.test.jsx`, `src/analyzer.desktop.test.jsx`, `src/dictionary.desktop.test.jsx`, `src/settings.desktop.test.jsx` | desktop | plan 120: the doors that open in their columns, and the deck's deletion still asked |
| `src/deskfree.phone.test.jsx` | phone (390×844) | plans 114–120's phone side: at 390 every re-laid screen keeps the phone's arrangement, one block a phase |
| `src/stores/runTally.test.js` | node | the run's tally and the docked entry's tokens |
| `src/chrome.phone.test.jsx` ("draws no desk"), `RatingBar.browser.test.jsx` ("prints no keys") | phone, browser | nothing of the desk below the line |

## Dialogs on the desk (plan 120)

DESIGN.md's rule — a door opens in the column, never over it; a dialog is
kept for what must interrupt — applied to every `Sheet`, `role="dialog"`
and `aria-modal` the desk could still open. A dialog on the desk is the
phone's sheet set in the middle of the screen (`.sheet`, above).

**Moved into a column** (desk only, behind `useDesk()`; the phone keeps its
sheet, held by `src/deskfree.phone.test.jsx`):

| Door | Was | Now | Why it does not interrupt |
|---|---|---|---|
| A deck's More (`screens/DeckDetailScreen.jsx`) | a sheet over the deck page | `.desk-more` in the deck's side, taking turns with the form, Browse and the platforms | a list of what can be done to the deck — import, export, the library — not a question. Only its deletion is one, and that is now a dialog of its own |
| A gate lesson's compare row (`screens/GrammarRun.jsx`) | the rival's lesson in a sheet over the run | the rival's entry in the run's side (`SideLookup`), the session panel back on ✕ or Esc; Esc never leaves the run | reading the rival beside the lesson that names it is the point of the row |
| The grab's walkthrough (`components/analysis/GrabTutorial.jsx`) | a dialog over the intake | `.desk-tut` in the intake's column, in place of the history | it is read while it is followed — copy, make the bookmark, come back — and the intake it explains stays in view |
| A kanji's readings (`components/dictionary/DictionaryDetail.jsx`) | a sheet stacked over the entry, even when the entry stood in a column | `.desk-readings` in the entry's place, in a dock, a run's side or a lookup dialog; Esc peels only the list | a door in an entry, and every other door in an entry already opened in its column |
| The iOS install steps (`components/settings/DisplayPage.jsx`) | a sheet over Settings (an iPad on its side reaches the desk) | `.desk-install` in the page, under the row, `aria-expanded` | two lines explaining the row they sit under |

**Kept as dialogs, because they interrupt:**

| Dialog | Where | Why |
|---|---|---|
| Finish with blanks; leave the paper | `screens/ExamRunner.jsx` | each stands between the learner and an act on a timed paper that cannot be taken back |
| The paper did not submit | `screens/ExamRunner.jsx` | the paper is not marked, and the clock can submit it by itself (`isTimeUp`), so a line in the side could go unseen. It is the answer to the learner's own commit |
| Make it mine; unfollow or remove; delete the selected cards; delete the deck | `screens/DeckDetailScreen.jsx` | confirmations of what cannot be undone. On the desk the deck's deletion is its own dialog over the More dock, as the other three are |
| The CSV import | `components/decks/ImportCardsMenu.jsx` | a paste and a commit in one go, whose preview is its own list: nothing on the page is of use beside it |
| A new deck | `screens/DecksScreen.jsx` | a creation that ends by leaving the shelf for the deck it made; the shelf has no second column, and conjuring one for a two-field form would be a column found to fill (plan 114) |
| Report a deck | `components/decks/PublicDeckPage.jsx` | each reason sends the report: an outward act, the sheet its confirmation |
| The balance; the pass's back | `components/credits/BalanceSheet.jsx`, `components/journey/StatusSheet.jsx` | the rail's doors, the chrome's rather than a page's: they open the same over every screen, and no page has a column that is theirs — in a page's side they would evict its companion |
| The offer; a run stopped at an empty balance | `components/credits/PaywallSheet.jsx`, `RunOutSheet.jsx` | a refusal, and a run that cannot go on |
| A level change | `components/settings/LearningPage.jsx` (`LevelSheet`) | a confirmation: it marks stops known or sets them aside |
| Which deck to mine into | `components/analysis/DeckPicker.jsx` | the question an add in flight asks before it can finish, asked once and remembered; it opens from the entry or breakdown that often *is* the column |
| A guide note | `components/guide/Guide.jsx` | a note whose job is to stop the learner at what it teaches; it already stands beside its anchor (plan 115) |

**Already in a column before plan 120:** the exam's answer sheet
(`RunSide`), the statistics' two sheets, the run lookups (`SideLookup`,
the entry dock), the analyser's lookup (`AnalyzerDock`), the grammar
index's lesson (`GrammarLessonBody`), Browse.

**Belongs in a column, but the page has none — a layout decision, left:**
the radical family's lookup (`components/selection/RadicalLesson.jsx`; it
wants the dictionary's catalogue-and-dock layout, plan 115's deferred
split) and the first ride's 🔍 (`screens/RideRun.jsx` stands no side).
And one wrinkle: on Today the rail's status panel opens the pass's back
as a dialog while the same body stands open beside the gate.
