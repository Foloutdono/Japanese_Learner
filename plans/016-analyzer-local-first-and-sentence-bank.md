# Plan 016: Make the analyzer instant, multi-sentence, and turn history into a Sentence bank

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d4911a6..HEAD -- backend/routes/phrase.py backend/study frontend/src/screens/PhraseAnalyzerScreen.jsx frontend/src/components/analysis`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — changes a stored data shape
- **Depends on**: `plans/015-shared-analysis-components.md` (hard)
- **Category**: direction
- **Planned at**: commit `d4911a6`, 2026-08-25

## Why this matters

Three things land together because they are the same change seen from three
angles.

**The analyzer waits on a model it no longer needs.** Plans 013 and 014 built
and exposed a local tier that answers instantly and free. The screen still asks
for the deep tier on every Analyze click, so it still shows a spinner and still
fails outright when no provider is reachable.

**It handles one sentence.** Paste a paragraph and it goes to the model as a
single 1200-token request that silently truncates. Photo and video input (plans
018, 019) produce paragraphs by definition, so this must be solved before
either.

**History stores a lie.** `phrase_history` freezes each word's SRS statistics at
analysis time. Reopen an entry from last month and a word you have since
mastered still reads "New". Now that re-deriving the analysis is free, storing
it is strictly worse than not storing it.

Read `docs/adr/0002-sentence-bank-stores-text-not-results.md` before starting.

## Current state

### The screen asks for the deep tier unconditionally

After plan 014, `frontend/src/screens/PhraseAnalyzerScreen.jsx:57` looks like:

```js
  function analyze() {
    const trimmed = phrase.trim()
    if (!trimmed || loading) return
    setLoading(true)
    ...
    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: trimmed, deep: true, lang }),
    })
```

### History stores the enriched result

`backend/routes/phrase.py:271`:

```python
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO phrase_history(user_id, phrase, result) VALUES (%s, %s, %s) RETURNING id, created_at",
                (user_id, phrase, json.dumps(result)),
            )
```

and `backend/srs/data_structure.sql:67`:

```sql
CREATE TABLE phrase_history (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    phrase TEXT NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`result` holds the whole enriched analysis including per-user `stats` objects.
`GET /api/phrase/history/{id}` (`phrase.py:306`) returns it verbatim, which is
why stale badges appear.

### There is precedent for in-code migration

`backend/routes/decks.py:312` runs `ALTER TABLE` statements at import time to
evolve `custom_cards`. That is this repo's established mechanism for schema
change — there is no migration framework. Follow it: idempotent
`ALTER TABLE ... IF EXISTS / IF NOT EXISTS`, wrapped so a missing database at
import time cannot stop the app from starting (see
`backend/routes/phrase.py:99-102` for that pattern).

### Data available but unrendered

The `/api/phrase/analyze` response already carries, unused by any screen:
`grammar` (pattern, level, span, `raw_id`, `stats`), `level`, `grade`,
`unknown_count`, `off_deck_count`, and per-token `furigana` (a list of
`{text, reading}` parts from `study/furigana.py:208`).

### Repo conventions

- New locale keys go in **both** `frontend/src/locales/en/index.js` and
  `frontend/src/locales/fr/index.js`. A locale-parity test (commit `38bb4a3`,
  `frontend/src/locales/locales.test.js`) fails on any key present in one side
  only, including a type mismatch between the two values.
- Translation keys used in components carry an inline `??` fallback —
  `ReadingScreen.jsx:26-36` documents this.
- Backend tests are `unittest.TestCase` under pytest; see
  `backend/tests/test_furigana.py`. Frontend component tests use the browser
  lane (`*.browser.test.jsx`); see `frontend/src/hooks/useDialog.browser.test.jsx`.

### Vocabulary (from `CONTEXT.md`)

- **Passage** — what the learner submits as one act. A container.
- **Sentence** — the atom of analysis. A Passage splits into one or more.
- **Sentence bank** — the learner's kept Sentences with their provenance.
  Stores text, not a frozen analysis.
- **i+1** — a Sentence with exactly one unknown Token.
- **Off-deck** — a Token in no app deck; never counted as unknown.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Backend tests | `cd backend && pytest` | all pass |
| Frontend tests | `cd frontend && npm test` | all pass |
| Lint | `cd frontend && npm run lint` | exit 0 |
| Build | `cd frontend && npm run build` | exit 0 |

## Scope

**In scope**:
- `backend/study/sentences.py` (create)
- `backend/routes/phrase.py` (multi-sentence response, history reshape)
- `backend/srs/data_structure.sql` (the `phrase_history` declaration)
- `backend/tests/test_sentences.py` (create)
- `frontend/src/screens/PhraseAnalyzerScreen.jsx`
- `frontend/src/components/analysis/` (furigana ruby, grammar chips, level badge)
- `frontend/src/locales/en/index.js` and `frontend/src/locales/fr/index.js`

**Out of scope** (do NOT touch):
- Mining buttons and deck writes — plan 017.
- Photo and video input — plans 018 and 019.
- Audio playback — see `docs/adr/0006`; not part of this plan.
- `ReadingScreen.jsx` beyond what a shared-component signature change forces.
  Reading practice serves one curated sentence at a time and must not gain a
  splitter.
- `backend/study/analysis.py`'s `analyze_local` contract. Consume it; do not
  change its shape.
- Deleting `phrase_history.result` **data**. See Step 3 — the column is made
  nullable and stops being written, but existing rows are left alone.

## Git workflow

- Branch: `advisor/016-analyzer-local-first`
- Commit per step; conventional commits, e.g.
  `feat(analysis): split passages into sentences`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Sentence splitting

Create `backend/study/sentences.py` exposing:

```python
def split_sentences(text: str) -> list[dict]:
    """A Passage split into Sentences, each {"text", "start", "end"}."""
```

Requirements:

- Split on `。`, `！`, `？`, `!`, `?` and newlines, **keeping the terminator
  with the sentence it ends**.
- Do not split inside `「」`, `『』` or `（）`. Quoted speech ending in `。`
  inside a larger sentence is one Sentence, not two.
- Offsets are into the **original** `text`, and
  `text[s["start"]:s["end"]] == s["text"]` must hold for every result.
- A text with no terminator at all returns exactly one Sentence spanning
  everything. This is the common case for auto-generated video captions
  (plan 019), so it must be correct rather than an edge case.
- Collapse runs of whitespace between Sentences into the gaps, not into the
  Sentences: no returned `text` starts or ends with whitespace.
- Empty or whitespace-only input returns `[]`.

Add a `MAX_SENTENCES = 50` cap. When a Passage exceeds it, return the first 50
and let the caller report the truncation. **Never truncate silently** — this
repo's own convention (see `plans/README.md`'s "no silent caps" note in the
previous wave) is to say what was dropped.

**Verify**: `cd backend && python -c "
from study.sentences import split_sentences
r = split_sentences('私は学生です。今日は暑い！明日は?')
print(len(r), [s['text'] for s in r])
t='私は学生です。今日は暑い！'
print(all(t[s['start']:s['end']]==s['text'] for s in split_sentences(t)))"`
→ prints `3` with three sentences, then `True`

### Step 2: Multi-sentence analyze

In `backend/routes/phrase.py`, change `analyze_phrase` so the request body's
`phrase` is treated as a **Passage**:

1. `split_sentences(phrase)`.
2. Analyze each Sentence with the plan-013/014 pipeline, independently. Each
   gets its own local tier, its own deep-tier cache lookup, and its own
   `attach_user_state`.
3. Return `{"passage": <original text>, "sentences": [<per-sentence analysis>, ...], "truncated": <int>, "id", "created_at"}`
   where `truncated` is the number of Sentences dropped by `MAX_SENTENCES`.

`deep: true` applies to **every** Sentence in the Passage. That is a real cost
multiplier, so the frontend must not send it for a multi-sentence Passage — see
Step 5, where the deep tier is bought one Sentence at a time.

**Backward compatibility**: a single-Sentence Passage must still work for
`ReadingScreen`, which posts one curated sentence. Keep the top-level `tokens`,
`words`, `grammar`, `level`, `explanation` and `available` keys mirroring
`sentences[0]` when there is exactly one Sentence. Remove the deprecated
`words` alias **only** after confirming with
`grep -rn "\.words" frontend/src/` that nothing reads it any more.

**Verify**: `cd backend && pytest` → all pass

### Step 3: Reshape history into the Sentence bank

Two changes, in this order.

**Schema.** Add an idempotent in-code migration at `phrase.py` import time,
following `backend/routes/decks.py:312`'s pattern and wrapped in the
`try/except` + `logger.exception` shape already used by `_init_cache` at
`phrase.py:99`:

- `ALTER TABLE phrase_history ALTER COLUMN result DROP NOT NULL`
- `ALTER TABLE phrase_history ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'typed'`
- `ALTER TABLE phrase_history ADD COLUMN IF NOT EXISTS source_ref TEXT NOT NULL DEFAULT ''`

Update the declaration in `backend/srs/data_structure.sql` to match, so a fresh
database and a migrated one agree.

`source` is the provenance kind (`typed`, `image`, `video`, `reading`).
`source_ref` is free text identifying where within it — a video id and
timestamp, an image filename. Plans 018 and 019 populate them; this plan just
creates the columns with defaults so those plans need no further migration.

**Writes.** Stop writing `result`. Insert `phrase`, `source` and `source_ref`
only.

**Reads.** `GET /api/phrase/history/{entry_id}` re-derives: read the stored
`phrase`, run it back through the Step 2 pipeline, and return the same shape
`POST /api/phrase/analyze` returns. Never call the model on this path — a
history open is a local-tier operation. If the deep tier was bought earlier it
is still in `phrase_analysis_cache`, keyed by text and permanent, so look it up
and merge it when present without ever calling out.

**Existing rows keep their `result` and are simply ignored.** Do not migrate,
backfill, or delete them. The column is nullable now; old data is harmless.

`GET /api/phrase/history` (the list) gains `source` in each row and is otherwise
unchanged.

**Verify**: `cd backend && pytest` → all pass
**Verify**: `cd backend && grep -n "INSERT INTO phrase_history" routes/phrase.py` → the statement no longer mentions `result`

### Step 4: Render what the local tier already returns

In `frontend/src/components/analysis/`, extend the components from plan 015:

- **Furigana ruby** in `SentenceBreakdown`'s sentence line: render each token's
  `furigana` parts as `<ruby>` with `<rt>` for parts that have a `reading`, and
  bare text for parts that do not. A part with a null `reading` must render its
  text with no `<rt>` at all — okurigana already writes its own kana, and a
  duplicated reading above it is exactly what `study/furigana.py:1-33` exists to
  prevent.
- **`GrammarChips.jsx`** — one chip per `grammar` entry: pattern, JLPT level,
  and a `StatusBadge` from its `stats`. Chips are **hints, not claims**: the
  local tier finds them by substring matching over 205 patterns, so the copy
  must not assert. Use a phrasing like "grammar spotted" rather than "grammar
  used".
- **`LevelBadge.jsx`** — the estimated `level`, the `unknown_count`, and an
  **i+1 marker** when `unknown_count === 1`. Show `off_deck_count` separately
  and label it distinctly (words the app does not teach), never merged into the
  unknown count.

New locale keys in **both** locale files. At minimum:
`sentenceLevel`, `unknownWords`, `offDeckWords`, `iPlusOne`, `grammarSpotted`,
`explainSentence`, `explaining`, `noExplanationYet`, `passageTruncated`.
Every use in a component carries an inline `??` fallback.

**Verify**: `cd frontend && npm test` → all pass, **including the locale-parity test**
**Verify**: `cd frontend && npm run lint && npm run build` → both pass

### Step 5: Local-first analyzer with per-Sentence Explain

In `PhraseAnalyzerScreen.jsx`:

- `analyze()` posts **without** `deep`. Results render immediately from the
  local tier. Remove the full-screen `Loading` gate on this path — the request
  is a single local round trip, so a brief inline indicator is enough.
- Render one `SentenceBreakdown` per entry in `sentences`, each with its own
  `LevelBadge` and `GrammarChips`.
- Each Sentence gets its own **Explain** control. Pressing it posts that
  Sentence's text alone with `deep: true` and `lang`, and merges the returned
  `explanation` and per-token `meaning` into that Sentence's state only.
  Never fetch the deep tier for the whole Passage at once.
- When `truncated > 0`, show it using `passageTruncated`. Do not hide it.
- When `available === false` (the tokenizer is unavailable), show a plain
  message rather than an empty breakdown.
- The history list gains its `source` label. Opening an entry calls
  `GET /api/phrase/history/{id}` and renders the re-derived analysis exactly
  like a fresh one.

**Verify**: `cd frontend && npm test && npm run lint && npm run build` → all pass

### Step 6: Test

Create `backend/tests/test_sentences.py` (structure per
`backend/tests/test_furigana.py`), covering:

- three-sentence splits on `。`, `！`, `？`
- the offset invariant `text[start:end] == text` for every Sentence, on several
  inputs including one with newlines
- no split inside `「」`
- no terminator returns exactly one Sentence covering the whole text
- empty and whitespace-only input return `[]`
- a Passage over `MAX_SENTENCES` returns exactly `MAX_SENTENCES` entries

Extend `backend/tests/test_phrase_api.py` (created by plan 014) with:

- a multi-sentence Passage returns one entry per Sentence
- a history round trip: POST, then GET the entry, and assert the returned
  analysis is present **and that no `stats` value came from storage** — assert
  it by monkeypatching `srs.get_user_states` to return a known dict and
  checking the response reflects *that*, not whatever was stored
- the history GET makes no LLM call (monkeypatch `chat` to raise)

Extend the plan-015 browser test with a furigana case: a token whose
`furigana` has a part with `reading: null` renders no `<rt>` for that part.

**Verify**: `cd backend && pytest && cd ../frontend && npm test` → all pass

## Test plan

Cases are enumerated in Step 6. Two are load-bearing:

- **the offset invariant** — every later plan maps highlights and click targets
  through these offsets;
- **the history round trip asserting stats come from the live SRS state** —
  that is the defect ADR 0002 exists to fix, and it is invisible without a test.

## Done criteria

ALL must hold:

- [ ] `cd backend && pytest` exits 0
- [ ] `cd frontend && npm test` exits 0, including the locale-parity test
- [ ] `cd frontend && npm run lint && npm run build` both exit 0
- [ ] `grep -n "INSERT INTO phrase_history" backend/routes/phrase.py` → no `result` column
- [ ] `grep -n "result JSONB NOT NULL" backend/srs/data_structure.sql` → no match
- [ ] `grep -rn "\.words" frontend/src/` → no matches (or the alias was kept and the reason recorded)
- [ ] Analyze with `OPENROUTER_API_KEY` and `NVIDIA_API_KEY` unset renders a full breakdown
- [ ] Every new locale key exists in both `en` and `fr`
- [ ] `plans/README.md` status row for 016 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `frontend/src/components/analysis/` does not exist. Plan 015 is a hard
  dependency.
- The `ALTER TABLE` statements fail against the live database for any reason
  other than "already applied". Report the error; do not drop and recreate the
  table — it holds user data.
- `grep -rn "phrase_history" backend/` finds a consumer outside
  `routes/phrase.py`. Report it before changing the write shape.
- Re-deriving a history entry takes more than roughly 200 ms for a
  single-Sentence entry. That suggests `analyze_local` is doing something
  per-request it should be doing at import time; report the profile rather than
  adding a cache.
- The locale-parity test fails and the cause is a pre-existing gap rather than
  your new keys. Report it separately.

## Maintenance notes

- **`source` and `source_ref` are populated by plans 018 and 019.** They exist
  now with defaults so those plans need no further migration.
- **Old `phrase_history` rows still carry `result`.** They are ignored, not
  migrated. If the column is ever dropped, that is a separate decision and
  needs its own plan.
- **A reviewer should check** that `deep` is never sent for a whole Passage,
  and that the Explain control is per Sentence. That is the entire cost model.
- **Grammar chips are hints.** If their false-positive rate turns out to be too
  high on real input, the fix is in `difficulty.points_in`'s `_distinctive`
  filter (plan 013), not in the component.
- `MAX_SENTENCES = 50` is a guess. Plan 019 will exercise it hard; revisit the
  number there rather than here.
