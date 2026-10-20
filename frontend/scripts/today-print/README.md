# 浮世絵 — the print of the hour (plans 205, 261)

Today's gate stands on a print: one landscape, four prints a season, the
hour choosing which (dawn, the day, dusk, the night) and the month the
season (plan 261: the cherry in spring; Red Fuji, the cloud peak, the
crape myrtle and the fireflies in summer, the fireworks on an August
night; the maples in autumn; the snow and the red plum in winter). The
owner picked it on the canvas "Tsuji — Today, the visit card" (direction
F, round 9), and its seasons on the canvas "Tsuji — Today, the seasons"
(round 5). This folder is the canvases' generator, moved into the repo
so the print can be rebuilt. The app draws its output and nothing else.

```bash
cd frontend && python3 scripts/today-print/build.py   # needs numpy and Pillow
```

It writes:

- `public/today/print/<REV>/<print>-<phone|desk>.json`: a print in four
  layers (sky, behind the train, the train, in front of it), with the
  train's run and its time; a print is a season at an hour
  (`spring-dawn` … `winter-night`), or the summer's August night
  (`summer-hanabi`), and the summer's five again with the other crape
  myrtle (`summer-dawn-b` … `summer-hanabi-b`), twenty-two of them;
- `public/today/print/<REV>/grain.png`, `paper.png`: the sky's wood grain
  and the paper's fibre, tiles drawn once;
- `src/components/station/print/print.json`: what the app draws itself,
  per print (the dial's inks, the inks of the lines set on the print, the
  sky's stops for the moment before the print has come, its view and the
  print whose view it is, `viewKey`, its name's key in the locales) and
  the two frames' geometry.

Which print shows is the app's: `printName` in `src/domain/printHour.js`,
the hour by the clock (`printHour`, shared with the ambiance) and the
season by the month (`printSeason`: spring from March, summer from June,
autumn from September, winter from December), August's night the
fireworks'; in summer, every other day, the `-b` prints (the day counted
from its dawn, so a night keeps its evening's tree). `src/todayPrint.test.js` holds every print it can name on
disk, and nothing else there.

The output is deterministic: two builds write the same bytes.

## Changing the print

- **Bump `REV` in `build.py` whenever the output changes.** The service
  worker keeps `/today/print/` cache-first for a year, so a print rebuilt
  under the same revision never reaches a returning learner. Delete the
  old revision's folder in the same commit.
- **A moving part is a class here and a rule in `index.css`** (the
  print's section, `/* ── 浮世絵 — the print of the hour (plan 205)`).
  `build.py` maps the rounds' prefixes (`f4-`, `f5-` …, `b5-`, the
  seasons' `s1-`) onto the app's one namespace, `tpr-`. `src/todayPrint.test.js` fails on a class
  with no rule, an animation with no keyframes, a reference to an id the
  print does not hold, or a print missing on disk.
- **Every animation has a reduced-motion answer:** the print keeps still
  under `prefers-reduced-motion`, with the train halfway across.
- Never edit the JSON by hand. Change the modules and rebuild.

## The modules

Each round of the canvas kept the last one's work and redrew a part of
it, so the modules import one another in the order they were drawn:

| module | what it draws |
| --- | --- |
| `geo.py` | number formatting, the lines' pigments, the dial's arcs |
| `brush.py` | the brush kit: polar strokes, maple leaves |
| `fuji.py` | Fuji as the prints draw it |
| `scene_f3.py` | round 3: the landscape, the four hours' skies and inks |
| `scene_f4.py` | round 4: stars, the disc, the first moving parts |
| `birds5.py`, `scene_f5.py` | round 5: jointed birds, clouds, grasses, leaves |
| `scene_f6.py` | round 6: the bay, the fog, the sea wall, the hills |
| `el7.py` | round 7: the pine, the boats, the train and its bridge, the flowers |
| `el8.py` | round 8: the pine's boughs placed clear of the train |
| `boughs9.py` | round 9: each branch seated in its tier |
| `scene_f9.py` | round 9: the print in its layers (`scene()`) |
| `s1_*` … `s5_*` | the seasons (below): `s5_scene.scene(L, hour, season)` is what `build.py` draws |
| `layouts.py` | the two frames: phone 390 × 746, desk 1184 × 900 |
| `textures.py` | the grain and paper tiles |
| `build.py` | the app's files |

## How the app lays it out

`usePrintFrame` (`src/components/station/print/usePrint.js`) measures
the frame and chooses the print: the desk always takes the desk's, and so
does a wide frame in the phone's layout (wider than 0.7 of its height: a
tablet, a phone on its side), since the phone's print, filled to that
width, would swell the dial and lose its foreground under the gate.

The print fills the frame's width, centred on the gate (the screen's
middle on a phone, the gate's column on the desk) as far as the frame's
height lets it grow to; past that it keeps its ground and the dial its
side. Its foot sits on the frame's foot: a taller screen shows more sky,
a shorter one loses up to 56 units of sky (64 on the desk) and then gives
up ground. On the phone the air under the lines keeps the room they take
(`--tpr-room`), so a screen too short for them scrolls. The dial and the
lines under it are the app's own, live, placed in the print's units
(`at()`), so they stand where the canvas put them: at 390 × 844 and at
1440 × 900 the app's layout is the canvas's.

A day with nothing due (`ClearedGate`, plan 206, the owner's pick G3 of
the canvas's round 10) stands on the same print without its train (the
last one has gone; `TodayPrint`'s `train={false}`), its disc the day's
seal cut in red (`TodayDial`'s `CutSeal`), in the sun's own red at dawn.

## The seasons (plan 261)

Round S¹ of the canvas "Tsuji — Today, the seasons"
(https://claude.ai/artifact/RsQaXzEqW86yeouw6M9Th8): the same bay at
its four hours, dressed by the year. Spring has its cherry, haze and
hazy moon; summer, Red Fuji, the cloud peak and fireflies; autumn is
the print as built, with its maples; winter, snow on the pine, the hills
and the bank. Rounds S² to S⁵ redrew what the owner asked of it, and
`build.py` draws round S⁵, the owner's picks.

| module | what it draws |
| --- | --- |
| `s1_inks.py` | each season's inks over each hour's, and the hour's view (題箋) as the season names it |
| `s1_scene.py` | the print in its season, `scene(L, hour, season)`: Fuji's snow line, the hills' woods turning |
| `s1_flora.py` | the season's tree (cherry, maple), the pine under its snow, the bank's flowers |
| `s1_air.py` | the season's clouds and birds, what falls, the fireflies, the fireworks; its moving parts' CSS |
| `s1_canvas.py` | the canvas's artboards, from round 9's (read from "Tsuji — Today, the visit card") |
| `s1_preview.py` | stills of the prints, and the contrast the lines under the dial keep on each |

Round S² redraws what the owner asked for after round 1, and builds on it
as the rounds before it did:

| module | what it draws |
| --- | --- |
| `s2_inks.py` | round 1's inks with the cherry and the maple fuller, Fuji's summer inks, a tree for every season |
| `s2_fuji.py` | Fuji without its snow: the cinder cone, the forest climbing the ravines, the gullies, the last streaks of snow |
| `s2_air.py` | the cloud peak as a tower of the print's own cloud banks; fuller falls; a few petals or leaves close to the eye |
| `s2_flora.py` | the season's tree: cherry, maple; for summer green maple, crape myrtle or willow; for winter red plum or the bare maple |
| `s2_scene.py` | round 1's composition, drawn with round 2's parts |
| `s2_canvas.py` | round 2's artboards |

```bash
cd frontend && python3 scripts/today-print/s1_preview.py /tmp/seasons phone   # round 1, every season and hour
SCENE=s2_scene python3 scripts/today-print/s1_preview.py /tmp/seasons phone   # round 2
SCENE=s2_scene VARIANT='{"tree": "yanagi"}' TAG=yanagi python3 scripts/today-print/s1_preview.py /tmp/seasons phone summer day
SCENE=s3_scene python3 scripts/today-print/s1_preview.py /tmp/seasons phone   # round 3, as built
SCENE=s3_scene VARIANT='{"fireworks": true, "flies": null}' TAG=hanabi python3 scripts/today-print/s1_preview.py /tmp/seasons desk summer night
```

Round S³ is the owner's pick of the summer and the winter, every other
season as round 2 drew it.

| module | what it draws |
| --- | --- |
| `s3_inks.py` | round 2's inks with the picks: the crape myrtle summer's tree, the red plum winter's; the August night (`NIGHTS`) |
| `s3_air.py` | the cloud peak as a cumulus: a tower of great lobes lit from the dial's sun, soft crevices between them; the desk's fireworks clear of the dial's lines |
| `s3_flora.py` | the crape myrtle: stems from one root, mottled and smooth; cones of flowers over small leaves; florets falling and fallen |
| `s3_scene.py` | round 2's print with round 3's parts: `scene(L, hour, season, variant=None)` |
| `s3_canvas.py` | round 3's artboards, and the year as chosen |

Round S⁴ redraws the day's gulls and draws the crape myrtle and the cloud
peak several ways, for the owner to choose from (`variant={'myrtle': ...,
'peak': ...}`):

| module | what it draws |
| --- | --- |
| `s4_birds.py` | the day's gulls (海猫): a white M with black tips crossing the bay on the wind, gliding, leaning into turns, beating now and then |
| `s4_flora.py` | the crape myrtle three ways: `photo` (A), `kacho` (B, as Sugakudō's kachō-e draws it), `flat` |
| `s4_air.py` | the cloud peak four ways: `hokusai`, `tones`, `far`, `bank` |
| `s4_scene.py` | round 3's print with round 4's parts |
| `s4_canvas.py` | round 4's artboards, each tree close |

Round S⁵ is the owner's picks, and what `build.py` draws: the myrtle A
and B a day each (B the `-b` prints), the cloud peak in tones, round 4's
gulls; and the meadow laid out by depth.

| module | what it draws |
| --- | --- |
| `s5_fore.py` | the meadow: the flowers in two drifts from the frame's feet under the trees, far patches faded by the air, the trees' shade, what they let fall lying flat in a carpet under the crown, grass by depth and along the frame's foot; a clump sways as one |
| `s5_scene.py` | round 4's print with the picks and the meadow: `scene(L, hour, season, variant=None)`, `variant={'myrtle': 'kacho'}` for B |
| `s5_canvas.py` | round 5's artboards: the four seasons and B, the ground close, the desk |

```bash
SCENE=s5_scene python3 scripts/today-print/s1_preview.py /tmp/seasons phone   # round 5, as built
SCENE=s5_scene VARIANT='{"myrtle": "kacho"}' TAG=b python3 scripts/today-print/s1_preview.py /tmp/seasons phone summer
```

The text under the dial keeps 4.5:1 on every print (`s1_preview.py`'s
contrast, the 1st percentile of each line's zone): rerun it over every
season on both frames, the August night and the B prints, after any
change.
