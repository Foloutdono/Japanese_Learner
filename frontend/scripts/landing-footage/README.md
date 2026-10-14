# The landing page's footage

The clips behind the features section (`landing/README.md`, "Footage") are
filmed from the real app by a script, so a clip can be remade the day a
screen changes and shows exactly what ships. Nothing here is edited: a script
only does what a finger does, and the recorder films what the app draws.

On screen: a demo account (`seed.py`), **the English interface** and the dark
theme. Phone clips are 1080×2340 (360×780 at 3x), 30 fps, muted, no status
bar; computer clips are 1440×900.

## What it needs

Everything runs on this machine, with no Supabase and no model key:

```bash
# Postgres (CLAUDE.md, "Commands"), with the schema loaded, then:
cd backend
echo 'DEV_USER_ID=demo-footage' >> .env          # beside DATABASE_URL
uvicorn main:app --port 8000
cd ../frontend
grep -E '^VITE_SUPABASE' .env.production > .env.development.local
npx vite --port 5173 --host 127.0.0.1
```

`session.mjs` hands the page a Supabase session it believes in (the backend,
run with `DEV_USER_ID`, checks no token), sets the interface to English and
the browser's scheme to dark. Chromium comes from `PLAYWRIGHT_BROWSERS_PATH`;
`ffmpeg` must be on the path.

## Filming

```bash
cd frontend/scripts/landing-footage
python seed.py                                   # the demo learner: N5, level 13, 74 cards due
SNAPSHOT=1 node film.mjs phone kana              # dumps the seeded database to out/demo.sql, films kana
node film.mjs phone aujourdhui kana vocabulaire kanji grammaire pratique analyseur examen
node film.mjs desk kana …                        # the computer's clips, named <id>-desk
```

`out/` (gitignored) gets `<id>.mp4` and `<id>.jpg`, the still, named as the
bucket expects. **Each clip starts from the seeded database**: `film.mjs`
restores `out/demo.sql` before every take, so answering a card in one clip
changes nothing in the next. Upload the files to the `landing` bucket by
hand (`landing/README.md`).

| File | What it is |
| --- | --- |
| `clips.mjs` | One script per clip: the screen it starts on and what is pressed. Where the app allows it a clip ends on the screen it began on, so the loop is seamless. |
| `helpers.mjs` | A press, a stroke, and the strokes of any glyph (KanjiVG, the app's own stroke-order data) drawn at a hand's pace. |
| `session.mjs` | The demo learner's browser. |
| `deterministic.mjs` | Frame-by-frame filming for the screens a CPU-only machine cannot paint in real time. Today's gate is a print of a few dozen animated layers: about 10 frames a second here (60 on a phone), so a real-time screencast of it is choppy. The clip is marked `smooth: true` and the browser's clock is made ours: every frame advances timers, animations and transitions by exactly 1/30 s, then renders, however long that takes (about 2 minutes a clip). Needs Playwright's `chromium_headless_shell`. |
| `record.mjs` | The screencast, cut into constant 30 fps h264. The phone gets its 3x from the browser itself, since a screencast returns CSS pixels whatever the emulated scale. |
| `seed.py` | The demo learner and a fortnight of reviews, through the app's own endpoints. |

## What this cannot film

- **Dictation** needs the voice engine (`CLAUDE.md`, "Speech"): without it the
  screen answers "Couldn't load a clip", so the reading and dictation clip
  shows reading practice. Run the engine locally and add a dictation step to
  `pratique` in `clips.mjs` to include it.
- **A YouTube link** needs the network and a proxy: the analyser clip types a
  sentence instead.
- **A mock exam paper** is built without the model here, which leaves out the
  paraphrase part: the paper has 18 questions in three parts, where a
  generated one has 21 in four.

Clips are cast by chance in places (the kana and the kanji asked are the
deck's next card), so two takes differ. Film again until the take is a good
one.
