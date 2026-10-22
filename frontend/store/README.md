# Store screenshots

The eight App Store / Play Store images (Today, a grammar question, the
dictionary, the practice stations, a mock exam, the guided kanji trace, the
goal card, the breakdown), in French and English. A static tool outside `src/`,
like `../carousel/`: none of it ships with the app.

Every screen is the real app, captured from a running dev stack, never drawn:
`capture.mjs` takes them at an iPhone 16 Pro's 393×852 @3x with the notch's
safe area injected, `compose.mjs` sets each in a phone under its headline, on
its line's colour (the pigments of `DESIGN.md`), as 1290×2796 PNGs. A callout
is a crop of another real capture. Words are in `copy.json`; every figure in
them is the app's (7,964 words · 2,383 kanji · 545 grammar points; JMdict's
200,000+ entries and KANJIDIC2's 13,108 characters in the dictionary).

```bash
# 0. a dev stack with a learner who has a history (local database only)
cd backend && cp .env.example .env     # DEV_USER_ID=local-dev-user
uvicorn main:app --port 8000
# onboard once (POST /api/onboarding/complete, N5 → N3 goal), then
python ../frontend/store/seed_demo.py && psql "$DATABASE_URL" -f ../frontend/store/seed_demo.sql
cd ../frontend && npm run dev -- --port 5173
# 1. capture (the language is the account's: PATCH /api/profile/learning {"uiLang":"en"})
node store/capture.mjs fr main
node store/capture.mjs fr kanji   # needs 学 new and every other kanji card not due
# 2. compose -> store/out/<lang>/NN-name.png
node store/compose.mjs            # or: node store/compose.mjs fr --only today,goal
```

`raw/`, `out/` and `.tmp/` are not tracked. `session.mjs` is the fake
session the dev backend ignores (`DEV_USER_ID`); it never reaches a deployed
instance.
