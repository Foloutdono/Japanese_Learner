# Ads

Video ads for the stores' and the platforms' feeds, drawn in code from the
app's own tokens, mark and sound recipes, and rendered here. They are not
part of the app or the landing page: nothing under `src/` or `landing/`
imports them.

## The 30-second practice ad

A vertical (1080 × 1920, 30 fps, H.264 + AAC) ad for TikTok and Instagram
Reels that sells the six practice platforms. In English, for paid
placements: the platform's own button carries the link, so the last card
shows the address and points down at that button.

```bash
cd frontend
npm run ad                                  # both cuts, into ads/out/
npm run ad -- --still 6.9,23.6              # single moments, as PNGs
npm run ad -- --sheet                       # one frame a second, as a contact sheet
npm run ad -- --audio                       # the stems and their mix only
```

It needs `npm install` (Playwright, the Noto fonts) and `ffmpeg` on the
PATH. Where Playwright's own Chromium is missing, set `CHROMIUM_PATH`
(in the cloud sessions: `/opt/pw-browsers/chromium`). A full render takes
a few minutes. Two files come out:

| File | What it is |
| --- | --- |
| `ads/out/tsuji-practice-30s.mp4` | The ad: music and effects, mastered to -14 LUFS, -1 dBTP. |
| `ads/out/tsuji-practice-30s-sfx.mp4` | The same picture with the effects only, for laying a track from TikTok's Commercial Music Library or Meta's Sound Collection. Ads cannot use trending sounds. |

`ads/out/` is not committed: the source renders the same file every
time.

### How it is made

| File | Role |
| --- | --- |
| `practice30/page.mjs` | The page: every scene laid out at once, with the app's tokens (`landing/tokens.mjs`), its fonts and its mark. The figures (words, kanji, grammar points, the exam's questions, minutes and pass mark) are counted by `landing/content.mjs` and the address comes from `landing/config.mjs`, so the ad can't fall out of step with the landing page. |
| `practice30/ad.css` | The ad's sheet, drawn at 432 × 768 and captured at a scale of 2.5, so the app's phone-sized scale reads at video size. |
| `practice30/timeline.js` | `window.seek(t)`: the stage at `t` seconds, a pure function of `t`. It also publishes `window.CUES`, the moments the sound lands on. |
| `practice30/score.js` | `window.renderScore()`: the music, a 120 BPM track written on the Web Audio API, and the effects, the app's own voices from `src/lib/audio/recipes.js` placed on the cues, both rendered offline. |
| `render.mjs` | Seeks frame by frame in Chromium, pipes the frames to ffmpeg, then muxes and masters the two cuts. |

Nothing is sampled or recorded, so there is nothing to license. The
station announcements in `public/sounds/announcements/` are deliberately
left out: they are 春日部つむぎ's voice, whose terms ask for a credit and
set their own conditions on commercial use.

### The script

Every cut sits on a beat (120 BPM, a beat is 0.5 s).

| Time | Picture | Sound |
| --- | --- | --- |
| 0.0–1.25 | **Hook.** "Months of flashcards…" over a deck being swiped, a day counter running to 180. | Ticking hats, a muffled kick, the app's card swipe on each card. |
| 1.25–2.25 | "…and you still can't read **this?**" 駅でコーヒーを飲みます。 slams in, shakes, two red ? and a wavy underline. | A low boom, the app's wrong answer. |
| 2.25–3.5 | "You're missing **practice.**" in the gate's gold, the six lines bursting out behind it. | Impact, then a riser and a snare roll. |
| 3.5–5.0 | The 辻 mark, its road drawn in gold, "6 ways to practise Japanese", the six rings popping in. They then fly up to become the rail. | The drop. The app's gate chime, a bell for each ring. |
| 5.0–8.5 | **1/6 読書 Reading.** "Read real sentences": the reading typed, Check, ✓, furigana, and the breakdown word by word. | Typing, the app's correct chime. |
| 8.5–11.5 | **2/6 理解 Comprehension.** "Understand short texts": a passage highlighted, the right answer picked. | |
| 11.5–14.5 | **3/6 翻訳 Translation.** "Translate into Japanese": kana typed, converted to kanji, ✓, the tutor's note. | |
| 14.5–17.5 | **4/6 書取 Dictation.** "Write what you hear": the clip plays, romaji typed, ✓, the line revealed. | |
| 17.5–20.5 | **5/6 作文 Composition.** "Compose your own sentences": 〜たい given, a sentence written, "〜たい found", the tutor's suggestion. | |
| 20.5–24.5 | **6/6 模試 Mock exam.** "Sit mock JLPT exams": the clock, a kanji-reading item answered, the paper turned over to 142 / 180, the answer sheet filling, a red 合格 stamp. "Unofficial scoring" stays on screen. | Arpeggios join the track; fare ticks, the app's stamp. |
| 24.5–26.5 | **The whole course, N5 → N1** on a departure board: words, kanji and grammar points flapping in, plus a line on spaced repetition. | The floor drops out, the board's flaps, a riser. |
| 26.5–30.0 | **Call to action.** The mark, "Start practising today", the gate button "Start free" with its reader's ripples, the address, "Free during early access · no account needed", an arrow down to the platform's button. | The final drop, the app's platform chime, a last stab. |

The English is British, as the site's is ("practise" the verb,
"practice" the noun).

### The safe zone

The platforms' own captions, buttons and icon column cover the frame's
foot and its lower right. Everything that must be read stays within
x 80–940 and y 140–1520 of the 1080 × 1920 frame, and the right edge
stays clear of x 940 from y 900 down. Only the ground (the glow, the
sleepers, the line stripe at the foot) runs past it.

### Claims to keep true

- **"Free during early access · no account needed"** is the landing
  page's own line. Change it the day the pass goes on sale.
- **"Unofficial scoring"** must stay on the mock-exam scene: the paper is
  built to the JLPT's format, not by its organisers.
- **142 / 180** is an illustration of one learner's result, not a claim
  about results. It is set in `page.mjs` (`examScore`).
- The figures on the board are counted, not typed. Re-render after a
  deck change.

### Copy for the placement

Suggested text to go with the video in Ads Manager (each platform's
limits are noted):

- **Primary text:** "Flashcards teach you words. Practice teaches you
  Japanese. Read, listen, translate and write real sentences at your
  JLPT level, then sit a mock exam. Free during early access."
- **Headline** (Meta, 40 characters): "6 ways to practise Japanese"
- **TikTok ad text** (100 characters): "Months of flashcards and still
  can't read a sentence? Practise Japanese for real 🇯🇵"
- **Button:** Learn more, or Sign up
- **Destination:** the English page,
  `https://japanese-learner-seven.vercel.app/en`. The site reads no
  campaign parameters today (its analytics are first-party and closed,
  `docs/adr/0012`), so each platform's own reporting is the measure of
  the placement. A UTM tag on the link is harmless, but nothing records
  it until the page is taught to.
