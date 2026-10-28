# 対戦の曲 — the duel's music and sounds (plan 285)

What a sprint sounds like: the owner's pick of the canvas "C1, le son
retenu". The music is R3's, the club music of the IIDX world, made
lighter so that it accompanies the race rather than takes the room. The
race's sounds are R1's, the taiko. The ending is R3's: the last chord on
0:00 and the result's quiet loop. The music is scored to sprint-2's two
minutes, its combo and its rush: a sprint-1 duel (a minute, dealt
before plan 284) races in silence, and its result sounds like any other.

```bash
cd frontend && node scripts/duel-music/build.mjs     # needs ffmpeg; about a minute
```

`score.js` is the score, played in a page of Playwright's Chromium and
rendered in its `OfflineAudioContext`. `build.mjs` mixes, levels and
encodes it, and writes:

- `public/sounds/duel/<REV>/base.mp3`, `chords.mp3`, `arp.mp3`,
  `melody.mp3`: the four layers, a sixteen-bar cycle each, with `PAD`
  seconds of itself either side (see "The seams");
- `public/sounds/duel/<REV>/rush.mp3`: bars 71-80, every layer on;
- `public/sounds/duel/<REV>/final.mp3`: the last chord, on 0:00;
- `public/sounds/duel/<REV>/result.mp3`: the result's loop, padded the
  same way;
- `public/sounds/duel/<REV>/fx-<name>.mp3`: each sound of the race and
  the result;
- `src/lib/audio/duel.json`: the revision, the bar, the files, which is
  all `src/lib/audio/duel.js` reads.

## Changing it

- **Bump `REV` in `build.mjs` whenever the output changes.** The service
  worker keeps `/sounds/` cache-first for a year, so a file rebuilt
  under the same revision never reaches a returning learner. The build
  deletes the old revision's folder; commit the deletion with it.
- **Rebuild only when the score changes.** Chromium's offline render
  varies at about 1e-8 from one run to the next, so a rebuild writes
  different bytes that sound the same. Rebuild with a change to
  `score.js` or `build.mjs`, and commit it under a new `REV`.
- Never edit the mp3s or the JSON by hand.
- Nothing here is a recording: every sound is oscillators and seeded
  noise.
- `src/duelAudio.test.js` holds all of it to the server: every file the
  player asks for is on disk at its revision and nothing stale beside
  it, the 80 bars last `SPRINT_MS` (sprint-2's two minutes in
  `study/duels.py`), the last ten are `RUSH_MS`, the layers turn on at
  `COMBO_TIERS`, and the player plays every sound the build made. A
  change to the sprint, the rush or the tiers is a change to the score.

## Scored to the sprint

160 BPM: a bar is 1.5 s, the sprint's two minutes are 80 bars, and its
rush (15 s) is the last ten. The music is four layers:

| layer | what it is | on from |
| --- | --- | --- |
| `base` | the kick, the snare, the hats, the bass | the start |
| `chords` | a saw pad | ×1.5 (five right in a row) |
| `arp` | a plucked arpeggio | ×2 (ten) |
| `melody` | R3's lead | ×3 (twenty) |

Each plays the cycle's bars 1-70 (A then B: vi IV V iii vi IV V V, then
IV V iii vi ii V vi vi). The rush is a file of its own: A a whole tone
up with every layer on, then a snare build into 0:00. The last chord is
I, a whole tone up, on the bar line after the sprint.

`duel.js` plays it all on the run's clock, which is the server's: the
first bar at `startsAt`, the rush at `endsAt - rushMs`, the last chord
at `endsAt`. A layer turns on on the next beat and off on the next
sixteenth, so a combo heard is always in time. A miss muffles the music
a moment (a lowpass), and a broken combo longer. A tab hidden puts the
context to sleep (`ambiance.js`), and the race is scheduled again from
the server's clock when the tab is looked at.

## The seams

Each layer is rendered for three cycles and the middle one kept, so a
voice still ringing over the bar line is at the loop's start, as it is
in the music. The files carry `PAD` seconds of the cycle's end before it
and of its start after it, and the player loops between `PAD` and
`PAD + cycle`: wherever an mp3 decoder put the first sample, that region
is one whole turn.

The rush, the last chord and every sound start after `LEAD` (0.25 s) of
silence, which the player skips, so an encoder's priming lands in it. A
decoder that keeps the priming starts every file a little later: the
manifest's `onset` is where the last chord's first sound is, and the
player reads the decoder's shift off it.

## Levels

One scale for everything: a right answer sits where the app's own
`correct` does, 0.042, the loudest 42 ms window of RMS
(`scripts/measure-voices.mjs`). Every other sound keeps the level the
canvas gave it relative to that (`LEVEL` in `score.js`, in dB). The
music keeps the canvas's balance with the sounds: about −41 LUFS on its
bus, a couple of dB above the lake. The music plays on the ambiance's bus
(`BASE_GAIN.ambiance.duel`) and the sounds on the effects' bus
(`BASE_GAIN.sfx.duel`), so the learner's two sliders and the mute reach
them as they reach everything else.

## The rules the sounds keep

- **The music accompanies.** The owner asked for it lighter: it sits
  under the answers' sounds, and the layers only come in as the
  learner earns them.
- **Heard on a phone.** A phone's speaker plays little under 400 Hz, and
  the taiko's don is a low drum. It is voiced with the ring of its
  higher modes (`HAND` in `score.js`), so through a model of a phone's
  speaker (two 400 Hz highpass filters) it loses 10 dB, not 21.
- **Decoded at 24 kHz.** Nothing in the music is above 12 kHz, and four
  layers at 48 kHz would hold twice the memory. The player keeps the
  decoded files only while a duel's screen is open.
