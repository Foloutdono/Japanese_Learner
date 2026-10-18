# 湖の刻 — the ambiance of the hour (plan 219)

The ambiance is the lake on Today's print, heard at the print's own
hour: a lake at the foot of Fuji in autumn, its stone shore, the pine,
and the local line running along the water. One two-minute loop per
print, 曙 dawn, 帰帆 the day, 落雁 dusk and 秋月 night, switching on the
print's clock (`src/domain/printHour.js`) and crossfading when the hour
turns. It plays behind Today and every station page. The owner chose
the direction over three rounds of an audition page, asking each time
for less: keep it sparse.

```bash
cd frontend && python3 scripts/ambiance/build.py          # needs numpy and ffmpeg
cd frontend && python3 scripts/ambiance/build.py night    # one hour
```

It writes:

- `public/sounds/ambiant/<REV>/<hour>.mp3`: the loop, with a second of
  itself wrapped on at each end (see "The seam");
- `src/lib/audio/ambiance.json`: the revision, the loop's length and
  the pad, which is all `src/lib/audio/ambiance.js` reads.

It takes about two minutes. The output is deterministic: the same
build writes the same bytes on the same ffmpeg.

## Changing it

- **Bump `REV` in `build.py` whenever the output changes.** The service
  worker keeps `/sounds/` cache-first for a year, so a loop rebuilt
  under the same revision never reaches a returning learner. The build
  deletes the old revision's folder; commit the deletion with it.
  `src/ambiance.test.js` fails on a missing hour or a stale file.
- Never edit the mp3s or the JSON by hand. Change the modules and
  rebuild.
- Nothing here is a recording: every sound is drawn from noise and
  oscillators, with fixed seeds.

## The modules

| module | what it holds |
| --- | --- |
| `kit.py` | the periodic loop: shaped noise, events placed round a circle, circular filters and reverb, `level` |
| `sounds.py` | the things heard: the water, the pine, a sculling oar, the whistling birds (a tit, a kite, an owl), the temple bell, the crickets, the level crossing, the train |
| `hours.py` | the four mixes, and each hour's loudness (`HOURS`) |
| `build.py` | mastering, the files, the manifest |

## The seam

Every layer is built on a buffer of exactly one loop treated as a
circle. Noise is shaped frame by frame with circular overlap-add,
events are added modulo the loop, and filters and the reverb are
circular convolutions. Every slow control curve has a whole number of
cycles per loop. So the last sample runs into the first: there is no
seam, and no crossfade hides one.

An mp3 decoder may add or drop a few milliseconds at the start of a
file (the encoder's priming). So each file carries `PAD` seconds of the
loop's end before it and of its start after it, and the player loops
between `PAD` and `PAD + LOOP` (`loopStart`/`loopEnd`). Wherever the
decoder put the first sample, that region is one whole turn of the
circle.

## Levels

A layer's level is where its loud moments sit, in dB relative to its
hour's other layers (`kit.level`: the 95th percentile of its short-term
RMS, taken over its events only, so a bird heard twice is judged by its
call, not the silence around it). Each hour is then mastered to its
loudness in `hours.HOURS`. Day is at -36 LUFS, where the metro-platform
loop it replaced sat; dawn, dusk and night sit under it. The app's
ambiance trim (`BASE_GAIN.ambiance`, `src/lib/audio/settings.js`) and
the learner's slider do the rest.

## The rules the sounds keep

- **Sparse.** A quiet bed (the open water, the shore, a little wind)
  and two or three events in two minutes. The owner asked for less
  twice. Most of each loop is air.
- **Only birds that whistle.** Harsh calls (crows, geese, cranes,
  sparrows) came out like kazoos when synthesised, and were cut. A
  tit, a kite and an owl are whistled notes on a moving pitch, with a
  little breath, placed far off: highs absorbed, the level shimmering
  in the air (`sounds.distant`).
- **The train is what carries from a hundred metres.** It is the
  wheels' rolling hiss swelling and fading, a low body, and a soft
  タタン at the rail joints. It has no tonal motor whine: pure tones
  read as a synthesiser.
- **Pitched things keep the app's pentatonic.** The crossing bell
  strikes G5, one of the five notes the chimes use (C D E G A), so a
  chime over the ambiance never clashes with it.
- **Decoded at 24 kHz.** Nothing in a loop is above 12 kHz, and a
  two-minute loop decoded at 48 kHz holds ~47 MB. The player decodes
  at 24 kHz and keeps only the hour playing.
