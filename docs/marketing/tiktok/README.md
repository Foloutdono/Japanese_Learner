# TikTok promo: "Fed up with never reaching your Japanese goal?"

`tsuji-tiktok.mp4` is 1080×1920, 30 fps and 47 s long, with AAC audio at
−14 LUFS (TikTok's playback level). Every phone shot in it is live footage of
the app, recorded in a phone-sized browser (390×780 CSS px, 3× pixel density,
English UI, dark theme).

## Sound

- **Music:** an original track written for this video, synthesized in
  `pipeline/music.py`. No sample or loop is borrowed, so there is nothing to
  license. It runs at 128 BPM in D major: a filtered two-bar intro with a
  riser, then a drop on "Try Tsuji!". After the drop it loops 王道進行
  (G maj7, A7, F#m7, Bm7) under a koto-like pluck in the major pentatonic,
  and it resolves on D under the address.
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

Every shot is re-timed so its taps fall on beats. Each scene starts on a
downbeat and arrives with a train-pull slide (the boarding's own transition,
with motion blur) and a whoosh. Cuts inside a scene are a quick zoom
cross-fade. Captions pop in word by word on the beat, the highlight moves
within a line as the footage changes, and the background glow breathes with
the kick.

| Time | Beat | Caption | Footage |
| --- | --- | --- | --- |
| 0:00 | 0 | Fed up with never reaching **your Japanese goal?** | The welcome hub, slowly pushing in |
| 0:03.8 | 8 (drop) | 辻 Try **Tsuji!** | The phone punches in. Board is pressed on beat 10 and "Alex" is typed |
| 0:07.5 | 16 | **Set up your goal** and follow your progress | Goal N4, the lines, rhythm, the hour (each pick on a beat), then the plan |
| 0:14.5 | 31 | Set up your goal and **follow your progress** | Profile: the pass, the October calendar, the streak, reviews |
| 0:16.9 | 36 | **Connect,** board and you are on track | "Keep your progress": email and password |
| 0:18.8 | 40 | Connect, **board** and you are on track | The pass, Enter the station, the gate |
| 0:22.5 | 48 | Connect, board and **you are on track** | Today, Depart, the 本日 door, a card turned on beat 52 and rated Correct on beat 54 |
| 0:26.3 | 56 | Try **more complex learning modes** if you like it | The grammar ladder answered on beat 62, then 日 drawn stroke by stroke and marked right |
| 0:33.8 | 72 | Assimilate your study with **the practice modes** | Practice list, a comprehension question answered, timed reading typed (100%) and Correct |
| 0:41.3 | 88 | Join Tsuji right now on **tsuji.app** | The hub. The address stamps in on beat 92 and the last chord lands on beat 96 |

## Before posting

- **Cover:** pick a frame from 0:00 to 0:03, where the hook is on screen.
- **Sound:** the video carries its own track, so post it with its original
  sound. A trending sound can still be layered on at low volume in TikTok's
  editor.
- **The demo learner.** The progress, run and practice shots show "Mika", a
  demo account whose 30 days of study were simulated through the app's real
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
#    times plus every sound the app played, tap and key)
./reset.sh 33333333-3333-4333-8333-333333333333
./serve.sh 33333333-3333-4333-8333-333333333333 && node rec_onboard.mjs
python seed.py 22222222-2222-4222-8222-222222222222 Mika 30
./serve.sh 22222222-2222-4222-8222-222222222222
node rec_progress.mjs && node rec_run.mjs && node rec_modes.mjs
node rec_practice.mjs && node rec_readprac.mjs
# 2. sound: the app's voices, then the music
node render_sfx.mjs ../../../../frontend $FILM_DIR/sfx
python music.py
# 3. captions, frame, background; then the edit
node overlays.mjs
python edit.py                      # -> $FILM_DIR/out/tsuji_tiktok.mp4
python edit.py --frames 120,700     # stills, to check a moment
python edit.py --audio              # the mix alone
```

- **Captions:** edit them in `overlays.mjs` (`caps`).
- **The cut:** each shot's source-to-beat anchors are in `edit.py` (`SEGS`),
  along with the scene beats, the caption cues and the stamp and final beats.
  Re-film a clip and its moments move, so re-anchor it from its
  `frames.json` events.
- **The music:** chords, motif and arrangement are in `music.py`. The beat
  grid is shared with `edit.py` (`BPM`).
