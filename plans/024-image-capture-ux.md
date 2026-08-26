# Plan 024: Crop, shrink, and send — make photo input usable

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2552915..HEAD -- frontend/src/components/analysis frontend/src/lib/ocr.js frontend/src/screens/PhraseAnalyzerScreen.jsx frontend/src/locales`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: MEDIUM — replaces the default recognition path
- **Depends on**: `plans/023-vision-ocr-backend.md` (**hard** — this plan calls
  `POST /api/ocr`, which does not exist until 023 lands)
- **Category**: correctness / DX
- **Planned at**: commit `2552915`, 2026-08-26

## Why this matters

Plan 023 makes the backend able to read Japanese from a photo. This plan is
what actually gets a *good* photo to it, and fixes three defects in the current
input that are independent of which engine runs.

**1. On a phone, you cannot choose an existing picture at all.**

```jsx
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={e => handleFile(e.target.files?.[0])}
```

`capture="environment"` tells a mobile browser to go **straight to the rear
camera**, skipping the gallery. The button offering it says:

```jsx
          {t.takePhoto ?? 'Take a photo'} / {t.chooseImage ?? 'Choose an image'}
```

so the UI promises two things and the attribute permits one. A learner trying to
analyse a screenshot or a saved manga page has no route in. `plans/018` intended
"camera on mobile, picker on desktop"; `capture` does not mean that.

**2. Whole-page images are the worst possible input.** Recognition quality is
dominated by how much irrelevant pixel area surrounds the target text. A photo
of a full page asks the model to transcribe everything, then hands the analyzer
a wall of text the learner did not want. Letting the learner drag a box around
*the sentence they care about* is the single largest accuracy lever available,
and it costs one canvas.

**3. Nothing is resized.** A modern phone photo is 4–12 MB. Plan 023 rejects
>8 MB with a 413, so the honest failure mode today would be "your photo is too
big" on a large fraction of real photos. Downscaling client-side to ~1600 px on
the long edge costs nothing, is invisible to quality at the scale text occupies,
and cuts upload time on mobile data.

Two simplifications also fall out of 023:

- **The vertical-text toggle can go — but not for the reason you'd assume.**
  It exists because Tesseract needs different traineddata (`jpn` vs
  `jpn_vert`). Vision models do **not** transparently handle vertical Japanese:
  measured 2026-08-26, every candidate scored **0/3** on a vertical (tategaki)
  sample with a plain "transcribe this" prompt — they read the characters but
  scrambled the column order, and one model confidently replied *"There is no
  Japanese text in the image."*

  What fixes it is the **prompt**, not a mode: telling the model that text may
  be vertical and to read columns top-to-bottom, right-to-left took the best
  model from 0/3 to **3/3**. Plan 023's prompt carries those instructions for
  **both** orientations, and the same prompt still reads horizontal text
  correctly — so the learner never has to classify their own photo, which is
  the actual UX win. Do not add a toggle back; if vertical results disappoint,
  the fix is in 023's prompt.
- **`onEscalate` can go.** It was a hook for a tier that now *is* the default.

## Current state

`frontend/src/components/analysis/ImageInput.jsx` today:

```jsx
export function ImageInput({ t, onTextReady, onEscalate }) {
  const [vertical, setVertical] = useState(false)
  ...
      const { text, confidence } = await recognize(file, {
        vertical,
        onProgress: info => setProgress(info),
      })
      const ratio = japaneseRatio(text)
      if (confidence < LOW_CONFIDENCE_THRESHOLD || ratio < LOW_JAPANESE_RATIO_THRESHOLD) {
        setLowConfidence(true)
      }
      onTextReady(text)
```

`onEscalate` is destructured but **never passed** by
`PhraseAnalyzerScreen.jsx`, which renders:

```jsx
          <ImageInput
            t={t}
            onTextReady={text => { setPhrase(text); setFromImage(true) }}
          />
```

so the "Try harder" button has never once rendered. That call site is also
where `source: 'image'` provenance is set — **keep that behaviour exactly**.

`frontend/src/lib/ocr.js` exports `recognize()` plus the pure helpers
`normalize`, `stripInterCjkSpaces`, `collapseBlankLines`, `JAPANESE_SCRIPT_RE`.
The helpers stay; `recognize()` becomes the fallback path rather than the only
one.

## Scope

**In scope:**
- `frontend/src/components/analysis/ImageInput.jsx` — rewritten
- `frontend/src/components/analysis/ImageCropper.jsx` — new
- `frontend/src/lib/image.js` — new (downscale/crop/encode helpers)
- `frontend/src/lib/ocr.js` — add `recognizeRemote()`; keep `recognize()`
- `frontend/src/screens/PhraseAnalyzerScreen.jsx` — call-site props only
- `frontend/src/index.css` — additive rules only
- `frontend/src/locales/{en,fr}/index.js` — new keys
- New tests alongside the existing `*.browser.test.jsx` / `*.test.js`

**Out of scope — do not touch:**
- `backend/` — all of it. Plan 023 owns the endpoint.
- `SentenceBreakdown`, `WordDetail`, `useMining`, or anything downstream of
  `onTextReady`. This plan changes how text is *produced*, not what happens to
  it.
- The `source: 'image'` provenance flow in `PhraseAnalyzerScreen.jsx`.
- Removing `tesseract.js` from `package.json`.

## Steps

### Step 1 — Image helpers

Create `frontend/src/lib/image.js` with pure-ish, testable functions:

```javascript
export const MAX_EDGE = 1600        // px on the long edge before upload
export const JPEG_QUALITY = 0.9
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024   // must match routes/ocr.py

export function fitWithin(width, height, maxEdge = MAX_EDGE) { /* -> {width, height} */ }
export async function loadImage(file)                        // -> HTMLImageElement
export async function toBlob(source, crop, maxEdge)          // -> Blob (image/jpeg)
```

`fitWithin` must be **pure** and unit-tested: it returns the original size when
already within `maxEdge`, preserves aspect ratio otherwise, never returns a zero
dimension, and rounds to integers.

`toBlob` draws the (optionally cropped) region onto a canvas at the fitted size
and encodes JPEG. Comment why JPEG and not PNG: a photograph re-encoded as PNG
is often *larger* than the original, which would defeat the point.

**Verify:**

```bash
cd frontend && npm test -- --run src/lib/image.test.js
```

Expected: `fitWithin` cases pass.

### Step 2 — Remote recognition in `ocr.js`

Add alongside the existing export — do not modify `recognize()`:

```javascript
/**
 * Recognize Japanese text by sending the image to the backend's vision
 * tier (POST /api/ocr, see plans/023). This is the DEFAULT path: it is
 * dramatically more accurate on photographs than the local tesseract
 * tier below, which stays available for offline/private use.
 *
 * The image leaves the device on this path. That is a real change from
 * docs/adr/0004's original position -- see its 2026-08 amendment.
 */
export async function recognizeRemote(blob, session, { vertical = false } = {}) {
  const form = new FormData()
  form.append('file', blob, 'capture.jpg')
  form.append('vertical', String(vertical))
  const data = await apiUpload('/api/ocr', session, form)
  return { text: data.text, model: data.model, remote: true }
}
```

Use the existing `apiUpload` from `lib/api.js` (added in plan 019) — do not
hand-roll a fetch. It already handles the bearer token and non-2xx `ApiError`.

`ImageInput` must surface the endpoint's specific failures rather than one
generic message: **413** → "that image is too large", **429** → "daily limit
reached", **503** → "image reading isn't available right now". A single
"couldn't read this image" for all three is what makes a feature feel broken
when it is actually rate-limited.

### Step 3 — The cropper

Create `frontend/src/components/analysis/ImageCropper.jsx`.

- Shows the picked image scaled to fit its container.
- A draggable/resizable rectangle over it, defaulting to the **full image**, so
  doing nothing is a valid choice.
- Must work with **pointer events** (`onPointerDown/Move/Up` + `setPointerCapture`),
  which covers mouse and touch in one path. Do not write separate mouse and
  touch handlers.
- Exposes `{ x, y, width, height }` in **natural image coordinates**, not
  display coordinates — the scale factor between the two is the one thing this
  component must get right, and it is what the test in Step 6 pins.
- Buttons: **Use this area** and **Use whole image**.
- Keyboard-accessible: the crop box is focusable and arrow keys nudge it. The
  repo has an accessibility wave behind it (plans 002–007); do not regress that.

Style with additive rules in `index.css` only, following the existing
`analysis-image-input__*` naming.

### Step 4 — Rewrite `ImageInput`

New flow: **pick → crop → recognize → editable text** (`onTextReady`).

```jsx
export function ImageInput({ t, session, onTextReady }) {
```

- Drop `vertical`, `onEscalate`, `LOW_CONFIDENCE_THRESHOLD`,
  `LOW_JAPANESE_RATIO_THRESHOLD`, and `japaneseRatio`. Confidence-based
  escalation was a Tesseract concept; the vision tier has no comparable score
  and no tier above it to escalate to.
- **Two separate inputs**, which is what fixes defect 1:

```jsx
      {/* Two inputs, not one: `capture` forces the camera and hides the
          gallery on mobile, so a single input cannot offer both. The
          button labels and the inputs now agree. */}
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" ... />
      <input ref={galleryRef} type="file" accept="image/*" ... />
```

  On desktop both open the same picker, which is harmless.
- After a file is chosen, render `<ImageCropper>`; on confirm, call
  `toBlob(...)` then `recognizeRemote(...)`.
- Keep a **"Read on my device instead"** control that runs the existing
  `recognize()` tesseract path on the same cropped blob. Label it honestly —
  something like `t.ocrLocalOption` = "Read on my device (private, less
  accurate)". This is what preserves ADR-0004's privacy option rather than
  deleting it.
- Keep the progress display for the local path (tesseract reports progress);
  for the remote path a simple busy state is enough — comment why they differ.
- Always reset `fileInputRef.current.value = ''` in `finally`, as today, or
  re-picking the same file fires no `change` event.

### Step 5 — Call site

In `PhraseAnalyzerScreen.jsx`, pass `session` and drop nothing else:

```jsx
          <ImageInput
            t={t}
            session={session}
            onTextReady={text => { setPhrase(text); setFromImage(true) }}
          />
```

`setFromImage(true)` **must stay** — it is what makes the Passage record
`source: 'image'` provenance (plan 016/018).

### Step 6 — Locale keys

Add to **both** `locales/en/index.js` and `locales/fr/index.js`. Suggested:
`chooseImage`, `takePhoto`, `cropHint`, `useThisArea`, `useWholeImage`,
`ocrReading`, `ocrLocalOption`, `ocrTooLarge`, `ocrLimitReached`,
`ocrUnavailable`, `ocrFailed`.

**Before adding each key, check for a collision** — this bit the wave twice:

```bash
cd frontend && for k in chooseImage takePhoto cropHint useThisArea useWholeImage ocrReading ocrLocalOption ocrTooLarge ocrLimitReached ocrUnavailable ocrFailed; do
  echo "$k: $(grep -c "^\s*$k:" src/locales/en/index.js)"
done
```

Expected: `0` for every new key, `1` for any you intend to reuse. A count of
`2+` after your edit means a **silent** collision — the later spread in the
export wins and your string is dead code, with no lint or build error. See
`plans/README.md`'s plan-016 note.

**Verify parity:**

```bash
cd frontend && npm test -- --run -t "locale"
```

Expected: the locale-parity test passes.

### Step 7 — Tests

- `src/lib/image.test.js` — `fitWithin` (pure): under-max passthrough,
  landscape, portrait, square, integer rounding, no zero dimension.
- `src/components/analysis/ImageCropper.browser.test.jsx` — a crop rectangle in
  display space maps to the right **natural-image** coordinates when the image
  is displayed at a non-1:1 scale. This is the component's one real invariant.
- `src/components/analysis/ImageInput.browser.test.jsx` — extend the existing
  file:
  - a chosen file shows the cropper, not an immediate recognition
  - confirming the crop calls `recognizeRemote` (mocked) and then `onTextReady`
    with its text
  - 413 / 429 / 503 each render their **own** message
  - the local-device option calls `recognize`, not `recognizeRemote`

Wrap renders in `<LangProvider>` and stub `globalThis.fetch`, as
`SentenceBreakdown.browser.test.jsx` does — otherwise the provider's
translation fetch produces an unhandled rejection that pollutes the run.

**Verify:**

```bash
cd frontend && npm test -- --run && npm run lint
```

Expected: all tests pass; lint **0 errors** (18 pre-existing warnings are fine).

## STOP conditions

- **`POST /api/ocr` does not exist or returns 503.** Plan 023 is not done. Stop —
  do not build a local-only fallback and call this plan finished.
- **The cropper cannot produce correct natural-image coordinates** for a scaled
  image. Everything downstream is wrong if this is wrong; get the Step 7 test
  green before wiring recognition to it.
- **`MAX_UPLOAD_BYTES` here disagrees with `_MAX_IMAGE_BYTES` in
  `routes/ocr.py`.** Make them agree, and leave a comment in both naming the
  other.
- A locale-key collision check returns `2+` after your edit.

## Test plan

Automated: Step 7.

Manual — this is the check that closes the original report, so do it on a real
phone, not a desktop emulator:

1. **Gallery access**: on a phone, tap "Choose an image" → the **gallery**
   opens, not the camera. (This is defect 1; it cannot be verified on desktop.)
2. **Camera**: tap "Take a photo" → camera opens.
3. Photograph a page of Japanese. Crop to **one sentence**. Recognize.
   **Expected**: that sentence, accurately — then Analyze produces a normal
   breakdown.
4. Repeat with **Use whole image** on the same photo and note the difference in
   the execution note. That comparison is the argument for the cropper.
5. Try a **vertical** text sample with no toggle anywhere. Expected: it still
   reads correctly.
6. Toggle **"Read on my device"** on the same crop. Expected: noticeably worse
   output — which is the honest reason it is not the default.

## Maintenance note

The crop rectangle's display↔natural coordinate mapping is the fragile part.
Anything that changes how the image is sized (a CSS `object-fit` change, a new
container, a zoom control) can silently break it while the UI still looks
right — the symptom is recognition of the wrong region, not an error. The Step 7
test is the guard; keep it.

`MAX_EDGE = 1600` is a guess, not a measurement — the same honesty
`plans/018` applied to its confidence thresholds. If accuracy on small print
disappoints, raise it before blaming the model, since downscaling is the one
lossy step this client performs.

Watch in review: any reintroduction of a single file input with `capture`, and
any new "generic error" catch that collapses 413/429/503 back into one message.
