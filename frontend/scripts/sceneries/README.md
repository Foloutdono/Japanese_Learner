# 景 — the reading challenge's sceneries (plan 309)

The reading challenge (`frontend/carousel/challenge.js`) lays its text over
Today's print. Beside the bay, the app's own print, it can stand on other
views of the same country, each a print in the same woodblock hand: the
mirror lake, the lake gate, the river, the station. This folder draws
them. None of it ships in the app: the carousel alone reads the files,
`frontend/carousel/sceneries.js` names them (`--scenery` on
`carousel/long/render.mjs`, the studio's Scenery field), and the app's
grain and paper go with them.

```bash
cd frontend && python3 scripts/sceneries/build.py                # every scenery drawn
cd frontend && python3 scripts/sceneries/build.py --only lake    # one, or a few by commas
cd frontend && python3 scripts/sceneries/build.py --check        # rebuilt in memory, held to the files
cd frontend && python3 scripts/sceneries/check.py [--check]      # the committed folders, held to the rules
```

It writes, for each scenery, into `carousel/prints/<REV>/<scenery>/`:

- `<print>.json`: a print in the app's four layers (the sky, what lies
  behind the train, the train, what stands in front of it) with the
  train's run and its time, shaped as the app's prints are
  (`{rev, print, device: 'phone', w, h, train: {run, dur: 46, delay: 20},
  layers}`); seventeen of them, the season's at each hour and August's
  night (`spring-dawn` … `winter-night`, `summer-hanabi`). The summer's
  `-b` myrtle is the app's alone: the challenge loads the A print for it.
- `meta.json`: the frame (its horizon, for the sky's stops; the disc the
  challenge sets on it, `cx: 195, cy: 150, disc: 24`; the rows the train
  runs in, `trainBand`, or `null` where no line runs) and each print's
  look, the app's own entry for that print in
  `src/components/station/print/print.json`, under `generator`, the
  app's print revision.

The output is deterministic: two builds write the same bytes, and
`--check` fails on any file a rebuild would change.

## Changing a scenery

- **Bump `REV` in `build.py` whenever the output changes**, and
  `PRINTS_REV` in `carousel/sceneries.js` with it
  (`src/carouselPrints.test.js` holds them equal and allows one
  revision's folder); delete the old revision's folder in the same
  commit.
- **Rebuild after any change to `scripts/today-print`**: the sceneries
  are drawn with its parts, so a change there changes them; then bump
  `REV`.
- Never edit the JSON by hand, and never edit today-print from here: it
  is imported where it stands (`sys.path`, no bytecode written), and its
  `build.py`, which shares this folder's script's name, is taken by its
  path.

## The hand: what every scenery keeps

Every print is drawn inside round 5 (`s5_scene.round5()`) and dressed for
its season's hour (`s1_scene.dressed()`), from `s5_scene.inks(season,
hour)` (`common.inside`): every ink, bird, tree and falling thing is the
bay's. Its sky layer is the bay's own sky drawn at the scenery's frame
(`common.sky`): its first `<defs>` is the generator's block every reused
part points into, never a copy. A table of the generator's that a
scenery lays out its own way is given the scenery's entry while the
print is drawn and given back after (`common.swapped`, in
`s1_scene.dressed`'s idiom: `fore` the meadow, `fireworks_at` August's
bursts). The serialisers are today-print's (`tight`, `lighter`,
`rename_classes`, `rename_ids`).

- **No new class.** Every moving part keeps the class the bay's has, so
  index.css's still rules hold it and a later motion could move it with
  no new drawing; no `opacity=` on a part with a `tpr-` class.
- **No `<defs>` inside another**: the carousel's loader gathers every
  layer's `<defs>` with a non-greedy match, which a nested one cuts
  short. A part's own defs are lifted out beside it.
- **Ids `tpr-`, once each, every reference found in its layer's own
  image.** The carousel's loader draws each layer as an image of its
  own, carrying that layer and every layer's `<defs>` (`app.loadPrint`):
  a part drawn once and placed again with `<use>` is placed from its
  own layer, or held in `<defs>`. A part that writes fixed ids (the
  water's strips, the boats' fire) is drawn once a print.
- **The train whole in its image.** The loader draws the train layer a
  print's width either side of the frame and slides it along its run:
  whatever lies left of −W in it is never drawn, and shows only as a
  train cut short once it moves. `common.small_train` refuses a lead the
  run cannot reach from there (under k · length − 0.1 W + 9: 154 at half
  the bay's size, 103 at 0.36), and `check.py` reads each train back from
  its layer: in the image, off the print at both ends of its run, its
  rows and its reflection's inside the meta's `trainBand`.
- **Each part seeds its own random**, as the generator's do.
- **At most 12 MB a scenery.**

`check.py` holds the files to all of it; `src/carouselPrints.test.js`
holds the committed files to the same in CI.

## The frame

The phone's frame, 390 × 746 units, at 2.769 px a unit on a 1080 × 1920
video. Under the hook (H) the print is anchored at its top (px = 2.769 ×
units); from the reading on (R) it is raised 52.7 units (px = 2.769 ×
units − 146). So:

- nothing that must be seen above px 330 (the feed's top bar);
- in R the subject above the caption (px < 1490, units < 591), nothing of
  it under the buttons (px x > 920, y > 1100);
- the text's column is px x 184-896 (units 66-324): the ground under it
  calm;
- the hook's plate covers px 500-940 in H: Fuji's summit at H px ≥ 975
  (units ≥ 352);
- the disc the challenge draws at units (195, 150), r 24, its glow to
  2.2 r: the light's road on the water under it (`L.cx = 195`), and no
  star, cloud or flight in units x 145-245, y 100-200, nor in the
  masthead's row (units y 126-153 under the hook, 179-206 raised:
  `common.MASTHEAD`). August's night has no disc: no road either.

## The sceneries

| id | | the view | module | train |
| --- | --- | --- | --- | --- |
| `lake` | 逆さ富士 | Mirror lake: Fuji over a still lake and upside down in it, the line on the far shore's embankment, the season's tree leaning in from the left | `lake.py` | half size, far shore, its lit windows doubled in the water |
| `torii` | 鳥居 | Lake gate: the lake without the line, a vermilion gate standing in the water in the left margin, the season's tree on the right bank | `lake.py`, `gate=True` | none: the quiet one |
| `river` | 川 | The river: Fuji small and far, the river widening to the viewer between levees planted with the season's tree (桜堤), the line crossing far up it on the bay's bridge | `river.py` | 0.36, far bridge |
| `station` | 駅 | The station: under the eaves of a small station's platform, the bay beyond between its posts | `station.py` | half size, far shore |

The bay (入江) stays the challenge's default, and the long view (一望) is
the app's own desk print: neither is drawn here. A module whose scenery
is not drawn yet raises `NotImplementedError`, and `build.py` passes it
by, unless its folder is on disk: a folder nothing draws is a problem.

On the lake the boats sit nearer than the rows the train's reflection
takes (the train layer is drawn over the water), the tree lets fall a
long raft of petals on the water (花筏: `s5_fore.fallen`'s petals
without the tint it lays on a meadow), and two of August's bursts open
right of Fuji, where their light lies in open water, left of the feed's
buttons. The gate's boats ride the open water between the gate and its
tree; its bursts open over the tree, which hides their light in the
water.

As built: the lake 9.0 MB raw (1.9 MB gzipped), the gate 8.7 MB (1.9
MB), about 3 s each; a summer print, with its crape myrtle, is the
heaviest (about 0.9 MB).

## The modules

| module | what it draws |
| --- | --- |
| `common.py` | the bay's hand (`inside`, `sky`, `shared_defs`, `swapped`, `fore`, `fireworks_at`, `turned`, `small_train`) and the files (`serialise`, `document`, `meta`, `write`) |
| `lake.py` | the mirror lake and the lake gate: the lake's layout and meadow, Fuji's reflection in strips, the embankment and its line, the reeds, the torii and its reflection |
| `river.py` | the river and its avenue |
| `station.py` | the station under the eaves |
| `check.py` | the rules above (a train read back from its layer among them), and `--check` |
| `build.py` | `REV`, the registry of the sceneries, the files |
