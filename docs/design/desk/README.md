# The desk (机) — class map

The app's computer design (plans 113–123, ADR 0018). At **1100px and up**
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
| `.desk-door`, `__side` | first contact (plan 122): the Welcome with no rail, the work centred and the sign-in (`AuthCard`, login only, Log in a ghost beside Board) standing in a `--desk-side-w` column at the right edge; the roll's lanes masked at the work's edges, four copies a lane, paused under a pointer. `authMode` opens the side on a mode rather than a second screen | `components/boarding/Welcome.jsx`, `components/account/AuthCard.jsx`, `App.jsx` |
| `.desk-brd`, `--side`, `__side` | the boarding as a run's frame (plan 122): the questions and their Continue on the centre line at `--desk-side-w`, beside the journey being built (`BuildSteps` over `domain/boarding.js`'s `boardingDraft`, repriced on every answer); Building skipped; the plan's chart 1:1 | `screens/BoardingFlow.jsx`, `components/boarding/Building.jsx`, `PlanStep.jsx` |

## The rail

| Class | What | Component |
|---|---|---|
| `.desk-rail` | the sumi column down the left edge: fixed, `--desk-rail-w`, the HUD's `--chrome-edge` on its right | `components/chrome/DeskRail.jsx` |
| `.desk-rail__mast`, `__glyph`, `__name` | 辻 over TSUJI, the origin station's plate | 〃 |
| `.desk-rail__list` | the gates' list, inside `nav[data-guide="tabbar"]` (the tab bar's label and guide anchor) | 〃 |
| `.desk-gate`, `--on`, `__ico`, `__label`, `__due` | a gate: `GateIcon` plus its word, always captioned. The lit gate has the lozenge's wash and a 2px rule on the rail's edge. Today's due count is warning ink, the rail's only colour | 〃 |
| `.desk-gate__key` | the `/` cap on the Dictionary gate: the dictionary's search from anywhere the rail is (plan 114) | 〃 |
| `.desk-rail__stations`, `.desk-sec`, `--on` | the lit gate's stations as stops on a drawn line, the one you stand in filled. `config/tabs.js`'s `getDeskSections` supplies them | 〃 |
| `.desk-rail__foot` | the rail's floor, holding the learner's pass | `components/chrome/DeskRail.jsx` |
| `.desk-pass` (`--low`, `--out`), `__face` | the learner's pass (plan 127): the HUD's three instruments as one card on the rail's floor, the profile pass's sheen and identity corner, its edge the balance's (warning at ≤5, danger at 0) | `components/chrome/DeskPass.jsx` |
| `.desk-pass__level`, `__climb`, `__track`, `__fill`, `__gain`, `__xp`, `__unit` | the face, `hud.level`'s door → the pass: the HUD's roundel (`.hud__level`, the fare rising off it) and the climb to the next level in the pass's gold, the run's level bar at pocket size; titled with the level | 〃 |
| `.desk-pass__purse`, `__fig`, `__note` | the purse, `hud.pass`'s door → the balance sheet: the pocket pass's mark and figure (`.hud__pass-wave`, `.hud__pass-fig`) and what it counts, or when a spent one comes back (`balanceRefillLine`, `domain/credits.js`'s `refillClock`) | 〃 |
| `.desk-pass__stub` (`--ahead`, `--onTime`, `--slightlyBehind`, `--delayed`, `--suspended`, `--offline`), `__word`, `__drift` | the stub, `hud.status`'s door: the journey's word and drift under a perforation, a lamp in the state's ink. On Today it scrolls to and calls the journey beside the gate (`.desk-journey--called`) rather than opening its sheet (`hudStatus.js`'s `showStatus`, plan 123) | 〃 |
| `.desk-rail__gates` | the gates scroll alone on a short window; the head and the foot stay whole (plan 123) | `components/chrome/DeskRail.jsx` |

The order is `config/tabs.js`'s `DESK_TAB_IDS` (Today first). `TAB_IDS` is
still the phone's row and the flick's order. The rail has no flick.

## The screens

| Selector | What | Where |
|---|---|---|
| `.learn > .plates`, `.practice > .plates` | two by two; Learn's fifth plate (the shelf) takes the row; Practice's six go three rows of two since 作文 (plan 125), the exam last beside it | `screens/LearnScreen.jsx`, `screens/PracticeScreen.jsx` |
| `.desk-line`, `__origin`, `__leg` (`--done`, `--here`), `__track`, `__stop`, `__fig` | a Learn plate's foot as the whole line: 初, then a leg per level, filled as far as it is learned. Each leg is a button to its stop, the ridden one `aria-current="location"` (plan 115) | `components/station/LinePlate.jsx` (`LineFoot`) |
| `.learn > .platform-grid` | two across; an odd last slot takes the row; exactly three go three across | `components/selection/ModeSelector.jsx` and the source pickers |
| `.learn > .route` | a route that boards directly, drawn across as a line | `components/selection/RouteStops.jsx` |
| `.today` | the gate on the left; `.desk-side` on the right with the pass's strip and its back. The gate's `.gate-card__lanes` go two across once the gate holds two lanes at a phone's width (~1390px, plan 116) | `screens/TodayScreen.jsx`, `components/station/GateCard.jsx` |
| `.desk-journey`, `__head`, `__name`, `__word` | the pass's back beside the gate: the status sheet's body on sumi | `components/journey/JourneyPanel.jsx` (body: `JourneyBody.jsx`) |
| `.desk-split`, `__list`, `__page`; `.desk-stop--open` | a station as two panes: the stops (sticky, scrolling in their own column) beside the chosen stop's platforms; the open stop in gold, one tab stop walked with ↑/↓, Home and End, Space opening it (`hooks/useListWalk.js`; since plan 123 every list beside a page walks this way, its keys in `aria-keyshortcuts`). The list's rows are links (`<Link replace>`, plan 117), so a row opens in a new tab too; the link wears the button's face (`.desk-split__list a:is(…)`) | `components/selection/StationSplit.jsx`, `SplitRow.jsx`; Vocab, Kanji, Kana, Grammar, Exam; since plan 115 the grammar points, the tiers, a theme's bands, the exam's review (its open question in `?question=`) |
| `.desk-lesson` | a grammar point's lesson as the page beside the level's points, on the card's surface | `screens/GrammarScreen.jsx`, `components/study/GrammarLesson.jsx` (`GrammarLessonBody`) |
| `a:is(.deck-card, .radical-tile, .chip, .stage__leave, .record--door, .pf-line, .stg-row)` | the desk's other places as links (plan 123) — the shelf's decks (pushed) and its library door, a radical page's tiles, a bar's way up, the profile's halls and lines, Settings' pages — each wearing its button's face, measured against a button twin by `links.desktop.test.jsx` | `components/selection/SplitRow.jsx` (`push`), `components/chrome/Bar.jsx` (`LeaveTo`), `components/chrome/Console.jsx` (`Chip`'s `to`) |
| `.desk-split .radical-tile[aria-current="page"]`, `.rad-door[aria-expanded]`; `.desk-split__page > .rad > .platform-grid` | a radical's page as two panes (plan 118): the index on the radical's stroke page beside the lesson and its platforms (one to a row, figured by `ScopeFigures`), the open radical in gold; the family's door a toggle, in gold and with no › while the family stands in the list instead of the index. The bare index opens on its page's biggest family | `screens/KanjiScreen.jsx`, `components/selection/RadicalSelector.jsx` (`RadicalRedirect`), `components/selection/RadicalLesson.jsx` (`RadicalFamilyList`), `components/dictionary/RadicalIndex.jsx` (`selected`), `domain/radicals.js` |
| `.desk-split--shelf`, `.desk-shelf-page` | the library's shelf beside the open deck's page, half and half | `screens/LibraryScreen.jsx`, `components/decks/PublicDeckPage.jsx` (`PublicDeckPane`) |
| `.desk-mode-fig`, `__due`, `__unit`, `__count` | a platform's own figures: due now, the composition bar, mastered / total — from /api/stats (`ModeFigures`) or a scoped stats route (`ScopeFigures`, plan 115) | `components/selection/ModeFigures.jsx` |
| `.desk-stats`, `__holds`, `__leaks` | the statistics in two columns: the line (1:1), the ladder and the lines; the misses and every trouble card | `screens/StatsScreen.jsx` |
| `.desk-lines`, `__line` (`--open`), `__levels` | the lines as one table (a subgrid), the open line's levels hung from its roundel | `components/stats/LineRows.jsx` (`inline`) |
| `.desk-run`, `.desk-run__side`, `__note` | a run with a side: the side fixed to the right edge in the run's pigment (`RunSide`), the stage top-aligned; card and choices, or prompt and board, side by side; unused choices keep their place. The run's foot sticks under its content at the dock line (plan 123). Above ~1460px the card and the side are centred together by `--desk-run-inset` (`:root:has(.desk-run)`), the level bar spanning the workspace; the level board docks across the side's top. The first ride keeps one too (plan 122), the flipped card's entry docked in it | `components/study/StudyStage.jsx` (`side`, `RunSide`), `screens/RideRun.jsx` |
| `.desk-run--panels`, `.desk-run__left`, `.desk-run__panel` | a card run on three panels (plan 126; it replaced plan 124's console): the grid of three columns (`--desk-run-left-w` \| `--card-w` \| `--desk-run-right-w`, giving down to `--desk-run-col-min` on a laptop), the left column's two surface panels, neither captioned (the owner's cut). `StudyStage` lays it out where the run hands it `records` and a side; `RunPanelsContext` tells the elements under it to print no key caps and the tiles to stand unlit before the reveal | `components/study/StudyStage.jsx` (`records`, `panel`, `progress`), `components/study/runPanels.js`; the six card runs |
| `.desk-session`, `.desk-figs`, `.desk-fig`, `__value`, `__unit`, `__label` | the session panel: this run's figures with the remaining count as the fourth (`RunRecords`), the level bar as a row of it (the same `LevelBar`, restyled) and the deck's legend (`DeckLegend`) | `components/study/RunPanel.jsx`, `components/study/RunRecords.jsx`, `components/chrome/LevelBar.jsx` |
| `.desk-card`, `.desk-stops`, `__line`, `__labels`, `__here`, `.desk-verdicts`, `.desk-verdict` (`--q0`…`--q5`), `__head`, `__dot`, `__word`, `__when`, `.desk-keys`, `__item`, `.desk-rhythm` | the card panel: the card's state on a line with stops, every verdict of the learner's scale as a tile (its digit, its word, when the card comes back — `domain/forecast.js` over the card's `review_preview`), the keys the elements no longer print, the rhythm on a sumi foot (`stores/runTally`'s `startedAt`) | `components/study/CardPanel.jsx` |
| `.rating-bar--unlit` (in `.desk-run--panels`) | the tiles framed under the card in a surface row, and before the reveal drawn dark, inert and disabled rather than unseen | `components/study/RatingBar.jsx` |
| `.desk-sealed`, `__mark`, `.dict-entry--band`, `.dict-entry__top` | the card's details: sealed before the reveal (one panel, a ?), and after it the entry in its band layout — the plate as a band (the stack's children take the grid's areas) with the learner's record under its stripe in a top panel, the dictionary alone in the bottom one, the stroke sheet growing last (`DictionaryLookupBody`'s `band`) | `components/study/SessionPanel.jsx`, `components/dictionary/DictionaryDetail.jsx` |
| `.desk-entry`, `.desk-misses`, `__list`, `.desk-miss`, `.desk-run__note` | the run's side: the revealed card's entry, and at the run's end the cards that went badly as chips, each opening its entry (plan 115; plan 124 listed them during the run, plan 126 returned them to the end). A browse and the first ride, which stand no panels, keep the plate's own layout and the note before the reveal; a browse has no misses (plan 119) | `components/study/SessionPanel.jsx`, `stores/runTally.js` (`tallyMisses`); the browse's side in `screens/KanaRun.jsx`, `VocabRun.jsx`, `KanjiRun.jsx` |
| `.desk-lookup` | a door opened in a docked breakdown: the entry in the column, the breakdown kept beside it; since plan 120 also a grammar run's side, for the rival a gate lesson names | `components/analysis/SideLookup.jsx`, `screens/GrammarRun.jsx` |
| (作文's side) | a composition run's column (plan 125): the point's lesson (`GrammarLessonBody`, the grammar station's own) while the learner writes and reads the tutor's review, so the phone's lesson door is not drawn; the sentence's own breakdown once they have rated, its doors opening in the column | `screens/CompositionRun.jsx` |
| `.desk-run--paper`, `.desk-answers`, `__fig`, `__cap`, `__finish`; `.desk-paper`, `__text`, `__ask` | the mock exam: the answer sheet in the side; a reading passage flat beside its questions | `screens/ExamRunner.jsx`, `exam/ExamCard.jsx`, `exam/QuestionRenderer.jsx` (`PassageText`) |
| `.desk-anl-dock`, `__keys` | the analyser's second column: the dictionary on the stage's token | `components/analysis/AnalyzerDock.jsx` |
| `.desk-intake`, `__main` | the analyser's intake beside its history | `screens/AnalyzerScreen.jsx` |
| `.desk-photo`, `--over` | the photo intake's drop target around its two tiles; a picture pasted (Ctrl/⌘ V, printed on Choose) or dropped goes straight to the cropper (plan 123) | `components/analysis/ImageInput.jsx` |
| `.desk-dock`, `__head` | a door opened in a column: its caption and the entry's roundel ✕ (`.dict-plate__btn`, titled with Esc) over the phone's own body, in place of the column's tenant until ✕, Esc or the lit chip pressed again. It takes the focus in (`initialFocus`, else its caption) and gives it back to what opened it; an Esc from a filled field leaves the field first (plans 120, 123) | `components/chrome/DeskDock.jsx` |
| `.desk-cardform` | a deck's card form in its own dock (plan 123): New card or Edit card, its first field focused, a new card's draft kept until it is saved or cancelled | `screens/DeckDetailScreen.jsx` |
| `.desk-browse` | a deck's Browse, docked in the deck page's side (the result row stacked, as on a phone); the ✕ its one close, the results one tab stop walked with ↑/↓ from the search and ticked on Space (plan 123) | `components/decks/BrowseCardsMenu.jsx` (`BrowseCardsDock`) |
| `.desk-more` | a deck's More — import, export, the library — in the deck page's side; the deck's deletion asks in a dialog of its own (plan 120) | `screens/DeckDetailScreen.jsx` |
| `.desk-tut` | the grab's walkthrough in the intake's column, in place of the history; its copy button shares the panel's state (plan 120) | `components/analysis/GrabTutorial.jsx` (`GrabTutorialDock`), `useBookmarkletCopy.js`, `screens/AnalyzerScreen.jsx` |
| `.desk-readings` | a kanji's every reading in the entry's own place, whatever holds the entry (a dock, a run's side, a lookup dialog); ✕ or Esc steps back to the entry (plan 120) | `components/dictionary/DictionaryDetail.jsx` (`ReadingsInPlace`) |
| `.desk-install` | the iOS install steps in the settings page, under the row that asked (`aria-expanded`) (plan 120) | `components/settings/DisplayPage.jsx`, `components/ui/InstallSheet.jsx` (`InstallSteps`) |
| `.desk-crumb`, `__up` | the way up: a ‹ way out the rail does not already open, as a crumb over the title (`DeskCrumb`, also over the analyser's result and the dictionary's radical header) | `components/chrome/Bar.jsx` |
| `.desk-deck`, `__main`, `__study`, `__cap` | a deck's cards beside its platforms, or the form while a card is written | `screens/DeckDetailScreen.jsx`, `components/decks/DeckPlatforms.jsx` |
| `.desk-profile`, `__col` | the holder opened flat: the pass and stamps at `--desk-side-w`, beside the record | `screens/ProfileScreen.jsx` |
| `.desk-banzuke`, `.desk-bz__period` | both rankings at once, side by side where the column holds two | `components/profile/Banzuke.jsx` (`both`) |
| `.desk-settings`, `__list`, `__page`; `.stg-row--on` | the list (sticky, bounded, the one `<h1>`) beside the open page at `--card-w` (a pane, `<h2>`, no way back). The open row is marked in gold. The bare list opens its first page. The rows are links that replace the page beside them, with no › (the pass, a dialog, keeps its own), one tab stop walked with ↑/↓ (plan 123) | `screens/SettingsScreen.jsx`, `components/settings/SettingsPage.jsx`, `components/settings/pane.js` |
| `.sheet`, `.sheet--sumi`, `.sheet__handle` | a sheet is a centred dialog: all four corners, no handle, a fade. It is centred by `inset` and `margin: auto`, never a transform, because the drag owns that. Since plan 123 its actions share a row, it opens on `initialFocus` (the way back, never the irreversible act), and a `dismiss` sheet draws a ✕ (`.desk-sheet__close`); the rail's two sheets (`:root[data-chrome="shell"] .status-sheet`, the balance) stand beside the rail at `--desk-side-w` | `components/chrome/Sheet.jsx` |
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
| `.flashcard__hint .desk-kbd` | "Espace pour révéler" — not on a card run's panels (plan 126), where the card panel lists the keys and the rating tiles print no digit either | 〃 |
| (plan 122) | the boarding answers the keys: Enter presses the live step's Continue (its cap printed; from a pressed answer too), the digits pick (`PICK_KEY_DIGIT`, a level its own number — N5 5, the kana stop 0), Esc does nothing; Enter boards from the Welcome and goes on from the ride's ends | `hooks/useBoardKeys.js`, `domain/choiceKeys.js`, `components/boarding/BoardFrame.jsx` (`Continue`'s `keys`) |
| (plan 123) | a reading, translation or dictation line goes type, Enter, digit, Enter (Next's cap); Space plays the dictation clip, the field focused on play; ←/→ step a browse; digits and Enter answer the placement test; → and Enter go on in a guide; ↑/↓/Home/End walk every list beside a page (`useListWalk`, `WALK_KEYS`), arrows walk the dictionary's grid (`useGridWalk`) and a radio group (`useRadioWalk`); Ctrl/⌘ V pastes a picture into the photo intake. Esc has one owner, the innermost door that holds it (`stores/escHold.js`), and the run's head drops its cap meanwhile. Enter after a pointer press goes to the page, not to the control the pointer left focused (`pressedByPointer`) | `components/chrome/DeskKeys.jsx`, `lib/keyGuards.js`, `hooks/useListWalk.js`, `hooks/useGridWalk.js`, `hooks/useRadioWalk.js`, `stores/escHold.js`, `components/analysis/ImageInput.jsx` |
| (plan 115) | Enter departs from Today and takes a finished run's action; Esc leaves a run (`DepartKey`, `EnterKey`, `LeaveKey`); C shows the choices; A–D/1–4 and Enter answer comprehension; Space plays a listening clip; Ctrl/⌘+Enter analyses; ←/→ walk the grammar points, the exam's review, the analyser's tokens. Each cap on what it presses, with `aria-keyshortcuts` | `components/chrome/DeskKeys.jsx`, `components/study/HintBar.jsx`, `screens/ComprehensionRun.jsx`, `exam/AudioPlayer.jsx`, `components/analysis/WritingSlip.jsx` |

## Tests

| File | Lane | What |
|---|---|---|
| `src/desk.css.test.js` | node | the section's contract, and the width written once |
| `src/chrome.desktop.test.jsx` | desktop (1100×800) | the rail: order, captions, stations, due, the pass at its foot (its three doors, its climb, its balance's edge and caption), geometry, no line pigment, a run without it |
| `src/chrome.wide.test.jsx` | wide (1440×900) | the column capped at `--board-w` and centred beside the rail |
| `src/sheet.desktop.test.jsx` | desktop | the centred dialog |
| `src/gates.desktop.test.jsx`, `src/profile.desktop.test.jsx`, `src/settings.desktop.test.jsx` | desktop | the screens |
| `src/keys.desktop.test.jsx` | desktop | the keys |
| `src/components/chrome/Shell.desk.browser.test.jsx` | browser | a resize across 1100 keeps the screen |
| `src/lattices.desktop.test.jsx`, `src/today.desktop.test.jsx`, `src/dictionary.desktop.test.jsx`, `src/stations.desktop.test.jsx`, `src/stats.desktop.test.jsx`, `src/runs.desktop.test.jsx`, `src/header.desktop.test.jsx`, `src/decks.desktop.test.jsx` | desktop | plan 114, one file a phase |
| `src/breakdown.desktop.test.jsx`, `src/comprehension.desktop.test.jsx`, `src/folds.desktop.test.jsx`, `src/exam.desktop.test.jsx`, `src/shelf.desktop.test.jsx`, `src/analyzer.desktop.test.jsx`, `src/laptop.desktop.test.jsx`, `src/session.desktop.test.jsx` | desktop | plan 115, one file a phase |
| `src/today.wide.test.jsx` | wide | plan 116: the gate's lanes two across, in the list's order, Enter departing with the choice |
| `src/splitRows.desktop.test.jsx` | desktop | plan 117: a split's row as a link measures as the button it replaced (at rest, hover, focus), and a modified click is left to the browser |
| `src/radicals.desktop.test.jsx` | desktop | plan 118: a radical's page beside the index, the family in the list, the bare index |
| `src/browse.desktop.test.jsx` | desktop | plan 119: the browse's side — the entry docked on reveal, no tally, no column over an empty browse |
| `src/panels.desktop.test.jsx` | desktop | plan 126: the three columns, the session panel, the card panel's tiles and figures, the bare elements, the tiles unlit then lit, the details sealed then banded, the choices under the card, a run without records keeping the side alone (it replaced plan 124's `console.desktop.test.jsx`) |
| `src/grammar.desktop.test.jsx`; blocks of `src/shelf.desktop.test.jsx`, `src/analyzer.desktop.test.jsx`, `src/dictionary.desktop.test.jsx`, `src/settings.desktop.test.jsx` | desktop | plan 120: the doors that open in their columns, and the deck's deletion still asked |
| `src/frontdoor.desktop.test.jsx`, `src/frontdoor.wide.test.jsx`, `src/ride.desktop.test.jsx`; `src/frontdoor.phone.test.jsx`, `src/ride.phone.test.jsx` | desktop, wide, phone | plan 122: the Welcome and its side, the boarding's frame, keys and digits, the first ride's side and ends |
| `src/columns.wide.test.jsx`, `src/runs.wide.test.jsx`, `src/practice.desktop.test.jsx`, `src/guide.desktop.test.jsx`, `src/links.desktop.test.jsx`, `src/radios.desktop.test.jsx`, `src/focus.desktop.test.jsx`; blocks of the session, today, dictionary, keys, shelf, sheet, chrome, settings, stations, laptop, exam, browse, grammar, folds, analyzer, breakdown, stats and runs desktop tests | desktop, wide | plan 123, P1–P19 |
| `src/composition.desktop.test.jsx`; the six-plate block of `src/gates.desktop.test.jsx`; a block of `src/deskfree.phone.test.jsx` | desktop, phone | plan 125: 作文's side — the lesson while writing, the breakdown once rated, Enter to the next point; Practice's six plates; the phone's door and no column |
| `src/deskfree.phone.test.jsx` | phone (390×844) | plans 114–125's phone side: at 390 every re-laid screen keeps the phone's arrangement, one block a phase |
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
| A new deck | `screens/DecksScreen.jsx` | a creation that ends by leaving the shelf for the deck it made; the shelf has no second column, and conjuring one for a two-field form would be a column found to fill (plan 114). Since plan 123 it does leave: the new deck's page opens with its first card's form in the side |
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

**Left for the owner:**

- The radical family's lookup (`components/selection/RadicalLesson.jsx`,
  `RadicalFamilyList`). Since plan 118 the family stands in the radical
  page's list beside the lesson, and a tile still opens its entry as a
  centred dialog — plan 118's own stated choice, made while this plan was
  open. By this rule it belongs in the page's column beside the family.
- A ← → caption line where a walk has no control of its own (the grammar
  lesson, the exam's review, the dictionary's dock): the keys are in
  `aria-keyshortcuts`, but printing them reopens plan 114's key-legend cut.
- A Learn or Practice plate's foot as one tab stop walked with ←/→ (five
  stops a plate today).
- The exam review row's hover is the bare button's brightness filter, kept
  to the pixel with the phone's button (plan 117); restyling it is a change
  to both sides.
- Ruby readings still go into a copy on the phone (the five lines the desk
  now strips), and a note stands over the rating bar with no token for its
  place: both phone changes, left for the owner.
- Shoot on a real computer duplicates Choose; hiding it should be keyed on
  `(any-pointer: coarse)`, never on the width, since a tablet reaches the
  desk.

(The first ride's 🔍 and Today's status dialog, listed here after plan 120,
are gone: the ride has a side now (plan 122), and the status panel calls
the journey standing beside the gate (plan 123).)
