# 練習の改札 — the painted platform (plan 225)

The Practice gate on the phone stands on a platform the owner painted: a
car at the platform, its door open, Fuji past the canopy. It was drawn as
board 4, "Le quai peint", on the canvas "Practice gate — five wheels",
where the owner picked it and its four hours. This folder cuts the two
paintings into the layers the app moves, and lights them at each of
Today's hours (曙 dawn, 帰帆 the day, 落雁 dusk, 秋月 the night, the hours
of Today's print, plan 205). The app draws everything else itself: the
roll signs, the door's two leaves, the pantograph, the clock, the gate
button.

```bash
cd frontend && python3 scripts/practice-gate/build.py
# needs numpy, Pillow and opencv-contrib-python-headless (xphoto's shift-map)
```

It writes:

- `public/practice/gate/<REV>/`: five layers at each hour, as WebP --
  `bg` (the scene, its sky without clouds), `clouds` (the clouds alone,
  the sky's rows), `car` (the standing car), `car2` (the next cars, from
  the door-shut painting, for the train passing) and `near` (the two
  pillars, in front) -- and `band-car.png`, `band-car2.png`, the
  stripe's masks, over which the app lays the line's pigment, and
  `sky.png`, the sky's mask, behind which the clouds drift;
- `src/components/practice/gate/gate.json`: the revision the app asks for,
  the door leaves' inks at each hour and where the clouds' rows lie.

The output is deterministic: two builds write the same bytes (the stars
and the moon's seas draw from one seeded stream, the hours in a fixed
order).

## Changing the platform

- **Bump `REV` in `build.py` whenever the output changes.** The service
  worker keeps `/practice/gate/` cache-first for a year, so layers
  rebuilt under the same revision never reach a returning learner.
  Delete the old revision's folder in the same commit.
- **Never edit the layers or the JSON by hand.** Change the modules and
  rebuild. `src/practiceGate.test.js` fails on a layer missing at the
  revision the app asks for.
- The paintings in `source/` are the owner's. Nothing else is drawn from.

## The modules

| module | what it does |
| --- | --- |
| `cut.py` | paints the clock, the gate button and the pantograph's moving parts out of the scene (the app draws them), lets in a band of sky so the painting fills the phone's taller gate, cuts the car, the next cars and the pillars |
| `band.py` | the blue stripe's own mask on each car, nothing else blue (not the seats through the door, not the lake) |
| `parts.py` | the scene's parts as masks (sky, clouds, land, Fuji's snow, the canopy and its lamps, the wires, the platform and its tactile strip; on the cars their body, glass, inside, roof, underframe) |
| `hours.py` | each hour's light, part by part: Today's sky, the sun or moon, stars, the far town's windows, the lamps and their glow, the windows lit from inside |
| `clouds.py` | each hour's scene split into the sky without its clouds and the clouds alone, which give the scene back at rest; past the sky (behind the wires, the land, the pillars) the clouds are carried as far as they drift |
| `build.py` | the app's files |

## How the app lays it out

The scene is 390 × 724 units (2 px to a unit in the layers): the gate's
frame on a phone, filled to its width and sat on its foot like Today's
print, so a taller screen shows more sky. A car tile is 340.71 × 360.17
units at (24.65, 195.86); the train passing is the tile repeated, the
standing car the painting's own. The roll signs, the leaves and the
pantograph are placed in the same units (`PracticeGate.jsx`).

## On the desk (plan 244)

The desk's gate stands on a second painting of the owner's,
`source/desk.webp`: the owner's picture of option B of the canvas
"Tsuji — Practice on the desk" (the station painted wide, the 辻駅 sign,
the 富士見台 pillar, the clock, the bench, a car with its door open, and
the board drawn over its right side). `desk.py` cuts it and lights it
with this folder's own recipes (`hours.py`, given the painting's
`Geometry`: where its sky, floor, stars, town and lamps' rims lie, and
where each hour puts its sun or moon in this sky).

```bash
cd frontend && python3 scripts/practice-gate/desk.py
# same needs as build.py; a few minutes, deterministic
```

It writes:

It reads `source/desk.webp` (the platform) and `source/interior.webp`
(the car's inside, through the open door).

- `public/practice/gate/desk/<REV>/`: at each hour, `bg` (the scene, the
  roof's gear and what the app draws painted out, its sky without its
  clouds), `clouds` (the clouds lifted off it, `clouds.py`'s, carried
  past the scene's two sides as far as they drift), `car` (the standing
  car, its door open), `car2` (the same car, door shut: the cars before
  and after it), `near` (the pillars, the pillar's sign, the bench) and
  the shut door's two leaves, `leaf-l` and `leaf-r`, as WebP; and
  `band-car.png`, `band-car2.png`, `band-leaf-l.png`, `band-leaf-r.png`,
  the stripe's masks, and `sky.png`, the sky's own mask, behind which
  the app moves what lives in it;
- `src/components/practice/gate/desk.json`: the revision, the scene's
  size (2127 × 940 units, one px each) and where the car, the door, the
  clock, the sign and the pillars stand in it, the frame's fill at
  each hour, and the sky's (plan 244b): its rows and how far its clouds
  drift, the brightest stars each hour drew (the app's glints) and its
  sun's or moon's glow.

The rules are the phone's: bump `REV` in `desk.py` whenever its output
changes (the service worker keeps `/practice/gate/` cache-first, the
desk's folder with it) and delete the old revision's folder, never edit
the layers or the JSON by hand, and draw from nothing but the owner's
painting. `src/practiceGate.test.js` holds the layers at the revision
the app asks for, and the fit.

| module | what it does |
| --- | --- |
| `desk_cut.py` | cuts the picture's name strip off; paints out the gate button and the clock's face (the app draws both); draws the platform under the board again from the painting's own bays and one bay more past the right edge, for a wide window: the canopy at the rafters' repeat; the sky quilted from the sky past Fuji, in strips at seeded offsets joined on their least-error cut (mirrored at the seam, it showed a house and a cloud twice, face to face); the floor carried at the pillars' own pitch, so each shadow and reflection falls from its pillar (mirrored, the shadows met in a V under every bay); the car carried along its doors and windows from the car with its pillar drawn out (carried with it, the pillar stood as a sliver beside the next); a pillar carried one bay on. Each car ends in a body panel and its part of a gangway, the left one's hidden behind the frame's pillar, so the cars of a passing train meet as cars do. In the open doorway it draws the car's inside from the owner's second picture, `source/interior.webp` (plan 244c): the picture's opening is wider than the car's door, so its columns are kept in runs (`KEEP`) that let out only plain wall, trees and bench between the rings, posters and stanchions, joined over a few px and brought to the doorway's size (`INSIDE`); `FAR`, `STANCHIONS` and `FLOOR_IN` are measured on the picture through the same map. Then it cuts the layers and the stripe's masks |
| `desk_parts.py` | the scene's parts as masks, as `parts.py` does for the phone's (the sky and its clouds, Fuji's snow, the far hills, the forest, the canopy, what hangs from it and its lamps, the wires, the platform and its tactile strip, the sign less the sky round it; on the cars their roof, side, windows and their glass apart from the mullions and transom, the lit inside and its far window, the underframe; in front the pillars, the pillar's sign and the bench) |
| `desk_parts.py`, the land | the land is told from the sky by a matte (plan 244b), not a line: GrabCut seeded by what is surely sky (high up, over Fuji's traced outline) and surely land (the forest low down, Fuji under its outline), softened by a guided filter and read again, at the edge, as the share of the way from the sky's colour to the land's. Each hour lights the sky from the sky's colour and the land from the land's, and lays them together by it: cut by a line per column, a tree's top stood in steps and the sky's light it held stood round it as a rim, Fuji's slope wore a pale line, and the far hills, as pale as the sky, were taken for it and lit away (they are the land's now, and the hour's far colour). The town's windows are the forest's, never Fuji's slope. The roof's gear is traced (`desk_cut.PANTO`, `COOLER`): its dark steel is the forest's shade's, and the cooler let the forest through its vents |
| `desk.py` | lights the parts at each hour and writes the app's files. After dark the windows show what the open doorway shows -- the strap rail and its rings, the cream wall, the far window -- tiled along each, the far glass mirroring the lit inside with the ceiling's tubes caught in it (the phone's recipe lit the trees seen through the car, and they glowed amber). The inside's far window shows the hour's sky, taken from the scene's own rows at the horizon's height, between and over its trees lit as the forest, the lit car faintly in the glass (`far_view`, `MIRROR`). After dark every side window looks across the car (`across`): the rail and rings of one ring's bay and one cushion of the doorway run along the car's length, and across from each window (its panes joined as one) a far window of its own, framed as the doorway's, with as many panes, showing its own stretch of the hour's sky and trees from the scene, never over a pillar -- tiled from the doorway, every pane held a copy of the doorway's window; the sun the picture lays on the inside's floor goes with the sun (`inside_lit`); the signs' panels dim, their letters keep their light, their steel frames are steel; the stars are the phone's at this painting's scale. The pillars: the near layer's soft edge takes the pillar's lit colour on both sides (it kept the day's sky, a pale line by each pillar after dark), the scene under each pillar is the pillar, its round base included (`desk_cut.BASE`), and the sun's white rim on their right is lit as the lamps leave it (`Desk.pillar_knee`) |

The app fits the scene to its frame in `deskFit.js` (the open door kept
left of the board, the sign whole or gone, the clock never cut by the
board's edge where the painting can help it) and draws the board, the
leaves, the clock, the stripe's pigment and the gate button over it
(`DeskGate.jsx`), and lets its sky live behind `sky.png` (`DeskSky.jsx`,
plan 244b): the clouds drift, the brightest stars catch the light, the
sun's or the moon's glow breathes, and the hour's birds cross, jointed
as Today's print draws them (`DeskBirds.jsx`, plan 244c: cranes at dawn,
swallows by day, each on its own swooping way, the geese of 落雁 at dusk); under reduced motion, the
painting's own sky.
