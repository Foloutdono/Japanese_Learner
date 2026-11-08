# The App Store header (plan 308)

iOS 27's product page opens on a header: a 21:9 picture across the top of
the page, set in App Store Connect under *Informations de la page produit ›
En-tête et résultats de recherche › En-tête*. Tsuji's is the print Today's
gate stands on (`scripts/today-print/`, plans 205 and 261): Fuji over the
bay, the train on the viaduct, the season's tree. No text: the store sets
the app's name, icon and button beside it, and a picture without words
needs no copy per language.

```bash
cd frontend && python3 scripts/store-header/build.py OUT                        # the four seasons' day
cd frontend && python3 scripts/store-header/build.py OUT autumn-day --guides    # one print, and a copy with the safe area drawn
```

It writes `OUT/<print>.png`, 3840 × 1646, RGB without alpha (the store
refuses transparency), about 6 MB. A print is named as Today names it: a
season (`spring`, `summer`, `autumn`, `winter`) and an hour (`dawn`, `day`,
`dusk`, `night`), `summer-hanabi` for August's night, and a summer print
ending in `-b` for the crape myrtle drawn the other way. Nothing is written
into the repository: the files go to App Store Connect, not to the app.

## What it draws

The print's own modules on the desk's frame (1184 × 900 units), seen
through a 21:9 window 507.5 units tall from y = 352, at the device scale
that puts the 1184 units across 3840 pixels, and shot in Chromium under
reduced motion with the app's rules for the moving parts, as
`scripts/today-print/s1_preview.py` shoots the stills. So the header is the
print: a print redrawn there is redrawn here by running this again.

What it changes on the desk's frame (`HEADER` in `build.py`), and why:

- **Apple's safe area.** The template's art safe area for a 3840 × 1646
  header is a centred box of 1646 × 661 pixels at (1097, 493), read from
  Apple's Sketch template (`creative_assets-templates.sketch`, linked from
  [App Store asset best practices](https://developer.apple.com/app-store/asset-best-practices/));
  what lies outside it a device may crop or cover. Fuji's summit and the
  whole train stand inside it, the trees and the meadow outside. `held()`
  refuses to build a layout that breaks that.
- **The bay is shallower** (38 units of water, the desk's 54) and the hills
  a little lower, since the box is two fifths of the window's height and
  holds both the summit and the train: what the bay gives up, Fuji gets.
- **Fuji in the middle**, sized to the box (the desk's stands right of
  centre, clear of the dial); the train of six cars stopped under it, both
  noses inside the box.
- **The sun without the dial's rings** (`sun()`): the dial is the app's,
  live, and a header has no day to count.
- **The sky's gradient laid over the window** (`fit_sky()`), so the header's
  sky runs from the hour's deepest ink to its horizon as the print's does,
  rather than showing only the paler half below the window's top.
- The boats spread to both sides of Fuji, the clouds moved into the
  window's sky. Everything else (the pine, the season's tree, the meadow,
  the birds, what falls) stands where the desk's print has it.

## Uploading

App Store Connect › the app › *Informations de la page produit* ›
*En-tête et résultats de recherche* › *En-tête* › *Charger*, under each
localization the page lists (the file has no text, so one file serves them
all), then check it in *Aperçu* on iPhone and iPad, light and dark. The
header goes through App Review on its own and needs no new build. The
*Résultats de recherche* asset is a separate, optional slot (3:2): without
one, search results keep showing the screenshots, which say more about the
app than a landscape does.

The store also takes a 5244 × 2950 (16:9) "universal" PNG that can serve
both slots; its safe area is a 1402 × 962 box above the centre, too small to
hold Fuji and the train at a size that reads, so this script makes the
dedicated 21:9 header only.

Changing the season of the header is a run of this script and an upload;
the app's own print changes by itself.

## The moving header

The header also takes a video (3840 × 1646, 5 to 30 seconds, 30 or 60
fps, looping, muted until someone turns the sound on). The owner found the
still print said nothing about the app, and picked E of four directions
drawn from Today on the canvas "Tsuji — the moving header"
(https://claude.ai/artifact/NJruRGMvqqhjtVCXWAP6ca): **the day's run**.

```bash
cd frontend && node scripts/store-header/film.mjs OUT                         # autumn-day, 3840 × 1646
cd frontend && node scripts/store-header/film.mjs OUT winter-day --date 2026-12-08
cd frontend && node scripts/store-header/film.mjs OUT --width 1920            # a quicker preview
```

It writes `OUT/today-<print>.mp4`: twelve seconds that loop without a
seam, H.264 and AAC, about twenty minutes of filming at full size.
`today.py` builds the page and `film.mjs` films it; they need Python (the
print's modules), Chromium and ffmpeg.

What plays, each part drawn as the app draws it:

- **The run** (0.8 to 6.9 s). Today's dial stands on the sun of the print,
  left of Fuji as on the desk's Today: PrintDial's geometry
  (`components/station/TodayDial.jsx`, `domain/dial.js`), the print's
  inks (`print.json`). The count, in the hour's two golds, rolls down
  from the day's cards to 0 while the day's thread closes round it with
  its stop, and the train crosses the bay.
- **The day's finish** (from 6.95 s), at the app's own beats
  (`components/dayclear/useFinish.js`, `BEATS.day`). The ring turns in;
  the day's seal (TodayDial's `CutSeal`, its ink grain and its tilt) is
  slammed, with its flash, its bloom and the 3px shake, and the sun's
  glow gives way to the seal's. The week's seven stamps come in under the
  dial, today's is pressed, and a full week's gold rings ring in. The
  keyframes are `index.css`'s (`clr-slam`, `tdy-fin-ring`,
  `tdy-fin-flash`, `clr-bloom`, `clr-shake`, `clr-press`, `tdy-fin-pop`).
- **The next day** comes back over the last 0.8 s.

Nothing on it is a word: the count, 辻駅, the date and the days. So one
file serves every localization. The date is the seal's and the week's
(`--date`, in the print's season). The sound is the hour's lake at its
trim, with the stamp at the seal's hit and the 終着 chord at the recap:
the app's own recipes and levels, rendered as `scripts/measure-voices.mjs`
renders them.

A frame is a still taken alone: `render(t)` sets the print's own
animations and the finish's keyframes to `t`, so the film is the same
however fast the machine shoots. The print's motion has periods of its
own, so the film runs half a second past the loop and its end is
crossfaded into its start. The frames are filmed in parts of three
seconds, each kept on disk once whole (`OUT/.parts-*`), so a run cut
short goes on from its last whole part when it is started again.

The file is checked before it is kept: exactly the size asked, in square
pixels, its colours tagged BT.709. App Store Connect reads a video's size
through its pixel shape, and refused a first film whose frames had come
out two rows short and been stretched back ("les dimensions du fichier ne
sont pas valides"), so the frames are shot on whole device pixels.

## The captioned header: the day's queue

The owner then asked for more of Today on the header: the modes its
queue deals and a caption for each step. Of three captioned versions
drawn on the same canvas the owner picked **I, the queue**, and kept
*Draw the kanji* as its kanji mode.

```bash
cd frontend && node scripts/store-header/film.mjs OUT autumn-day --page queue --lang en   # OUT/queue-autumn-day-en.mp4
cd frontend && node scripts/store-header/film.mjs OUT autumn-day --page queue --lang fr
cd frontend && node scripts/store-header/film.mjs OUT autumn-day --page queue --lang es
```

`queue.py` builds the page (`today.py`'s print, dial and finish with the
queue laid over it, the language in its query) and `film.mjs` films it:
24 seconds, so about forty minutes a language at full size. Its captions
are words, so each localization in App Store Connect gets its own file.

What plays, in the safe area:

- **The day** (0 to 2.9 s): the dial on the day's 24 cards beside a card
  naming its four lines, kana 2, vocabulary 10, kanji 8, grammar 4.
- **The queue**: the cards come along the platform one after another, the
  one at its middle answered in the mode Today deals it: Kana → romaji (ゲ
  turned over), Word → meaning (毎日), Draw the kanji (日 drawn in
  KanjiVG's stroke order from its meaning, `backend/kanjivg/065e5.svg`),
  then the grammar ladder's Choose (これは、友だち＿かさです, three
  choices, の) and Build (つめたい水＿飲みました, "wo" typed, then the
  rating, a tap on Easy). Each card's header is its caption: the mode's
  name in its line's pigment (`--line-*`) and what to do.
- **The day done** (from 20.6 s): `today.py`'s finish at `useFinish.js`'s
  beats, the week's stamps in the card beside it, and the seal turning
  back into the next day's 24.

The cards are set as the run sets them rather than captured: its faces,
inks and borders, read from the running app's computed styles
(`.gl-sent`, `.gl-gap`, `.gl-tr`, `.gl-tile`, `.field`, `.btn-primary`,
`.rating-bar__btn`), and its words (`locales/*/index.js`, the API's
meanings), at a size made for a phone: on an iPhone the grammar sentence
is about 15 points and the captions about 11. A card redrawn in the app
is a card to set again here. The sounds are the app's, where it plays
them (`window.SOUNDS`): the card turning, the next card coming, a choice
picked, the rating, the stamp and the 終着 chord.
