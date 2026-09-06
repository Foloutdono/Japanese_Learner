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
| `.platform-card--line`, `.platform-card__title-jp` | the platform card | `screens/PracticeScreen.jsx` (until plan 072) |

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

## What retired with it

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

## Still to port (plans 071–075)

`.offer*`, `.pass-tag` (with the store); the `.route*` redraw, `.svc*`, `.lvlstrip*`, `.slip*`,
`.stg-head`/`.stg-list`, `.cal*`, `.card-row`, `.deck-identity`, `.type-row`,
`.form`, `.picker-row` (071–074); `.dict-plate`, `.dict-block`, `.dict-word`,
`.tok*`, `.token-card`, `.exam-meta`, `.exam-sheetbar` (072–073); the whole
`.brd-*` boarding (075). Reading the canvas: `Artifact` `read` on its URL
saves the page; the design lives in `<script id="appifact-doc">` as JSON —
`content.files` holds one `*.dc.html` per artboard plus `canvas.json`; the
common prefix of the artboard files is this stylesheet.
