<p align="center">
  <img src="frontend/brand/icon.png" alt="The Tsuji icon: the character 辻 in cream on black, underlined in gold" width="120" height="120">
</p>

<h1 align="center">辻 Tsuji</h1>

<p align="center">
  <strong>Learn Japanese, from kana to reading real text.</strong><br>
  Vocabulary, kanji, grammar, reading, listening and mock JLPT exams, from N5 to N1,<br>
  in one app with one daily review queue.
</p>

<p align="center">
  <!-- TODO: replace with the custom domain once it is live -->
  <a href="https://japanese-learner-seven.vercel.app"><strong>Try Tsuji →</strong></a>
  &nbsp;·&nbsp;
  <strong>English</strong> · <a href="README.fr.md">Français</a>
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="FastAPI on Python 3.12" src="https://img.shields.io/badge/FastAPI-Python%203.12-009688?logo=fastapi&logoColor=white">
  <img alt="PostgreSQL 16" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white">
  <img alt="Supabase Auth" src="https://img.shields.io/badge/Supabase-Auth-3FCF8E?logo=supabase&logoColor=white">
  <img alt="Capacitor 8" src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white">
  <img alt="Installable PWA" src="https://img.shields.io/badge/PWA-installable-5A0FC8?logo=pwa&logoColor=white">
</p>

---

## Contents

- [About](#about)
- [What makes Tsuji different](#what-makes-tsuji-different)
- [Features](#features)
- [Content at a glance](#content-at-a-glance)
- [Screenshots](#screenshots)
- [Try it](#try-it)
- [Free during early access](#free-during-early-access)
- [How it was built](#how-it-was-built)
- [Engineering highlights](#engineering-highlights)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started (development)](#getting-started-development)
- [Deployment](#deployment)
- [Documentation map](#documentation-map)
- [Author](#author)
- [Credits and licence](#credits-and-licence)

---

## About

Tsuji is a Japanese-learning app for the web and mobile. It covers the whole
path from the first kana to the JLPT N1, in English and French.

I'm learning Japanese myself, at an intermediate level and working towards
the N3. For a long time that meant juggling several apps. Anki handled
vocabulary: it's powerful, but austere and slow to set up. Separate tools
for grammar and kanji never talked to each other. Duolingo is pleasant, but
too light to prepare for the JLPT. After months of study I still couldn't
read a real page of Japanese.

Tsuji is the app I wanted instead. Vocabulary, kanji, grammar, reading,
listening and exam practice live in one place, feed one daily review queue,
and lead back to real Japanese text at every step. It is being built as a
real product, and it also shows what one student can ship by directing an AI
coding agent.

## What makes Tsuji different

- **One path, one queue.** Kana, vocabulary, kanji, grammar and your own
  cards all feed a single spaced-repetition queue. A day's study is one list,
  not five apps.
- **Built to read real Japanese.** The Analyzer takes any text you type,
  photograph or pull from a video's subtitles. It splits the text into words
  with readings and grammar, marks which words you already know, and opens
  each word's dictionary entry in one tap.
- **A station, not a menu.** 辻 (*tsuji*) means "crossroads". It is a
  *kokuji*, a character invented in Japan, and its five strokes draw the
  intersection it names. The app is designed as a Japanese railway station:
  - each subject is a line with its own colour;
  - screens are stations;
  - your profile is a commuter pass;
  - the day's reviews wait at the fare gate.

  The metaphor gives a dozen subjects one coherent map instead of a menu of
  menus.

## Features

Tsuji is organised into five tabs.

### Today
- **Daily queue:** every review due across every section, in one queue, with
  the day's share of new cards beside it.

### Learn
- **Kana:** hiragana and katakana, sound by sound. You learn to recognise
  them first, then write them by hand.
- **Vocabulary:** 8,090 words graded from N5 to N1. Study by level, by
  frequency, by theme, or beyond the syllabus, from written form to meaning
  and back.
- **Kanji:** 2,212 characters by level, with stroke-order diagrams. Read
  them, then write them from memory. You can also study by radical, one
  family of characters at a time.
- **Grammar:** 541 points from N5 to N1, each with a written lesson (what it
  attaches to, what it does, how it differs from its neighbours) and example
  sentences.
- **Decks:** your own cards, typed in or imported from a spreadsheet, and
  scheduled alongside the built-in material.
- **Library:** decks published by other learners, ready to follow.

### Practice
- **Reading:** real sentences pitched at your level, chosen by JLPT level,
  by frequency or from your own cards. Read first, check after.
- **Comprehension:** short passages followed by questions, the reading half
  of the JLPT rehearsed.
- **Translation:** put a sentence into Japanese yourself, then compare it
  with a reference answer and get feedback on yours.
- **Dictation:** hear a sentence at most twice and write down what was said,
  in romaji.
- **Mock exams:** full-length, timed practice exams in the JLPT format,
  covering vocabulary, grammar, reading and listening. Scoring is unofficial.

### Dictionary
- **Dictionary:** look up a kanji, a kana or any of 212,000 words. Each
  entry shows readings, radicals, stroke order, examples, and whether you've
  met it before. Favourites keep the entries you want to come back to.
- **Analyzer:** paste text, take a photo, or load a video's captions. Tsuji
  splits it sentence by sentence and word by word, shows the grammar each
  sentence uses, and grades it by JLPT level. An AI explanation is available
  on request.

### Profile
- **Commuter pass:** your XP level, streak and progress, plus a weekly and
  an all-time leaderboard.
- **Statistics:** how well your cards are holding, week by week; how far
  ahead each card is scheduled; and where you're losing them.
- **Settings:** your level and daily pace, a four- or six-button rating bar,
  a light, dark or system theme, and an English or French interface.

New learners start with a short onboarding. They choose their level or take
a placement test, pick a daily pace (5, 10 or 20 new cards), and take a
guided first ride through a flashcard and a reading exercise.

## Content at a glance

All content is organised by JLPT level:

| Level | Vocabulary | Kanji | Grammar points |
|---|---:|---:|---:|
| N5 | 675 | 103 | 91 |
| N4 | 642 | 144 | 108 |
| N3 | 1,771 | 366 | 110 |
| N2 | 1,767 | 367 | 115 |
| N1 | 3,235 | 1,232 | 117 |
| **Total** | **8,090** | **2,212** | **541** |

- Every grammar lesson is written by hand, never generated. Each example
  sentence is checked to contain its pattern and to stay within its level's
  kanji.
- The dictionary covers 212,000 JMdict entries and all 13,108 KANJIDIC2
  characters, with 6,702 stroke-order diagrams from KanjiVG.
- Glosses and the whole interface are available in English and French.

## Screenshots

<!--
TODO: add the six screenshots below to docs/readme/, then remove this
comment's opening and closing markers so the gallery shows.

  docs/readme/today-phone.png         Today's queue, on a phone
  docs/readme/analyzer-phone.png      The Analyzer breaking down a sentence, on a phone
  docs/readme/grammar-phone.png       A grammar lesson, on a phone
  docs/readme/dictionary-desktop.png  A dictionary entry, on a computer
  docs/readme/exam-desktop.png        A mock exam, on a computer
  docs/readme/stats-desktop.png       The statistics page, on a computer

Phone shots: about 390×844 (portrait). Computer shots: about 1440×900.

<table>
  <tr>
    <td align="center"><img src="docs/readme/today-phone.png" alt="Today's review queue on a phone" width="240"><br><sub>Today</sub></td>
    <td align="center"><img src="docs/readme/analyzer-phone.png" alt="The Analyzer breaking down a Japanese sentence" width="240"><br><sub>Analyzer</sub></td>
    <td align="center"><img src="docs/readme/grammar-phone.png" alt="A grammar lesson on a phone" width="240"><br><sub>Grammar lesson</sub></td>
  </tr>
</table>

<p align="center"><img src="docs/readme/dictionary-desktop.png" alt="A dictionary entry on the desktop layout" width="720"><br><sub>Dictionary, on a computer</sub></p>
<p align="center"><img src="docs/readme/exam-desktop.png" alt="A mock JLPT exam on the desktop layout" width="720"><br><sub>Mock exam</sub></p>
<p align="center"><img src="docs/readme/stats-desktop.png" alt="The statistics page on the desktop layout" width="720"><br><sub>Statistics</sub></p>
-->

*Screenshots are coming soon.*

## Try it

<!-- TODO: replace with the custom domain once it is live -->
- **On the web:** open **[japanese-learner-seven.vercel.app](https://japanese-learner-seven.vercel.app)**
  in any modern browser and create an account with an email address and
  password, or with Google.
- **Install it:** Tsuji is a Progressive Web App, so it installs like a
  native app and opens full-screen.
  - In Chrome or on Android, choose *Install app*.
  - On iPhone or iPad in Safari, tap *Share → Add to Home Screen*.
- **Phone or computer:** Tsuji is designed for phones first. At 1100 px and
  wider it switches to a desktop layout with a side rail and two-column
  screens.
- **Native apps:** Android and iOS builds, packaged with Capacitor, are in
  preparation.
- **Languages:** the interface and the glosses are in English and French.

## Free during early access

Tsuji is free to use during early access.

A paid plan, the **Pass** (定期券, "commuter pass"), is built into the app but
not on sale yet. When it launches, the free tier and the Pass are planned to
split as follows. The limits may change before launch.

| | Free | Pass |
|---|---|---|
| Reviews | 200 credits on sign-up, then 30 more a day (up to 50); one credit per review. Kana are always free. | Unlimited |
| Your own decks | 7 | 100 |
| Your own cards | 200 | 10,000 |
| Practice modes (reading, comprehension, translation, dictation, mock exams) and the Analyzer | Not included | Included |

## How it was built

Tsuji is built by one person directing an AI coding agent. I'm a third-year
student in artificial intelligence. I set the product direction, the design
and the priorities, reviewed the work, and tested it every day. The code
itself was written by **[Claude Code](https://claude.com/claude-code)**,
Anthropic's coding agent. I did not write it by hand.

Since spring 2026 that has produced 120 numbered plans and more than 160
merged pull requests. The work is organised around four habits:

1. **Written plans, shipped in waves.** Every piece of work starts as a
   numbered plan that I read and approve before any code is written. A plan
   sets out the scope, the decisions, the files and the tests. Related plans
   ship together as a wave: the mobile release, the deck library, the
   desktop layout, and so on.
2. **Mockups before code.** New screens are explored as mockups first, and I
   choose a direction before implementation starts.
3. **Daily use and feedback.** I study with Tsuji on my phone and report
   what I find. Decisions made this way are recorded as "owner-directed" in
   [`DESIGN.md`](DESIGN.md), so they are not reopened later.
4. **Written rules, and checks that enforce them.** Four sets of documents
   set the rules the agent works by:
   - [`CLAUDE.md`](CLAUDE.md): how to work in this repository;
   - [`DESIGN.md`](DESIGN.md): the visual language;
   - [`CONTEXT.md`](CONTEXT.md): the shared vocabulary;
   - 18 [architecture decision records](docs/adr/).

   Continuous integration enforces them: more than 300 test files, linters,
   and design guards that fail the build when a font size, a spacing value
   or a colour escapes the design's token scale.

An agent also checks the content. Twice a week, a scheduled Claude Code
session takes one slice of what Tsuji teaches (grammar points, vocabulary or
example sentences) and tries to disprove it against reference sources. It
files its findings as a single GitHub issue and never edits the content
itself: a wrong correction that arrives with a citation is worse than the
original error. The method is in
[`docs/content-audit/PLAYBOOK.md`](docs/content-audit/PLAYBOOK.md).

## Engineering highlights

### Architecture
- **One codebase, three targets.** The same React app ships as a website,
  an installable PWA, and Android and iOS apps through Capacitor. The native
  apps reach the API through the web origin, so there is a single proxy and
  a single CORS surface
  ([ADR 0008](docs/adr/0008-native-shells-reach-the-api-through-the-web-origin.md)).
- **A second layout for computers.** From 1100 px wide, the app switches to
  a desktop layout. Below that width every screen renders exactly the
  phone's markup. Tests at phone, tablet, desktop and wide viewports keep
  the two layouts apart
  ([ADR 0018](docs/adr/0018-the-desk-is-a-second-chrome-that-never-reaches-the-phone.md)).
- **A small memory footprint.** The large reference sets (212,000 JMdict
  entries and 13,108 kanji) are stored in SQLite and read on demand rather
  than held in memory, so the API fits in a 512 MB server.
- **Controlled AI costs.** Every model call goes through one client, which:
  - falls back across providers (Gemini, then OpenAI, then OpenRouter);
  - records the tokens each call uses;
  - keeps a shared pool, so an expensive exercise is generated once and
    served to many learners;
  - applies daily limits per learner.

### Japanese language processing
- **A custom spaced-repetition scheduler.** Cards step through learning
  intervals from 3 minutes to a day. After that, each card's own difficulty
  sets its intervals. Progress is tracked per card and per study mode.
- **Two-tier sentence analysis.**
  - The local tier is instant, free, and works without any AI provider:
    MeCab/UniDic tokenisation, readings, furigana, grammar detection, JLPT
    grading and matches against your decks.
  - The deep tier adds contextual glosses and an explanation. It is a model
    call, made only when you ask for it for a given sentence
    ([ADR 0001](docs/adr/0001-two-tier-sentence-analysis.md)).
- **Grammar detection from conjugation, not spelling.** Forms such as the
  passive, causative, potential, volitional, 〜てみる and 〜すぎる are
  detected from the tokenizer's conjugation fields rather than by matching
  characters.
- **OCR in the browser first.** Photos are read on the device with
  Tesseract.js, so the image stays on the phone. A vision model is called
  only in three cases: Tesseract's confidence is low, the result is mostly
  not Japanese, or the learner asks for another attempt. The recognised text
  is always shown for editing before analysis
  ([ADR 0004](docs/adr/0004-ocr-runs-client-first.md)).
- **Generated text that respects your level.**
  - A comprehension passage is written around grammar points and words
    drawn from the chosen level, so it doesn't reuse the same three every
    time.
  - Every passage is measured before it is served. Vocabulary above the
    level is capped at one word in twenty, or the text is rejected.
    Out-of-level kanji are rewritten in kana
    ([ADR 0015](docs/adr/0015-generated-text-is-gated-on-its-level-mix.md)).
  - Mock exams follow the official JLPT section structure, are validated
    before they are served, and have synthesised listening audio.

### Quality
- **Tests.**
  - Backend: 106 test files (pytest), run against a real PostgreSQL.
  - Frontend: 209 test files (Vitest), in seven lanes: Node, plus Chromium
    at phone, tablet, touch, desktop and wide viewports.
- **Design guards in CI.**
  - A Stylelint ratchet: new violations fail, while existing ones are
    tracked in a baseline.
  - A token-scale check on font sizes, spacing and radii.
  - Colour-contrast checks.
- **Content checks.** Every grammar example must contain its own pattern and
  stay within its level's kanji. A script audits the vocabulary deck for
  duplicates, readings and gaps.
- **Recorded decisions.** 18 [architecture decision records](docs/adr/)
  explain why the system is shaped the way it is.

### Product and privacy
- **First-party analytics only.** There is no third-party SDK. The app
  records only a closed list of events, never anything a learner typed and
  never a raw URL
  ([ADR 0012](docs/adr/0012-behaviour-is-recorded-first-party-or-not-at-all.md)).
- **Accounts are erased properly.** Deleting an account removes the
  learner's data, and maintenance scripts clean up after accounts removed by
  any other route
  ([ADR 0010](docs/adr/0010-learner-rows-are-reconciled-with-auth-not-cascaded-from-it.md)).
- **Bilingual throughout.** English and French, including French typography
  rules.
- **Monetisation measured before launch.** The credit system and the Pass
  offer are built and instrumented before any store exists, so demand can be
  measured before a price is set.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Vite 8, plain CSS with design tokens in a single stylesheet |
| Mobile | PWA (vite-plugin-pwa), Capacitor 8 for Android and iOS |
| Backend | Python 3.12, FastAPI, Uvicorn, psycopg2 (raw SQL, no ORM) |
| Data | PostgreSQL 16 (on Supabase), SQLite for the dictionary data |
| Auth | Supabase Auth (email and password, Google) |
| Japanese | fugashi + UniDic (MeCab), pykakasi, JMdict, KANJIDIC2, KanjiVG |
| AI | Gemini, OpenAI and OpenRouter through OpenAI-compatible HTTP; Tesseract.js for OCR |
| Audio | edge-tts for exam listening and dictation; the browser's speech synthesis for study |
| Testing | pytest, Vitest with Playwright (Chromium), ESLint, Stylelint |
| Hosting and CI | Vercel (web), Render (API), GitHub Actions |

## Architecture

```mermaid
flowchart LR
  W["Web and PWA"] --> V["Vercel<br/>static site + /api proxy"]
  N["Android and iOS<br/>Capacitor"] --> V
  V --> A["FastAPI<br/>on Render"]
  A --> DB[("PostgreSQL<br/>learner data")]
  A --> R[("SQLite and JSON<br/>dictionary and decks")]
  A --> L["LLM providers<br/>Gemini, OpenAI, OpenRouter"]
  A --> T["edge-tts<br/>exam audio"]
  W -. sign-in .-> S["Supabase Auth"]
  N -. sign-in .-> S
  A -. token check .-> S
```

The browser only ever talks to one origin. Vercel serves the app and
forwards `/api`, the stroke-order diagrams and the exam audio to the
FastAPI backend. The backend keeps each learner's progress in PostgreSQL. It
reads the dictionary and the decks from files shipped with the code, and
calls an AI provider only for the features that need one.

```
.
├── backend/            FastAPI application
│   ├── routes/         one thin router per feature
│   ├── srs/            spaced-repetition engine, scheduler, XP, schema
│   ├── study/          exams, sentence analysis, tokenizer, AI client, dictation
│   ├── content/        authored content: grammar (N5–N1), sentences, audio clips
│   ├── datas/          vocabulary and kanji decks, dictionary databases
│   ├── scripts/        data builds, migrations, maintenance
│   └── tests/          pytest suite
├── frontend/           React + Vite application
│   ├── src/            screens, components, hooks, domain logic, locales (en, fr)
│   ├── android/, ios/  Capacitor native projects
│   └── public/         icons, PWA assets, privacy page
├── docs/               decision records, design notes, release and audit guides
├── CLAUDE.md           the working guide to this codebase
├── DESIGN.md           the visual language
└── CONTEXT.md          glossary of domain terms
```

## Getting started (development)

These are the essentials. [`CLAUDE.md`](CLAUDE.md) and
[`frontend/README.md`](frontend/README.md) cover the rest. Run each block
from the repository root.

**Prerequisites:** Python 3.12, Node 22 or later, and Docker (or a local
PostgreSQL 16).

**1. Start a database**

```bash
docker run -d --name jp-db -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
docker exec -i jp-db psql -U postgres -c "CREATE DATABASE jp;"
docker exec -i jp-db psql -U postgres -d jp < backend/srs/data_structure.sql
```

**2. Run the backend** (on port 8000)

```bash
cd backend
cp .env.example .env          # the defaults match the database above
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- `DEV_USER_ID` in `.env` makes the backend treat every request as that one
  local user, with no token check. It is for local development only and
  must never be set on a deployed server; the backend prints a warning
  banner when it is on.
- AI keys (`GOOGLE_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`) are
  optional. Without one, the AI-backed features return an error: exam
  generation, comprehension, translation feedback, the Analyzer's
  explanations and photo recognition by a vision model. Everything else
  works.

**3. Run the frontend** (on port 5173)

```bash
cd frontend
grep -E '^VITE_SUPABASE' .env.production > .env.development.local
npm install
npm run dev
```

Open <http://localhost:5173> and sign in. The dev server forwards `/api` to
the backend on port 8000.

**4. Run the tests**

```bash
# Backend: the tests use their own database.
docker exec -i jp-db psql -U postgres -c "CREATE DATABASE jp_test;"
docker exec -i jp-db psql -U postgres -d jp_test < backend/srs/data_structure.sql
cd backend
DATABASE_URL=postgresql://postgres:dev@localhost:5432/jp_test DEV_USER_ID=test-user python -m pytest -q
```

```bash
# Frontend
cd frontend
npx playwright install chromium   # once, for the browser test lanes
npm test
npm run lint && npm run lint:css && npm run lint:scale && npm run lint:ink
```

If `DATABASE_URL` isn't set, the backend tests look for a database at
`localhost:5433/jp_test`.

## Deployment

- **Web:** Vercel builds `frontend/` from `main`.
  [`frontend/vercel.json`](frontend/vercel.json) forwards `/api`, `/kanjivg`
  and `/exam-audio` to the backend, so the browser only talks to one origin.
- **API:** Render runs the FastAPI backend, as described in
  [`render.yaml`](render.yaml). A persistent disk stores the generated exam
  audio.
- **Database and sign-in:** Supabase (PostgreSQL and Auth). Each backend
  module creates its own tables when it starts, and
  [`backend/srs/data_structure.sql`](backend/srs/data_structure.sql) is the
  reference snapshot of the schema.
- **Mobile:** pushing a `vX.Y.Z` tag on `main` builds a signed Android App
  Bundle and uploads an iOS build to TestFlight. See
  [`docs/release.md`](docs/release.md).
- **GitHub Actions:** four workflows.
  - `CI`: backend and frontend tests, linters and the build.
  - `Mobile`: the native builds.
  - `Database maintenance`: weekly log pruning and history compaction.
  - `Weekly digest`: a weekly usage summary.

## Documentation map

| Document | What it covers |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | The full working guide: commands, architecture, conventions, maintenance scripts |
| [`DESIGN.md`](DESIGN.md) | The visual language: the station metaphor, colour, type, spacing, motion, layout |
| [`CONTEXT.md`](CONTEXT.md) | The glossary: what *card*, *deck*, *mode*, *sentence*, *passage* mean here |
| [`docs/adr/`](docs/adr/) | 18 architecture decision records |
| [`docs/design/`](docs/design/) | Notes on the mobile and desktop layouts |
| [`docs/release.md`](docs/release.md) | How to ship a web, Android and iOS release |
| [`docs/oauth.md`](docs/oauth.md) | How Google sign-in works on the web and in the native apps |
| [`docs/llm-commercial-plan.md`](docs/llm-commercial-plan.md) | The choice of AI providers and cost control |
| [`docs/content-audit/PLAYBOOK.md`](docs/content-audit/PLAYBOOK.md) | How the twice-weekly content audit works |
| [`backend/content/grammar/README.md`](backend/content/grammar/README.md) | The grammar catalogue's format and style guide |
| [`frontend/README.md`](frontend/README.md) | Frontend commands, native shells and the design guards |
| [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) | Licences of the third-party data and fonts |

## Author

<!-- TODO: replace the placeholders below -->
**[Your Name]**, third-year Bachelor's student in Artificial Intelligence at
Hénallux (Namur, Belgium), learning Japanese.

I'm looking for an **internship from February to May 2027, in Belgium**, in
**AI-assisted software development** or **full-stack development**. Tsuji
shows how I work: I take a product from idea to production by directing an
AI coding agent. That means defining the work, writing down the rules,
reviewing the result and testing it in real use.

- LinkedIn: [LinkedIn URL] <!-- TODO -->
- Portfolio: [Portfolio URL] <!-- TODO -->
- GitHub: [@Foloutdono](https://github.com/Foloutdono)

## Credits and licence

Tsuji's dictionary and reference data come from open projects, used under
their own licences:

- **JMdict / JMnedict**, **KANJIDIC2** and **RADKFILE**, by the
  [Electronic Dictionary Research and Development Group](https://www.edrdg.org/):
  CC BY-SA 4.0.
- **[KanjiVG](https://kanjivg.tagaini.net/)** by Ulrich Apel, the
  stroke-order diagrams: CC BY-SA 3.0.
- **[Tatoeba](https://tatoeba.org)**, some example sentences: CC BY 2.0 FR.
- **VOICEVOX:春日部つむぎ**, the station announcements.
- **Noto Sans JP**, **Noto Serif JP** and **Space Grotesk**: SIL Open Font
  License 1.1.

The full notices are in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

© 2026 [Your Name]. All rights reserved. The source code of this project is
not licensed for reuse. The third-party data above remains under its own
licences.
