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
