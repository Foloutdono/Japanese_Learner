# Plan 018: Read Japanese from a photo — in-browser OCR with a vision-model escalation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d4911a6..HEAD -- backend/study/llm_shared.py frontend/src/screens/PhraseAnalyzerScreen.jsx frontend/package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — new dependency; Step 1 may invalidate Step 4
- **Depends on**: `plans/016-analyzer-local-first-and-sentence-bank.md` (hard)
- **Category**: direction
- **Planned at**: commit `d4911a6`, 2026-08-25

## Why this matters

Everything a learner most wants to read is on paper or on a screen they cannot
copy from: a sign, a menu, a manga panel, a game. Typing it back in requires
already knowing how to read it, which is the problem.

Plan 016 made the analyzer accept a Passage of many Sentences and analyze it
locally for free. This plan supplies a Passage from a photo. Because the local
tier costs nothing, a ten-Sentence page is as cheap to analyze as one word.

Read `docs/adr/0004-ocr-runs-client-first.md` before starting. The decision:
`tesseract.js` in the browser first, escalating to a vision model only when
confidence is low — the common case (a clean screenshot) then costs nothing and
never leaves the device.

## Current state

### The contract this plugs into

Plan 016 left the analyzer taking a Passage of arbitrary text and splitting it
into Sentences. **This plan produces `text: string` and hands off.** Nothing
downstream knows OCR happened. Do not build a parallel analysis path.

### The provider layer

`backend/study/llm_shared.py:72` — every provider is one frozen dataclass:

```python
@dataclass(frozen=True)
class Provider:
    name: str
    url: str
    api_key: str | None
    models: tuple[str, ...]
    reasoning_body: object = field(default=None)
```

and `chat(messages, timeout, max_tokens, reasoning)` at `llm_shared.py:324`
posts `messages` through verbatim. Both configured endpoints are
OpenAI-compatible, so an image is expressed as a content-part array on a user
message — **no change to `chat`'s body construction is needed**, only a
provider entry that names a vision-capable model.

### Model availability is unproven

`_PROVIDER_CATALOG` at `llm_shared.py:91` currently lists
`nvidia/nemotron-3-super-120b-a12b`, `nvidia/nemotron-3-ultra-550b-a55b`,
`nvidia/nemotron-3.5-lightning-30b-a3b` (NVIDIA) and, on OpenRouter,
`nvidia/nemotron-3.5-lightning:free`, `nvidia/nemotron-3-super-120b-a12b:free`,
`google/gemma-4-31b-it:free`, `nvidia/nemotron-3-ultra-550b-a55b:free`.

**None is confirmed vision-capable for these accounts.** This file's comments
are emphatic about the discipline here — every model list in it records having
been checked live against the provider's catalog, and one entry notes a model
that "answered the N5 prompt in English rather than Japanese — which a catalog
check alone would never have caught".

`backend/scripts/check_llm_models.py` exists for exactly this and already has a
`--smoke` mode that spends one completion per model. Step 1 extends that
discipline to vision.

### Repo conventions

- `python-multipart` is already in `backend/requirements.txt`, so a multipart
  upload endpoint needs no new backend dependency.
- New locale keys go in **both** locale files; the parity test (commit
  `38bb4a3`) enforces it.
- `frontend/src/lib/api.js`'s `apiFetch` sets `Content-Type: application/json`
  unconditionally. A multipart POST must override it — pass
  `headers: { 'Content-Type': undefined }` or use `fetch` directly with the
  auth header, and comment why.

### Vocabulary (from `CONTEXT.md`)

- **Passage** — what the learner submits as one act. A photo is a Passage source.
- **Sentence** — the atom of analysis.
- **Local tier** — analysis computable without a language model.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Frontend install | `cd frontend && npm install` | exit 0 |
| Frontend tests | `cd frontend && npm test` | all pass |
| Lint / build | `cd frontend && npm run lint && npm run build` | both exit 0 |
| Backend tests | `cd backend && pytest` | all pass |
| Vision probe | `cd backend && python -m scripts.check_llm_models --vision` | see Step 1 |

## Scope

**In scope**:
- `backend/scripts/check_llm_models.py` (add a vision probe — Step 1)
- `backend/study/llm_shared.py` (a `vision` flag and a vision model entry)
- `backend/routes/ocr.py` (create), registered in `backend/main.py`
- `backend/tests/test_ocr.py` (create)
- `frontend/package.json` (add `tesseract.js`)
- `frontend/src/lib/ocr.js` (create)
- `frontend/src/components/analysis/ImageInput.jsx` (create)
- `frontend/src/screens/PhraseAnalyzerScreen.jsx` (wire the input)
- both locale files

**Out of scope** (do NOT touch):
- The analysis pipeline. OCR produces text and stops.
- `manga-ocr` or any server-side OCR model — ADR 0004 rejects it on
  infrastructure grounds (~440 MB against a Render instance whose 1 GB disk is
  already committed to exam audio).
- Storing uploaded images. The image is transient: used, then discarded. Do not
  add a table, a bucket, or a disk path for it.
- `chat()`'s retry, fallback and dead-model bookkeeping in `llm_shared.py`.
  Add a provider entry and a flag; change no control flow.

## Git workflow

- Branch: `advisor/018-image-and-camera-input`
- Commit per step; conventional commits, e.g. `feat(ocr): read Japanese from a photo`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Prove a vision model exists — before building on one

Extend `backend/scripts/check_llm_models.py` with a `--vision` flag that, for
each configured provider, sends one tiny request containing a small
`image_url` content part (a data URI of a generated image with a few Japanese
characters drawn on it is fine) and reports per model:

- rejected the request shape (400) — not vision-capable;
- accepted and returned text — record what it returned.

Run it. **Record the result in the plan's status row and in a comment in
`llm_shared.py`**, exactly as the existing model lists do.

This step gates Step 4. If no configured model is vision-capable, Steps 2, 3, 5
and 6 still deliver the whole client-side feature; Step 4 becomes a STOP and a
report.

**Verify**: `cd backend && python -m scripts.check_llm_models --vision` → exits
0 and prints a per-model verdict

### Step 2: Client-side OCR

Add `tesseract.js` to `frontend/package.json` dependencies.

Create `frontend/src/lib/ocr.js` exposing:

```js
export async function recognize(file, { vertical = false, onProgress } = {})
// -> { text: string, confidence: number }
```

Requirements:

- **Lazy-load the worker and the traineddata on first use**, never at module
  import. The `jpn` traineddata is 15–25 MB; it must not be on the critical
  path of any other screen.
- `vertical` selects `jpn_vert` instead of `jpn`.
- Report progress through `onProgress` so the UI can show the download and the
  recognition separately — the first use is slow and silence reads as a hang.
- Terminate the worker when done; do not leak one per image.
- Normalise the output: strip the spaces Tesseract inserts between Japanese
  characters (they are an artifact of a space-delimited assumption that does
  not hold for Japanese), collapse blank lines, and trim.

**Verify**: `cd frontend && npm run build` → exit 0, and the main bundle does
not grow by megabytes (`ls -la frontend/dist/assets/` before and after; the
traineddata must not be bundled)

### Step 3: The input control

Create `frontend/src/components/analysis/ImageInput.jsx`:

- `<input type="file" accept="image/*" capture="environment">` — this gives the
  camera on mobile and a file picker on desktop with no permission plumbing of
  its own.
- A **vertical text** toggle, defaulting to horizontal.
- Progress display driven by `onProgress`.
- The recognized text lands in an **editable textarea** before anything is
  analyzed. This is not a nicety: OCR will be wrong sometimes, and the learner
  is the cheapest corrector available. Never analyze straight from `recognize`
  without showing the text first.
- A **Try harder** control that triggers Step 4's escalation.

Wire it into `PhraseAnalyzerScreen.jsx` as a second way to fill the existing
Passage textarea. The analyze path is unchanged.

**Verify**: `cd frontend && npm run lint && npm test` → both pass

### Step 4: Vision escalation (gated on Step 1)

Only if Step 1 found a vision-capable model.

In `backend/study/llm_shared.py`, add `vision: bool = False` to `Provider` and
a catalog entry naming the confirmed model. Add a `vision_models()` helper
returning the (provider, model) pairs that carry it. Do not alter `chat`'s
control flow.

Create `backend/routes/ocr.py` with `POST /api/ocr`, multipart:

- Accept one image file. **Cap the size** (2 MB is ample for readable text) and
  reject larger with a 413 rather than forwarding it.
- Reject any content type that is not an image.
- Build a `chat()` message with a text instruction ("transcribe the Japanese
  text in this image, output only the text") and an `image_url` content part
  carrying a data URI.
- Return `{"text": ...}`. On `LLMUnavailable`, return 503 with a message
  pointing at the client-side result the caller already has.

Register the router in `backend/main.py` alongside the others.

Client side: escalate automatically when Tesseract's confidence is below ~70 or
the result is less than ~60% Japanese-script characters, and always when the
learner presses **Try harder**. Both thresholds are guesses; put them in named
constants with a comment saying so.

**Verify**: `cd backend && pytest tests/test_ocr.py -v` → all pass

### Step 5: Provenance

When a Passage came from an image, send `source: "image"` on the analyze
request so plan 016's Sentence bank records it. The `source` and `source_ref`
columns already exist with defaults — plan 016 created them for exactly this.

**Verify**: `cd backend && grep -n "source" routes/phrase.py` → the analyze
endpoint accepts and stores it

### Step 6: Locale keys and tests

Locale keys in **both** files: `takePhoto`, `chooseImage`, `verticalText`,
`ocrLoading`, `ocrRecognizing`, `ocrConfidenceLow`, `tryHarder`,
`ocrCheckText`, `ocrFailed`, `imageTooLarge`.

Create `backend/tests/test_ocr.py`: an oversized upload returns 413; a
non-image content type is rejected; with `chat` monkeypatched to raise
`LLMUnavailable` the endpoint returns 503 (**never** a 500); with `chat`
monkeypatched to return text, the endpoint returns it.

Add a node-lane test for `frontend/src/lib/ocr.js`'s text normalisation — the
space-stripping and blank-line collapsing are pure functions and should be
tested without a worker. Export them separately so they can be.

**Verify**: `cd backend && pytest && cd ../frontend && npm test` → all pass

## Test plan

Backend cases in Step 6. Frontend: the normalisation unit tests (node lane),
plus a browser-lane test that `ImageInput` shows the editable textarea before
analysis and does not auto-submit.

Do not write a test that runs real OCR on a real image — slow, flaky, and it
tests Tesseract rather than this code.

**Verification**: `cd backend && pytest && cd ../frontend && npm test && npm run lint && npm run build`.

## Done criteria

ALL must hold:

- [ ] `cd backend && pytest` exits 0
- [ ] `cd frontend && npm test && npm run lint && npm run build` all exit 0
- [ ] `python -m scripts.check_llm_models --vision` runs and its result is recorded in a comment in `llm_shared.py`
- [ ] `grep -rn "tesseract" frontend/src/` → only in `lib/ocr.js` (lazy-loaded, not imported at app start)
- [ ] Selecting an image produces text in an editable field **before** any analysis runs
- [ ] Uploading a 5 MB image returns 413, not a 500 or a hang
- [ ] No image is written to disk anywhere (`grep -rn "open(" backend/routes/ocr.py` → no file writes)
- [ ] Every new locale key exists in both `en` and `fr`
- [ ] `plans/README.md` status row for 018 updated, including the Step 1 verdict

## STOP conditions

Stop and report back (do not improvise) if:

- **Step 1 finds no vision-capable model on either provider.** Land Steps 2, 3,
  5 and 6, mark Step 4 blocked in the index with the probe output, and stop.
  Do **not** add a new paid provider on your own initiative — that is an
  operator decision with a cost attached.
- `tesseract.js` cannot be made to lazy-load and ends up in the main bundle.
  Report the bundle size delta rather than shipping it.
- Tesseract's Japanese output is unusable (garbage on a clean, high-contrast
  screenshot of printed Japanese). That invalidates ADR 0004's tier 1; report
  with the sample rather than compensating with heuristics.
- The multipart upload fails because `apiFetch` forces a JSON content type and
  you cannot override it cleanly. Report it — the fix belongs in `lib/api.js`
  as its own change, not smuggled into this plan.

## Maintenance notes

- **Tier 2 is unproven until Step 1 says otherwise.** Whatever the probe finds
  must be written down in `llm_shared.py` next to the model list, in the same
  style as the existing entries, so the next person does not re-derive it.
- **The confidence thresholds are guesses.** Expect to tune them against real
  photos; keep them named and commented so a reviewer knows they are not
  measured.
- **The editable textarea is load-bearing**, not a nicety. A future
  "auto-analyze" shortcut would remove the only correction step in the flow.
- **Revisit `manga-ocr`** if the backend ever moves to an instance with room
  for it — it is materially better on exactly the material learners photograph
  most.
