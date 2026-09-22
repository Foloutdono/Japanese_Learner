# The desk (机) — class map

The app's computer design (plan 112, ADR 0018). At **1100px and up**
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
| `.phone--desk` | the Shell's frame on the desk. It reserves `--desk-rail-w` on the left; the phone's own ≥769 rule then caps `.phone__content` at `--board-w` and centres it | `components/chrome/Shell.jsx` |
| `:root[data-chrome="shell"]` (in the block) | `--dock-bottom` is the inset alone, because there is no tab bar | `components/chrome/useChrome.js` |

## The rail

| Class | What | Component |
|---|---|---|
| `.desk-rail` | the sumi column down the left edge: fixed, `--desk-rail-w`, the HUD's `--chrome-edge` on its right | `components/chrome/DeskRail.jsx` |
| `.desk-rail__mast`, `__glyph`, `__name` | 辻 over TSUJI, the origin station's plate | 〃 |
| `.desk-rail__list` | the gates' list, inside `nav[data-guide="tabbar"]` (the tab bar's label and guide anchor) | 〃 |
| `.desk-gate`, `--on`, `__ico`, `__label`, `__due` | a gate: `GateIcon` plus its word, always captioned. The lit gate has the lozenge's wash and a 2px rule on the rail's edge. Today's due count is warning ink, the rail's only colour | 〃 |
| `.desk-rail__stations`, `.desk-sec`, `--on` | the lit gate's stations as stops on a drawn line, the one you stand in filled. `config/tabs.js`'s `getDeskSections` supplies them | 〃 |
| `.desk-rail__foot` | the HUD's three instruments (`HudInstruments`): level and pass on one line, the status panel under them | `components/chrome/Hud.jsx` |

The order is `config/tabs.js`'s `DESK_TAB_IDS` (Today first). `TAB_IDS` is
still the phone's row and the flick's order. The rail has no flick.

## The screens

| Selector | What | Where |
|---|---|---|
| `.learn > .plates`, `.practice > .plates` | two by two; the fifth plate (the shelf, the exam) takes the row | `screens/LearnScreen.jsx`, `screens/PracticeScreen.jsx` |
| `.today` | the strip (sticky) beside the fare gate; the finished run's slip spans both | `screens/TodayScreen.jsx` |
| `.desk-profile`, `__col` | the holder opened flat: the pass and stamps, beside the record | `screens/ProfileScreen.jsx` |
| `.desk-settings`, `__list`, `__page`; `.stg-row--on` | the list (sticky, the one `<h1>`) beside the open page (a pane, `<h2>`, no way back). The open row is marked in gold. The bare list opens its first page | `screens/SettingsScreen.jsx`, `components/settings/SettingsPage.jsx`, `components/settings/pane.js` |
| `.sheet`, `.sheet--sumi`, `.sheet__handle` | a sheet is a centred dialog: all four corners, no handle, a fade. It is centred by `inset` and `margin: auto`, never a transform, because the drag owns that | `components/chrome/Sheet.jsx` |
| `.phone--desk .dict-dock` | the dictionary's dock no longer clears a HUD | `screens/DictionaryScreen.jsx` |
| `.dock-note`, `.guide-callout` | the docked note spans the screen, not the rail; the guide's note centres on the screen | `components/ui/UpdateToast.jsx`, `components/guide/Guide.jsx` |

## The keys

| Class | What | Component |
|---|---|---|
| `.desk-kbd` | a key cap in `currentColor`, the caption register | — |
| `.rating-bar__btn > .desk-kbd` | each rating tile's digit in its corner (1 is the best, at the right) | `components/study/RatingBar.jsx` |
| `.mcq-row__index` (desk: the bare digit) | the choice's index is the key that answers it, with `aria-keyshortcuts` | `components/study/QuizComponents.jsx` |
| `.flashcard__hint .desk-kbd` | "Espace pour révéler" | 〃 |

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
| `src/chrome.phone.test.jsx` ("draws no desk"), `RatingBar.browser.test.jsx` ("prints no keys") | phone, browser | nothing of the desk below the line |
