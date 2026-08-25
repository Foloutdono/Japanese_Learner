# Plan 014: Make `/api/phrase/analyze` local-first, language-aware, and verified against the tokenizer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d4911a6..HEAD -- backend/routes/phrase.py frontend/src/screens/ReadingScreen.jsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — this endpoint has two live consumers
- **Depends on**: `plans/013-local-analysis-tier.md` (hard), `plans/012-learner-level-resolver.md`
- **Category**: direction
- **Planned at**: commit `d4911a6`, 2026-08-25

## Why this matters

Three problems in one endpoint:

1. **It cannot answer without a language model.** Every call to
   `/api/phrase/analyze` costs an LLM round trip, and when no provider is
   reachable the analyzer shows nothing at all. Plan 013 built a local tier
   that answers instantly and free; this plan makes it the default.
2. **The explanation is in the wrong language.** `SYSTEM_PROMPT` never
   receives the learner's UI language, so a French user gets an English
   explanation. This is a live defect, not a future concern.
3. **The model's segmentation is unchecked.** The LLM proposes word boundaries
   and nothing verifies them, while the same codebase runs a real
   morphological analyzer for reading practice. Merging the model's output
   *onto* verified tokens makes a hallucinated word droppable instead of
   displayable.

Read `docs/adr/0001-two-tier-sentence-analysis.md` first. Its load-bearing
points are inlined below.

## Current state

### The endpoint today

`backend/routes/phrase.py:211`:

```python
@router.post("/api/phrase/analyze")
def analyze_phrase(payload: PhraseRequest, user_id: str = Depends(get_user_id)):
    phrase = payload.phrase.strip()
    if not phrase:
        raise HTTPException(status_code=400, detail="Phrase is required")

    # The model's own words/explanation only. Everything below this line
    # is per-user (SRS state) and is recomputed on a cache hit -- the
    # cached half is the expensive, user-independent half.
    llm_result = _cached_analysis(phrase)
    if llm_result is None:
        llm_result = _call_llm(phrase)
        _store_analysis(phrase, llm_result)

    states = srs.get_user_states(user_id)
    ...
```

The request model, `backend/routes/phrase.py:161`:

```python
class PhraseRequest(BaseModel):
    phrase: str
    save: bool = True
```

### The language defect

`backend/routes/phrase.py:30` — the prompt names no language anywhere:

```python
SYSTEM_PROMPT = """You are a Japanese language tutor. Given a Japanese phrase, segment it into words and respond with ONLY a single JSON object (no markdown fences, no commentary) matching exactly this schema:
...
- "explanation" is 2-4 sentences explaining the grammar and nuance of the whole phrase.
"""
```

The pattern to copy is `backend/routes/translation.py:142`, which does it
correctly — it takes `lang: str = "en"` on its payload and resolves it through
`reading.LANG_NAMES`. That table lives at `backend/routes/reading.py:50`:

```python
LANG_NAMES = {
    "en": "English",
    "fr": "French",
    "es": "Spanish",
    "de": "German",
    "ja": "Japanese",
    "it": "Italian",
    "pt": "Portuguese",
}
```

### The cache

`backend/routes/phrase.py:72-77`:

```python
CACHE_VERSION = 1


def _phrase_key(phrase: str) -> str:
    material = f"v{CACHE_VERSION}:{phrase}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()
```

The header comment above it explains the design and names the escape hatch:
*"No expiry. The analysis of a fixed string does not go stale; if the prompt or
the model changes enough to matter, bump CACHE_VERSION and every entry becomes
a miss without a migration."* This plan changes both the prompt and the key
material, so it must bump the version.

### The two live consumers

**The analyzer** — `frontend/src/screens/PhraseAnalyzerScreen.jsx:65`:

```js
    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: trimmed }),
    })
```

**Reading practice** — `frontend/src/screens/ReadingScreen.jsx:232`, fired
eagerly in the background for every phrase shown:

```js
    apiFetch('/api/phrase/analyze', session, {
      method: 'POST',
      body: JSON.stringify({ phrase: phraseText, save: false }),
    })
```

Both render `result.words[]` (each with `surface`, `reading`, `meaning`, `pos`,
`vocab_match`, `kanji_matches`) plus `result.explanation`. **Neither may break
in this plan.** The frontend rewiring is plans 015 and 016.

### Repo conventions this must match

- Comments carry reasoning and name what was rejected — see the cache header
  at `backend/routes/phrase.py:48-72` for the standard this file already sets.
- Route modules stay thin; logic lives in `study/`. This plan adds a merge
  helper to `study/analysis.py`, not to the route.
- `backend/tests/test_http_smoke.py` is the existing pattern for endpoint
  tests via `TestClient` (see `backend/tests/conftest.py` for the `client`
  fixture).

### Vocabulary (from `CONTEXT.md`)

- **Sentence** — the atom of analysis; supersedes "phrase" in new code.
- **Token** — one morpheme as segmented by the local tier.
- **Local tier** — analysis computable without a language model.
- **Deep tier** — the contextual gloss and prose explanation; bought
  explicitly, per Sentence, never automatically.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests (all) | `cd backend && pytest` | all pass |
| Tests (this) | `cd backend && pytest tests/test_phrase_api.py -v` | all pass |
| Frontend tests | `cd frontend && npm test` | all pass |
| Frontend lint | `cd frontend && npm run lint` | exit 0 |

## Scope

**In scope**:
- `backend/routes/phrase.py`
- `backend/study/analysis.py` (add `merge_deep` only — see Step 3)
- `backend/tests/test_phrase_api.py` (create)
- `frontend/src/screens/ReadingScreen.jsx` (**one line** — Step 5)
- `frontend/src/screens/PhraseAnalyzerScreen.jsx` (**one line** — Step 5)

**Out of scope** (do NOT touch):
- Any other part of `ReadingScreen.jsx` or `PhraseAnalyzerScreen.jsx`. The
  component rewrite is plans 015 and 016. In this plan you add one field to one
  request body in each file and nothing else.
- `backend/study/llm_shared.py` — the provider chain is correct as it stands.
- `phrase_history`'s schema — the Sentence bank migration is plan 016.
- `_call_llm`'s `max_tokens=1200` and `reasoning=False`. Both are documented
  choices at `backend/routes/phrase.py:172-183`; multi-sentence input is solved
  by splitting (plan 016), never by raising the cap.

## Git workflow

- Branch: `advisor/014-two-tier-phrase-api`
- Commit per step; conventional commits, e.g.
  `feat(phrase): default to the local analysis tier`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extend the request model

In `backend/routes/phrase.py`, add two fields to `PhraseRequest`:

```python
class PhraseRequest(BaseModel):
    phrase: str
    save: bool = True
    # The deep tier is bought explicitly. Default False so the common
    # path makes no model call at all -- see docs/adr/0001.
    deep: bool = False
    # The explanation's language. Absent before 2026-08, which meant every
    # learner got whatever language the model chose (in practice English),
    # including French users reading a French UI.
    lang: str = "en"
```

Keep the existing comment on `save` exactly as it is.

**Verify**: `cd backend && python -c "from routes.phrase import PhraseRequest; print(PhraseRequest(phrase='x').deep, PhraseRequest(phrase='x').lang)"`
→ prints `False en`

### Step 2: Make the prompt language-aware and bump the cache version

Convert `SYSTEM_PROMPT` into a template taking one `{lang_name}` substitution,
following `backend/routes/translation.py:129-140`'s approach. The
`explanation` bullet must instruct the model to write in `{lang_name}`; the
JSON keys and the `reading` field stay Japanese/hiragana regardless.

Change `_call_llm(phrase)` to `_call_llm(phrase, lang)` and resolve the name
with `LANG_NAMES.get(lang, lang)`, importing `LANG_NAMES` from
`routes.reading` exactly as `translation.py` does.

Then change the cache key so language is part of it, and bump the version:

```python
CACHE_VERSION = 2


def _phrase_key(phrase: str, lang: str) -> str:
    material = f"v{CACHE_VERSION}:{lang}:{phrase}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()
```

Thread `lang` through `_cached_analysis` and `_store_analysis`. Without this
the first caller's language would be served to everyone — a French learner
would permanently poison the cache for English ones. Comment that.

Bumping to `2` is required because both the prompt and the key material
changed; the header comment at `backend/routes/phrase.py:70` already
prescribes exactly this.

**Verify**: `cd backend && grep -n "CACHE_VERSION = 2" routes/phrase.py` → one match
**Verify**: `cd backend && grep -c "lang" routes/phrase.py` → at least 8 matches

### Step 3: Add `merge_deep` to `study/analysis.py`

Add one function to the module plan 013 created:

```python
def merge_deep(analysis: dict, llm_words: list[dict], explanation: str) -> dict:
    """Fold the deep tier's glosses onto locally verified Tokens."""
```

Rules:

- Match each LLM word to a local Token by `surface`, walking both lists
  forward so repeated words match in order rather than all binding to the
  first occurrence.
- On a match, copy only the LLM's `meaning` onto the Token. Everything else —
  `surface`, `reading`, `pos`, offsets, `vocab_match`, `kanji_matches` — comes
  from the local tier and wins. The tokenizer is the authority on segmentation.
- An LLM word matching no Token is **dropped**, and the count of drops is
  returned on the result as `"deep_dropped": int`. This is the verification
  that ADR 0001 calls for: a hallucinated word is discarded rather than shown.
- A Token that no LLM word matched simply keeps no `meaning`. That is normal
  for particles and must not be treated as an error.
- Set `"explanation"` on the result. Return a new dict; do not mutate the
  input (the local analysis is cacheable and shared).

**Verify**: `cd backend && python -c "
from study.analysis import analyze_local, merge_deep
a = analyze_local('私は学生です。')
m = merge_deep(a, [{'surface':'私','meaning':'I'},{'surface':'ZZZZ','meaning':'nonsense'}], 'note')
print(m['deep_dropped'], m['explanation'], any(t.get('meaning')=='I' for t in m['tokens']))"`
→ prints `1 note True`

### Step 4: Rewrite the endpoint

`analyze_phrase` becomes:

1. Strip and validate `phrase` as today (400 on empty — unchanged).
2. `analysis = analyze_local(phrase)`.
3. If `payload.deep`: look up the cache with `(phrase, lang)`; on a miss call
   `_call_llm(phrase, lang)` and store it. Then
   `analysis = merge_deep(analysis, llm_result.get("words", []), llm_result.get("explanation", ""))`.
4. `analysis = attach_user_state(analysis, srs.get_user_states(user_id), user_id)`.
5. Build the response. Keep `save` behaviour exactly as it is today.

Two hard requirements:

- **The non-deep path must make no LLM call and must not raise 503.** The
  whole point is that the analyzer works with no provider configured. Do not
  call `llm_configured()` on this path either.
- **Backward compatibility.** The response must still carry a `words` key that
  the two existing frontend consumers can render. Set `words` to the same list
  object as `tokens`. The Token shape from plan 013 already carries `surface`,
  `reading`, `pos`, `vocab_match` and `kanji_matches`; `merge_deep` adds
  `meaning`. Mark `words` deprecated in a comment naming plan 016 as its
  removal point, so it does not become permanent by accident.

The response keeps `phrase`, `explanation`, `words`, `id` and `created_at`, and
gains `tokens`, `grammar`, `level`, `grade`, `available`, `unknown_count`,
`off_deck_count` and (when deep) `deep_dropped`.

**Verify**: `cd backend && pytest` → all pass

### Step 5: Keep both frontend consumers behaving exactly as before

Both call sites currently rely on getting a gloss and an explanation, so both
must now ask for the deep tier explicitly. Add **one field** to each request
body and change nothing else in either file.

`frontend/src/screens/PhraseAnalyzerScreen.jsx:65-68` →
`body: JSON.stringify({ phrase: trimmed, deep: true, lang })`, taking `lang`
from the `useLang()` hook the component already calls at line 37.

`frontend/src/screens/ReadingScreen.jsx:232-235` →
`body: JSON.stringify({ phrase: phraseText, save: false, deep: true, lang })`,
taking `lang` from that component's existing language context access.

This preserves today's behaviour precisely. Plan 016 flips the analyzer to
local-first and plan 015 makes reading practice's eager pre-fire free; neither
belongs here.

If `ReadingScreen.jsx` does not already have `lang` in scope at that line, read
it from `useLang()` at the top of the same component — do not thread a new prop
through, and do not refactor anything else.

**Verify**: `cd frontend && npm run lint` → exit 0
**Verify**: `cd frontend && npm test` → all pass
**Verify**: `cd frontend && git diff --stat src/screens/` → exactly two files, at
most 4 changed lines each

### Step 6: Test the endpoint

Create `backend/tests/test_phrase_api.py`, using the `client` fixture from
`backend/tests/conftest.py` (which sets `DEV_USER_ID=test-user`, so no auth
setup is needed). Model it on `backend/tests/test_http_smoke.py`.

Cover:

- `POST /api/phrase/analyze` with `{"phrase": "私は学生です。"}` returns 200,
  carries `tokens`, `grammar`, `level` and `available`, and has
  `explanation == ""`
- the same call **makes no LLM request**: monkeypatch `study.llm_shared.chat`
  to raise if called, and assert the request still returns 200. This is the
  single most important test in the file
- an empty phrase returns 400
- `save: false` returns `id: None` and writes no history row
- with `deep: true` and `chat` monkeypatched to return a fixed JSON string, the
  response carries the `explanation` and at least one Token has a `meaning`
- `_phrase_key` returns different digests for the same phrase under `lang="en"`
  and `lang="fr"`
- the legacy `words` key is present and is the same list as `tokens`

Do not write a test that calls a real model.

**Verify**: `cd backend && pytest tests/test_phrase_api.py -v` → all pass

## Test plan

One new backend file, cases enumerated in Step 6. The no-LLM-call assertion is
the regression guard for this plan's entire purpose — if it is ever deleted,
the local-first property can silently regress.

No new frontend test: Step 5 is a two-line request-body change and the existing
suite covers that both screens still build and lint.

**Verification**: `cd backend && pytest` and `cd frontend && npm test` → all pass.

## Done criteria

ALL must hold:

- [ ] `cd backend && pytest` exits 0
- [ ] `cd frontend && npm test` exits 0 and `npm run lint` exits 0
- [ ] `cd backend && pytest tests/test_phrase_api.py -v` → all pass, including the no-LLM-call test
- [ ] `grep -n "CACHE_VERSION = 2" backend/routes/phrase.py` → one match
- [ ] `grep -n "lang_name" backend/routes/phrase.py` → at least one match
- [ ] A `POST /api/phrase/analyze` without `deep` returns 200 with `OPENROUTER_API_KEY` and `NVIDIA_API_KEY` both unset
- [ ] `git diff --stat` shows at most 4 changed lines in each of the two frontend screens
- [ ] `plans/README.md` status row for 014 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `backend/study/analysis.py` does not exist or does not export
  `analyze_local` and `attach_user_state`. Plan 013 is a hard dependency;
  do not build a substitute.
- The excerpts at `phrase.py:161`, `:211` or `:72` do not match the live code.
- Preserving the `words` shape appears to require changing either frontend
  screen beyond the single request-body line. Report what breaks instead.
- Any existing test fails after Step 4 in a way that suggests another consumer
  of this endpoint exists that this plan did not find. Search for it and
  report; do not adapt it silently.
- You conclude the cache needs a migration. It does not — bumping
  `CACHE_VERSION` is the designed mechanism, and stale rows are harmless.

## Maintenance notes

- **`words` is a deprecation, not a feature.** Plan 016 removes it once both
  screens read `tokens`. A reviewer should check the comment naming that.
- **The no-LLM-call test guards the ADR.** If a future change makes the default
  path call a model again, that test is what catches it.
- **`CACHE_VERSION` must be bumped** by any later change to `SYSTEM_PROMPT` or
  to the key material. The header comment at `phrase.py:48` explains why; keep
  it accurate.
- Existing `phrase_analysis_cache` rows written under version 1 become
  permanent misses. They are harmless and small; a cleanup is not worth a
  migration.
