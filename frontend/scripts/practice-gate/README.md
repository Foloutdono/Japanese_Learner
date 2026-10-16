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

- `public/practice/gate/<REV>/`: four layers at each hour, as WebP --
  `bg` (the scene), `car` (the standing car), `car2` (the next cars, from
  the door-shut painting, for the train passing) and `near` (the two
  pillars, in front) -- and `band-car.png`, `band-car2.png`, the
  stripe's masks, over which the app lays the line's pigment;
- `src/components/practice/gate/gate.json`: the revision the app asks for
  and the door leaves' inks at each hour.

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
| `build.py` | the app's files |

## How the app lays it out

The scene is 390 × 724 units (2 px to a unit in the layers): the gate's
frame on a phone, filled to its width and sat on its foot like Today's
print, so a taller screen shows more sky. A car tile is 340.71 × 360.17
units at (24.65, 195.86); the train passing is the tile repeated, the
standing car the painting's own. The roll signs, the leaves and the
pantograph are placed in the same units (`PracticeGate.jsx`).
