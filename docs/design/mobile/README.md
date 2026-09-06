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

## What retired with it

`components/ui/TopBar.jsx` (the in-car display, its auto-hide and peek tab,
the desktop profile ring, the phone level bar), `components/ui/BurgerMenu.jsx`
(the drawer as a network map, the pass stub), `screens/HomeScreen.jsx` (the
gate hall: concourse, IC card, notice strip — the map moved to
`screens/LearnScreen.jsx`, the gate card waits for plan 070), and
`config/navLinks.js` (now `config/tabs.js`). Their CSS blocks and their
entries in `.stylelint-baseline.json` went in the same commit.

## Still to port (plans 069–075)

`.gate-card__fare`, `.lane*`, `.balance*`, `.offer*`, `.pass-tag`,
`.fare-slip*` (069–070); the `.route*` redraw, `.svc*`, `.lvlstrip*`, `.slip*`,
`.stg-head`/`.stg-list`, `.cal*`, `.card-row`, `.deck-identity`, `.type-row`,
`.form`, `.picker-row` (071–074); `.dict-plate`, `.dict-block`, `.dict-word`,
`.tok*`, `.token-card`, `.exam-meta`, `.exam-sheetbar` (072–073); the whole
`.brd-*` boarding (075). Reading the canvas: `Artifact` `read` on its URL
saves the page; the design lives in `<script id="appifact-doc">` as JSON —
`content.files` holds one `*.dc.html` per artboard plus `canvas.json`; the
common prefix of the artboard files is this stylesheet.
