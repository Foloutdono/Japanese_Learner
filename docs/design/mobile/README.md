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
language; Japanese is content** (a word, a sentence, a deck's name, a rank)
and the tab bar's icons. The bilingual JP + Latin pairing the desktop chrome
used retires for the mobile chrome.

## The backbone (plan 068)

| Canvas class | `index.css` block | Component |
|---|---|---|
| `.phone`, `.phone__content` | 車内 — the mobile chrome | `components/chrome/Shell.jsx` (`Shell`, `StageFrame`) |
| `.hud`, `.hud__level`, `.hud__status*`, `.hud__pass*`, `.hud-fare` | 運行案内 — the HUD | `components/chrome/Hud.jsx` (`Hud`, `HudPass`, `useXpGain`, `FareFigure`) |
| `.tabbar`, `.tab`, `.tab__jp`, `.tab__cap`, `.tab__due`, `.tab--on`, `.tab--badged` | 改札口 — the tab bar | `components/chrome/TabBar.jsx`; the five gates in `config/tabs.js` |
| `.bar`, `.bar__row`, `.bar__roundel`, `.bar__names`, `.bar__title`, `.bar__sub`, `.bar__aside`, `.bar__stripe`, `.bar--register` | the compact header | `components/chrome/Bar.jsx` (`Bar`; `ScreenBar` is the transitional adapter for screens plans 070–074 have not rebuilt) |
| `.stage__head`, `.stage__leave`, `.stage__where*`, `.today-remaining` | the head of a run | `components/chrome/StageHead.jsx`, `Leave` in `Bar.jsx` |
| `.scrim`, `.sheet`, `.sheet--sumi`, `.sheet__handle`, `.sheet__head`, `.sheet__jp`, `.sheet__cap` | bottom sheets | `components/chrome/Sheet.jsx` (modal behaviour from `hooks/useDialog`) |
| `.console`, `.console__top`, `.console__chips`, `.console__action`, `.console__index`, `.console__field`, `.console__clear`, `.console__count` | the console | `components/chrome/Console.jsx` (`Console`, `ConsoleTop`, `Chips`, `ConsoleAction`, `ConsoleIndex`) |
| `.chip`, `.chip--on`, `.chip__glyph`, `.chip-row` | chips | `Chip` in `Console.jsx` |
| `.seg`, `.seg__opt`, `.seg__opt--on`, `.seg__opt-jp`, `.seg__opt-latin`, `.seg--full`, `.seg--kaiseki` | the segmented control | `Seg` in `Console.jsx` (the profile's 番付 already drew `.seg`) |
| `.loading`, `.loading__dot`, `.empty*` | 待合 / 空 (plan 067) | `components/ui/Loading.jsx`, `components/ui/Empty.jsx` |
| `.platform-card--line`, `.platform-card__title-jp` | the platform card | `screens/PracticeScreen.jsx` |

Tokens minted for the chrome: `--hud-h` (48px, the HUD's own height —
it was the retired phone level bar's 36px), `--tabbar-h` (50px), and
`--dock-bottom`, which every docked object reads: the tab bar plus the
safe-area inset under the shell (`:root[data-chrome="shell"]`, stamped by
`components/chrome/useChrome.js`), the inset alone on a stage.

## The run (plan 070)

| Canvas class | `index.css` block | Component |
|---|---|---|
| `.stage` (the frame), `.stage__foot` | the study stage — the ≤768px block docks the rating bar and grows the card | `components/study/StudyStage.jsx`; the six study screens render inside it |
| `.stage__head`, `.stage__leave`, `.stage__where*`, `.today-remaining`, `.stage__head .hud__pass` | the head of a run | `components/chrome/StageHead.jsx` |
| `.deck-progress`, `.deck-progress__bar`, `.deck-progress__segment` | the hairline (the legend hides on a phone) | `DeckProgress` in `components/study/QuizComponents.jsx`; the run's own bar in `screens/TodayRun.jsx` |
| `.study-assist`, `.study-assist__toggle`, `--on` | the assist toggles | `components/study/HintBar.jsx` |
| `.prompt-card`, `.prompt-card__body`, `.prompt-card__foot`, `.stage-mark*`, `.char-display*`, `.flashcard*` | the card | `components/study/PromptCard.jsx`, `CardPrompt.jsx`, `StageMark.jsx`, `QuizComponents.jsx` |
| `.mcq-list`, `.mcq-row*` | the choices | `MCQGrid` in `QuizComponents.jsx` |
| `.rating-bar*` | the docked rating bar | `components/study/RatingBar.jsx` |
| `.draw-prompt`, `.canvas-wrap`, `.canvas-clear-btn` | the draw face | `components/study/DrawingCanvas.jsx` |
| `.readings-input*` | the readings face | `components/study/ReadingsInput.jsx` |
| `.browse-nav` | the fast review's foot | `components/study/ReviewDeck.jsx` |
| `.levelup*`, `.reissue*`, `.card-stamp*` | the boards over the stage | `components/rewards/XpToast.jsx`, `components/study/CardStamp.jsx` |
| `.gate-card`, `.gate-card__head`, `.gate-card__title`, `.gate-card__figure`, `.gate-card__count`, `.gate-card__unit`, `.gate-card__lanes`, `.gate-card__pick`, `.gate-card__fare*`, `.gate-card__short*`, `.btn-depart`, `.btn-depart--ghost` | 改札 — the fare gate | `components/station/GateCard.jsx` |
| `.lane`, `.lane--off`, `.lane__tick`, `.lane__where`, `.lane__mode`, `.lane__due` | the lanes are the picker | `GateCard.jsx` |
| `.pass--strip` (with `.stamp-rally*`, `.hall-pace*`) | the strip under the gate | `components/station/PassStrip.jsx` |
| `.today-clear*`, `.fare-slip*` | the finish | `RunComplete` in `screens/TodayScreen.jsx`, `components/credits/FareSlip.jsx` |
| `.balance*` | the balance sheet (plan 069) | `components/credits/BalanceSheet.jsx`, `RunOutSheet.jsx` |

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
| `.bar--register`, `.platform-card--line` | the hub | `screens/PracticeScreen.jsx` (plan 068) |
| `.timer`, `.timer__bar`, `.timer__fill` (`--low`), `.timer__label` | the practice sessions | `screens/ReadingScreen.jsx`, `screens/ReadingComprehensionScreen.jsx` |
| `.sentence`, `.sentence--left`, `.sentence--covered` | the card's one line | `ReadingScreen.jsx` |
| `.prose`, `.prose__label`, `.prose__en` (`--lead`), `.prose__jp` (`--passage`), `.prose__romaji`, `.prose__ai`, `.prose__rule`, `.prose__verdict` (`--ok`, `--x`), `.prose__breakdown` | the card as a page — `PromptCard`'s `prose` prop puts it on `.prompt-card__body` (`.prompt-card__body--prose`) | `ReadingScreen.jsx`, `screens/TranslationScreen.jsx`, `ReadingComprehensionScreen.jsx` |
| `.prompt-card--ask` | a flat, left-aligned question card | `ReadingComprehensionScreen.jsx`, `screens/ExamRunner.jsx` (with `.exam-card`) |
| `.type-badge` | the outlined caption pill (its type's colour as a tint) | `QuestionTypeBadge` in `components/study/QuizComponents.jsx` |
| `.mcq-list`, `.mcq-row` (`--selected`, `--correct`, `--wrong`, `--filler`), `.mcq-row__index` (A–D), `.mcq-row__text--latin` | the choices | `ReadingComprehensionScreen.jsx`; the exam's rows are `exam/QuestionRenderer.jsx` |
| `.stage__foot` (a `<form>` with `.field` + `.btn-primary`), `.btn-row` | the field and the action docked in the foot; two actions side by side | the three sessions, `screens/ExamResult.jsx` |
| `.result-lattice` (of `.record`s), `.surface`, `.qrows`, `.qrow-item`, `.qrow`, `.qrow__q`, `.qrow__note`, `.qrow__detail` | the comprehension result | `ReadingComprehensionScreen.jsx` |
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
way back in its aside — the way every station does since plan 071. The
sessions and the exam runner render on `StudyStage` / the stage frame with
`‹ Practice` (`‹ Exam`) as the way out and no pocket pass: practice spends
no credits. The reading and translation tier step is the vocab station's
tiers page (a `Seg` for the word list over `TierSelector`), and the batch
carries the chosen `tier_size`. The comprehension exercise commits a pick
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
| `.console` + `.chip` (a chip per collection in its line colour, the radical index as a sixth chip under kanji), `.console__index` with the count (the dots while it loads) | the console | `DictionaryScreen.jsx` on `components/chrome/Console.jsx` |
| `.dict-grid`, `.dict-entry-card` (`--selected`, `__kana`, `__char`, `__meaning`), `.dict-level-badge`, `.stage-mark` | the catalogue | `ResultsSection` in `DictionaryScreen.jsx`; `LevelBadge` in `components/dictionary/DictionaryDetail.jsx` |
| `.dict-entry`, `.dict-plate*`, `.dict-kind`, `.dict-block*`, `.dict-sense*`, `.dict-tag*`, `.dict-ex*`, `.dict-form*`, `.dict-word*`, `.dict-readings*`, `.dict-register*`, `.dict-reading*`, `.dict-sheet` (the readings sheet and the lookup sheet), `.record` | the entry plate and its body. Since `main`'s dictionary-detail redesign (PRs 21 and 22) was merged into this wave on 2026-09-07, that implementation owns the entry: the same canvas plate, with the readings in two registers, the backend's `study/kanji_words.py` grouping and its own 745-line suite. Plan 073's twin of it retired in the merge; the catalogue, the console and the analyzer above and below are plan 073's | `components/dictionary/DictionaryDetail.jsx` (`DictionaryDetail`, `DictionaryLookupSheet`) |
| `.seg--full.seg--kaiseki` (`.anl-sources`), `.anl-panel` (`__lead`), `.anl-resume` | the three intakes | `screens/AnalyzerScreen.jsx` on `Seg` |
| `.textarea`, `.anl-slip` (`__field`, `__count`), `.field--filled`, `.anl-action` | the writing slip | `components/analysis/WritingSlip.jsx` |
| `.intake-pair`, `.intake-btn` | Shoot / Choose | `components/analysis/ImageInput.jsx` |
| `.head2` (`__latin`, `__count`), `.anl-history`, `.anl-hist-list`, `.anl-hist-row`, `.anl-hist` (`__n`, `__body`, `__jp`, `__meta`, `__count`, `__when`, `__go`, `__delete`), `.anl-kept`, `.anl-undo*` | History | `components/analysis/AnalyzerHistory.jsx` |
| `.stage__head.anl-head` (`.stage__where-jp`, `.anl-kept`), `.anl-clear` | the result's head: ‹ Analyzer, the first sentence, the count | `AnalyzerScreen.jsx` |
| `.anl-stepper` (`__btn`, `__count`, `__i1`), `.anl-stops`, `.anl-stops__dot` (`--on`) | the stepper | `AnalyzerScreen.jsx` |
| `.anl-stagebd` (`__card`), `.tok-line`, `.tok` (`--on`, `--mastered`, `--learning`, `--unknown`, `--offdeck`, `--particle`, `__furi`, `__word`), `.anl-stage[data-furigana]`, `.anl-legend` (`__item`, `__ink--*`) | the line and its legend | `components/analysis/SentenceBreakdown.jsx` (`layout="stage"`) |
| `.token-card` (`--i1`, `__head`, `__surface` (`--door`), `__reading`, `__pos`, `__gloss`, `__i1`, `__foot`, `__kanji`, `__k`) | the token card | `components/analysis/StageCard.jsx` (`MineButton` as the `.btn-primary`) |
| `.anl-dials`, `.anl-dial` (`__cap`) + `.seg` | the furigana and view dials | `AnalyzerScreen.jsx` |
| `.anl-explainbox`, `.anl-explain__body`, `.anl-explain` | Explain this sentence | `AnalyzerScreen.jsx` |
| `.picker`, `.picker-row` (`--current`, `--new`, `--create`, `__roundel`, `__name`, `__count`, `__mark`, `__create`) | the deck picker sheet | `components/analysis/DeckPicker.jsx` on `Sheet` |
| `.word-detail*` | the word's own sheet (the record and the deck action) | `components/analysis/WordDetail.jsx` on `Sheet` |

The routes: `/dictionary` and `/dictionary/analyzer`, both under the shell.
The analyzer's result renders on its own page under the `‹ Analyzer` head
rather than on the stage frame, so the working rail (search, the stop
filter, the line) stays beside it on a wide screen (`.anl-railcol` moves
before the stage at ≥1100px). Held from the canvas: the pass tag on the
door (plan 069, `HAS_STORE`), the photo frame and the video section (the
existing intakes keep their cropper and their subtitle grab), and the
entry as a sheet — `.dict-dock` keeps its split at ≥1100px inside the
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

## Profile, statistics and settings (plan 074)

| Canvas class | `index.css` block | Component |
|---|---|---|
| `.pass` (the existing block), `.pass__ring-track`, `.pass__ring-fill`, `.jour-line` as the balance line (`.balance-line`, `__refill`) | the pass, the balance on its footer | `components/profile/CommuterPass.jsx`, `PassHolder.jsx`, `components/credits/BalanceLine.jsx` |
| `.sbook` (`__month`, `__title`, `__dows`, `__dow`, `__grid`, `__stamp` `--missed`/`--today`/`--future`, `__side`, `__figs`), `.fig` (`__v`, `__u`, `__l`) | the stamp book | `StampBook` in `components/profile/ProfileBlocks.jsx` |
| `.records`, `.record` (`--door`, `__note`), `.pf-line__id` (`__roundel` `--icon`, `__names`, `__jp`) | the records and the two doors | `Records` in `ProfileBlocks.jsx`, `LineMark` in `LineLedger.jsx` |
| `.pf-ledger`, `.pf-line` (`__fig`, `__of`, `__track`, `__done`) | the ride ledger | `components/profile/LineLedger.jsx` |
| `.banzuke`, `.bz__head`, `.bz__mark`, `.bz__jp`, `.bz__seg` (a `Seg`), `.leaderboard-row` (`--me`, `__rank` `--gold`/`--silver`/`--bronze`, `__name`, `__xp`, `__gap`) | the ranking | `components/profile/Banzuke.jsx` |
| `.sheet--sumi.status-sheet` + `.jour-st--*`, `.hud__status` (the chip), `.jour-track*`, `.jour-figs`, `.jour-fig` (`__v` `--st`, `__u`, `__l`), `.jour-rev__actions`, `.jour-act`, `.status-sheet__none`, `__office`, `__error` | the status sheet, off the HUD's station panel | `components/journey/StatusSheet.jsx` (`StatusChip` from `components/chrome/Hud.jsx`, `GhostTrack.jsx`; the open state in `stores/journey.js`) |
| `.bar` + `.stage__leave`, `.records--stats` (six `.record`s with `__note`s) | the statistics head and lattice | `screens/StatsScreen.jsx` |
| `.stat-cap` (`__fig`), `.cal.cal--gold` (`__months`, `__month`, `__grid`, `__cell` `--1`…`--4`/`--future`, `__foot`, `__scale`) | the practice calendar (fourteen weeks, whole) | `components/stats/PracticeCalendar.jsx` |
| `.forecast.forecast--pass` (`__bars`, `__col`, `__v`, `__bar`, `__days`) | the week's forecast | `components/stats/Forecast.jsx` |
| `.stg-headrow`, `.stg-head` (`__jp`), `.stg-list`, `.stg-row` (`__names`, `__jp`, `__value`, `__chev`), `.stg-signout` | the settings list | `screens/SettingsScreen.jsx` |
| `.slip` (`__label`, `__name`, `__hint`, `__act`, `__value`, `__confirm`), `.cap` | a page's slips | `SettingsPage`, `Slip` in `components/settings/SettingsPage.jsx` |
| `.svc-grid` (`--2`), `.svc` (`--on`, `__jp`, `__pace`, `__star`, `__words`), `.grades`, `.hour-grid` | the service cards: theme, language, presets and mute, pace, grades, the daily hour | `components/settings/DisplayPage.jsx`, `SoundPage.jsx`, `LearningPage.jsx`, `DestinationPage.jsx` |
| `.lvlstrip` (`__stop` `--on`, `__dot`, `__code`, `__jp`), `.lvl-note` (`__strong`) | the level strip and its note | `LearningPage.jsx` |
| `.sheet.lvl-sheet`, `.lvl-sheet__body` (`__strong`), `__figs`, `__fig` (`-v`, `-l`), `.btn-depart--sheet` | the level confirm sheets (Move up / Move down) | `LevelSheet` in `LearningPage.jsx` |
| `.onb-dests` → `.dest-grid`, `.onb-dest` → `.dest` (`--on`, `__code`, `__load`); `.jour-line.dest-line` (`__date`, `__note`), `.form__row` | Destination: the stops ahead, the pass line on paper, Hand it back / Reprint | `DestinationPage.jsx` (renamed while the old boarding's `.onb-dest` block still stood; it retired with plan 075) |

The routes: `/profile` (the pass and its inserts, no bar), `/profile/stats`
(the bar with ‹ Profile), `/profile/settings` (the list) and
`/profile/settings/<display|sound|learning|destination|data|account>`. The
HUD's station panel opens the status sheet from every screen; the pass no
longer flips. The level rule (the canvas's note): choosing a level in
Settings › Learning previews the move on a sheet (`GET
/api/profile/learning/preview`) and the write (`PATCH /api/profile/learning`)
marks the stops behind a raised level known — `study/level_rule.py`,
`SRSEngine.seed_known` — while a lowered level holds the stops above back
from the run (`daily_queue.hold_above`) and deletes nothing. Held from the
canvas: the explorer and the trouble list stay under the statistics'
forecast (the canvas does not draw them and they carry the doors to a
review), the theme is offered as three service cards (the canvas names the
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
| `.board`, `.wmap__lines`, `.wmap-line*`, `.wmap-track*`, `.wmap-due*`, `.wmap__group`, `.wmap-row*`, `.wmap-roundel` | 路線図 — the wall map (no masthead: the bar names the place) | `components/station/WallMap.jsx`, `screens/LearnScreen.jsx` |
| `.bar__link` | a text link in the bar's aside (By frequency, JLPT instead) | the station screens |
| `.route`, `.route-stop*` (`--past`, `--current`, `__rail`, `__marker`, `__code`, `__names`, `__jp`, `__hint`, `__here`, `__fig`, `__go`) | 路線図 — the route diagram | `components/selection/RouteStops.jsx`, `LevelSelector.jsx` |
| `.platform-grid`, `.platform-card*` (`__service` in the learner's language, `__stops`, `__pip`) | the platform card | `components/selection/ModeSelector.jsx`, `TierSelector.jsx`, `ThemeSelector.jsx` |
| `.seg--full`, `.console`, `.console__index` | the tier size, the theme filter | `Seg`, `ConsoleIndex` in `components/chrome/Console.jsx` |
| `.deck-card__lead`, `__glyph`, `__due`, `__aside`, `__count` | the shelf's card | `screens/DecksScreen.jsx` |
| `.form`, `.form__label`, `.form__row`, `.type-list`, `.type-row*` | the create form, a card's form | `DecksScreen.jsx`, `screens/DeckDetailScreen.jsx` |
| `.deck-identity*`, `.chip-row*`, `.card-list`, `.card-row*` | the deck page | `DeckDetailScreen.jsx` (the More sheet on `Sheet`) |

The routes: `/learn` (the map), `/learn/<line>` (the station — a line's
stops, or the kana sets), `/learn/<line>/tiers` and `/learn/vocab/themes`
(the other ways in), `/learn/<line>/<stop>`, `/learn/<line>/tier/<n>?size=`,
`/learn/vocab/theme/<key>` (the platforms), and the run on the stage frame
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
| `.brd` (`--welcome`), `.brd__head`, `.brd__back` (`--void`), `.brd__track`, `.brd__done`, `.brd__train`, `.brd__count`, `.brd__body` (`--top`, `--arrival`, `--center`), `.brd__stage`, `.brd__q` (`.brd__q-em` for the canvas's `b`), `.brd__hint`, `.brd__error`, `.brd__foot`, `.brd__link`; `.brd__cars`, `.brd__car` (`--in`, `--out`, `[data-dir]`) | 乗車 — the frame and the train pull | `screens/BoardingFlow.jsx` (the state machine), `BoardHead`, `BoardQuestion`, `Continue`, `BoardLink` in `components/boarding/BoardFrame.jsx` |
| `.brd-hero`, `.brd-roll` (`__lane`, `--back`), `.brd-demo` (`__tag`, `__glyph`, `__t` `--sm`/`--cap`, `.cloze`, `__meaning`, `__foot`, `__draw`, `__wave`, `__bar`), `.brd-tagline` | Welcome: the sign, the rolling stock, the promise | `components/boarding/Welcome.jsx`, the cards in `demoCards.js` |
| `.brd-field` (`--empty`) | the name | `NameStep.jsx` |
| `.brd__opts`, `.brd-opt` (`--on`, `__icon`, `__code`, `__names`, `__label`, `__desc`, `__check`), `.brd-tag` | one row, one choice: why, the level, the goal | `BoardOption.jsx`, `WhyStep.jsx`, `LevelStep`/`GoalStep` in `LevelStep.jsx`, the motive glyphs in `icons.jsx` |
| `.brd-kana` (`__pane`, `__jp`, `__read` `--second`, `__romaji`, `__en`, `__script`), `.brd-grid`, `.brd-kopt` (`--on`, `__label`, `__jp`) | the kana check and the reveal | `KanaStep`/`KanaReveal` in `KanaStep.jsx` |
| `.brd-grid` (`--3`), `.brd-cell` (`--on`, `--sm`, `__n`, `__u`, `__sub`, `__label`, `__time`) | the rhythm and the hours | `RhythmStep.jsx`, `TimeStep.jsx` |
| `.brd-board` (`__cap`, `__flaps`, `__colon`), `.brd-flap` (`--turn`; the canvas's `.flap`, drawn at rest — the rewards' `.flap` is the animated instrument), `.brd-day` (`__rail`, `__done`, `__tick` `--first`/`--last`, `__train` as `role="slider"`) | the departure board and the day track | `TimeStep.jsx` |
| `.brd-notif` (`__app`, `__body`, `__head`, `__title`, `__text`) | the nudge (native shells only, `lib/platform.js`) | `NudgeStep.jsx` |
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

## What retired with it

`screens/OnboardingFlow.jsx` (the ticket office and its five scenes),
`screens/LandingScreen.jsx` (`.landing*`), `components/onboarding/FirstRide.jsx`,
`DepartureBoard.jsx`, `CallingAt.jsx`, `DepartureChips.jsx` and `levelSigns.js`,
the old `.auth*` block (the mode toggle, the back button, the fields
wrapper), the whole `.onb-*` block except what Settings and the boarding
still use (the dial, `.onb-test*`, `.onb-action`/`.onb-link`/
`.onb-step__actions`, `.onb-reco-badge`, `.onb-arrival*`, `.onb-preview*`),
the `landing*` and unused `onb*` locale keys, and `config/tabs.js`'s
`getShowcase`. Their baseline entries went in the same commit.

## Still to port

`.offer*`, `.pass-tag`, `.brd-offer__*`, `.brd-perks*`, `.brd-plan*` (with the
store). Reading the canvas: `Artifact` `read` on its URL saves the page; the
design lives in `<script id="appifact-doc">` as JSON — `content.files` holds
one `*.dc.html` per artboard plus `canvas.json`; the common prefix of the
artboard files is this stylesheet.
