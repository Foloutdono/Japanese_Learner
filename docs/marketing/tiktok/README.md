# TikTok promo: "Fed up with never reaching your Japanese goal?"

`tsuji-tiktok.mp4` is 1080×1920, 30 fps and 52 s long. Every phone shot in it
is live footage of the app, recorded in a phone-sized browser (390×780 CSS px,
3× pixel density, English UI, dark theme). The video has a silent audio track,
so add a sound in TikTok's own editor before you post. A trending sound reaches
more people than any track we could bake in.

| Time | Caption | Footage |
| --- | --- | --- |
| 0:00 | Fed up with never reaching **your Japanese goal?** | The welcome hub (辻 and its seven lines) |
| 0:03 | 辻 Try **Tsuji!** | The learner taps Board and types their name |
| 0:06 | **Set up your goal** and follow your progress | Goal N4, the lines, rhythm, the hour, then "Your plan is ready" (Apr 23, 2027) |
| 0:13 | Set up your goal and **follow your progress** | Profile: the October calendar (15-day streak), reviews and retention, then Statistics |
| 0:17 | **Connect,** board and you are on track | "Keep your progress": an email and password typed in |
| 0:19 | Connect, **board** and you are on track | "Your pass is ready", then Enter the station and the 辻 TSUJI station sign |
| 0:23 | Connect, board and **you are on track** | Today's gate, Depart, the 本日 door, cards flipped and rated, XP rising |
| 0:28 | Try **more complex learning modes** if you like it | The grammar ladder ("Which one fits", answered よ, right), then Draw the kanji (十 drawn stroke by stroke) |
| 0:38 | Assimilate your study with **the practice modes** | The practice list, timed reading practice (typed the reading, 100%), then reading comprehension questions |
| 0:48 | Join Tsuji right now on **tsuji.app** | The welcome hub |

Captions use the app's own fonts (Noto Serif JP 900 and Space Grotesk) and its
gold (`#c99a3e` / `#e6b652`) on its sumi ground. They sit in the top band
(y 120–380), below TikTok's tab bar.

## Before posting

- **Cover:** the first frame already carries the hook. Any frame from 0:00 to 0:03 works.
- **Sound:** pick one in the TikTok editor. The video is cut to a steady
  pace, so most 100–120 BPM tracks fit.
- **The demo learner.** The progress and practice shots show "Mika", a demo
  account whose 30 days of study were simulated through the app's real SRS
  engine (`pipeline/seed.py`). The level, the streak and the statistics
  are what the app computes for that history, but nobody actually studied
  them.

## Re-shooting after a UI change

Everything is in `pipeline/`. Run it against a local stack (Postgres, the
backend with `DEV_USER_ID`, and `npm run dev`; see CLAUDE.md). The browser
gets a fake Supabase session and a mocked guest sign-up. Nothing else is
stubbed, so every screen is the real app on real local data.

```bash
export FILM_DIR=/tmp/tsuji-film CHROMIUM_PATH=...   # CHROMIUM_PATH optional
cd docs/marketing/tiktok/pipeline
# the new learner: the welcome hub to the station gate
./reset.sh 33333333-3333-4333-8333-333333333333
./serve.sh 33333333-3333-4333-8333-333333333333 && node rec_onboard.mjs
# the demo learner with history: progress, run, modes, practice
python seed.py 22222222-2222-4222-8222-222222222222 Mika 30
#   then set user_profiles.guided for that user to all five gates, or the
#   guides cover the screens; clear comprehension_served for it before
#   rec_practice (only three seeded texts exist without an LLM key)
./serve.sh 22222222-2222-4222-8222-222222222222
node rec_progress.mjs && node rec_run.mjs && node rec_modes.mjs
node rec_practice.mjs && node rec_readprac.mjs
# captions, frame, background; then the cut
node overlays.mjs && python compose.py     # -> $FILM_DIR/out/tsuji_tiktok.mp4
```

- **Captions:** edit them in `overlays.mjs` (`caps`).
- **The cut:** each scene's clips, in/out points and speed are in
  `compose.py` (`SCENES`).
- **Checking a clip:** `sheet.py` makes a contact sheet of any clip at chosen times.
- **Tap rings:** `touch.js` draws a ring wherever a finger lands, and
  `rec.mjs` holds the recorder: CDP screencast frames at device resolution,
  re-timed to constant 30 fps.
