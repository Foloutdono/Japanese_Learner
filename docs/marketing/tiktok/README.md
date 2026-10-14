# TikTok promo: "Fed up with never reaching your Japanese goal?"

`tsuji-tiktok.mp4` is 1080×1920, 30 fps and 59.5 s long, with AAC audio at
−14 LUFS (TikTok's playback level). Every phone shot in it is live footage of
the app, recorded in a phone-sized browser (390×780 CSS px, 3× pixel density,
English UI, dark theme).

## Sound

- **Music:** an original track written for this video, synthesized in
  `pipeline/music.py`. No sample or loop is borrowed, so there is nothing to
  license. It runs at 128 BPM in D major: a filtered two-bar intro with a
  riser, then a drop on "Try Tsuji!". After the drop it loops 王道進行
  (G maj7, A7, F#m7, Bm7) under a koto-like pluck in the major pentatonic,
  and it resolves on D under the address (32 bars).
- **The app's own sounds:** every click, card turn, "correct", fare tick,
  departure-board flap and chime is the sound the app played at that moment
  in the recording. The recorder logs each `playVoice` call. `render_sfx.mjs`
  renders the shipped voices from `src/lib/audio/recipes.js` offline, and
  `edit.py` places each one where its moment lands after re-timing.
- **Sounds added in the edit:** a whoosh into each scene, the card whisk on
  cuts inside a scene, the hanko stamp when `tsuji.app` lands, keystrokes
  while typing, and a brush under each kanji stroke.
- **Left out:** the section announcements (jingle and voice, about 6 s each,
  longer than a shot) and the ambiance loops, which the music replaces.

## The cut

One idea per caption, each shown long enough to read. Footage plays close to
real speed (about 1–1.5×). The camera never moves: no push-ins and no
punches. Only cuts and slides change the picture. Zooms were tried and
dropped: each element worth showing (the plan's date, its route map, the
stamp card, the ticket) already spans most of the screen's width, measured
from the recording (`rec.mjs`'s `mark`), so a zoom would only crop it. Taps
still fall on beats. Each scene starts with a train-pull slide (the
boarding's own transition) and a whoosh, and cuts inside a scene are a quick
cross-fade. Captions pop in word by word on the beat. The background is still:
no glow pulses with the beat.

| Time | Beat | Caption | Footage |
| --- | --- | --- | --- |
| 0:00 | 0 | Fed up with never reaching **your Japanese goal?** | Full screen, no phone: "Fed up", "with never reaching", "your Japanese", then a big gold "goal?", one per beat, each with the app's wood pick (the hanko on "goal?"). The gold route line draws under it onto a station ring, then the words lift away as the phone rises in |
| 0:03.8 | 8 (drop) | 辻 Try **Tsuji!** | The hub. Board is pressed on beat 12.5 |
| 0:06.6 | 14 | **Set up your goal** and follow your progress | N4 picked, then the plan arrives under its 案内 sign: Apr 24, 2027 |
| 0:12.7 | 27 | Set up your goal and **follow your progress** | The plan's route map: kana, ~450 words, ~900 words, N4 |
| 0:15.0 | 32 | **Connect, board** and you are on track | The pass, Enter the station, the gate and the 辻 TSUJI sign |
| 0:18.8 | 40 | Connect, board and **you are on track** | Today, Depart, a card turned and rated Correct, and the level-up (79 → 80). Then the day cleared on the 30th day in a row: Service complete, the stamp card filling to 30, fireworks, the 一ヶ月 ticket and +1,000 XP |
| 0:37.5 | 80 | Try **more complex learning modes** if you like it | Draw the kanji: 国 ("Country") drawn stroke by stroke, revealed, Correct |
| 0:47.3 | 101 | Assimilate your study with **the practice modes** | Timed reading: the sentence shown, its reading typed, 100%, Correct |
| 0:54.4 | 116 | Join Tsuji right now on **tsuji.app** | The hub. The address stamps in on beat 120 and the last chord lands on beat 124 |

Left out on purpose: the name and account forms, the test ride after
the gate, and the profile.

## Before posting

- **Cover:** pick a frame from 0:00 to 0:03, where the hook is on screen.
- **Sound:** the video carries its own track, so post it with its original
  sound. A trending sound can still be layered on at low volume in TikTok's
  editor.
- **The demo learner.** The run, drawing and practice shots show "Mika", a
  demo account whose 29 days of study were simulated through the app's real
  SRS engine (`pipeline/seed.py`). The figures are what the app computes for
  that history, but nobody actually studied them.

## Re-making it

Everything is in `pipeline/`. Recording needs a local stack (Postgres, the
backend with `DEV_USER_ID`, and `npm run dev`; see CLAUDE.md) and Python
with numpy, scipy and Pillow for the edit. The browser gets a fake Supabase
session and a mocked guest sign-up. Nothing else is stubbed.

```bash
export FILM_DIR=/tmp/tsuji-film CHROMIUM_PATH=...   # CHROMIUM_PATH optional
cd docs/marketing/tiktok/pipeline
# 1. footage (each clip writes $FILM_DIR/frames/<clip>/frames.json: frame
#    times, every sound the app played, taps, keys and marked boxes)
./reset.sh 33333333-3333-4333-8333-333333333333
./serve.sh 33333333-3333-4333-8333-333333333333 && node rec_onboard.mjs
./serve.sh 22222222-2222-4222-8222-222222222222
./arm_demo.sh            # 29 days in a row, 3 cards due, 5 XP short of a level
node rec_clear.mjs       # Today -> level up -> Service complete -> 一ヶ月
node rec_draw.mjs && node rec_readprac.mjs
# 2. sound: the app's voices, then the music
node render_sfx.mjs ../../../../frontend $FILM_DIR/sfx
python music.py
# 3. captions, frame, background; then the edit
node overlays.mjs
python edit.py                      # -> $FILM_DIR/out/tsuji_tiktok.mp4
python edit.py --frames 120,700     # stills, to check a moment
```

- **Captions:** edit them in `overlays.mjs` (`caps`).
- **The cut:** each shot's source-to-beat anchors are in `edit.py` (`SEGS`),
  along with the scene beats, the caption cues and the stamp and final beats.
  Re-film a clip and its moments move, so re-anchor it from its
  `frames.json` events.
- **The music:** chords, motif and arrangement are in `music.py`. The beat
  grid is shared with `edit.py` (`BPM`).
