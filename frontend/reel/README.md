# 映像 — reels of the real app (plan 210)

Short vertical videos (TikTok, Reels, Shorts) that show what Tsuji does.
Each one is a **hook** (someone cannot read a sign, a menu, a manga
page, a message), a **transition** into the phone, the **app played for
real** by a finger, and an **end card**. A reel is one JSON script. The
generator films the actual app (`src/`): its screens, its motion and
its synthesised sounds. So a reel never shows a feature the app does
not have, and an app change shows up in the next render.

```bash
cd frontend
npm run reel -- reel/reels/sign-photo.json     # → reel/out/sign-photo.mp4: 1080×1920, 30 fps, with sound
```

| option | |
| --- | --- |
| `--out file.mp4` | where the film goes (default `reel/out/<script>.mp4`) |
| `--width 540` | a quick look: a quarter of the pixels, the same film |
| `--still 6.5` | one frame, at 6.5 s, as a PNG beside the film |
| `--frames dir --every 15` | every 15th frame as a JPEG (for a contact sheet) |
| `--preview` | prints a URL that plays the reel live in a desktop browser (432×768, no sound, nothing recorded) |
| `--fps 60`, `--max 90` | the frame rate, and the longest the film may run |

What it needs: the frontend's own `npm install`, `ffmpeg` on the PATH,
Chromium's headless shell (Playwright's, found on its own; `REEL_CHROME`
points at another), and the backend's Python packages (`pip install -r
backend/requirements.txt`; `REEL_PYTHON` picks the interpreter). No
database, no network, no model calls. With `VOICEVOX_URL` set in
`backend/.env` a dictation reel's clip is voiced by the engine; without
it the clip is silence.

A film renders at about real time at `--width 540` and about four
times its length at full size. It runs on its own clock, not the
machine's: a slower machine makes the same film, only more slowly.

## The samples

| script | the story | ≈ |
| --- | --- | --- |
| `sign-photo.json` | a construction notice nobody can read → snapped → the analyzer takes it apart: the words, a word's entry, 〜につき, the translation | 38 s |
| `manga-reading.json` | a raw manga panel → its line lifts off the page into reading practice: read aloud in romaji, checked, broken down | 34 s |
| `station-words.json` | Shinjuku's station sign → vocabulary cards, a level-up, a card mastered | 27 s |
| `menu-photo.json` | (French) an izakaya's menu in vertical kanji → snapped → analyzer | 33 s |
| `first-ride.json` | the origin station's sign → the four lines → the kana line boarded → あ, い, う | 37 s |
| `write-letter.json` | a pen pal's handwritten letter → 駅 and 会 written stroke by stroke | 35 s |
| `study-tour.json` | Today's gate, a day's cards and the day cleared; kana; kanji with its strokes; grammar's ladder | 86 s |
| `practice-tour.json` | translation, composition, dictation, comprehension, a mock exam, the dictionary, the deck library, the pass | 133 s |

The first two are the two openings the generator was asked for; copy
any of them to start a new reel.

## A script

```json
{
  "lang": "en",
  "learner": "Mika",
  "beats": [
    { "hook": "sign", "style": "construction", "text": "この先工事中につき通行止め", "caption": "POV: day one in Tokyo 😭" },
    { "snap": true, "caption": "so you snap it…" },
    { "app": "analyzer", "from": "photo", "text": "この先工事中につき通行止め", "translation": "Road closed ahead due to construction." },
    { "end": true }
  ]
}
```

`npm run reel` checks a script before it films anything, and names the
beat and the field it cannot play (`beat 3: needs "text" (a string)`).

### The film and the learner

| field | default | |
| --- | --- | --- |
| `lang` | `en` | `en` or `fr`: the app's language, and the end card's |
| `learner` | `Mika` | the name on the pass |
| `level` | `N4` | the learner's JLPT level: where runs and practice open |
| `xpLevel` | `12` | the level printed on the pass |
| `levelUpIn` | `4` | XP short of the next level: the first good answer levels up (a large number: never) |
| `streak` | `23` | days in a row, on the pass and in the stamp book |
| `plan` | `pro` | `free`, `pro` or `max`: the pass's tier |
| `theme` | `dark` | `dark` or `light` (washi) |
| `clock` | `12:30` | the phone's time, `hh:mm` |
| `timezone` | `Asia/Tokyo` | the clock's zone, and where the days of the stamp book start |
| `captions` | `board` | `board`, `plain` or `none` |
| `finger` | `dot` | `dot` or `hand` |
| `pace` | `1` | 0.5 to 2: the whole film slower or faster |
| `seed` | `7` | the handheld drift and where the marks fall: another seed is another take |
| `fps`, `width`, `height` | `30`, `1080`, `1920` | always 9:16 |
| `music` | none | `{ "file": "track.mp3", "volume": 0.22 }`, beside the script, under the whole film, faded at the end |
| `max` | `150` | the longest the film may run (a ceiling: a film ends with its last beat) |

### Beats

A beat names its kind once, as its key: a hook, a transition, an app,
the end. Every beat takes a `caption`: a line, or `{ "text", "at":
"top" | "middle" | "bottom", "hold": seconds }` (`null` holds it until
the next). In a caption, `*word*` is set in gold, emoji are drawn in
colour and Japanese is set in the Japanese face.

#### Hooks: what the viewer sees first

| hook | styles | its own fields |
| --- | --- | --- |
| `sign` | `notice`, `construction`, `station`, `street`, `shop` | `text`; `sub` (the small line); `title` and `from` (a notice's head and foot); `reading`, `romaji`, `prev`, `next` (a station's) |
| `board` | `departures` | `text` (the ticker); `rows`: `[["12:34", "各停", "しぶや", "2"], …]` |
| `menu` | `wall` | `text` (the paper of the day); `items`: `[["らーめん", "八五〇"], …]` |
| `page` | `manga`, `book`, `letter` | `text`; `sfx` (manga); `before`, `after`, `folio` (a novel's other columns); `to`, `from` (a letter's) |
| `chat` | `message` | `text`; `from` (who sent it); `before` (an earlier bubble) |
| `media` | `photo`, `video` | `file`; `subject`; `overlay`; `start`, `volume` (video) |

Any hook also takes `duration` (seconds on screen, 2.7 by default),
`puzzle: false` (no `?` marks), `lean` (how far the camera pushes in,
1.1) and `place` (the world behind it: `street`, `platform`, `izakaya`,
`desk`, `cafe`).

**Your own picture or footage** is a `media` hook, with the file beside
the script. The text is in it already, so `subject` says where:
`[x, y, w, h]` in fractions of the frame (`[0.25, 0.33, 0.5, 0.22]` is a
box a quarter in, a third down, half as wide and a fifth as tall). The
camera frames it, the `?` marks stand around it, the viewfinder of a
snap holds it and the analyzer's crop is drawn over it. A video (mp4,
mov, webm…) is cut into the film's frames and plays from `start` with
its own sound (`volume`, 1 by default), which fades as the app takes
over. It runs for its own length (at most 12 s) unless `duration` says
otherwise. `overlay: true` prints the hook's `text` over the picture,
which a `lift` can then carry into the app.

```json
{ "hook": "media", "style": "video", "file": "me-at-the-station.mp4", "subject": [0.3, 0.2, 0.4, 0.15],
  "caption": "me trying to read the departure board 🫠" }
```

#### Transitions: from the world into the phone

| | |
| --- | --- |
| `snap` | the phone comes up as a camera, focuses on the text, takes the picture, and a swipe switches to the app holding it (the analyzer, `from: "photo"`) |
| `lift` | the text comes off the object, the phone rises under it, and each character lands in its place in the app (reading practice) |
| `rise` | the phone comes up with the app already open |
| `cut` | a hard cut to the app, with a punch-in |
| `whip` | the world is swept aside and the phone swept in |

Between two app beats nothing is written: the next feature's station
plate passes over the screen while the app changes place under it.

#### Apps: the app, played

Every app beat takes `caption` (as it starts), `reveal` (when its result
shows), `level` (instead of the script's), and seconds for `think`,
`read` and `hold`.

| app | what is played | its own fields |
| --- | --- | --- |
| `analyzer` | a photo cropped and read (OCR), or text pasted; the breakdown; entries opened; a grammar point; the explanation | `text`; `from` (`photo`, `text`); `translation`; `explain` (the explanation's words; `translation` otherwise); `taps` (the words opened); `point` (the pattern to open, or `false`); `crop` `{x, y, w, h}`; `ocr` (what the photo reads as, if not `text`) |
| `reading` | a sentence read and typed in romaji, checked, broken down | `text`, `translation`, `answer` (the romaji typed), `taps`, `breakdown: false` |
| `translation` | a prompt, the Japanese typed on the phone's Japanese keyboard, the tutor's review | `text` (the Japanese), `translation` (the prompt), `review`, `verdict`, `good`, `fix`, `typing` (the phrases converted one by one) |
| `composition` | a grammar point, a sentence written with it, the review | `point` (`grammar_N5_〜てください`), `text`, as translation |
| `dictation` | a clip listened to, what was heard typed in romaji, the check | `text`, `translation`, `answer`, `listens` |
| `comprehension` | a passage read, its questions answered | `answers` (how many) |
| `today`, `review` | Today's gate, the ticket gate, the day's cards, the day cleared | `words`, `kana`, `kanji` (the day's cards); `clear`; `ratings` |
| `kana` | a run of kana; in `kana.write_kana`, each written by the finger, stroke by stroke | `kana`: `["か", "き", "く"]`; `mode`; `ratings` |
| `vocab` | a run of words | `words`: `["駅:えき", "電車:でんしゃ"]` (spelling:reading); `mode`; `ratings` |
| `kanji` | a run of kanji, the first one's strokes drawn; in `kanji.write_kanji`, each written by the finger | `kanji`: `["駅"]`; `mode`; `strokes: false`; `ratings` |
| `grammar` | a point on its ladder: Choisir (its sentence, the endings that look alike), then Construire, each hole typed; the cards are the backend's own for the point | `point` (`grammar_N5_まだ〜ていません`: `grammar_<level>_<pattern>`, as `content/grammar/` names it; 〜てください when left out); `answer`, `typed` (what is chosen and typed, the right ones by default); `build: false` (Choisir alone) |
| `exam` | a mock JLPT paper, answered and scored | `picks`: `[2, 1, 2, 2]` |
| `dictionary` | a search typed in kana and converted, the entry, its strokes | `search`, `reading`, `category` (`kanji`, `vocab`, `grammar`, `hiragana`, `katakana`) |
| `decks` | the library, a deck opened and followed | `pick` (which deck) |
| `pass` | the pass turned over, the stamp book, the lines, the ranking | |
| `learn` | the Learn tab's four lines, their stops and what is due; one boarded, through the app's departure, to its platform | `line` (`kana`, `vocab`, `kanji`, `grammar`; `false` to only look) |

`ratings` is the answer given each card in turn (`[4, 4, 3]`; 4, Correct,
by default). `mode` is the run's exercise, as the app names it
(`kana.flashcard.f2b` by default; `kana.write_kana`, `kanji.write_kanji`,
`vocab.flashcard.b2f`…). In a writing mode the finger writes each
character on the board in its stroke order, along KanjiVG's own strokes,
before the app lays the answer over it.

#### The end

`{ "end": true }` ends on the app's mark, its name, a line and what to
do next. `caption` replaces the line, `cta` the button and `url` the
address; the defaults are the landing page's own copy, in the reel's
language.

## What is real and what is staged

- **The app is real.** It boots in the phone at 390×844 from `src/`,
  with a learner signed in, and is used through real input: taps and
  drags, text, and the Japanese IME's composition.
- **What the app's server computes is the server's own code.** Every
  sentence's breakdown, reading and furigana, the dictionary entries,
  how right a typed answer is, a grammar point's lesson, the
  comprehension exercise and the decks' sizes come from the backend's
  modules, run once per script without a database
  (`backend/scripts/reel_fixtures.py`, cached in `reel/.cache/<script>/`).
- **What a model would write is the script's.** The analyzer's
  explanation and the tutor's reviews are what the script says (or a
  plain "natural and correct"). Write them as the app would show them,
  and as carefully: a wrong gloss in a promo misleads more people than
  one in the app.
- **The learner is a fixture**: their days, their figures, the
  ranking (`stage/fixtures.js`, and the script's fields above).
- Nothing leaves the machine. The app's requests are answered inside
  the page (`stage/backend.js`), its analytics included, and a request
  nobody answers is logged and refused, never sent.

## How it is made

- `reel.mjs`: the command. It checks the script (`script.mjs`), asks
  the backend (`requestOf` → `reel_fixtures.py`), cuts footage, takes
  each snap's photo, films, mixes the sound and encodes with ffmpeg.
- `server.mjs`: Vite with the app's own config. It serves the director
  at `/__reel/director`, the app at `/__reel/stage/*` and the cache at
  `/__reel/files/*`.
- `capture.mjs`: Chromium's headless shell on virtual time. A frame is
  drawn only when the renderer asks for one, and every timer, animation
  and transition in both pages advances exactly one frame per frame.
  That is what makes the film deterministic.
- `director/`: the 432×768 board (the frame at 2.5× for 1080 wide).
  It holds the world of the hook (`hooks.js`), the phone and the
  camera's moves (`phone.js`), the keyboard, the finger, the captions,
  the transitions and the end card. `apps/` has one scene per feature
  (`route`, `ready`, `before`, `play`).
- `stage/`: the app's boot in the phone, with a session, the stand-in
  server (`backend.js`) and its answers per feature. `audio.js` records
  every sound on the film's clock (an OfflineAudioContext, rendered
  once the film is over); `media.js` plays `<audio>` elements on it.

A new feature needs a scene in `director/apps/`, its name in
`script.mjs`'s `APPS`, the requests it makes answered in `stage/`, and a
sample. `src/reel.test.js` holds the scenes to the scripts and each
scene's place to a route the app declares.

## Before posting

- `reel/out/` and `reel/.cache/` are not committed.
- Music: only a track you have the rights to.
- A dictation clip voiced by VOICEVOX Nemo carries its licence: credit
  "VOICEVOX Nemo" in the post, and never use the audio to train a
  model.
