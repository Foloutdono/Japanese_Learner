# Store screenshots

The eight store images (Today, a grammar fiche over a grammar question, the
dictionary, the practice stations, a mock exam, the guided kanji trace with its
readings' shares, flashcards with the goal card, the rolling comprehension
text), in French and English. A static tool outside `src/`, like
`../carousel/`: none of it ships with the app.

Every screen is the real app, captured from a running dev stack, never drawn.
`capture.mjs` takes each at an Android-sized 393×740 @3x with a notch's safe
area injected, plus the pieces a slide lifts or floats (cut exactly to their
element, with their place in `rects.json`, so nothing is clipped);
`compose.mjs` sets each in a phone under a big headline (`copy.json`, titles
only) on its line's colour (the pigments of `DESIGN.md`), the lifted piece
standing out of a dimmed screen, as **1080×1920 PNGs**: Google Play's 9:16
phone screenshot (2:1 at most, 320–3840 px a side). Every figure in a title
is the app's (JMdict's 200,000+ entries, KANJIDIC2's 13,108 characters).

The 7-inch tablet set (portrait, 540×960 screens at 2x, drawn into a tablet frame, 1080×1920 too) uses the same
steps with a `tablet` argument and `--tablet`: `node store/capture.mjs fr main tablet`, `node store/compose.mjs --tablet`
(into `out/<lang>-tablet/`). `node store/compose.mjs --feature` makes Google Play's 1024×500 feature graphic.

The **7-inch tablet set is landscape 16:9 (1920×1080)**: `node store/capture_tablet.mjs <lang> main` (and `kanji`,
with 学 new), then `node store/compose_tablet.mjs` into `out/<lang>-tablet7/`. The app is captured at 1280×720,
where it draws its own wide layout (the rail, the side panels); each slide enlarges one real piece of it.
The older portrait `tablet` mode of `capture.mjs`/`compose.mjs` is superseded by it.

```bash
# 0. a dev stack with a learner who has a history (local database only)
cd backend && cp .env.example .env     # DEV_USER_ID=local-dev-user
uvicorn main:app --port 8000
# onboard once (POST /api/onboarding/complete, N5 → N3 goal), then
python ../frontend/store/seed_demo.py && psql "$DATABASE_URL" -f ../frontend/store/seed_demo.sql
cd ../frontend && npm run dev -- --port 5173
# 1. capture (the language is the account's: PATCH /api/profile/learning {"uiLang":"en"})
node store/capture.mjs fr main
# 学 new (no card_modes row, none in glyph_tours) and every other kanji card not due, then:
node store/capture.mjs fr kanji
# 2. compose -> store/out/<lang>/NN-name.png
node store/compose.mjs            # or: node store/compose.mjs fr --only today,goal
```

The kanji step marks 学's first tour done: delete its `glyph_tours` row to take the other language.
`raw/`, `out/` and `.tmp/` are not tracked. `session.mjs` is the fake
session the dev backend ignores (`DEV_USER_ID`); it never reaches a deployed
instance.
