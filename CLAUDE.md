# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Tsuji** (辻) — a Japanese-learning web app (kana, vocab, kanji, grammar, reading, listening, SRS review, mock exams, and a library of decks learners publish to each other). FastAPI backend + React/Vite frontend, Postgres storage, Supabase for auth.

The name is the glyph: 辻 is the masthead, the icon and the plate at the origin station (辻駅). `Tsuji` is its name in Latin letters — the store name, the PWA `short_name` and the bundle id `app.tsuji`. See `DESIGN.md`, "The idea".

## Visual design

**Before touching any CSS or building any screen, read `DESIGN.md`.** It is the
single source of truth for the app's visual language: the station metaphor, the
pigment rules, "say less", and the size/space/radius/tracking scales.

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
runtime purpose.

- **Plan numbers are cited in source comments**, so a number is never reused.
  The next free number is **206**. `git ls-tree HEAD plans/` under-reports
  what is taken (earlier plan files were lost to a working-tree cleanup), and
  `plans/README.md` has fallen behind before: grep the source for `plan NNN`
  before claiming a number, and claim it before the first commit, so the
  commit messages and the code carry the same one.
- **No summary per plan here.** A finished plan is recorded by its commits,
  its PR and the comments that cite it, not by an entry in this file. When a
  plan teaches something every later change must respect, write it as a rule
  in the section it belongs to (below, or in `DESIGN.md`), not as history.

### Rules learned from past plans

- **A redesign is drawn before it is built.** Draw the options on a canvas,
  let the owner pick, then build the pick as drawn. Do not build a direction
  the owner has not chosen.
- **A change to an id is a migration.** A card id (vocab, kanji, grammar
  pattern, pool card) is the key of every learner's SRS rows: a rename goes
  through the renames module and its `migrate_*` script, never an edit in
  place. A card whose reading was wrong is retired (`RETIRED`) rather than
  moved, so its learners start the corrected card fresh.
- **Bump the revision when the output changes.** Anything cached or stored
  per output carries a revision: `LOCAL_REV` in `study/analysis.py` (the
  breakdown), the `phrase_analysis_cache` version (the deep tier),
  `TOUR_REV` in `study/grammar_tour.py`, `VOICE_REV` and `KANA_REV` (audio),
  `REV` in `frontend/scripts/today-print/build.py` (Today's print, plan 205).
  A change to what any of them produces bumps it, or learners keep the old.
- **The grammar detector and the lookups change by counter-case.** Every new
  rule or refusal is pinned in `tests/test_grammar_precision.py` /
  `tests/test_lookup_precision.py` with the sentence it must find and the one
  it must not, and the change is diffed over every sentence the app teaches
  before it ships.
- **A quiz question is one only understanding answers.** The tour's quiz
  (plan 196) is written per point (`tour.quiz`: read a sentence, build a
  form, say the right thing in a situation) and is never "which of these
  uses it?" (the eye answers that), never a translation printed over the
  question it answers (a twist's and a meaning's `tr` is held back until it
  is answered), and never a sentence or a question twice in a tutorial.
  `study/grammar_check.py` holds it; `content/grammar/README.md`, "The
  quiz", is the style guide. Draft with `python -m scripts.check_tour_quiz`.
- **Every grammar point is asked in Choisir.** The contrast drill needs a
  sentence the matcher or the detector can blank and a rival that is
  certainly wrong in the gap; a point with neither (は, も, ない形, 〜て（理由）)
  carries `choose`, questions written by hand (`study/grammar_choose.py`,
  plan 201; `content/grammar/README.md`, "Choisir's own questions") and
  never falls back to the flashcard. `study/grammar_check.py` fails a point
  with neither. What the gate cannot see is a second right answer, the
  commonest defect there: write every wrong filling out in the sentence, let
  the translation printed under it carry what the grammar does not, keep the
  stem outside the hole (悲し＿＿＿ + み), and let an independent reviewer
  attack the batch before it ships.
- **One progress number.** A card's progress is `srs._progress`, 0 (new) to
  1 (mastered); every `learned / total`, bar and figure sums it. Never add a
  second curve beside it.
- **The grammar ladder walks its steps in its own row.** A
  `grammar.ladder` card's step (Choisir ×3, Construire ×4, mastered, the
  relapse) is read from its `card_modes` fields by `srs/ladder.py`, which
  sets them so `srs._progress` and the stage read the walk unchanged, and
  which both the review and its forecast run through, the forecast
  saying where each rating leaves the point (`review_preview[q].step`,
  plan 198) so the client never copies the pass rule. Never store the
  step beside the row; a row written before plan 194 reads onto the walk.
- **XP and studied days are separate.** A card review goes to `review_log`, a
  practice answer pays through `srs.award_practice` into `xp_ledger`; both
  make a studied day. A bonus (`day_clear`) never does.
- **Model calls are rationed and costed.** A new feature that calls a model
  goes through `core/daily_limit.py` (`daily_usage`) for its daily ceiling and
  into `scripts/llm_cost_model.py` for its cost. Nothing the learner typed is
  kept.
- **A new per-learner table is erased with the account.** Add it to
  `DELETE /api/account` (`routes/account.py`) in the same change.
- **One table's self-migration per transaction.** A failing `ALTER` must not
  roll back another table's.
- **The reading bank is held at its level from both sides.** A row of
  `content/reading_sentences.py` (which reading and translation share) has
  nothing above its level and, at N4–N1, two deck words of its own level
  besides its grammar point, its focus one of them, its point found by the
  detector and a French translation (`row_problems`). Draft new rows
  through `python -m scripts.reading_bank_report --check FILE.json`.
- **A width change is held on both sides.** A desk change keeps the phone's
  DOM unchanged (`src/deskfree.phone.test.jsx`), and the short desk
  (1280×600, the `short` lane) is checked too. A phone bug fixed gets its own
  phone test.

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

### Speech — the voice engine (plan 121, ADR 0019)

Every voice the server makes (exam listening, dictation, the `/api/tts` card
readings) and the kana deck's clips come from a **self-hosted VOICEVOX Nemo
engine**, reached over HTTP by `study/voice_engine.py`. On Render it is the
`voicevox-nemo` private service in `render.yaml`, in Frankfurt beside the
backend, and the backend's `VOICEVOX_URL` is its internal address
(`host:port`). Locally, run the same image and
set `VOICEVOX_URL=http://localhost:50121` in `backend/.env`:

```bash
docker run -d --name voicevox-nemo -p 127.0.0.1:50121:50121 voicevox/voicevox_nemo_engine:cpu-0.23.0
```

Port **50121**, not VOICEVOX's usual 50021. Without an engine nothing breaks:
listening sections are skipped (before any model call is paid for), dictation
and `/api/tts` answer 503, and the tests never need one.

The licence's one condition is the credit **"VOICEVOX Nemo"** (Credits page
and `THIRD_PARTY_NOTICES.md`). It also **forbids using the audio for machine
learning**: never publish a generated clip as, or feed it into, a dataset.

**Changing the voice is a code change, not an env var**: edit
`voice_engine.DEFAULT_VOICES` (plan 121b, the owner's choice: slot 0, the
reader of words, dictation and lone kana, is 女声6; 1 and 2 are dialogue
speakers A, a woman, 女声6, and B, a man, 男声1; 3 is the exam narrator,
女声1) or a voice's pace in `VOICE_TEMPO` (男声1 speaks at 0.9), and bump
`VOICE_REV` in `voice_engine.py` **and** `lib/audio/speech.js`
(`tests/test_kana_audio.py` holds them equal). A clip made before the current
revision is never served; it is remade in place, under the name
`dictation_log`/`exam_papers` already store. Then run `revoice_audio`
(below) so nobody waits for it.

```bash
python -m scripts.audition_voices                 # every voice, as a sample file each
python -m scripts.audition_voices --roles 女声6,女声6,男声1,女声1  # one exam item: reader,A,B,narrator
python -m scripts.audition_voices --tempo 男声1   # one voice at four speeds, for VOICE_TEMPO
python -m scripts.build_kana_audio --check        # kana clips missing, stray, off-spec or unsourced
python -m scripts.build_kana_audio --force        # remake frontend/public/sounds/kanas/ on the engine
python -m scripts.build_kana_audio --from-bank datas/kana_source/ritsu/strong --pitch A3 --credit namine-ritsu --force
```

The kana clips are committed, and `kanas/sources.json` records which voice
made each one, as its row id in `domain/attributions.js`;
`tests/test_kana_audio.py` fails on a voice without its Credits row and
`THIRD_PARTY_NOTICES.md` section. The deck is cut from a recorded voice,
波音リツ's UTAU bank 強連続音 Ver1.5.1 at A3 (plan 121c, ADR 0020,
`scripts/kana_bank.py`), whose terms ask for no credit, report or
permission (the app credits him anyway). The owner chose it by ear, as
"good for now": a better kana voice is a known follow-up. To remake it,
unzip `https://www.canon-voice.com/voice/r73_strong_ren0151.zip` (names in
Shift_JIS) under `backend/datas/kana_source/ritsu/strong/`, which is
gitignored, and run the `--from-bank … --pitch A3` line above; a trial
set for listening goes to `--out datas/kana_source/trial-…`. A remade set
needs a new `KANA_REV` in `lib/audio/playback.js` (`ritsu1` now), or
returning learners keep the old one for a year.

The one optional warm-up, and it needs no database:

```bash
python -m scripts.build_dictation_audio --check   # what is missing
python -m scripts.build_dictation_audio           # synthesize it
python -m scripts.build_grammar_audio --tours     # the grammar tours' scenes (plan 187d)
```

The grammar tours (plan 187d) speak through `GET /api/grammar/audio`,
which voices only lines the catalogue says, by who says them: the reader
for an example or a twist, speaker A for the other person in a scene and
B for the learner. `build_grammar_audio` makes them ahead of the first
learner, as `build_dictation_audio` does for dictation; without it each
line is made on the request that wants it. Without `--tours` it also
voices every example sentence in the catalogue (~2,400 lines).

書取 (dictation, `/practice/dictation`) plays a clip per line of
`content/listening_clips.py`. Nothing depends on having run this — a missing
clip is synthesized on the request that wants it, and again by
`study/exam_audio_repair.py` if the file is later lost — but the first learner
of the day otherwise waits for five syntheses on the voice engine before the
screen can show anything. Running it twice costs nothing: a clip the current
voice already made is skipped without a call to the engine.

**Changing `study/dictation.RATE` renames every clip in the collection**, and
deliberately: the speaking rate is part of the audio's content key, so a clip
read at a new speed is a new file. The old ones become garbage the next run of
`prune`-nothing will collect — delete `datas/exam_audio/*.mp3` (or the mounted
`EXAM_AUDIO_DIR`) by hand after such a change, then re-run the script.
Local Postgres (schema is `backend/srs/data_structure.sql` — a reference snapshot kept honest by `backend/tests/test_schema_declared.py`; the real source of truth is each module's own `CREATE TABLE IF NOT EXISTS` self-migration, run at import time):
```bash
docker run -d --name jp-db -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
docker exec -i jp-db psql -U postgres -c "CREATE DATABASE jp;"
docker exec -i jp-db psql -U postgres -d jp < backend/srs/data_structure.sql
```

### Database maintenance

Five operator scripts, none of them on the request path (six with
`prune_withdrawn`). **All of them report and change nothing without `--yes`**,
so the first run of any of them is safe:

```bash
cd backend
python -m scripts.purge_orphans        # rows whose Supabase auth user is gone
python -m scripts.compact_review_log   # roll old review rows up, then trim
python -m scripts.compact_events       # same, for the 足跡 trail (event_log)
python -m scripts.prune_logs           # cap the logs nothing reads past a point
python -m scripts.prune_withdrawn      # decks an author deleted, past their grace
python -m scripts.drop_legacy_tables   # tables a removed feature left behind
```

One more is read-only and needs no flag, so it is safe to run at any time:

```bash
python -m scripts.weekly_digest        # the four numbers, as markdown
```

Two others fill a shared cache ahead of demand rather than maintaining
one. Neither is required — both caches fill themselves from real traffic
— and both cost model calls, so both report first:

```bash
python -m scripts.prewarm_phrase_cache --dry-run        # the ~520 curated sentences
python -m scripts.prewarm_comprehension_pool --dry-run  # exercises per (level, lang)
python -m scripts.prewarm_exam_papers --dry-run         # one paper per exam id
```

None of the three is what makes a fresh deploy usable: the comprehension
pool is never empty, because `content/comprehension/*.json` (plan 111,
three hand-written exercises per level in both languages, held to the
same checks as a model answer by `tests/test_comprehension_seed.py`) is
upserted into `comprehension_pool` when `routes/reading.py` is imported,
keyed on `seed_key` so a corrected seed updates its row. The prewarm
scripts grow the pools past that floor; `prewarm_comprehension_pool`
reports the seeded and the generated rows apart. Exam papers have no
seed -- a paper is ~35 model calls -- so `prewarm_exam_papers` is the
only thing that spares the first learner at each exam id the wait.

Three are one-shots, each run once after a deploy that changed the ids a
content set serves — `content/grammar/renames.py` for grammar points,
`content/vocab_renames.py` for vocab entries, `content/kanji_renames.py`
for kanji (plan 112, the 23 characters the deck taught at two levels).
Each renames the learner's card rows to the new ids, merges on collision,
and leaves anything it does not recognise in place and reported. Vocab
alone can also **retire** an id that has no card to move to
(`vocab_renames.RETIRED`, the N5 より、ほう). It drops the schedule
(`cards`, `card_modes`) and the deck rows, pins and favourites that name
the card, and keeps `review_log` and `card_first_review`, so no figure
summed over them moves. Grammar's `RETIRED` only reports.

```bash
python -m scripts.migrate_grammar_ids  # report; --yes to apply, --user to scope
python -m scripts.migrate_vocab_ids    # report; --yes to apply, --user to scope
python -m scripts.migrate_kanji_ids    # report; --yes to apply, --user to scope
python -m scripts.migrate_pool_cards   # same, for a pool card whose word the deck now teaches
python -m scripts.migrate_grammar_ladder  # plan 187e: each studied point onto the ladder
```

The last is run once, after the deploy that carries the grammar ladder
(plan 187e), which makes `grammar.ladder` grammar's primary track: it
writes each studied point a ladder row with the schedule of its best
grammar mode and folds the old `grammar.flashcard.f2b` row (Today's main
lane before it) into it. Until it runs, Today deals already-studied points
as new on the ladder. **After any change to `content/grammar/*.json`, run
`python -m scripts.build_ladder_flags`**: `content/grammar/ladder.json`
writes down which points Construire (`grammar.build`, typed since plan 194)
and write can be asked on, and
`tests/test_grammar_ladder.py` fails while it disagrees.

The fourth reads `datas/vocab/pool_moves.json`, which
`scripts/prune_pool_overlap.py` appends to for every pool row it takes
out (plan 110b): a learner who studied 母 from the pool before it was an
N5 card keeps that history on the N5 card.

One more one-shot, run once after the deploy that carries plan 097's
columns (`user_profiles.tutorial_at`, `guided`) and before the frontend that
reads them: it stamps the first ride as seen on every account that boarded
before the ride existed, so nobody with three thousand reviews is shown
how to flip a card. Same shape as the others — reports first.

```bash
python -m scripts.backfill_first_ride  # report; --yes to apply, --user to scope
```

And one after any deploy that changes the voice (plan 121 did, from edge-tts
to VOICEVOX Nemo). Run it from the backend's Render Shell, since it needs the
database and the disk the clips live on. It remakes every dictation clip and
every clip a stored paper refers to, in place and in the current voice. Then
it deletes the clips that cannot be remade: stale files only, never one the
current voice made. A second run resumes where the first stopped.

```bash
python -m scripts.revoice_audio        # report; --yes to remake and delete
```

A vocab card id is `vocab_{level}_{kanji}_{kana}`, so **correcting either
surface field of a deck entry orphans its SRS rows** — and the deck key
`"{kanji}::{kana}"` that `frequency_overrides.item_key` stores along with
them. Plan 091 corrected 34 entries and `migrate_vocab_ids.py` is what
carries the progress across; a future deck correction needs its own entries
in `vocab_renames.MOVES` for the same reason, or, for residue that was
never a word and has no card to fold into, one in `vocab_renames.RETIRED`
with its reason. **After any deck change, run
`python -m scripts.audit_vocab_deck --write-snapshot`,
`python -m scripts.placement_report --rebuild-order --write-lists` (two
runs; each flag is its own) and, for an added
word, `python -m scripts.prune_pool_overlap --yes`** (the JMdict pool is
"everything not in the deck"; this takes the new word's pool row out,
senses moved to `curated_senses`, ids untouched — never rebuild the pool
from another JMdict edition, a pool card's id is its row's position in
the export) and commit `datas/vocab/vocab_served.json`,
`vocab_frequency.json` and `vocab_jmdict.sqlite3` with it: `tests/test_vocab_deck.py` fails
on an id that left the deck without a `MOVES` line, and on a served id
the snapshot has not seen.

Two things are worth knowing before reaching for any of them:

- **`review_log` is not an audit log.** Lifetime XP, the level, total reviews,
  the streak, the 番付 standing and the daily-new budget are every one of them
  a `SUM`/`COUNT`/`MIN` over that table — there is no other copy. A plain
  `DELETE ... WHERE reviewed_at < ...` is therefore a partial account reset,
  not a retention policy. `compact_review_log.py` is the way to bound it: it
  folds the rows into `review_daily` / `card_first_review` (declared in
  `data_structure.sql`) *before* deleting them, and `srs.py`'s readers add the
  two halves back together, so no figure the learner sees moves. Those tables
  being empty is exactly today's behaviour, so nothing changes until the
  script is run.
- **Deleting a user outside the app does not delete their data.** Nothing can
  foreign-key to `auth.users` here — the card tables scope rows by a
  `"{user_id}:{card_id}"` string prefix rather than a column — so a deletion
  from the Supabase dashboard leaves every app row standing.
  `DELETE /api/account` is the path that erases properly; `purge_orphans.py`
  is the repair for deletions that bypassed it. See
  `docs/adr/0010-learner-rows-are-reconciled-with-auth-not-cascaded-from-it.md`.

- **A withdrawn deck is not a deleted one yet.** Deleting a deck other
  learners follow does not delete it: `routes/decks.delete_deck` sets
  `withdrawn_at` instead, so the deck leaves the author's shelf and their deck
  limit but stays readable for its followers, who are shown a warning and can
  take a copy. `prune_withdrawn.py` is what finally collects it. Without that
  script the grace period is not a grace period — it is content an author asked
  to delete, kept forever because somebody once followed it. See
  `docs/adr/0014-a-published-deck-is-a-link-not-a-copy.md`.

`prune_logs`, `compact_review_log`, `compact_events` and `prune_withdrawn` also
run weekly from `.github/workflows/db-maintenance.yml` (and on demand — the workflow's Run
button defaults to a dry run). It needs a `DATABASE_URL` repo secret, set to
Supabase's **session**-mode pooler URI on port 5432: the transaction pooler
(6543) cannot hold `compact_review_log`'s rollup in one transaction. The other
two scripts are deliberately not scheduled — dropping tables is a one-shot, and
`purge_orphans` needs the Supabase service key, which is too broad a secret to
park in CI for an occasional job.

For a one-time cleanup with nothing to install,
`backend/scripts/sql/cleanup_orphans_and_legacy.sql` does the orphan purge and
the legacy-table drop in the Supabase SQL Editor. It can find orphans by
joining `auth.users` directly, which `purge_orphans.py` cannot — the editor
runs as `postgres`, whereas the app's role is not assumed to see the `auth`
schema. It reports before it deletes, skips tables that do not exist yet, and
is a one-shot, so it cannot drift from the scripts.

### Analytics (足跡)

Behaviour is recorded **first-party or not at all** — there is no third-party
SDK, and `frontend/public/privacy.html`'s "No advertising, no trackers, no sale
of data" is a promise the design keeps rather than a line to amend. See
`docs/adr/0012`.

Three rules matter more than the rest:

- **Never record anything a learner typed.** Not a dictation answer, not an
  analysed sentence, not a deck or theme name. `backend/core/events.py` holds a
  closed set of event names, each with the property keys it may carry, and
  applies it to whatever a browser posts. `frontend/src/lib/track.js` mirrors
  that set, and `backend/tests/test_events.py` fails if the two drift.
- **Never store a pathname.** `/learn/vocab/theme/animaux/…` names a theme the
  learner chose and `/learn/decks/:deck_id` a deck they named.
  `frontend/src/lib/routePattern.js` reduces a path to the route App.jsx
  declared, and a path matching none is not recorded at all. Adding a screen
  means adding its pattern to `ROUTES` there — a node-lane test fails otherwise.
- **Never store an API path either.** `/api/decks/<id>` carries what a
  learner named. `lib/apiTrail.js` records a failed request (`api_error`:
  a 5xx or no answer, never a 4xx the endpoint meant) as its area alone,
  `/api/decks`, through `apiArea` in `lib/routePattern.js`.

Call `track(name, props)` from `lib/track.js`; never `fetch` an analytics
endpoint from a screen. `track` also stamps each event with the visit's random
session id (`event_log.sid`, shape-checked by `events.clean_sid`, never a
property) and opens a visit with `session_start`. Reading the data: `scripts/weekly_digest.py` (weekly,
from `.github/workflows/weekly-digest.yml`, into the run's step summary:
boarding, return, who is active (DAU/WAU/MAU), sessions (length, screens, a day), the boot, the fare gate, the
offer door by door, the ride and guides, runs by kind and level, failed
requests and the install prompt; `tests/test_weekly_digest.py` reads each
back), or
Metabase/the Supabase SQL editor pointed at the same database.

### Content audit

Every gate in this repo asks whether the content is well-formed;
`check_grammar` asks whether a sentence contains its pattern and stays
inside the level's kanji, `test_listening_clips` whether the kana
transcribes the jp. **Nothing in CI asks whether what we teach is true.**
A wrong gloss passes every check and is then memorised by someone who has
no way to know better, which is why it is worth a scheduled job of its own.

A Routine ("Tsuji content audit", Tuesdays and Fridays) wakes a session
that takes one slice of the taught content, tries to disprove it, and files
a single GitHub issue labelled `content-audit`. **The audit never edits
content** — a wrong correction arriving with a citation attached is worse
than the original error. `docs/content-audit/PLAYBOOK.md` is the method,
including the evidence bar and what must never be filed.

```bash
cd backend
python -m scripts.audit_slice                  # what today's run audits
python -m scripts.audit_slice --dump           # ... and the entries, as JSON
python -m scripts.audit_slice --schedule 12    # the next twelve runs
python -m scripts.audit_slice --on 2026-10-06  # reproduce a past run's slice
```

The basics course (plan 186, `content/basics.json`) has a read-only
report of its own: every lesson example of a course point, with what it
asks of a learner who has met only the course so far. A reason to look,
never a gate, and the audit's to act on:

```bash
cd backend
python -m scripts.basics_report          # the examples that stray
python -m scripts.basics_report --json   # the same, as JSON
```

The reading bank (plan 192) has one too: per level, its rows, the points
covered and the words and kanji of the level it uses, each row's level
words and problems, and candidate rows run through every rule with their
furigana, romaji, detected points and tagged words:

```bash
cd backend
python -m scripts.reading_bank_report               # the figures, per level
python -m scripts.reading_bank_report --rows N2     # each row's level words and problems
python -m scripts.reading_bank_report --check rows.json  # candidate rows, before they enter the bank
```

One more read-only report measures the vocab deck itself (plan 103) —
its shape, duplicates, readings, glosses, and every content word in the
taught sentences that resolves to no card, split into the present cards
the lookups miss and the real gaps. `tests/test_audit_vocab_deck.py`
holds its figures as ratchets; lower a bound when a plan lowers the
figure, never raise one. `docs/vocab-deck-review.md` is the review it
measures for.

```bash
cd backend
python -m scripts.audit_vocab_deck                # the report
python -m scripts.audit_vocab_deck --dump         # the figures and lists, as JSON
python -m scripts.audit_vocab_deck --skip-corpus  # without the tokenizer half
```

A second report puts the deck beside two outside lists (plan 109,
`datas/vocab/sources/`): cards placed above the level the community
JLPT lists give the word, list words with no card, and frequent words
(a subtitle corpus, lemmatised through the tokenizer) with no card.
Three candidate lists for the audit's slices — it changes no card. The
one thing it rewrites is `vocab_frequency.json`, the deck's keys in the
ranking's order; **after any deck change run it with
`--rebuild-order`**, since a test holds the file equal to what it would
write.

```bash
cd backend
python -m scripts.placement_report                  # the three lists, forty each
python -m scripts.placement_report --slice 2        # the next forty of each
python -m scripts.placement_report --rebuild-order  # vocab_frequency.json, in ranking order
python -m scripts.placement_report --write-lists    # placement_lists.json, for the audit's rotation
```

The slice is a pure function of the date — grammar, vocab, sentences,
since plan 109 placement (the three candidate lists, read from
`datas/vocab/placement_lists.json`, which `placement_report --write-lists`
writes) and since plan 187g tours (each grammar point's written twist and
scene) in rotation, each area walking its own list — so there is no
ledger to keep in sync and no state to corrupt. Read-only, no database, no `.env`, no network:
it parses the content modules with `ast` rather than importing them, so it
runs in a fresh clone (`content/listening_clips.py` needs pykakasi; this does
not). `tests/test_audit_slice.py` holds the rotation to the playbook's
promises. Vocab is the one bank too big to walk exhaustively — 8,091 entries
at 40 a run — so its slices are ordered risk-first by the disagreements with
JMdict the script can find on its own, and the `flags` it prints are a reason
to look rather than findings.

### Frontend (`frontend/`)
```bash
npm install
npm run dev       # Vite dev server, proxies /api -> localhost:8000
npm run build
npm run lint
npm test          # vitest: node, browser, phone, tablet, touch, desktop and wide lanes (see vite.config.js)
npm run build:native  # the Capacitor bundle (dist-native/, reads .env.native)
npm run icons     # rasterise brand/*.svg and regenerate the icon set in public/ (the mark: scripts/build-mark.py)
npm run landing   # the landing page (plan 167): public/landing/, sitemap.xml, robots.txt
npm run landing:og  # its two share cards, rendered in Chromium
python3 scripts/today-print/build.py  # Today's print of the hour (plan 205; numpy, Pillow)
```

Today's gate stands on a print drawn ahead of time (plan 205):
`scripts/today-print/` is its generator and writes `public/today/print/<REV>/`
and `src/components/station/print/print.json`. Never edit those by hand;
`scripts/today-print/README.md` has the modules and the rules.

The landing page is the site's **`/`** (and `/en`), and the app's front
door is **`/app`**: on the web the app's document is built as `app.html`
(`appShell.js`) so that `vercel.json` can rewrite `/` to the page, and the
page sends a signed-in learner and every sign-in's return on to `/app`
before it paints (`frontend/landing/README.md`, "`/` and the app").
**`npm run dev` and `npm run preview` route by `vercel.json` too**
(`appShell.js`'s `siteRoutes`), so locally `/` is the landing page as well:
open **`/app`** (or any app route) for the app. It is a
**static page outside `src/`** (`frontend/landing/`,
built into `public/landing/` and committed, like `public/privacy.html`):
none of the app's CSS rules or guards apply to it, so it copies the
tokens it uses (`landing/tokens.mjs`, held equal to `index.css` by
`src/landing.test.js`). **After a change under `frontend/landing/`, to a
deck it counts, or to the sound palette (`src/lib/audio/recipes.js`, the
trims in `settings.js`), run `npm run landing`**: the same test fails on a
committed page, or demos' `voices.js`, that differs from what the build
writes. Its footage is uploaded to a
public Supabase Storage bucket by file name and needs no rebuild;
`frontend/landing/README.md` has the slots, the bucket and what changes
when the page goes live.

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
- `routes/` — one file per feature area (kana, vocab, kanji, grammar, phrase, reading, translation, dictation, composition, practice, dictionary, decks, exams, today, stats, profile, frequency, theme_vocab, translations, onboarding, journey, tts, station). Thin FastAPI routers; business logic lives in `srs/` and `study/`.
- `core/` — cross-cutting singletons: `auth.py` (identity), `db.py` (raw psycopg2 connections), `srs_instance.py` / `frequency_store_instance.py` (module-level singletons constructed once at import time from `DATABASE_URL`, imported by routes needing SRS/frequency state).
- `srs/` — the spaced-repetition engine (`srs.py` is the large one — scheduling, review submission, card state), `scheduler.py` (interval/difficulty math), `storage.py` (DB access), `models.py` (`CardState`/`ReviewResult` dataclasses), `xp.py` (XP curve), `batch_cache.py`, `frequency_store.py`.
- `study/` — content-generation and evaluation logic that sits above the SRS layer: exam generation (`exam_blueprint.py`, `exam_*_gen.py` per section — vocab/kanji/grammar/reading/listening — `exam_validation.py`, `exam_scoring.py`, `exam_tts.py`), card selection/lookup (`card_index.py`, `card_lookup.py`, `daily_queue.py` for the "Today" queue), difficulty modeling (`difficulty.py`), grammar detection (`grammar_detect.py` — which catalogue points a sentence actually uses, over the tokenizer and the catalogue's own example sentences; `difficulty.points_in` is its name to the rest of the app), a point's own Choisir questions (`grammar_choose.py`, plan 201), Japanese text processing (`furigana.py`, `morphology.py`, `grammar_match.py`, `sound.py`, `romaji.py` — Hepburn conversion and the fold two romanizations are compared under), dictation (`dictation.py` — clip identity and the transcription measure), speech (`voice_engine.py` — the only client of the VOICEVOX Nemo engine; `exam_tts.py` — the clip store, content keys, the voice epoch and dialogue assembly; `word_tts.py` — the `/api/tts` card-reading clips), and study `modes.py`/`structures.py` defining the review-mode taxonomy per content type.
- `content/` — static/generated reference data (grammar points, vocab, kanji readings/meanings, frequency lists, reading sentences, the dictation bank in `listening_clips.py`) as Python modules or JSON, built/refreshed by scripts in `scripts/`. **The grammar catalogue is `content/grammar/N5.json … N1.json`** (plan 087, ADR 0016): one list per level, every text in both languages, the lesson (`steps`, `compare`, four examples) beside the gloss at the levels in `RICH_LEVELS`. Its text was drafted with an AI model and is audited by AI agents (the content audit below), never copied — no sentence from a published list — and it is held to `study/grammar_check.py`: run `python -m scripts.check_grammar --report` before every content commit. A pattern string is a card id, so a rename or a level move goes through `content/grammar/renames.py` and the migration script; `content/grammar/README.md` has the schema and the style guide. `content/grammar_data.py` is a dead scrape kept only as the provenance test's negative corpus. **The two big reference sets are SQLite, not JSON, and deliberately so**: `datas/vocab/vocab_jmdict.sqlite3` (212k JMdict entries, via `vocab_jmdict_data.py`) and `datas/kanji/kanji.sqlite3` (all 13,108 KANJIDIC2 characters, via `kanji_pool_data.py`). A dict held at import costs RSS on every worker for the whole process lifetime; SQLite reads only the pages a query touches. Do not "simplify" either back into a `json.load` at module scope — that is what the 512 MB Render budget cannot take. The JSON they are built from is gitignored (`backend/.gitignore`); restore the upstream export beside them and re-run `scripts/build_jmdict_db.py` / `scripts/build_kanji_db.py` to refresh.
- `scripts/` — one-off data-pipeline scripts (build JMDict/frequency/theme/radical indexes, generate grammar sentences, migrate card IDs, wipe SRS data) and the database-maintenance tools below. Not part of the request path.
- `translations/` — i18n string tables served to the frontend.

Card IDs are namespaced per user as `"{user_id}:{card_id}"` (`core/auth.py:prefixed`/`unprefixed`) so SRS state for the same content differs per learner in the same tables.

### Frontend layout (`frontend/src/`)
- `App.jsx` — top-level router; gates all routes behind Supabase session state (`lib/supabase.js`). Every screen renders under one of two layout routes: the `Shell` (HUD + tab bar below 1100px; the desk's rail at 1100px and up) for the five tab trees (`/today`, `/learn`, `/practice`, `/dictionary`, `/profile`) or the `StageFrame` (no chrome) for runs and sessions; the old top-level paths (`/kana`, `/decks/:id`, `/exam/:id` …) redirect to their place behind a gate. `/dev/rewards`, `/dev/onboarding`, `/dev/sounds` and `/dev/ride` are dev-only routes (tree-shaken out of production builds via `import.meta.env.DEV`).
- `screens/` — one file per route/page (largely 1:1 with `App.jsx` routes).
- `components/` — shared UI grouped by feature area (`chrome`, `decks`, `dictionary`, `profile`, `rewards`, `selection`, `station`, `stats`, `study`, `ui`). `components/chrome/` is the chrome (plan 068; the desk, plan 113): the `Shell` and `StageFrame` layout routes, the `Hud`, the `TabBar`, the `DeskRail` (the computer's chrome, drawn instead of both at 1100px and up), the `Bar` (and `ScreenBar`, the transitional header for screens the redesign has not reached), `Sheet`, `Console`/`Chip`/`Seg`, `StageHead` — the class map from the canvas is `docs/design/mobile/README.md`. `components/station/` holds cross-cutting screen-transition UI (`DepartureGate`, `TrainDoor`) rendered outside `<Routes>` in `App.jsx` so their animations survive the navigation that would otherwise unmount them.
- `domain/` — pure client-side domain logic: card shape helpers, kana sets, level titles, reward tiers, stats modeling, study-mode definitions, XP curve. Mirrors backend concepts but has no network calls.
- `stores/` — small client-side state modules (boarding/departure transition state, profile summary, rating scale) — not Redux, just modules with subscribable state.
- `exam/` — mock-exam UI: question rendering, exam kind definitions, `examService.js` for the exam API calls. Pairs with `screens/Exam*.jsx`.
- `hooks/useCardSession.js` — shared review-session state machine used by the study screens.
- `hooks/useDesk.js` — the one line between the two chromes (`DESK_QUERY`, `(min-width: 1100px)`). Below it every screen renders exactly the phone's DOM; above it the Shell draws the rail and a few screens lay themselves out for the width. **Never write a desk rule outside the last section of `index.css`, and never write the width anywhere else** — `src/desk.css.test.js` fails on both. See ADR 0018 and `docs/design/desk/README.md`.
- `lib/api.js` — fetch wrapper. `apiFetch` returns the raw `Response`; `apiJson`/`apiJsonWithTimeout` add `ApiError` on non-2xx and an owned `AbortController` — prefer these over hand-rolled fetch+timeout in new screens.
- `lib/supabase.js` — Supabase client; falls back to a placeholder project if env vars are unset (keeps builds/tests that don't touch auth from crashing on construction).
- `config/` — static config: `tabs.js` (the five gates and the section registry behind them: paths, line colours, titles), `stations.js` (codes and readings per route), `identity.js` (the two pass routes).
- `locales/` + `i18n.jsx` + `LangContext.jsx` — French/English string tables and language context.

### Data flow
Frontend calls same-origin `/api/*` FastAPI routes in both dev and prod (Vite proxy in dev, Vercel rewrites in prod; there is no backend-origin env var — see Deployment below) with a Supabase bearer token → `core/auth.get_user_id` resolves the user → routes use `core/srs_instance.srs` (the shared `SRSEngine`) and `study/` helpers to read/write per-user card state in Postgres, and static `content/` data for card content itself.

## Deployment

- Backend: Render (`render.yaml`), root `backend/`, persistent disk mounted at `/data` for SRS storage. The running service is the dashboard's `Japanese_Learner`, in Frankfurt, which `render.yaml` did not create (the names differ): a Blueprint made from the file would add a second backend beside it, so the live services are changed in the dashboard and the file is kept saying the same.
- Voice engine: a second service in `render.yaml`, `voicevox-nemo`, a
  **private** service running the stock `voicevox/voicevox_nemo_engine` image
  pinned by digest. It has no auth, so it must never be made public; only the
  backend reaches it, through `VOICEVOX_URL` (its internal `host:port`),
  over the private network, in the same region: Frankfurt, pinned in
  `render.yaml`. It holds no state. Starter's 512 MB
  fits it (343 MB at peak with the three voices) at the cost of slow first
  syntheses; Standard halves them. See ADR 0019.
- Frontend: Vercel (`frontend/vercel.json`), SPA rewrite to `app.html` (the
  app's document under its web name, `appShell.js`; `/` and `/en` are the
  landing page, plan 167), plus
  proxy rewrites for `/api`, `/kanjivg` and `/exam-audio` to the Render
  backend. The browser never calls `onrender.com` directly — some mobile
  carriers cannot reach that shared zone at all (diagnosed 2026-09-01: every
  CORS preflight died in transit on 4G), and same-origin also removes the
  preflight round trip. `VITE_API_URL` is retired — the code no longer reads
  it (a leftover copy in the Vercel dashboard once out-prioritised the tracked
  `.env.production` and silently rebaked the direct URL). A new backend static
  mount needs a matching rewrite in `vercel.json` (and in `vite.config.js`'s
  dev proxy).
- The one exception is the native shell (Capacitor): its WebView origin is
  `capacitor://localhost` / `https://localhost`, so `npm run build:native`
  (`vite build --mode native`, output `dist-native/`) reads the tracked
  `frontend/.env.native`, whose `VITE_API_ORIGIN` is the **Vercel** origin —
  never Render — so the proxy stays in the path. `vite.config.js` refuses
  any other mode that carries the variable; `backend/main.py` lists the two
  WebView origins in CORS. See `docs/adr/0008-native-shells-reach-the-api-through-the-web-origin.md`.
