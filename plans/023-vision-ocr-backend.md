# Plan 023: A vision-model OCR tier that actually reads Japanese

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2552915..HEAD -- backend/study/llm_shared.py backend/routes backend/srs/data_structure.sql backend/scripts/check_llm_models.py`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: MEDIUM — adds a paid call on a user-triggered path; the cost cap in
  Step 5 is not optional
- **Depends on**: —
- **Blocks**: `plans/024-image-capture-ux.md` (hard — that plan calls this
  endpoint)
- **Category**: correctness / direction
- **Planned at**: commit `2552915`, 2026-08-26

## Why this matters

Photo input does not work. Real user report, 2026-08-26: *"every picture return
either a complete mess of characters or wrongs ones."*

That is the expected outcome of the current design, not a bug in it.
`frontend/src/lib/ocr.js` runs **tesseract.js and nothing else**, with no
preprocessing, against photographs. Tesseract's Japanese models are trained on
clean scanned documents; on a phone photo — perspective, uneven lighting, low
effective DPI, stylised fonts — they produce exactly the garbage described.

The escalation tier that was supposed to rescue this was **never built**,
because `plans/018` Step 4 hit its own STOP condition:

> No model is confirmed vision-capable on either provider.

**That conclusion was wrong, and this is the single most important fact in this
plan.** The probe only tested the 7 models already hardcoded in
`_PROVIDER_CATALOG` — all of them text-only. It never asked either provider
which models *do* accept images. It reported "no vision capability available"
when the real finding was "the seven text models I tried are text models."

Re-probed live on 2026-08-26 against the key already in `backend/.env`:

- OpenRouter serves **417 models, 250 of them image-capable**.
- Five candidates were benchmarked on a deliberately degraded Japanese image
  (rotated 1.2°, downscaled to 530×190, one line in low-contrast grey — chosen
  to approximate a bad phone photo):

  | Model | Exact lines | Prompt $/tok |
  |---|---|---|
  | `qwen/qwen3-vl-8b-instruct` | **3/3** | 0.000000117 |
  | `qwen/qwen3-vl-30b-a3b-instruct` | **3/3** | 0.00000013 |
  | `mistralai/mistral-small-3.2-24b-instruct` | **3/3** | 0.000000075 |
  | `qwen/qwen2.5-vl-72b-instruct` | **3/3** | 0.00000025 |
  | `qwen/qwen3-vl-235b-a22b-instruct` | **3/3** | 0.00000021 |
  | `google/gemma-4-31b-it:free` | HTTP 429 | free |

  "Exact lines" = the model's output contained the source line **character for
  character**, including punctuation. Five of six scored perfect.

The free-tier Gemma rate-limited again — the same symptom `plans/018` saw. That
was always a **quota** signal, never a capability one.

At roughly 1–1.5k tokens per image, a recognition costs on the order of
**$0.0002**. The deep-tier explanation this app already buys per sentence costs
more.

### The consequence for ADR-0004

`docs/adr/0004-ocr-runs-client-first.md` chose client-side Tesseract as tier 1,
with the image never leaving the device. That privacy property is real and worth
keeping **as an option**. But the decision assumed client-side OCR would be
*usable*, and it is not. This plan therefore inverts the default and Step 7
amends the ADR to say so honestly, rather than leaving a decision record that
contradicts the code.

## Current state

### `study/llm_shared.py` — the machinery to reuse

`Provider` is a dataclass holding one OpenAI-compatible endpoint and an ordered
model list:

```python
class Provider:
    name: str
    url: str
    api_key: str | None
    models: tuple[str, ...]
    # reasoning-flag -> extra top-level request-body keys.
    reasoning_body: object = field(default=None)
```

`chat()` walks `PROVIDERS` in order and, within each, `provider.models` in
order, with retry, and remembers dead models/providers for the process
lifetime:

```python
def chat(messages: list[dict], timeout: int = 60, max_tokens: int = 3000, reasoning: bool = True) -> str:
```

Two properties make this directly reusable for vision:

- **`messages` is already arbitrary.** OpenAI-style multimodal content parts
  (`{"type": "image_url", "image_url": {"url": "data:image/png;base64,..."}}`)
  pass straight through. No transport change is needed.
- The dead-model/dead-provider bookkeeping is exactly what a second model list
  wants too.

What is missing is only a **separate model list**: a request with an image sent
to `nvidia/nemotron-3-super-120b-a12b` fails, so vision cannot share `models`.

### What exists on the frontend

`frontend/src/lib/ocr.js` exports `recognize()` (tesseract only) plus the pure
helpers `normalize` / `stripInterCjkSpaces` / `collapseBlankLines`.
`ImageInput.jsx` already has an `onEscalate` prop that is **never passed**,
because the tier behind it was never built.

Wiring the frontend is **plan 024**, not this plan. This plan ends at a working,
tested HTTP endpoint.

## Scope

**In scope:**
- `backend/study/llm_shared.py` — `vision_models` on `Provider`, `vision=` on
  `chat()`
- `backend/routes/ocr.py` — new, `POST /api/ocr`
- `backend/main.py` — register the router
- `backend/srs/data_structure.sql` — declare the new usage table
- `backend/scripts/check_llm_models.py` — extend `--vision` to probe real
  vision models
- `backend/tests/test_ocr_api.py`, `backend/tests/test_llm_vision_models.py` —
  new
- `docs/adr/0004-ocr-runs-client-first.md` — amend (Step 7)

**Out of scope — do not touch:**
- `chat()`'s existing text path, its retry policy, or `_DEAD_MODELS` /
  `_DEAD_PROVIDERS` semantics. Vision reuses them; it does not modify them.
- `frontend/` — all of it. That is plan 024.
- `routes/phrase.py` and the analysis pipeline. This endpoint returns **text**;
  what happens to that text is unchanged.
- Removing tesseract.js. It stays as the offline option (plan 024 decides how
  it is offered).

## Steps

### Step 1 — Give `Provider` a vision model list

Add the field, defaulting to empty so a provider with no verified vision model
simply never gets tried:

```python
    models: tuple[str, ...]
    # Image-capable models, in preference order. Separate from `models`
    # because the two sets do not overlap: a text model 400s on an
    # image_url content part, and most vision models are worse at the
    # bounded-JSON tasks `models` is tuned for. Empty means this provider
    # is skipped entirely for vision work.
    vision_models: tuple[str, ...] = ()
```

Populate OpenRouter with the **benchmarked** list, cheapest-capable first, and
record the evidence the way every other entry in this file does:

```python
        # Vision. Benchmarked live 2026-08-26 against a deliberately
        # degraded Japanese image (rotated 1.2 degrees, downscaled to
        # 530x190, one line in low-contrast grey -- an approximation of a
        # bad phone photo). Scored by exact character-for-character line
        # match. All four below scored 3/3; ordered cheapest-first, since
        # accuracy did not separate them and price does.
        #
        # google/gemma-4-31b-it:free is deliberately ABSENT: it is
        # image-capable, but rate-limited (429) on every attempt across
        # two separate sessions. That same 429 is what made plans/018
        # conclude no vision model existed at all -- a quota signal
        # misread as a capability one. Do not re-add it as a primary.
        vision_models=(
            "mistralai/mistral-small-3.2-24b-instruct",
            "qwen/qwen3-vl-8b-instruct",
            "qwen/qwen3-vl-30b-a3b-instruct",
            "qwen/qwen2.5-vl-72b-instruct",
        ),
```

For NVIDIA, leave `vision_models=()` **for now** with this comment:

```python
        # No vision models listed until probed. GET /v1/models shows
        # candidates (nvidia/nemotron-nano-12b-v2-vl,
        # meta/llama-3.2-90b-vision-instruct,
        # nvidia/llama-3.1-nemotron-nano-vl-8b-v1), but "in the catalog"
        # is not "reads Japanese" -- the mistake plans/018 made. Run
        # `python -m scripts.check_llm_models --vision` and add only what
        # actually scores.
        vision_models=(),
```

**Verify:**

```bash
cd backend && python -c "
from study.llm_shared import _PROVIDER_CATALOG as C
for n,p in C.items(): print(n, '->', p.vision_models)
"
```

Expected: openrouter lists 4 models; nvidia lists none.

### Step 2 — Let `chat()` select the vision list

Add a keyword-only flag. It must change **only** which tuple is walked:

```python
def chat(messages: list[dict], timeout: int = 60, max_tokens: int = 3000,
         reasoning: bool = True, *, vision: bool = False) -> str:
```

Inside, where the attempt list is built from `provider.models`, use
`provider.vision_models if vision else provider.models`, and skip providers
whose selected tuple is empty.

Update the docstring with a `vision=True` paragraph explaining that `messages`
may then contain image content parts and that a provider with no
`vision_models` is skipped rather than tried and failed.

If no provider has any vision model, raise `LLMUnavailable` with a message that
names the cause:

```python
raise LLMUnavailable(
    "No configured provider has a vision-capable model. "
    "Run scripts/check_llm_models.py --vision."
)
```

**Verify** the text path is untouched:

```bash
cd backend && python -m pytest tests/ -q -k "llm or phrase or exam"
```

Expected: all pass, unchanged.

### Step 3 — Probe script tells the truth

Rewrite `check_llm_models.py`'s `--vision` mode so it probes
`provider.vision_models` (and, with `--vision-discover`, asks each provider's
`/models` endpoint which ids advertise image input). It must:

- render the probe image with Pillow + MS Gothic as it already does,
- send it as a `data:` URL image content part,
- score the reply by **exact line match** against the known source lines,
- print a per-model `n/3` score,
- exit non-zero only if **every** model fails.

Add a comment stating plainly that a 429 is a quota result, not a capability
result, and must not be recorded as "not vision-capable".

**Verify:**

```bash
cd backend && python -m scripts.check_llm_models --vision
```

Expected: at least one OpenRouter model scores 3/3. Record the full output in
the execution note.

Then probe the NVIDIA candidates named in Step 1's comment. **Add to
`vision_models` only those that actually score**; leave the tuple empty if none
do, and say so in the note.

### Step 4 — The endpoint

Create `backend/routes/ocr.py`.

```
POST /api/ocr   (multipart/form-data)
  file:     the image           (required)
  vertical: "true" | "false"    (optional, default false — a HINT only)
->  200 {"text": "...", "model": "...", "chars": 123}
    400  not an image / unreadable
    413  too large
    429  daily cap reached  {"error": ..., "used": n, "limit": n}
    503  no vision provider configured
```

Requirements:

- **Auth**: `user_id: str = Depends(get_user_id)`, like every other route.
- **Size cap**: reject `> 8 MB` with 413 **before** reading the whole body into
  memory where practical. Name the constant `_MAX_IMAGE_BYTES`.
- **Type check**: accept only `image/png`, `image/jpeg`, `image/webp`. Do not
  trust the client's `content_type` alone — verify by magic bytes.
- **Prompt**: instruct transcription only, no translation, no commentary,
  preserve line breaks, and return an empty string when there is no Japanese
  text. `vertical` only appends a hint that the text may be written
  vertically — the model does not need a separate mode, which is why plan 024
  can drop the toggle.
- **Post-process**: reuse the same normalisation the client does — collapse
  inter-CJK spaces and blank lines. Put it in
  `backend/study/text_normalize.py` so `routes/ocr.py` and any future caller
  share one implementation; mirror the `[ \t]+`-not-`\s+` rule from
  `frontend/src/lib/ocr.js` (and its comment about not eating real newlines).
- **Strip fences**: models sometimes wrap output in ``` blocks. Reuse the same
  approach as `routes/phrase.py::_parse_llm_json`'s fence stripping.
- Call `chat(messages, vision=True, max_tokens=1500, reasoning=False)`.
- Map `LLMUnavailable` → **503** with a message telling the operator to run the
  probe script.

**Register in `main.py`** next to the other routers.

**Verify:**

```bash
cd backend && python -c "
from main import app
print([r.path for r in app.routes if 'ocr' in r.path])
"
```

Expected: `['/api/ocr']`.

### Step 5 — Cost cap (not optional)

An authenticated endpoint that spends money per call needs a ceiling. Add a
per-user daily counter using the codebase's self-migration pattern (copy the
shape from `routes/decks.py::_ensure_deck_schema`):

```sql
CREATE TABLE IF NOT EXISTS ocr_usage (
    user_id  TEXT NOT NULL,
    day      DATE NOT NULL,
    count    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
)
```

- Increment with `INSERT ... ON CONFLICT (user_id, day) DO UPDATE SET count = ocr_usage.count + 1 RETURNING count`.
- Increment **before** the model call, and return **429** when the returned
  count exceeds `_DAILY_OCR_LIMIT` (default **60**, overridable by env
  `OCR_DAILY_LIMIT`). Counting before means a failed call still costs a slot —
  deliberate, because a retry loop on a failing model is exactly what a cap
  exists to stop.
- Comment why the limit is what it is: 60 images/day is far beyond real study
  use and still bounds a runaway client to a few cents.

**Declare the table in `backend/srs/data_structure.sql`** with an owning-module
comment. `tests/test_schema_declared.py` (plan 020) will fail if you forget —
that is the test doing its job.

**Verify:**

```bash
cd backend && python -m pytest tests/test_schema_declared.py -q
```

Expected: passes.

### Step 6 — Tests

`backend/tests/test_llm_vision_models.py`:
- every entry in each provider's `vision_models` is a non-empty string
- `models` and `vision_models` do not overlap for any provider
- `chat(..., vision=True)` raises `LLMUnavailable` when every provider's
  `vision_models` is empty (monkeypatch the catalog)
- `chat(..., vision=True)` selects a model from `vision_models`, not `models`
  (monkeypatch the HTTP layer, assert the model id in the request body)

`backend/tests/test_ocr_api.py` — **monkeypatch `chat`, never call a real
model**:
- a valid tiny PNG returns 200 and the normalised text
- a non-image body returns 400
- an oversized body returns 413
- `LLMUnavailable` maps to 503
- exceeding the daily limit returns 429, and the response says the limit
- fenced output (```` ```\n猫\n``` ````) is unwrapped
- inter-CJK spaces are stripped **and a genuine `\n` survives** — the exact bug
  fixed in plan 018 (`[ \t]+` vs `\s+`), re-asserted here because this is a
  second implementation of the same rule

Use a **unique** phrase in any test that touches shared caches — see the
`phrase_analysis_cache` collision recorded in `plans/README.md`.

**Verify:**

```bash
cd backend && python -m pytest tests/test_ocr_api.py tests/test_llm_vision_models.py -v
cd backend && python -m pytest -q
```

Expected: new tests pass; the full suite (338 at time of writing) still passes.

### Step 7 — Amend ADR-0004

Do **not** rewrite history. Append a dated amendment to
`docs/adr/0004-ocr-runs-client-first.md`:

- what was assumed (client-side Tesseract would be good enough),
- what was observed (unusable on photographs; users got garbage),
- what changed (a vision tier is now the default; Tesseract remains available
  as the offline/private option),
- what is unchanged (an image is still never stored server-side — it is
  forwarded to the model and dropped),
- the correction to `plans/018`'s probe conclusion, so nobody re-derives the
  false negative.

State plainly that the image now **does** leave the device on the default path,
since that is exactly the property ADR-0004 originally chose to protect.

## STOP conditions

- **Every benchmarked vision model fails the probe in Step 3.** Do not ship a
  route that 503s. Report the probe output; the account may be out of credit
  (a 402 is a *provider* signal, unlike 429).
- **The only models that pass are `:free` ones.** They rate-limit under any real
  use; a feature built on them will look broken again. Report and ask before
  proceeding.
- **`chat()` would need its retry or dead-model logic changed** to support
  vision. It should not — if it does, the vision list is being wired in at the
  wrong layer. Stop and re-read Step 2.
- **A test needs a real model call to pass.** Every test here must run offline.
- Adding the daily-cap table breaks `tests/test_schema_declared.py` and the fix
  is not simply declaring it in `data_structure.sql`.

## Test plan

Automated: Step 6, all offline.

One **manual live check** at the end, since the whole plan rests on real model
behaviour:

1. Start the backend with `DEV_USER_ID` set.
2. `curl -s -F 'file=@<a real photo of Japanese text>' -H 'Authorization: Bearer x' http://127.0.0.1:8000/api/ocr`
3. **Expected**: recognisable Japanese matching the photo — not the character
   soup Tesseract returns for the same image. Put both outputs side by side in
   the execution note; that comparison is the evidence this plan worked.

## Maintenance note

Model catalogues churn. `vision_models` will rot exactly like `models` has
twice before (see the dated comments in `_PROVIDER_CATALOG`). The probe script
is the defence — run `--vision` after touching either list.

Two traps for review:
- **Never conclude "no vision capability" from a 429.** That single misreading
  cost this feature an entire release cycle.
- **Never let `vision_models` and `models` merge.** A text model sent an image
  400s, and `chat()` will faithfully burn one attempt per model discovering it.

Cost scales linearly with images. If usage grows past the daily cap being
meaningful, the next move is caching by image hash — the same
content-addressed trick `phrase_analysis_cache` already uses, and the reason
Step 4 returns `chars` and `model` in the response (both useful for a future
cache key and for spotting a model quietly degrading).
