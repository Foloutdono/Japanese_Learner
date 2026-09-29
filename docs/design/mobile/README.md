# The mobile canvas — class map

The app's phone design is the "Japanese Learner Mobile" canvas (67 artboards,
three spec sheets, nine annotation notes; see `plans/README.md`, wave 14).
Its shared stylesheet is kept verbatim beside this file as `mockup.css` —
**reference only, never imported**. The app has one stylesheet,
`frontend/src/index.css` (`DESIGN.md`, ADR 0007), and every rule that ships
moves there under its namespace, on the `:root` tokens; the canvas's `.jp`
block carries the same token names, so a port is a copy with the literals
checked against `frontend/src/design-scale.json`.

The canvas's rule for the chrome: **the interface speaks the learner's
language; Japanese is content** (a word, a sentence, a deck's name, a
card's stage)
and the tab bar's icons. The bilingual JP + Latin pairing the desktop chrome
used retires for the mobile chrome.

At 1100px and up the app draws its second chrome, the desk (plan 112,
ADR 0018); its class map is `../desk/README.md`. Nothing in it reaches
the widths this canvas covers.

## The backbone (plan 068)

| Canvas class | `index.css` block | Component |
|---|---|---|
| `.phone`, `.phone__content` | 車内 — the mobile chrome | `components/chrome/Shell.jsx` (`Shell`, `StageFrame`) |
| `.phone__content[data-pull]` (`"next"` / `"back"`) | 乗り換え — the flick between gates: the arriving gate pulls in from the side the flick came from. Not a class of the canvas's — the canvas drew the bar and nothing else along the row of five | `hooks/useGateSwipe.js`, `gateBeside` in `config/tabs.js`, set by `Shell.jsx` |
| `.hud`, `.hud__level`, `.hud__status*`, `.hud__pass*`, `.hud-fare` | 運行案内 — the HUD | `components/chrome/Hud.jsx` (`Hud`, `HudPass`, `useXpGain`, `FareFigure`) |
| `.tabbar`, `.tab`, `.tab__ico`, `.tab__cap`, `.tab__due`, `.tab--on`, `.tab--badged` | 改札口 — the tab bar; the canvas's `.tab__jp` (a kanji where the pictogram goes) and its row of captions are retired — see below | `components/chrome/TabBar.jsx`, `GateIcon.jsx`; the five gates in `config/tabs.js` |
| `.bar`, `.bar__row`, `.bar__roundel`, `.bar__names`, `.bar__names--stacked`, `.bar__title`, `.bar__sub`, `.bar__aside`, `.bar__stripe`, `.bar--register` | the compact header; the canvas set the sub a gap after the title, the app sets the two registers at the row's two ends — see below | `components/chrome/Bar.jsx` (`Bar`; `ScreenBar` is the transitional adapter for screens plans 070–074 have not rebuilt) |
| `.stage__head`, `.stage__leave`, `.stage__where*`, `.today-remaining` | the head of a run | `components/chrome/StageHead.jsx`, `Leave` in `Bar.jsx` |
| `.scrim`, `.sheet`, `.sheet--sumi`, `.sheet__handle`, `.sheet__head`, `.sheet__jp`, `.sheet__cap` | bottom sheets | `components/chrome/Sheet.jsx` (modal behaviour from `hooks/useDialog`) |
| `.console`, `.console__top`, `.console__chips`, `.console__action`, `.console__index` (`--bare`), `.console__field`, `.console__clear`, `.console__count`, `.console__toggle` | the console | `components/chrome/Console.jsx` (`Console`, `ConsoleTop`, `Chips`, `ConsoleAction`, `ConsoleIndex`) |
| `.chip`, `.chip--on`, `.chip__glyph`, `.chip-row` | chips | `Chip` in `Console.jsx` |
| `.seg`, `.seg__opt`, `.seg__opt--on`, `.seg__opt-jp`, `.seg__opt-latin`, `.seg--full`, `.seg--kaiseki` | the segmented control | `Seg` in `Console.jsx` (the profile's 番付 already drew `.seg`) |
| `.loading`, `.loading__dot`, `.empty*` | 待合 / 空 (plan 067) | `components/ui/Loading.jsx`, `components/ui/Empty.jsx` |
| `.platform-card--line`, `.platform-card__title-jp` | the platform card | `screens/PracticeScreen.jsx` |

Tokens minted for the chrome: `--hud-h` (48px, the HUD's own height —
it was the retired phone level bar's 36px), `--tabbar-h` (50px), and
`--dock-bottom`, which every docked object reads: the tab bar plus the
safe-area inset under the shell (`:root[data-chrome="shell"]`, stamped by
`components/chrome/useChrome.js`), the inset alone on a stage.

**The bar is a sign: the name at one end, its caption at the other.**
The canvas drew `.bar__names` as two items a `--sp-3` gap apart, which on
every real title left the rest of the row empty and read as one long
string (`Practice Four platforms`) rather than as a platform sign. The app
wraps that row and gives it `place-content: flex-end space-between`, so
the title keeps the left and the sub sits against the right, both on the
title's bottom edge. The wrap is what replaced the hard `≤768px` stack the
long French names needed: a title too wide for the line keeps that line to
itself — `space-between` leaves a lone item at the start — and the sub
falls under it, so a short name gets its sign on a phone and a sentence
still gets its two lines.

The sign needs the right end free, and an aside is already standing on
it. `Vocabulaire ... SOURCES [‹ Apprendre]` puts the caption against the
button, near enough to read as the button's label rather than the name's,
so a bar carrying both a sub and an aside stacks at every width:
`Bar.jsx` adds `.bar__names--stacked`, which turns the row into a column
and returns the caption to under the name it captions, leaving the aside
the end to itself. A bar with only one of the two is unchanged.

Stacking also brings the tracking rule into play (DESIGN.md, Tracking):
a tracked caption on a left-flush axis takes an indent equal to its
tracking, so `.bar__names--stacked .bar__sub` carries
`text-indent: var(--tr-caption)` and `.bar__sub` on its own does not —
in the sign layout the caption is flush *right*, where the same indent
would push it off its own edge (the case `.dict-plate__cap` documents).
It is an optical correction as much as a tracking one: flush by their
boxes, `SOURCES` inked the box edge on most of its scanlines while
`Vocabulary` inked it only at the tips of the serif V's top arms, so
the caption read about 4px left of the name it captions.

**The gates are pictograms, and only the lit one is captioned.** The
canvas drew each gate as a kanji (`.tab__jp`) with the plain word under
it, in English, where `DICTIONARY` fits a 78px gate. `DICTIONNAIRE` is
94px and `AUJOURD'HUI` 87, and the caption had neither `nowrap` nor a
clip, so in French two gates printed over their neighbours. Six
directions were rendered against the real stylesheet and the owner took
this one: five drawn glyphs on one line (`GateIcon.jsx`, the shared
24×24 stroke convention), the word under the gate you are on only —
that gate is `flex: 0 1 auto` and takes the width its word needs, the
other four are `1 1 0` and share the rest. Every gate carries its word
as its `aria-label` whether or not it is printed, so the bar reads the
same to a screen reader as it did with five captions. The due count
caps at `99+`: a third figure is wider than the gate.

## The run (plan 070)

| Canvas class | `index.css` block | Component |
|---|---|---|
| `.stage` (the frame), `.stage__foot` | the study stage — the ≤768px block docks the rating bar and grows the card | `components/study/StudyStage.jsx`; the six study screens render inside it |
| `.stage__head`, `.stage__leave`, `.stage__where*`, `.today-remaining`, `.stage__head .hud__pass` | the head of a run | `components/chrome/StageHead.jsx` |
| `.lvlbar` (`__level`, `__level-num`, `__track`, `__fill`, `__gain`, `__xp`, `__unit`), `.hud-fare--bar` | the level bar docked on a run's bottom edge — the fare's home once the HUD has left; `--dock-bottom` on a stage is its height | `components/chrome/LevelBar.jsx`, mounted by `StudyStage` and by the exam runner |
| `.rating-bar__btn--best` | the rating bar's best answer, the one tile filled gold (2026-09: the segments became tiles) | `components/study/RatingBar.jsx` |
| `.deck-progress`, `.deck-progress__bar`, `.deck-progress__segment` | the hairline (the legend hides on a phone) | `DeckProgress` in `components/study/QuizComponents.jsx`; the run's own bar in `screens/TodayRun.jsx` |
| `.study-assist`, `.study-assist__toggle`, `--on` | the assist toggles | `components/study/HintBar.jsx` |
| `.prompt-card`, `.prompt-card__body`, `.prompt-card__foot`, `.stage-mark*`, `.char-display*`, `.flashcard*` | the card | `components/study/PromptCard.jsx`, `CardPrompt.jsx`, `StageMark.jsx`, `QuizComponents.jsx` |
| `.mcq-list`, `.mcq-row*` | the choices | `MCQGrid` in `QuizComponents.jsx` |
| `.rating-bar*` | the docked rating bar | `components/study/RatingBar.jsx` |
| `.draw-prompt`, `.canvas-wrap`, `.canvas-clear-btn` | the draw face | `components/study/DrawingCanvas.jsx` |
| `.readings-input*` | the readings face | `components/study/ReadingsInput.jsx` |
| `.browse-nav` | the fast review's foot | `components/study/ReviewDeck.jsx` |
| `.levelup*`, `.card-stamp*` | the boards over the stage; the canvas's `.reissue*` (the pass re-issued on a rank crossing) is retired with the rank titles | `components/rewards/XpToast.jsx`, `components/study/CardStamp.jsx` |
| `.gate-card`, `.gate-card__head`, `.gate-card__title`, `.gate-card__figure`, `.gate-card__count`, `.gate-card__unit`, `.gate-card__fare*`, `.gate-card__short*`, `.btn-depart`, `.btn-depart--ghost` | 改札 — the fare gate | `components/station/GateCard.jsx` |
| `.gate-one*`, `.gate-card--one`, `.gate-mix*`, `.gate-card__ask*`, `.gate-sheet*`, `.btn-depart--gate` | 一押し — the phone's gate in one gesture (plan 166): the day as one card, the services in a sheet | `components/station/GateCard.jsx`'s `PhoneGate`, `components/ui/GateButton.jsx` |
| `.lane`, `.lane--off`, `.lane__tick`, `.lane__where`, `.lane__mode`, `.lane__free`, `.lane__due` | the lanes are the picker; `__free` marks a lane that costs nothing (`core/credits.py`, `FREE_SOURCES` — 仮名 today), and is held back on a pass | `GateCard.jsx` |
| `.pass--strip` (with `.stamp-rally*`, `.hall-pace*`) | the strip under the gate | `components/station/PassStrip.jsx` |
| `.today-clear*`, `.fare-slip*` | the finish | `RunComplete` in `screens/TodayScreen.jsx`, `components/credits/FareSlip.jsx` |
| `.balance*` (with `.balance__free*`, the free line said once under the lattice) | the balance sheet (plan 069) | `components/credits/BalanceSheet.jsx`, `RunOutSheet.jsx` |

The run is `/today/run` on the stage frame, reached through the ticket
gate from `/today`; the chosen lanes ride in the query (`?lanes=a,b`, absent
when every lane is on). The finish is printed by `/today` under the chrome
from the router's state. Held from the canvas: the cloze face (the fill-in
mode has no blank to type into yet — the sentence is shown whole and the
rule is the flip), and docking a field's submit in the foot (the type,
draw and readings faces keep their button under the widget).

## Practice (plan 072)

| Canvas class | `index.css` block | Component |
|---|---|---|
| `.platform-card--line` | the hub — retired for the Learn gate's plates (plan 094, `.plate--platform`, the grades in `.plate__foot--dests`) | `screens/PracticeScreen.jsx` (plan 068). Its bar was the concourse's, the home roundel and the gold, as the Learn gate's was; since 2026-09-20 no gate prints a bar at all (DESIGN.md, The chrome) — the name is a clipped `<h1>` |
| `.timer`, `.timer__bar`, `.timer__fill` (`--low`), `.timer__label` | the practice sessions | `screens/ReadingRun.jsx`, `screens/ComprehensionRun.jsx` |
| `.sentence`, `.sentence--left`, `.sentence--covered` | the card's one line | `ReadingRun.jsx` |
| `.prose`, `.prose__label` (`--measured`, with `.prose__measure`), `.prose__en` (`--lead`), `.prose__jp` (`--passage`), `.prose__romaji`, `.prose__ai`, `.prose__rule`, `.prose__verdict` (`--ok`, `--x`), `.prose__breakdown` | the card as a page — `PromptCard`'s `prose` prop puts it on `.prompt-card__body` (`.prompt-card__body--prose`); the measured label carries the server's hint (dictation's accuracy, composition's point found / not found) beside the learner's answer, never over the card | `ReadingRun.jsx`, `screens/TranslationRun.jsx`, `ComprehensionRun.jsx`, `screens/DictationRun.jsx`, `screens/CompositionRun.jsx` (plan 125) |
| `.rvw`, `.rvw__head`, `.rvw__verdict` (`--correct`, `--acceptable`, `--partial`, `--incorrect`), `.rvw__summary`, `.rvw__list`, `.rvw__row`, `.rvw__mark` (`--ok`, `--x`), `.rvw__item`, `.rvw__fix`, `.rvw__corrected`, `.rvw__better`, `.rvw__fixed` | the tutor's review as a shape (`study/tutor_review.py`): a verdict, a line, what worked, what to fix, the corrected sentence with its change marked — and what the sentence says, when the review carries it | `components/study/TutorReview.jsx`, drawn by `screens/TranslationRun.jsx` and `screens/CompositionRun.jsx` (plan 125) |
| `.prompt-card--ask` | a flat, left-aligned question card | `ComprehensionRun.jsx`, `screens/ExamRunner.jsx` (with `.exam-card`) |
| `.type-badge` | the outlined caption pill (its type's colour as a tint) | `QuestionTypeBadge` in `components/study/QuizComponents.jsx` |
| `.mcq-list`, `.mcq-row` (`--selected`, `--correct`, `--wrong`, `--filler`), `.mcq-row__index` (A–D), `.mcq-row__text--latin` | the choices | `ComprehensionRun.jsx`; the exam's rows are `exam/QuestionRenderer.jsx` |
| `.stage__foot` (a `<form>` with `.field.field--page` + `.btn-primary`), `.stage__foot .field` (the answer rung), `.btn-row` | the field and the action docked in the foot; two actions side by side | the three sessions, `screens/ExamResult.jsx` |
| `.result-lattice` (of `.record`s), `.surface`, `.qrows`, `.qrow-item`, `.qrow`, `.qrow__q`, `.qrow__note`, `.qrow__detail` | the comprehension result | `ComprehensionRun.jsx` |
| `.paper-slot` | `.platform-slot__action` ("Different paper", under a sat paper) | `ModeSelector`'s `action` slot, from `screens/ExamScreen.jsx` |
| `.exam-meta`, `.exam-meta__section`, `.exam-meta__jp`, `.exam-timer` (`--low`) | the runner's head row | `ExamRunner.jsx` |
| `.exam-mondai`, `.exam-mondai__part`, `.exam-mondai__text` | Part n · Show instructions | `ExamRunner.jsx` |
| `.cap`, `.exam-underline` | the question's number and its underline | `ExamRunner.jsx`, `QuestionRenderer.jsx` |
| `.exam-nav`, `.exam-flag` (`--on`) | Previous · flag · Next | `ExamRunner.jsx` |
| `.exam-sheetbar`, `.exam-sheetbar__open`, `__label`, `__fig`, `__cap`, `__chips`, `__chip` (`--done`, `--flag`, `--here`), `.exam-finish` | the sheet bar, docked like the rating bar (the ≤768px block on `.stage`) | `SheetBar` in `exam/AnswerSheet.jsx` |
| `.exam-sheet`, `.exam-sheet__legend*`, `__grid`, `__chip*` | the numbered grid, in a `Sheet` the bar opens | `AnswerSheet` in `exam/AnswerSheet.jsx` |
| `.sheet` + `.hint` + `.btn-primary` / `.btn-secondary` (`--danger`) | the confirm, the leave guard, the submit error | `ExamRunner.jsx` on `components/chrome/Sheet.jsx` |
| `.exam-result-head`, `.exam-score-ring` (`--low`, `__svg`, `__track`, `__fill`, `__tick`, `__pct`), `.exam-result-figs` (`__score`, `__cap`, `__note`) | the result's head, under the bar | `ExamResult.jsx` |
| `.section-header--paired` + `.chip--on` (`.section-header__chip`) | Review your answers · Missed only | `ExamResult.jsx` |
| `.exam-review`, `.exam-review__part`, `.exam-group` (`__part`, `__score`), `.exam-review-row` (`__mark` `--ok`/`--x`/`--blank`, `__q`, `__jp`, `__blank`, `__chev`, `__detail`) | the review surface | `ExamResult.jsx` |

The practice pickers (source, level, word list + tier, the exam's level and
papers) render on `SelectionScreen` — the station page's own bar, with the
way back in its aside — the way every station does since plan 071. They are
also *routed* like a station now: reading, comprehension and translation
were each one route that began as a picker and became a session, and that
route was on the stage frame, so choosing a source happened with no HUD and
no tab bar. The pickers are their own routes under the shell
(`screens/SentenceStation.jsx`, one screen for all three: they ask the same
question) and the session is the run below them
(`ReadingRun`/`ComprehensionRun`/`TranslationRun`), with the choice carried
in the path — `/practice/reading` · `/levels` · `/tiers`, then
`/level/N4`, `/tier/3?size=200&domain=jmdict`, `/mastery`; comprehension has
one axis, so its root is the level list and its run is
`/practice/comprehension/N4`. `domain/sentenceSource.js` is the one place
that knows that shape, and a path the station could not have produced sends
the learner back to it. The sessions and the exam runner render on
`StudyStage` / the stage frame with the list they were chosen from as the
way out (`‹ Sources`, `‹ Levels`, `‹ Tiers`; `‹ Exam`) and no pocket pass:
practice spends no credits. They do pay the fare: every graded answer comes
back with `xp_earned` (`srs.award_practice`, into the ledger), and
`hooks/usePracticeXp.js` moves the docked level bar and sounds the tick the
way `useReviewGates` does on a card run. The reading and translation tier step is the
vocab station's tiers page (a `Seg` for the word list over `TierSelector`),
and the batch carries the chosen `tier_size`. The comprehension exercise commits a pick
with Next (the canvas), and re-reading the text pauses the clock. Held from
the canvas: the "sat twice" line on a paper (the catalog carries no attempt
count).

## What retired with it

The three sessions' private blocks (`.rdg-*` except the breakdown carousel
`.rdg-breakdown*`, which the analyzer shares; `.trn-*`; `.comp-*`), the
reading and translation screens' own `TierPicker` (and its jump-to-tier
row), the exam shell (`.exam-shell*`, `.exam-progress-bar*`, the
`.exam-mondai-instructions*` strip, `.exam-card-stage`, `.exam-nav-buttons`,
`.exam-nav-btn`, `.exam-flag-btn*`, the answer-sheet card's head and title,
`.exam-finish-btn`, the inline `.exam-confirm*` panels), and the old result
(`.exam-result-header*`, `.exam-result-disclaimer`, `.exam-review__*`,
`.exam-review-list`, `.exam-review-group*`, the old `.exam-review-row__*`
summary/icon/number/chevron, the 132px ring's `__arc`/`__target`). Their
baseline entries went in the same commit.

## Dictionary and the analyzer (plan 073)

| Canvas class | `index.css` block | Component |
|---|---|---|
| `.anl-door`, `.anl-door__roundel`, `__names`, `__title`, `__desc`, `__intakes`, `__intake` | the analyzer's door on the dictionary | `screens/DictionaryScreen.jsx` |
| `.console` + `.chip` (a chip per collection in its line colour), `.console__index` with the count (the dots while it loads) and the 部 index as a `.console__toggle` at the field's trailing edge under kanji — a round key carrying the glyph alone, named in `title`/`aria-label` — the row keeps the toggle alone (`--bare`) while the index itself is up | the console | `DictionaryScreen.jsx` on `components/chrome/Console.jsx` |
| `.dict-grid`, `.dict-entry-card` (`--selected`, `__kana`, `__char`, `__meaning`), `.dict-level-badge`, `.stage-mark` | the catalogue | `ResultsSection` in `DictionaryScreen.jsx`; `LevelBadge` in `components/dictionary/DictionaryDetail.jsx` |
| `.dict-entry`, `.dict-plate*`, `.dict-kind`, `.dict-block*`, `.dict-sense*`, `.dict-tag*`, `.dict-ex*`, `.dict-form*`, `.dict-word*`, `.dict-readings*`, `.dict-register*`, `.dict-reading*`, `.dict-sheet` (the readings sheet and the lookup sheet), `.record` | the entry plate and its body. Since `main`'s dictionary-detail redesign (PRs 21 and 22) was merged into this wave on 2026-09-07, that implementation owns the entry: the same canvas plate, with the readings in two registers, the backend's `study/kanji_words.py` grouping and its own 745-line suite. Plan 073's twin of it retired in the merge; the catalogue, the console and the analyzer above and below are plan 073's | `components/dictionary/DictionaryDetail.jsx` (`DictionaryDetail`, `DictionaryLookupSheet`) |
| `.seg--full.seg--kaiseki` (`.anl-sources`, an icon per source, `.seg__opt-icon`), `.anl-panel`, `.anl-resume` | the three intakes, on the desk's column since plan 136 (the panel's lead line retired with it) | `screens/AnalyzerScreen.jsx` on `Seg` |
| `.anl-entry` (`--open`, `__row`, `__field`, `__tool`, `__foot`) | the phone's way in since plan 136: one line over the passages, the camera and a subtitle file beside it; Japanese in it (or the focus) opens it into the slip, a YouTube link pasted there goes to the video sheet | `components/analysis/EntryLine.jsx` |
| `.anl-sheet` | the video and photo intakes as sheets over the passages (plan 136), the grab's walkthrough a dialog from the video one | `screens/AnalyzerScreen.jsx` on `Sheet` |
| `.anl-link` (`__say`), `.anl-still` (`__img`), `.anl-file`, `.anl-vlinks`, `.anl-vlink`, `.anl-window-toggle`, `.anl-drop__input` | the video intake as a column (plan 136): the link, the video's still, ONE filled action (the link's fetch where the server can, else setting up the bookmark until it has been used, else opening the video on YouTube), the file, and the rest on one quiet line (the bookmark, DownSub, the section) | `components/analysis/IntakeVideo.jsx`, `VideoStill.jsx` |
| `.textarea`, `.anl-slip` (`__field`, `__count`), `.field--filled`, `.anl-action` | the writing slip | `components/analysis/WritingSlip.jsx` |
| `.field--page` | a field mounted on the PAGE rather than on something raised — its well steps up to `--surface`, because there is nothing under the page to be a hole through. Seven mounts: both runs' entries, the account page's claim fields, the import dialog's paste box and separator, the browse dialog's search, the analyzer's rail head and video URL and section (`.anl-sheet .field--page` steps back down to the base well, the phone's sheet being raised). `src/fields.browser.test.jsx` holds every mount to it | `index.css`, the `.field` family |
| `.intake-pair`, `.intake-btn` | Shoot / Choose | `components/analysis/ImageInput.jsx` |
| `.anl-shelf` (`__chips`, `__rows`, `__empty`), `.chip__n`, `.anl-row` (`__open`, `__lead` (`--still`), `__glyph`, `__body`, `__jp`, `__meta`, `__go`, `__delete`), `.anl-kept`, `.anl-undo*` | the passages (plan 136, the owner's pick C; `.head2`, `.anl-history` and `.anl-hist*` retired with `AnalyzerHistory`): under the desk the kinds held as chips over a row per passage, its lead a video's still or the platform's glyph in a ring; the desk's cards are in the desk README | `components/analysis/PassageShelf.jsx`, `passages.js` |
| `.anl-head__keep` (`--on`) | 保存, the result's keep, in the head of the desk's result and of the phone's. It was a read-only `.anl-kept` stamp until 2026-09-11; it is the control now — the rail that carried the pin is not built below 1100px — and it wears the rail pin's own `+` / `✓` in a 44px round target | `AnalyzerScreen.jsx` |
| `.tok-line`, `.tok` (`--on`, `--lit`, `--mastered`, `--learning`, `--unknown`, `--offdeck`, `--particle`, `__furi`, `__word`), `[data-furigana]` on `.anl-subs` / `.anl-m__subs` | the line (its legend retired by plan 134) | `components/analysis/SubtitleLine.jsx` |
| `.anl-m` (`__head`, `__player`, `__video`, `__subs`, `__line` (`--none`), `__note`, `__points`, `__explain`), `.anl-pbar--compact`, `.anl-explainsheet` (`__head`, `__jp`) | the analyser's result on a phone since plan 134, the owner's drawing: the way back and keep, the video and its trimmed bar, the subtitles (the next sentence, the current one, the previous one), the numbered grammar, Explain opening the explanation in the dictionary's sheet | `screens/AnalyzerScreen.jsx`, `components/analysis/SubtitleLine.jsx`, `PlayerBar.jsx` (`compact`), `ExplainPanel.jsx` (`ExplainSheet`) |
| `.picker`, `.picker-row` (`--current`, `--new`, `--create`, `__roundel`, `__name`, `__count`, `__mark`, `__create`) | the deck picker sheet | `components/analysis/DeckPicker.jsx` on `Sheet` |
| `.word-detail*` | the word's own sheet (the record and the deck action) | `components/analysis/WordDetail.jsx` on `Sheet` |

The routes: `/dictionary` and `/dictionary/analyzer`, both under the shell.
The analyzer's result renders on its own page under the `‹ Analyzer` head
rather than on the stage frame, so the working rail (search, the stop
filter, the line) stays beside it on a wide screen (`.anl-railcol` moves
before the stage at ≥1100px). **On a phone there is no rail at all**
(2026-09-11): below that split it used to stack above the stage as a
~170px window, and `AnalyzerScreen`'s `wide` gate (`useMediaQuery`) now
keeps it out of the document entirely — the subtitles' sentences either
side and the bar's ‹ › walk the Passage there (plan 134), and
`.anl-head__keep` on the head keeps the stop you are on.
`AnalyzerScreen.phone.test.jsx` holds that; the browser lane's iframe is
414px wide, so the suites that assert the rail declare their own
desktop viewport.

Held from the canvas: the pass tag on the door (plan 069,
`HAS_STORE`), the photo frame and the video section (the existing
intakes keep their cropper and their subtitle grab), and the entry as a
sheet — `.dict-dock` keeps its split at ≥1100px inside the
shell's column and its modal below.

## What retired with it

The dictionary's console, tabs and index bar (`.dict-console*`,
`.dict-tab-*`, `.dict-index-bar*`, `.dict-results-grid`, `.dict-page`, the
radical back button), the identity plate and the panel it hung in
(`.dict-detail__*` — the stage, its badges and readings, the gloss and
senses labels, the composing kanji, the practice stats, the stroke
panel, the close slab and ✕), the old example and word rows
(`.dict-example*`, `.dict-vocab-example-*`, `.dict-stat*`, `.stat-row*`,
`.dict-tag-chip*`, `.dict-sense-marker`, `.dict-sense__number`), the
analyzer's selection screen and stub (`.anl-concourse`, `.anl-tiles`,
`.anl-tile__*`, `.anl-stub*`, `.anl-intake__jp`, `.anl-intake__lead`), the
sentence pane and its dials (`.anl-sentence*`, `.anl-tokrow`,
`.anl-stagectl*`, `.anl-stagebd__dot*`), the old history panel
(`.anl-history__*`), the old deck picker (`.anl-deckpicker__*`), the slip's
foot and stamp, the `.detail-*` side panel, `.word-span--known` and the
private `--anl-*` token family. Their baseline entries and their
design-scale allowlist entries went in the same commit — along with every
allowlist literal earlier retirements had left behind (the guard's
`--write` only ever merges, so those had accumulated since plan 068).

Plan 134 retired the phone's stage this wave built, for the owner's
drawing (the `.anl-m` row above): the stepper (`.anl-stepper*`,
`.anl-stops*`), the stage and its breakdown box (`.anl-stage`,
`.anl-stagebd*`, `SentenceBreakdown`'s `layout="stage"`), the token card
(`.token-card*`, `StageCard.jsx`) and the token table (`.anl-toktable`,
`.anl-trow*`), the dials (`.anl-dials`, `.anl-dial*`), the Explain box
(`.anl-explainbox`, `.anl-explain*`), the head's title and Clear
(`.anl-head`, `.anl-clear`), the old player panel (`.anl-player`, its
`__bar`, `__track`, `__fill`, `__vol` and `__dial`, `.anl-follow*`) and
the growth chain below 768px that handed the card the slack. The line
(`.tok-line`, `.tok*`) and the player's round buttons and clock
(`.anl-player__btn`, `__time`) stayed, for `SubtitleLine` and
`PlayerBar`.

## Profile, statistics and settings (plan 074)

| Canvas class | `index.css` block | Component |
|---|---|---|
| `.pass` (the existing block), `.pass__holder-names`, `.pass__since`, `.pass__door` (`-chev`), `.jour-line` as the balance line (`.balance-line`, `__refill`) | the pass — the initial with no ring, the name over the month it was issued — the balance on its footer, the footer the door to the balance sheet (plan 143) | `components/profile/CommuterPass.jsx`, `PassHolder.jsx`, `components/credits/BalanceLine.jsx`, `screens/ProfileScreen.jsx` |
| `.sbook` (`__month`, `__title`, `__dows`, `__dow`, `__grid`, `__stamp` `--missed`/`--today`/`--future`, `__side`, `__figs`), `.fig` (`__v`, `__u`, `__l`) | the stamp book, titled with its month, its three figures in one row | `StampBook` in `components/profile/ProfileBlocks.jsx` |
| `.records` (`--three`), `.record` (`--door`, `__note`), `.pf-line__id` (`__roundel` `--icon`, `__names`, `__jp`) | the records, three across, and the two doors, a lattice of their own under the pass (plan 143) | `Records` and `ProfileDoors` in `ProfileBlocks.jsx`, `LineMark` in `LineLedger.jsx` |
| `.pf-ledger`, `.pf-line` (`__fig`, `__of`, `__track`, `__done`) | the ride ledger, a row a line on one subgrid of columns (plan 143) | `components/profile/LineLedger.jsx` |
| `.banzuke`, `.bz__head`, `.bz__mark`, `.bz__jp`, `.bz__seg` (a `Seg`), `.leaderboard-row` (`--me`, `__rank` `--gold`/`--silver`/`--bronze`, `__name`, `__xp`, `__gap`) | the ranking | `components/profile/Banzuke.jsx` |
| `.sheet--sumi.status-sheet` + `.jour-st--*`, `.jour-dist` (`__count`, `__of`, `__pct`, `__leg`), `.jour-track*` (`__span`, `__siding`, `__leg` `--now`, `__done`, `__owed`, `__station` `--passed`/`--next`, `__station-name` `--jp`, `__plan`, `__you`, `__train`; the legs and the train since the 区間・新幹線 round), `.jour-cmps`, `.jour-cmp` (`__k`, `__v`, `__u`, `__d`, `__sub`), `.jour-rev__actions`, `.jour-act`, `.status-sheet__none`, `__office`, `__error` | the status sheet, off the HUD's station panel — distance first since the 進捗が主役 round, so the canvas's chip-over-two-lane-track-over-four-figures is history here | `components/journey/StatusSheet.jsx` (`GhostTrack.jsx`; the open state in `stores/journey.js`) |
| `.bar` + `.stage__leave`, `.rep-head`, `.rep-fig` (`--heading`, `__u`), `.rep-delta`, `.rep-cap` | the statistics head and its figures (plans 085, 138) — the bar wears TO, the plate the profile's door to it already draws, in the pass ink that door is painted in; no block under it carries a heading | `screens/StatsScreen.jsx` |
| `.rep-strip` (`__cell` `--line`/`--ladder`, `__figs`, `__when`) | the strip (plan 138): a hairline lattice two across — retention with its line and the ladder the row's width, the reviews behind the asked stop and the misses of thirty days between | `components/stats/ReportStrip.jsx` |
| `.rep-line` (`__svg`, `__path`, `__bridge`, `__ahead`, `__stop`, `__now`, `__sel`), `.rep-axis` | the retention line — good-or-better over reviews, a stop a day while there are three weeks or fewer and a stop a week after, the last stop pressed in the stamp's lacquer, the rail ahead dashed | `components/stats/RetentionLine.jsx` |
| `.rep-ladder` (`__step`, `__rung` `--empty`, `__n`, `__reach`) | the strength ladder — five rungs as wide as their share and never narrower than their captions, the mastered ink deepening rightward | `components/stats/StrengthLadder.jsx` |
| `.rep-plates`, `.rep-plate` (`__head`, `__names`, `__name`, `__fig`, `__body`, `__side`, `__none`), `.pf-line__roundel`, `.rep-grid-box`, `.rep-grid` (`__deck`, `__mode`), `.rep-cell` (`--leak`, `--none`, `__pct`, `__track`, `__fill`), `.rep-tiles`, `.rep-tile` (`__glyph`, `__pct`) | a plate per line (plan 138) — its retention, its grid of exercise by deck with the leak in the danger ink, its most-missed cards; every cell and tile opens its run; no sheet | `components/stats/LineReport.jsx` |
| `.composition` (`__seg` `--mastered`/`--learning`) | a bucket's composition — drawn by the desk's station split since plan 138 retired the stats' line rows | `components/stats/Composition.jsx` |
| `.bar` + `.stage__leave`, `.stg-home`, `.stg-list`, `.stg-row` (`__names`, `__jp`, `__value`, `__text`, `__chev`), `.stg-door` | the settings column: the pass over the list, every door a `.stg-door` (`SettingsDoor`). The list had its own head row (`.stg-headrow`, `.stg-head__jp`) — a near-copy of `.bar__row`/`.bar__title` with neither roundel nor rule, which left it and 統計 the two screens whose title did not look like the app's; the column and every page mount `Bar` now, with 設定's gear in the roundel (a pass has no line code — `config/identity.js`). Sign out is on the account page alone (plan 139) | `screens/SettingsScreen.jsx`, `SettingsPage` in `components/settings/SettingsPage.jsx` |
| `.slip` (`__label`, `__name`, `__hint`, `__act`, `__value`, `__confirm`), `.cap`, `.stg-cols`, `.stg-col`, `.stg-foot` (`__line`, `__was`) | a page's slips; two columns of them (`SlipColumns`, stacked on a phone); a page's foot — what the pass will print, and the one act | `SettingsPage`, `Slip`, `SlipColumns` in `components/settings/SettingsPage.jsx` |
| `.stg-row--link` (`__sub`, `__ext`) | the credits — one row per source the app is built on, each a link out (plan 085) | `components/settings/CreditsPage.jsx`, `domain/attributions.js` |
| `.svc-grid`, `.svc` (`--on`, `__jp`, `__pace`, `__star`, `__words`), `.hour-grid` | the service cards: the presets and mute, the lines, the daily hour, the services without a destination. A chosen card is a gold ring (plan 139) | `SoundPage.jsx`, `LinesPage.jsx`, `HourPage.jsx`, `ServicePage.jsx` |
| `.lvlstrip` (`__stop` `--on`, `__dot`, `__code`, `__jp`), `.lvl-note` (`__strong`) | the level strip and its note | `LevelPage.jsx` |
| `.sheet.lvl-sheet`, `.lvl-sheet__body` (`__strong`), `__figs`, `__fig` (`-v`, `-l`), `.btn-depart--sheet` | the level confirm sheets (Move up / Move down) | `LevelSheet` in `LevelPage.jsx` |
| `.dest-stops`, `.dest-here` (`--leaving`), `.dest-grid`, `.dest` (`--on`, `--ridden`, `--through`, `__dot`, `__names`, `__code`, `__load`, `__when` `--here`, `__tag`); `.dest-line__date`, `.form__row` | Destination (plan 139): the line upright from the stop you stand at, each stop ahead with the date the service reaches it, the rail drawn a half per row and inked as far as the stop chosen; the foot prints the validity, Hand it back and Reprint | `DestinationPage.jsx` |
| `.pass.stg-pass`, `.stg-pass__route`, `__stop` (`--on`), `__code`, `__name`, `__rail`, `__fields`, `__field` (`--on`, `--valid`), `__key`, `__value`, `__chev` | the pass printed with its contract at Settings' head (plan 139): the level → the destination, the service, the daily ride, the lines, the validity in gold — each field but the validity a door | `components/settings/SettingsPass.jsx` (`PassHead` from `components/profile/CommuterPass.jsx`) |
| `.stg-swatch` (`--light`, `--dark`, `--auto`), `.stg-meter` (`--muted`, `__bar`), `.stg-dots` (`__dot` `--best`) | what a row is set to, drawn: the theme's grounds, the mixer's levels, the rating bar's dots | `components/settings/RowSpecimens.jsx` |
| `.svc-chart` (`__axis`, `__tick`), `.svc-row` (`--on`, `--yours`, `__names`, `__name`, `__pace`, `__tag`, `__track`, `__rail` `--dashed`, `__end` `--dashed`, `__when` `--back`) | Service (plan 139): each pace a line to the destination on one time axis (a subgrid, so the axis and the rails agree), the learner's own pace dashed | `ServicePage.jsx`, `timeAxis` in `components/settings/contract.js` |
| `.theme-picks`, `.theme-pick` (`--on`, `__name`), `.theme-mini` (`__face` `--light`/`--dark`/`--cut`, `__bar` `--foot`, `__card`, `__line` `--short`), `.lang-picks`, `.lang-pick` (`--on`, `__name`, `__sample`) | Display (plan 139): the themes as screens drawn small, the languages saying the gates' names in themselves | `DisplayPage.jsx` |
| `.grades`, `.grade` (`--on`, `__name`), `.rating-bar--specimen` | Notation (plan 139): the three scales offered as the rating bar itself | `RatingPage.jsx`, `RatingBar`'s `specimen` |

The routes: `/profile` (the pass and its inserts, no bar), `/profile/stats`
(the bar with ‹ Profile), `/profile/settings` (the pass and the list) and
`/profile/settings/<level|destination|service|hour|lines|display|sound|rating|help|account|credits>`
(`learning` lands on `level` and `data` on `account` since plan 139). The
HUD's station panel opens the status sheet from every screen; the pass no
longer flips. The level rule (the canvas's note): choosing a level in
Settings › the level previews the move on a sheet (`GET
/api/profile/learning/preview`) and the write (`PATCH /api/profile/learning`)
marks the stops behind a raised level known — `study/level_rule.py`,
`SRSEngine.seed_known` — while a lowered level holds the stops above back
from the run (`daily_queue.hold_above`) and deletes nothing. Held from the
canvas: the statistics were redrawn by plan 138 (the four lines' plates;
the explorer, the lines' rows and the trouble list are gone), the theme is offered as three service cards (the canvas names the
page and draws no control), and the install row (plan 065) keeps its place
on Display & language.

## What retired with it

The pass's flip and its back (`components/journey/JourneyPass.jsx`,
`.jour-flip*`, `.jour-rev__title`/`__status`/`__turn`/`__foot`/`__none`/
`__office`/`__error`, `.jour-line__turn`), the contract grid
(`ContractGrid.jsx`, `.jour-grid*`), the destination counter
(`GoalCounter.jsx`, `.stg-contract`, `.stg-goal*`), the pass's gear and its
Japanese brand line, the old stamp book, figures and records block, the
ranking's two sides and chase line (`.bz__side*`, `.banzuke__chase`, the
level on a row), the statistics' headline (`Headline.jsx`, `.headline*`,
`.plaque*`), the scrolling year calendar (`.calendar*`, `.calendar-panel*`),
the fortnight forecast with its cumulative ghost, the rhythm charts
(`Rhythm.jsx`, `.rhythm-*`), the settings counter with its rail and slips
(`.stg-counter`, `.stg-rail*`, `.stg-panes`, `.stg-slip*`, `.stg-preset*`,
`.stg-lvlstrip*`, `.stg-pace*`, `.stg-scale*`, `.stg-danger-btn`,
`.stg-confirm*`, `.settings-*`), the theme toggle and the language select
(`ThemeToggle`, `LangSwitcher`, the mute button and `.btn-nav*`, `.theme-choice*`,
`.lang-select`), and the three `*-container` page classes. Their baseline
entries went in the same commit.

## Learn (plan 071)

| Canvas class | `index.css` block | Component |
|---|---|---|
| `.plates`, `.plate` (`--line`, `--shelf`, `--platform`, `__head`, `__roundel`, `__names`, `__title`, `__meta`, `__aside`, `__due`, `__foot` (`--stops`, `--dests`), `__prev`, `__here`, `__next`, `__stripe`) | 駅名標 — one station plate per line (plan 094; the canvas's wall map — `.board`, `.wmap-line*`, `.wmap-track*` — is retired, and `.wmap-roundel` survives only as the roundel the analyzer door and the deck cards draw) | `components/station/LinePlate.jsx`, `screens/LearnScreen.jsx`, `screens/PracticeScreen.jsx` |
| `.bar__link` | a text link in the bar's aside. No screen uses one today — the sources it carried (By frequency, By theme, JLPT instead) became platform cards on the station's own source page — but the bar still offers it, and `chrome.phone.test.jsx` holds it to the row's layout | — |
| `.route`, `.route-stop*` (`--past`, `--current`, `__rail`, `__marker`, `__code`, `__names`, `__jp`, `__hint`, `__here`, `__fig`, `__go`) | 路線図 — the route diagram; the rail is drawn per stop rather than once behind the list (so the ends cap at the first and last marker), and it and every marker are placed by their centre on one `left`, since a marker changes width when it is the stop you are at | `components/selection/RouteStops.jsx`, `LevelSelector.jsx` |
| `.platform-grid`, `.platform-card*` (`__service` in the learner's language, `__stops`, `__pip`) | the platform card | `components/selection/ModeSelector.jsx`, `TierSelector.jsx`, `ThemeSelector.jsx` |
| `.seg--full`, `.console`, `.console__index` | the tier size, the theme filter | `Seg`, `ConsoleIndex` in `components/chrome/Console.jsx` |
| `.stroke-rail*` (`__clip`, `__track`, `__key`, `__key--on`, `__step`), `.radical-page*` (`__grid`, `__grid--labelled`, `[data-fill="short"]`), `.radical-tile*` (`__sub`, `__run`, `--started`), `.dict-mark*` | the radical index as a study source (plan 086) — the dictionary's own, read under the station's `--line-color`, a tile printing the meaning and `learned / total` over the course's kanji. The stroke counts are one line walked by two chevrons or flicked with a thumb (the track scrolls inside `__clip`, which hides the edge a scrollbar would be drawn on), and one page is one grid in one order | `components/dictionary/RadicalIndex.jsx`, `components/selection/RadicalSelector.jsx` |
| `.radical-picker*` (`__grid`, `__cell`, `__cell--on`) | the deck form's radical field: the same `StrokeRail` over one stroke count's glyphs, for filing a personal kanji card under its Kangxi number | `screens/DeckDetailScreen.jsx` on `components/dictionary/RadicalIndex.jsx` |
| `.rad`, `.rad-plate*` (`__glyph`, `__strokes`, `__names`, `__meaning`, `__meta`, `__forms`, `__form`, `__note`, `__pos`, `__fig`), `.rad-family*`, `.rad-kanji*` (`--learning`, `--mastered`) | the radical lesson: the plate with the strokes and the 漢和辞典's first line, the platforms, then the family by level under a `BlockMark`, each kanji a door to its entry | `components/selection/RadicalLesson.jsx` |
| `.deck-card__lead`, `__glyph`, `__due`, `__aside`, `__count` | the shelf's card | `screens/DecksScreen.jsx` |
| `.form`, `.form__label`, `.form__row`, `.type-list`, `.type-row*` | the create form, a card's form | `DecksScreen.jsx`, `screens/DeckDetailScreen.jsx` |
| `.deck-identity*`, `.chip-row*`, `.card-list`, `.card-row*` | the deck page. `.deck-identity` is one row above 560px (roundel, names, the filled action as the right-hand column the density contract asks a wide card for) and three tiers under it (roundel + name, the figures across the whole card, the action under both) — four things in a 334px row left the author's name an 180px column. The tiers are a grid with `display: contents` on `__names`, so the same markup serves both | `DeckDetailScreen.jsx` (the More sheet on `Sheet`), `PublicDeckScreen.jsx` |

The routes: `/learn` (the map), `/learn/<line>` (the station — the SOURCES
on vocab and kanji, which are ordered along more than one axis; the stops
themselves on kana and grammar, which have only the one, exactly as
comprehension has no source page beside reading's), `/learn/<line>/levels`,
`/learn/<line>/tiers`, `/learn/vocab/themes` and `/learn/kanji/radicals?stroke=`
(a source's own list), `/learn/<line>/<stop>`, `/learn/<line>/tier/<n>?size=`,
`/learn/vocab/theme/<key>`, `/learn/kanji/radical/<n>` (the platforms — the
last one a lesson first), and the run on the stage frame
under each of those with `/<mode>` appended; `/learn/decks`, `/learn/decks/<id>`,
`/learn/decks/<id>/study` (the deck's platforms) and `/learn/decks/<id>/study/<mode>`.
A pre-071 deep link (`?set=&mode=`, `?level=&mode=`) on a station goes
straight onto the run when its mode is real.

## What retired with it

`components/selection/platformCount.js` and the station plate the selection
screens hung (`.selection-screen*`, `.selector-header*`, the のりば count and
the clock), `.tier-size-toggle*`, `.level-selector*`, the map's masthead
(`.board__masthead` and its names, `.board__now`, `.board__label*`), its
practice and facility registers (`.wmap__caption*`, `.wmap__facilities`,
`.fac-chip*`), the 線 suffix and the 番線 caption (Japanese is content), the
shelf's console and create card (`.decks-console*`, `.decks-filter-*`,
`.decks-index-bar*`, `.decks-create-*`, `.decks-type-*`), the deck card's
action row and delete affordance (`.deck-card__actions`, `__act`, `__delete`,
`__confirm-q`), and the deck page's header, toolbar and entry list
(`.deckdetail-identity*`, `.deckdetail-header`, `.deckdetail-actions*`,
`.deckdetail-list`, `.deckdetail-card-row*`, `.deckdetail-entry*`,
`.deckdetail-checkbox*`, `.deckdetail-edit-btn*`, `.deckdetail-source-badge`).

## What retired with the run (plan 070)

`components/station/HallPass.jsx` (the whole CommuterPass under the gate;
the strip replaces it), the Today picker (`.today-picker*`,
`.today-lane-row*` — the lanes on the gate are the picker), the read-only
`.gate-lane*` rows, the gate's bilingual name and its 内訳 disclosure,
`.review-deck__nav`, and `.btn-depart__latin`.

## What retired with the chrome (plan 068)

`components/ui/TopBar.jsx` (the in-car display, its auto-hide and peek tab,
the desktop profile ring, the phone level bar), `components/ui/BurgerMenu.jsx`
(the drawer as a network map, the pass stub), `screens/HomeScreen.jsx` (the
gate hall: concourse, IC card, notice strip — the map moved to
`screens/LearnScreen.jsx`, the gate card waits for plan 070), and
`config/navLinks.js` (now `config/tabs.js`). Their CSS blocks and their
entries in `.stylelint-baseline.json` went in the same commit.

## The boarding and the sign-in (plan 075)

| Canvas class | `index.css` block | Component |
|---|---|---|
| `.brd` (`--welcome`), `.brd__head`, `.brd__back` (`--void`), `.brd__track`, `.brd__done`, `.brd__train`, `.brd__count`, `.brd__body` (`--top`, `--arrival`, `--center`), `.brd__stage`, `.brd__q` (`.brd__q-em` for the canvas's `b`), `.brd__hint`, `.brd__error`, `.brd__foot`, `.brd__link`; `.brd__cars`, `.brd__car` (`--in`, `--out`, `[data-dir]`); `.brd__air` (not the canvas's: the air under a question, drawn as a spacer so it can give way — see below) | 乗車 — the frame and the train pull | `screens/BoardingFlow.jsx` (the state machine), `BoardHead`, `BoardQuestion`, `BoardAir`, `Continue`, `BoardLink` in `components/boarding/BoardFrame.jsx` |
| `.brd-hero`, `.brd-roll` (`__lane`, `--back`), `.brd-demo` (`__tag`, `__glyph`, `__t` `--sm`/`--cap`/`--latin`, `.cloze`, `__meaning`, `__foot`, `__draw`, `__wave`, `__bar`), `.brd-tagline` | Welcome: the sign, the rolling stock, the promise | `components/boarding/Welcome.jsx`, the cards in `demoCards.js` |
| `.brd-field` (`--empty`) | the name | `NameStep.jsx` |
| `.brd__opts`, `.brd-opt` (`--on`, `__icon`, `__code`, `__names`, `__label`, `__desc`, `__check`), `.brd-tag` | one row, one choice: why, the level, the goal | `BoardOption.jsx`, `WhyStep.jsx`, `LevelStep`/`GoalStep` in `LevelStep.jsx`, the motive glyphs in `icons.jsx` |
| `.brd-kana` (`__pane`, `__jp`, `__read` `--second`, `__romaji`, `__en`, `__script`), `.brd-grid`, `.brd-kopt` (`--on`, `__label`, `__jp`) | the kana check and the reveal | `KanaStep`/`KanaReveal` in `KanaStep.jsx` |
| `.brd-grid` (`--3`), `.brd-cell` (`--on`, `--sm`, `__n`, `__u`, `__sub`, `__label`, `__time`) | the rhythm and the hours | `RhythmStep.jsx`, `TimeStep.jsx` |
| `.brd-board` (`__cap`, `__flaps`, `__colon`), `.brd-flap` (`--turn`; the canvas's `.flap`, drawn at rest — the rewards' `.flap` is the animated instrument), `.brd-day` (`__rail`, `__done`, `__tick` `--first`/`--last`, `__train` as `role="slider"`) | the departure board and the day track | `TimeStep.jsx` |
| `.brd-notif` (`__app`, `__body`, `__head`, `__title`, `__text`) | the nudge (native shells only, `lib/platform.js`); the next reminder as it will read (plan 156) | `NudgeStep.jsx`, `settings/NotificationsPage.jsx` |
| `.brd-build__track` (`__done`, `__train`), `.brd-steps`, `.brd-step` (`--done`, `--now`, `--next`, `__mark`, `__label`, `__val`) | building the journey | `Building.jsx`; the 到着 signboard over the plan is `components/onboarding/TrainArrival.jsx` |
| `.brd-chart` (`__title`, `__grid`, `__axis`, `__lbl` `--soft`, `__line` `--us`/`--them`, `__dot`, `__cap`), `.brd-legend` (`__key`, `__swatch` `--them`), `.brd-lead` (`.brd-lead__em`), `.brd-bullets`, `.brd-bullet` | the plan | `PlanStep.jsx`, the figures from `domain/boarding.js` |
| `.brd-offer` (the centred title block only), `.brd-issue` (`__seal`), the `.pass` with `.balance-line` on its foot | the pass, issued | `PassStep.jsx` over `components/profile/CommuterPass.jsx` |
| `.auth`, `.auth__head`, `.auth-header` (`__glyph`, `__title`), `.auth-card` with a `Seg` (`.seg--full`) and `.field`s, `.auth-message` (`--error`, `--success`), `.auth-submit`, `.auth-foot` | the sign-in | `screens/AuthScreen.jsx` |

Pre-auth and pre-onboarding, no router: `App.jsx` mounts Welcome for a
signed-out visitor (Board → the sign-in on Sign up, "Have an account?" →
Login), and the boarding for a signed-in one whose profile has no
`onboardedAt`; the TicketGate finale plays over the mounted router as
before. One POST at "Enter the station" — `POST /api/onboarding/complete`,
extended with `motive`, `kanaKnown`, `rhythmMin`, `reminderTime`,
`notifications` and `tzOffsetMin` (backwards compatible) — and the level
rule and the kana door (`study/level_rule.py`, `SRSEngine.seed_known`) mark
the stops behind the level and the scripts already read known. The name is
written when its screen accepts it (`PATCH /api/profile`), so a taken name
is refused there and never on the pass. Held from the canvas: the offer
screen (`.brd-offer__*`, `.brd-perks*`, `.brd-plan*`) waits for a store
(`domain/credits.js` HAS_STORE); the drawn OS prompt (`.brd-dim`,
`.brd-alert*`) is never rendered — the system shows its own; the nudge
screen is skipped on the web; the tutorial is deferred. The motion sheet's
pull, the +120 ms rule and the rest-state-only rule under reduced motion are
pinned in `screens/BoardingFlow.browser.test.jsx`, its `.reduced` twin and
`boarding.phone.test.jsx`.

The canvas is an 844 px artboard and `why`'s six motives fill it exactly, so
its rhythm around a question — `--sp-9 + --sp-8` over it, `--sp-9` under it —
is a **maximum** here, not a fixed pad: both gaps are flex spacers
(`.brd__body::before` and `.brd__air`) that collapse in proportion, down to the
body's own `--sp-5`, before the body will scroll. `--center` bodies are centred
by a pair of grow-only spacers for the same reason — a centred flex line that
outgrows its box spills off both ends and no scroll reaches back over the top
of it. Pinned in `boarding.phone.test.jsx`, which shortens the frame to the
phones the artboard is not. (Plan 167 retired this rhythm: see below.)

## The boarding drawn as maps (plan 167)

The owner's pick A of the canvas "Onboarding on the phone", built as drawn;
the desk keeps plan 163's drawings. The frame never moves -- ‹ and the track
at the head, the question a rung under it at the top-left, the gate docked
at the foot -- and each question's drawing stands on auto margins in the
room between (`.brd__body > .brd__stage`). A drawing is laid on the canvas's
358px stage: `.brd-map` is as tall as its `--h` (times `--ys`, 0.86 on a
frame under 740px), a point is `--x` across as a share of the stage and
`--y` down in px, each a plain number set by its component, the lines an
SVG stretched over the stage with their strokes kept at their width.

| Class | Drawing | Component |
|---|---|---|
| `.brd` (`--arrival`: no head), `.brd__stop` (`--passed`, `--here`), `.brd-map` (`__lines`, `__at` `--start`/`--corner`/`--top`), `.brd-road` (`--on`), `.brd-hub` (`--sm`, `--md`) | the frame, the track, the map, a question's hub | `screens/BoardingFlow.jsx`, `BoardFrame.jsx` |
| `.brd-front` (`--auth`, `__head`, `__door`, `__door-btn`, `__promise`, `__map`, `__roads`, `__road`, `__way`, `__stn` `--over`/`--under`, `__sign`, `__name`, `__hub`, `__foot`), `.brd-tagline`; `.brd-signin` (`__stage`, `__road`, `__map`, `__sign`, `__hub`, `__form`, `__card`, `__go`) | the Welcome as the crossroads; the sign-in in the promise's place | `Welcome.jsx`'s `PhoneWelcome`, `FrontMap`, `PhoneSignIn` over `AuthCard`'s `frame` |
| `.brd-name` (`__line`, `__pole`, `__hub`, `__road`, `__next`, `__ring`, `__lab`), `.brd-plate` (`__field`, `__count`, `__stripe`) | the name: the station's plate on its pole | `NameStep.jsx` |
| `.brd-junction`, `.brd-way` (`__ring`, `__name`) | why: six reasons off one trunk | `WhyStep.jsx`'s `Junction` |
| `.brd-cross` (`__words`, `__ans`, `__chips`, `__chip` `--not`, `__label`, `__jp`, `__sub`) | the kana: two words at a crossing, an answer at each end | `KanaStep.jsx`'s `Crossing` |
| `.brd-read` (`__line`, `__head`, `__word`, `__script`, `__glyph`, `__sign`, `__sign-jp`, `__sound`, `__means`, `__cap`, `__word-fr`), `.brd-first` (`__ring`, `__txt`) | the reveal: each word read as a line, the first stop | `KanaStep.jsx`'s `ReadLines` |
| `.brd-climb` (`__rails`, `__rail` `--ink`, `__hub`), `.brd-stn` (`--known`, `--ride`, `--on`, `__ring` `--jp`, `__lab`, `__name`, `__desc`, `__note`, `__tag`) | the level and the goal: the line climbing | `LevelStep.jsx`'s `Climb` |
| `.brd-fan` (`__trunk`, `__road` `--off` with `[data-road]`, `__kana`, `__ticket`), `.brd-lcard` (`__chk`, `__ring`, `__name`, `__desc`, `__vol`, `__fig`, `__unit`), `.brd-arrive` (`--none`) | the lines: the kana into the hub, three lines out | `LinesStep.jsx`'s `LineFan` |
| `.brd-trains` (`__cols`, `__head`, `__first`), `.brd-train` (`__svc`, `__jp`, `__name`, `__tag`, `__min`, `__fig`, `__new`, `__arr`, `__date`, `__days`) | the rhythm: four trains on the departure board | `RhythmStep.jsx`'s `DepartureBoard` |
| `.brd-clock` on `.brd-board` (`__steps`, `__step`, `__when`), `.brd-hours`, `.brd-hour` (`__jp`, `__name`, `__time`) | the hour: the flap board turned by hand | `TimeStep.jsx`'s `HourBoard` |
| `.brd-nudge`, `.brd-notif` (`__name`), `.brd-week` (`__drop`, `__road`, `__day` `--first`, `__bell`, `__cap`, `__name`, `__date`) | the nudge: the notification and the week it arrives in | `NudgeStep.jsx`'s `Week` |
| `.brd-plan` (`__arrive`, `__cap`, `__date`, `__day`, `__year`, `__sub`), `.brd-ride` (`__line`, `__stop`, `__lab`), `.brd-held` (`__cell`, `__jp`, `__fig`, `__unit`), `.brd-for` | the plan: the arrival first, the ride, what it holds | `PlanStep.jsx`'s `Arrival` |
| `.brd-keep` (`__skip`, `__note`, `__skip-btn`), `.brd-tk` (`__map`, `__ride`, `__stop`, `__ring`, `__terms`, `__stub`, `__credits`, `__punch`), `.brd-provider`, `.brd-fld` | the account: the ticket it keeps over the form | `AccountStep.jsx`, `PaperTicket.jsx`'s `RideTicket` |
| `.brd-issue-stn`, `.brd-issue__road`, `.brd__foot--road` | the pass over the gate's reader | `PassStep.jsx` |

Building is gone on the phone as on the desk: the hour (or the nudge) goes
on to the plan under its 案内 signboard, and the reveal is the kana stop's
second half on the track. Pinned in `boarding.phone.test.jsx` (the frame,
the junction, the crossing, the boards, the crossroads and the sign-in),
`BoardingFlow.browser.test.jsx` (the walk and its stops),
`BoardingFlow.touch.test.jsx` (every question at 390x667 without a scroll),
`Welcome.browser.test.jsx` and the contrast guard's boarding sites.

Retired with it: `screens/AuthScreen.jsx` (`.auth`, `.auth__head`,
`.auth-header*`), `Building.jsx` (`.brd-build*`, `.brd-steps`, `.brd-step*`),
`demoCards.js` and the rolling stock (`.brd-hero`, `.brd-roll*`,
`.brd-demo*`), `BoardOption` (`.brd__opts`, `.brd-opt*`), `BoardAir`
(`.brd__air`), the kana card (`.brd-kana*`), the day track (`.brd-day*`),
the chart (`.brd-chart*`, `.brd-legend*`, `.brd-lead*`, `.brd-bullet*`) and
their locale keys.

## What retired with the plan 075 boarding

`screens/OnboardingFlow.jsx` (the ticket office and its five scenes),
`screens/LandingScreen.jsx` (`.landing*`), `components/onboarding/FirstRide.jsx`,
`DepartureBoard.jsx`, `CallingAt.jsx`, `DepartureChips.jsx` and `levelSigns.js`,
the old `.auth*` block (the mode toggle, the back button, the fields
wrapper), the whole `.onb-*` block except what Settings and the boarding
still use (the dial, `.onb-test*`, `.onb-action`/`.onb-link`/
`.onb-step__actions`, `.onb-reco-badge`, `.onb-arrival*`, `.onb-preview*`),
the `landing*` and unused `onb*` locale keys, and `config/tabs.js`'s
`getShowcase`. Their baseline entries went in the same commit.

## The library (`.lib-*`, plans 079-083)

Decks other learners published. Not on the canvas — it postdates it — so this
is the class map rather than a port note.

| Class | Where | What |
|---|---|---|
| `.lib-shelf` | `components/decks/LibraryShelf.jsx` | The block under 教材's own grid on `/learn/decks`. Prints nothing at all while the library is empty |
| `.lib-shelf__more` | both shelves | "See all" / "Show more" — a quiet full-width row, not a `.btn-secondary`: this is navigation, not an action on the screen's object |
| `.lib-card` + `__author` `__blurb` `__follows` | `components/decks/LibraryCard.jsx` | A published deck. It wears `.platform-card .deck-card` and adds only the two figures a public deck has that a private one does not |
| `.lib-controls` `__count` | `screens/LibraryScreen.jsx` | The ordering (a `Seg`, not chips) and the tally. **Not a `Console`** — a console's second row is a search field, and there is nothing to search here yet |
| `.lib-blurb` `.lib-note` | `screens/PublicDeckScreen.jsx` | The author's description, and the quiet line under a block — the count of the cards the preview left out, and the report sheet's own note |
| `.lib-warning` `__lead` | `screens/DeckDetailScreen.jsx` | Warn, then vanish: the author has deleted this deck. A state colour on a left rule, never a fill |
| `.lib-preview` | `screens/PublicDeckScreen.jsx` | The read-only card list and its tally, as one block: the rows are plain `.card-row` + `.card-row__body` (a span, so no pointer and no hover ground), and the `.lib-note` counting what was left out is the list's caption at `--sp-2`, not a third object at the page's own gap. The report under it is a plain `.chip-row` with a `.chip--danger` |

Two things worth knowing before touching it:

- **The heading is "Library", with no Japanese pair.** Owner-directed, recorded
  in `DESIGN.md` beside the analyzer's Latin-first exception. The 蘇芳
  `--line-decks` pigment stays — a line colour is not a name.
- **The library needs no registry entry.** `config/stations.js`'s
  `stationFor()` falls back to the longest matching prefix, so
  `/learn/decks/library` already inherits 教材's KZ roundel, きょうざい and its
  pigment. It is a place under the deck station, not a twelfth line.

Pinned by `LibraryCard.phone.test.jsx` (390 px: no overflow, one thumb target,
the description clamped and measured), `LibraryScreen.browser.test.jsx` and
`DeckDetailScreen.roles.browser.test.jsx`.

## Still to port

`.offer*`, `.pass-tag`, `.brd-offer__*`, `.brd-perks*`, `.brd-plan*` (with the
store). Reading the canvas: `Artifact` `read` on its URL saves the page; the
design lives in `<script id="appifact-doc">` as JSON — `content.files` holds
one `*.dc.html` per artboard plus `canvas.json`; the common prefix of the
artboard files is this stylesheet.


## The first ride and the guide (plans 097–100)

| Canvas class | `index.css` block | Component |
|---|---|---|
| `.ride`, `.ride--reading` on `.stage` | 試乗 — the two rides, on the stage frame like any run; the head's ‹ is Skip | `screens/RideRun.jsx`, `screens/RideReading.jsx` (dev workbench `/dev/ride`, `screens/RidePreview.jsx`) |
| `.ride__done`, `.ride__done-jp`, `.ride__done-text`, `.ride__done-note`, `.ride__done-air`, `.ride__done-foot` | the done screen: the call, the sentence, two grow-only spacers, the one filled action on the floor | `RideRun.jsx` |
| `.ride__plate`, `.ride__plate-cap`, `.ride__plate-list`, `.ride__plate-item`, `.ride__plate-icon`, `.ride__plate-title` | the pass plate: the platforms on the pass from `domain/paywall.PASS_PLATFORMS`, the quiet offer over "Enter the station" | `RideReading.jsx` |
| `.guide-callout`, `.guide-callout--live`, `.guide-callout__jp`, `.guide-callout__text`, `.guide-callout__foot`, `.guide-callout__count`, `.guide-callout__skip`, `.guide-callout__next` | 案内 — the note: the panel ink, one sentence, the pair as caption; `--live` carries controls and takes pointer events | `components/guide/Callout.jsx` (the rides), `components/guide/Guide.jsx` (the guide) |
| `.guide`, `.guide__spot` (`--pill`, `--flat`, `--plate`, `--card`, `--identity`) | the spot whose shadow is the scrim, wearing the anchor's own corner | `components/guide/Guide.jsx`; the stops in `components/guide/guides.js`; the trigger in `hooks/useGuide.js` |
| `[data-guide="…"]` | not a class: the anchor an element wears for the guide (`guide` prop on `Plate`, `StopsFoot`, `Console`, `Chips`, `CardTransition`, `RatingBar`; the attribute directly on the HUD, the tab bar, the gate card, the strip, the pass, the stamp book, the records, the ledger and the settings door) | the chrome and the five gates |
| `.furigana-word` (fitted, `--len`) | the ruby word wears `CharDisplay`'s fitted clamp since plan 098 | `components/study/Readings.jsx` |
| `.lane__new` | the day's ration in a lane, apart from what it owes (the queue carries the pace's new cards since 2026-09-21) | `components/station/GateCard.jsx` |
