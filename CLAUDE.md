# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Japanese-learning web app (kana, vocab, kanji, grammar, reading, listening, SRS review, mock exams). FastAPI backend + React/Vite frontend, Postgres storage, Supabase for auth.

## Visual design

**Before touching any CSS or building any screen, read `DESIGN.md`.** It is the
single source of truth for the app's visual language: the station metaphor, the
pigment rules, the bilingual pairing, and the size/space/radius/tracking scales.

Two rules that cause the most damage when missed:

- **All CSS lives in `frontend/src/index.css`.** One file, on purpose. Do not
  create a per-feature stylesheet — that is how two features ended up inventing
  private spacing token families. Namespace your selectors instead
  (`.exam-*`, `.anl-*`, `.onb-*`).
- **Never invent a size, space, radius or tracking value.** Use the tokens in
  `:root`. If none fits, that is a design decision — raise it rather than
  adding a 95th font size.

See `DESIGN.md` for the full specification: colour families, type, surfaces,
space, motion, structure and the density contract.

## Plans

`plans/` is intentionally untracked — the plan documents are large and have no
runtime purpose. Two consequences worth knowing:

- **Plan numbers are cited in source comments** (e.g. "Plan 034" in
  `PassageLine.browser.test.jsx`), so they must never be reused.
- **`git ls-tree HEAD plans/` under-reports which numbers are taken**, because
  earlier plan files were lost to a working-tree cleanup. Numbers **001–045**
  are used. When starting a new wave, begin at **046** or higher, and check
  `plans/README.md` if it is present on disk.

## Commands

### Backend (`backend/`)
```bash
cp .env.example .env          # then fill in DATABASE_URL / DEV_USER_ID
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
pytest                        # run all tests
pytest tests/test_scheduler.py            # single file
pytest tests/test_scheduler.py::test_name # single test
```
Local Postgres (schema is `backend/srs/data_structure.sql` — a reference snapshot kept honest by `backend/tests/test_schema_declared.py`; the real source of truth is each module's own `CREATE TABLE IF NOT EXISTS` self-migration, run at import time):
```bash
docker run -d --name jp-db -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
docker exec -i jp-db psql -U postgres -c "CREATE DATABASE jp;"
docker exec -i jp-db psql -U postgres -d jp < backend/srs/data_structure.sql
```

### Frontend (`frontend/`)
```bash
npm install
npm run dev       # Vite dev server, proxies /api -> localhost:8000
npm run build
npm run lint
npm test          # vitest
```

`npm run lint` is not the whole lint story: `npm run lint:css` (stylelint,
ratcheted against a checked-in baseline) and `npm run lint:scale` (a
source-level ratchet on font-size/border-radius/gap/padding literals against
`frontend/src/design-scale.json`) both run in CI right after `npm run lint`.
See `frontend/README.md`, "Design conformance guards", for what each one
catches and why violations are baselined/allowlisted rather than fixed
outright.

### Frontend env vars

`frontend/.env.production` is tracked (Vercel reads it), but **Vite does not
load it for `npm run dev`** — dev mode reads `.env.local` /
`.env.development.local`, which are gitignored. Without them the app falls back
to a placeholder Supabase project and every auth call fails with
`ERR_NAME_NOT_RESOLVED`.

One-time setup in a fresh clone or a new git worktree:

```bash
cd frontend && grep -E '^VITE_SUPABASE' .env.production > .env.development.local
```

See `frontend/.env.example` for the full variable list.

## Auth in local dev

Set `DEV_USER_ID` in `backend/.env` and every request is treated as that user with no token check (see `backend/core/auth.py`). This is opt-in only — it must never be set in a deployed environment, and the backend prints a loud warning banner on startup when it's active. Without it, `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` are required and every request does a round trip to Supabase to verify the bearer token.

## Architecture

### Backend layout
- `main.py` — FastAPI app setup: loads `backend/.env`, mounts routers, CORS (deployed frontend origin + `CORS_ORIGINS` env list), static mounts for `kanjivg` (stroke-order diagrams) and `datas/exam_audio` (generated TTS).
- `routes/` — one file per feature area (kana, vocab, kanji, grammar, phrase, reading, translation, dictionary, decks, exams, today, stats, profile, frequency, theme_vocab, translations, onboarding, journey). Thin FastAPI routers; business logic lives in `srs/` and `study/`.
- `core/` — cross-cutting singletons: `auth.py` (identity), `db.py` (raw psycopg2 connections), `srs_instance.py` / `frequency_store_instance.py` (module-level singletons constructed once at import time from `DATABASE_URL`, imported by routes needing SRS/frequency state).
- `srs/` — the spaced-repetition engine (`srs.py` is the large one — scheduling, review submission, card state), `scheduler.py` (interval/difficulty math), `storage.py` (DB access), `models.py` (`CardState`/`ReviewResult` dataclasses), `xp.py` (XP curve), `batch_cache.py`, `frequency_store.py`.
- `study/` — content-generation and evaluation logic that sits above the SRS layer: exam generation (`exam_blueprint.py`, `exam_*_gen.py` per section — vocab/kanji/grammar/reading/listening — `exam_validation.py`, `exam_scoring.py`, `exam_tts.py`), card selection/lookup (`card_index.py`, `card_lookup.py`, `daily_queue.py` for the "Today" queue), difficulty modeling (`difficulty.py`), Japanese text processing (`furigana.py`, `morphology.py`, `grammar_match.py`, `sound.py`), and study `modes.py`/`structures.py` defining the review-mode taxonomy per content type.
- `content/` — static/generated reference data (grammar points, vocab, kanji readings/meanings, frequency lists, reading sentences) as Python modules or JSON, built/refreshed by scripts in `scripts/`.
- `scripts/` — one-off data-pipeline scripts (build JMDict/frequency/theme/radical indexes, generate grammar sentences, migrate card IDs, wipe SRS data). Not part of the request path.
- `translations/` — i18n string tables served to the frontend.

Card IDs are namespaced per user as `"{user_id}:{card_id}"` (`core/auth.py:prefixed`/`unprefixed`) so SRS state for the same content differs per learner in the same tables.

### Frontend layout (`frontend/src/`)
- `App.jsx` — top-level router; gates all routes behind Supabase session state (`lib/supabase.js`). `/dev/rewards` is a dev-only route (tree-shaken out of production builds via `import.meta.env.DEV`).
- `screens/` — one file per route/page (largely 1:1 with `App.jsx` routes).
- `components/` — shared UI grouped by feature area (`decks`, `dictionary`, `profile`, `rewards`, `selection`, `station`, `stats`, `study`, `ui`). `components/station/` holds cross-cutting screen-transition UI (`DepartureGate`, `TrainDoor`) rendered outside `<Routes>` in `App.jsx` so their animations survive the navigation that would otherwise unmount them.
- `domain/` — pure client-side domain logic: card shape helpers, kana sets, level titles, reward tiers, stats modeling, study-mode definitions, XP curve. Mirrors backend concepts but has no network calls.
- `stores/` — small client-side state modules (boarding/departure transition state, profile summary, rating scale) — not Redux, just modules with subscribable state.
- `exam/` — mock-exam UI: question rendering, exam kind definitions, `examService.js` for the exam API calls. Pairs with `screens/Exam*.jsx`.
- `hooks/useCardSession.js` — shared review-session state machine used by the study screens.
- `lib/api.js` — fetch wrapper. `apiFetch` returns the raw `Response`; `apiJson`/`apiJsonWithTimeout` add `ApiError` on non-2xx and an owned `AbortController` — prefer these over hand-rolled fetch+timeout in new screens.
- `lib/supabase.js` — Supabase client; falls back to a placeholder project if env vars are unset (keeps builds/tests that don't touch auth from crashing on construction).
- `config/` — static config: `stations.js` (screen/route metadata), `navLinks.js`, `identity.js`.
- `locales/` + `i18n.jsx` + `LangContext.jsx` — French/English string tables and language context.

### Data flow
Frontend calls same-origin `/api/*` FastAPI routes in both dev and prod (Vite proxy in dev, Vercel rewrites in prod; there is no backend-origin env var — see Deployment below) with a Supabase bearer token → `core/auth.get_user_id` resolves the user → routes use `core/srs_instance.srs` (the shared `SRSEngine`) and `study/` helpers to read/write per-user card state in Postgres, and static `content/` data for card content itself.

## Deployment

- Backend: Render (`render.yaml`), root `backend/`, persistent disk mounted at `/data` for SRS storage.
- Frontend: Vercel (`frontend/vercel.json`), SPA rewrite to `index.html`, plus
  proxy rewrites for `/api`, `/kanjivg` and `/exam-audio` to the Render
  backend. The browser never calls `onrender.com` directly — some mobile
  carriers cannot reach that shared zone at all (diagnosed 2026-09-01: every
  CORS preflight died in transit on 4G), and same-origin also removes the
  preflight round trip. `VITE_API_URL` is retired — the code no longer reads
  it (a leftover copy in the Vercel dashboard once out-prioritised the tracked
  `.env.production` and silently rebaked the direct URL). A new backend static
  mount needs a matching rewrite in `vercel.json` (and in `vite.config.js`'s
  dev proxy).
