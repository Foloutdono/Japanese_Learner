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
- **Risk**: MEDIUM — no cost (NVIDIA free tier), but it puts user-triggered load
  on the shared quota the analyzer and exams also use; the cap in Step 5 is not
  optional. The chosen model is accurate but fails transiently ~1 call in 5, so
  the fallback chain is load-bearing.
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

Re-probed live on 2026-08-26 against the keys already in `backend/.env`.

### This project is free-tools-only, so NVIDIA is the target

OpenRouter has 250 image-capable models, but the good ones are **paid** and its
one usable free model (`google/gemma-4-31b-it:free`) returns HTTP 429 on every
attempt — the same symptom `plans/018` saw, which was always a **quota** signal
and never a capability one.

**NVIDIA's `integrate.api.nvidia.com` — the endpoint this backend already uses
for text, on the key already configured — serves vision models at no cost.**
Five candidates exist; four work. All accept the standard OpenAI
`image_url` content part, so **no transport change is needed anywhere**.

Benchmarked across three images of increasing difficulty. "Score" = output
contained the source line **character for character**:

| Model (NVIDIA, free) | clean | hard horizontal¹ | vertical² |
|---|---|---|---|
| **`nvidia/nemotron-nano-12b-v2-vl`** | **3/3** | **2/2** | **3/3** |
| `nvidia/llama-3.1-nemotron-nano-vl-8b-v1` | 3/3 | 1/2 | 2/3 |
| `meta/llama-3.2-90b-vision-instruct` | 3/3 | **2/2** | **0/3** |
| `meta/llama-3.2-11b-vision-instruct` | 3/3 | 1/2 | 0/3 |
| `microsoft/phi-3-vision-128k-instruct` | HTTP 404 — not served on this account |

¹ rotated 2°, downscaled to 470×120, sensor noise, blur, JPEG quality 32.
² vertical *tategaki*, three columns, JPEG quality 45, **with the orientation
prompt from Step 4** — see below.

**`nvidia/nemotron-nano-12b-v2-vl` matches the paid OpenRouter models on every
case**, verified against `qwen/qwen3-vl-30b-a3b-instruct` and
`qwen/qwen2.5-vl-72b-instruct` as controls (both 3/3 on the same vertical
image, confirming the test image was fair rather than illegible).

### Vertical text is a prompt problem, not a model problem

With a plain *"transcribe this"* prompt, **every** model scored 0/3 on vertical
text. They read the characters and scrambled the column order;
`meta/llama-3.2-90b-vision-instruct` replied *"There is no Japanese text in the
image. The text appears to be written in a different language, possibly Chinese
or Korean."*

Adding explicit instructions — text may be vertical, read columns top-to-bottom
and order them right-to-left — took `nemotron-nano-12b-v2-vl` from **0/3 to
3/3**, with no change to its horizontal accuracy. That prompt is specified in
Step 4 and is **load-bearing**, not a nicety: manga and novels are a core use
case for this app, and without it they silently fail.

`meta/llama-3.2-90b-vision-instruct` stayed at 0/3 even with the hint — it is
genuinely weak at Japanese, and is listed last for that reason.

### Reliability: accurate when it answers, flaky about answering

`nvidia/nemotron-nano-12b-v2-vl` fails transiently more than a paid endpoint
would. Measured over 6 identical back-to-back calls on the hard horizontal
image: **5 succeeded, 1 timed out**, and every success scored **2/2**. Two
HTTP 500s were also seen during earlier probing.

So roughly **one call in five needs a retry**, and accuracy is *not* the
variable — when it answers, it answers correctly.

This is exactly what `chat()` already does: retry once per model on a network
error, move to the next model on a 5xx. **The fallback chain is therefore
load-bearing here in a way it is not for the text models** — do not collapse
`vision_models` to a single entry, and do not remove the retry.

### Cost

**Zero.** This runs on NVIDIA's free API alongside the text models already in
use. There is no paid dependency anywhere in this plan, and no OpenRouter
vision model is used — see Step 1's note on why the paid list is recorded but
left empty.

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

Populate **NVIDIA** with the benchmarked list, best-first, recording the
evidence the way every other entry in this file does:

```python
        # Vision. Benchmarked live 2026-08-26 on three Japanese images of
        # increasing difficulty (clean; rotated+noisy+blurred+JPEG-q32 at
        # 470x120; vertical tategaki at q45), scored by exact
        # character-for-character line match. Ordered by measured
        # accuracy, NOT by size.
        #
        #   nemotron-nano-12b-v2-vl        3/3, 2/2, 3/3   <- matches the
        #       paid OpenRouter models on every case (controlled against
        #       qwen3-vl-30b and qwen2.5-vl-72b, both 3/3 on the same
        #       vertical image, so the test was fair).
        #   llama-3.1-nemotron-nano-vl-8b  3/3, 1/2, 2/3
        #   meta/llama-3.2-90b-vision      3/3, 2/2, 0/3   <- fine on
        #       horizontal, hopeless on vertical even WITH the
        #       orientation prompt; it answered "There is no Japanese
        #       text in the image". Last on purpose.
        #
        # meta/llama-3.2-11b-vision-instruct is omitted: strictly worse
        # than the 90b on every case. microsoft/phi-3-vision-128k-instruct
        # is omitted: 404s on this account.
        #
        # The chain is load-bearing. The primary fails transiently about
        # 1 call in 5 (measured: 5/6 success over 6 identical calls, one
        # timeout; two HTTP 500s seen while probing) -- but scores
        # perfectly whenever it answers. Do NOT reduce this to one model.
        vision_models=(
            "nvidia/nemotron-nano-12b-v2-vl",
            "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
            "meta/llama-3.2-90b-vision-instruct",
        ),
```

For **OpenRouter**, leave `vision_models=()` with the reason recorded, so nobody
re-derives the search:

```python
        # Deliberately empty: this project is free-tools-only. OpenRouter
        # serves 250 image-capable models and several are excellent at
        # Japanese (qwen/qwen3-vl-30b-a3b-instruct and
        # qwen/qwen2.5-vl-72b-instruct both scored 3/3 on the same hard
        # vertical image, ~$0.0002/image) -- but they are PAID, and the
        # one free option (google/gemma-4-31b-it:free) returns 429 on
        # every attempt. NVIDIA's free vision models above match them, so
        # there is nothing to buy here. If a paid budget ever appears,
        # this is where it goes and the two qwen ids above are verified.
        vision_models=(),
```

**Verify:**

```bash
cd backend && python -c "
from study.llm_shared import _PROVIDER_CATALOG as C
for n,p in C.items(): print(n, '->', p.vision_models)
"
```

Expected: nvidia lists 3 models; openrouter lists none.

**Provider order matters here and is the opposite of the text path's
assumption.** Confirm `_build_providers()` yields NVIDIA before OpenRouter for
vision, or that a provider with an empty `vision_models` is skipped rather than
ending the walk (Step 2). If NVIDIA is not first, vision requests will find no
model at all.

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

- render the probe images with Pillow + MS Gothic as it already does, but
  generate **three** cases, not one — a clean line, a degraded one (rotate,
  downscale, noise, JPEG quality ~32), and a **vertical** one. A single clean
  image cannot tell these models apart: all four scored 3/3 on clean text and
  only the hard cases separated them.
- send each as a `data:` URL image content part, using the **same
  `_OCR_PROMPT`** the route uses — probing with a different prompt would
  measure something the app never runs,
- score by **exact line match** against the known source lines,
- print a per-model, per-case `n/N` score,
- **retry once** on a 5xx/timeout before recording a failure, and report the
  retry count — the primary fails transiently about 1 call in 5, and a probe
  that reports that as "broken" would be as misleading as plan 018's 429,
- exit non-zero only if **every** model fails **every** case.

Add a comment stating plainly that a 429, a 500 or a timeout are **quota and
reliability** results, not capability results, and must never be recorded as
"not vision-capable". That single confusion cost this feature a release cycle.

**Verify:**

```bash
cd backend && python -m scripts.check_llm_models --vision
```

Expected: `nvidia/nemotron-nano-12b-v2-vl` scores full marks on all three
cases, possibly after one retry. Record the full output in the execution note —
it is the baseline any future model swap gets compared against.

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
- **Prompt**: use the exact orientation-aware prompt below. It is
  **load-bearing and measured** — the same models score 0/3 on vertical text
  without these instructions and 3/3 with them, while horizontal accuracy is
  unaffected. Do not "tidy" it down to *"transcribe this image"*.

  ```python
  _OCR_PROMPT = (
      "Transcribe ALL Japanese text in this image exactly.\n"
      "The text may be written HORIZONTALLY (yokogaki) or VERTICALLY (tategaki).\n"
      "If it is vertical, read each column TOP to BOTTOM and order the columns "
      "RIGHT to LEFT.\n"
      "If it is horizontal, read each line LEFT to RIGHT, top to bottom.\n"
      "Output only the transcribed text, one line per line or column. "
      "No commentary, no translation.\n"
      "If there is no Japanese text, output nothing."
  )
  ```

  Because this single prompt covers both orientations, the `vertical` form
  field is **advisory only** — append at most a one-line nudge when it is set.
  It exists so plan 024 can drop its toggle without losing the capability; it
  must never select a different prompt or a different model.
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

### Step 5 — Usage cap (still not optional)

Nothing here costs money, but the cap stays — the resource being protected is
just different. NVIDIA's free tier is a **shared, rate-limited quota for the
whole deployment**: one client in a retry loop degrades OCR for every user and,
because the same account serves the text models, would take the analyzer's deep
tier and exam generation down with it.

Add a per-user daily counter using the codebase's self-migration pattern (copy
the shape from `routes/decks.py::_ensure_deck_schema`):

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
  use, and it bounds a runaway client's draw on the shared free quota that the
  analyzer and exam generation also depend on.

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
  route that 503s. Report the probe output. Distinguish the signals before
  concluding anything: a **402** means the account is out of credit (a provider
  problem), a **429** means quota, a **500 or timeout** means flakiness — and
  **none of the three is evidence about capability**. Only a 400/404 on an
  image request, or consistently garbled output across retries, is.
- **The vertical case scores 0/3 across every model.** Check you are sending
  `_OCR_PROMPT` verbatim — orientation instructions are the difference between
  0/3 and 3/3, and a probe that drops them will look like a model failure.
- **You are about to add a paid model to make this work.** This project is
  free-tools-only. NVIDIA's free vision models were measured as sufficient; if
  they have stopped being so, STOP and report rather than reaching for
  OpenRouter's paid list — that is the operator's call, not the executor's.
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

Three traps for review:
- **Never conclude "no vision capability" from a 429, a 500, or a timeout.**
  That single misreading cost this feature an entire release cycle. Capability
  is proved or disproved by a 400/404 on an image request, or by garbled output
  that survives retries — nothing else.
- **Never let `vision_models` and `models` merge.** A text model sent an image
  400s, and `chat()` will faithfully burn one attempt per model discovering it.
- **Never shorten `_OCR_PROMPT`.** It reads like boilerplate and is not: the
  orientation clauses are worth 0/3 → 3/3 on vertical text, which is manga and
  novels — a core use case that would fail silently.

The free tier is the constraint to watch, not money. NVIDIA's quota is shared
across OCR, the analyzer's deep tier and exam generation, so OCR load shows up
as *other features* getting slower or 429ing. If that starts happening, the
next move is caching by image hash — the same content-addressed trick
`phrase_analysis_cache` already uses, and the reason Step 4 returns `chars` and
`model` in the response (both useful for a future cache key, and for spotting a
model quietly degrading after a provider-side swap).
