# 浮世絵 — the print of the hour (plan 205)

Today's gate stands on a print: one landscape, four prints, the hour
choosing which (曙 dawn, 帰帆 the day, 落雁 dusk, 秋月 the night). The
owner picked it on the canvas "Tsuji — Today, the visit card" (direction
F, round 9). This folder is the canvas's generator, moved into the repo
so the print can be rebuilt. The app draws its output and nothing else.

```bash
cd frontend && python3 scripts/today-print/build.py   # needs numpy and Pillow
```

It writes:

- `public/today/print/<REV>/<hour>-<phone|desk>.json`: the print in four
  layers (sky, behind the train, the train, in front of it), with the
  train's run and its time;
- `public/today/print/<REV>/grain.png`, `paper.png`: the sky's wood grain
  and the paper's fibre, tiles drawn once;
- `src/components/station/print/print.json`: what the app draws itself
  (the dial's inks, the inks of the lines set on the print, the sky's
  stops for the moment before the print has come) and the two frames'
  geometry.

The output is deterministic: two builds write the same bytes.

## Changing the print

- **Bump `REV` in `build.py` whenever the output changes.** The service
  worker keeps `/today/print/` cache-first for a year, so a print rebuilt
  under the same revision never reaches a returning learner. Delete the
  old revision's folder in the same commit.
- **A moving part is a class here and a rule in `index.css`** (the
  print's section, `/* ── 浮世絵 — the print of the hour (plan 205)`).
  `build.py` maps the rounds' prefixes (`f4-`, `f5-` …, `b5-`) onto the
  app's one namespace, `tpr-`. `src/todayPrint.test.js` fails on a class
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
and the bank. It is drawn for the owner's pick: `build.py` draws none of
it yet, and the app shows the print as built.

| module | what it draws |
| --- | --- |
| `s1_inks.py` | each season's inks over each hour's, and the hour's view (題箋) as the season names it |
| `s1_scene.py` | the print in its season, `scene(L, hour, season)`: Fuji's snow line, the hills' woods turning |
| `s1_flora.py` | the season's tree (cherry, maple), the pine under its snow, the bank's flowers |
| `s1_air.py` | the season's clouds and birds, what falls, the fireflies, the fireworks; its moving parts' CSS |
| `s1_canvas.py` | the canvas's artboards, from round 9's (read from "Tsuji — Today, the visit card") |
| `s1_preview.py` | stills of the prints, and the contrast the lines under the dial keep on each |

```bash
cd frontend && python3 scripts/today-print/s1_preview.py /tmp/seasons phone   # every season and hour
```
