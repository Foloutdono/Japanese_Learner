# 0004 — OCR runs in the browser first and escalates to a vision model

- **Status**: accepted
- **Date**: 2026-08-25

## Context

Photo input needs Japanese OCR, including vertical text. Three options were
on the table: `tesseract.js` in the browser, `manga-ocr` on the server, and a
vision-capable LLM through the existing provider chain.

They differ on every axis that matters. `manga-ocr` is by far the most
accurate on Japanese print and manga, and is a ~440 MB model that does not fit
the Render instance's memory or cold-start budget. A vision LLM costs a call
per image and needs a model we have not confirmed exists on either configured
provider. `tesseract.js` is free, private and offline, and its Japanese
accuracy on phone photos is mediocre.

Accuracy is also not all-or-nothing here: the learner is sitting right there
and is the cheapest corrector available.

## Decision

Tier the OCR.

**Tier 1 — `tesseract.js` in the browser.** `jpn` traineddata lazy-loaded on
first use and cached by the browser; `jpn_vert` behind a vertical-text toggle.
The image never leaves the device on this path.

**Tier 2 — vision LLM.** Escalate when Tesseract's mean confidence is low,
when the result is mostly not Japanese script, or when the learner asks for
another attempt. Reached through `study/llm_shared.py`'s existing provider
fallback chain.

The recognized text is always shown in an **editable** field before analysis
runs.

## Consequences

- The common case (a clean screenshot, a well-lit page) costs nothing and
  leaks nothing.
- The hard case (a photo at an angle, manga, low contrast) still works.
- No server-side model, no new memory or disk pressure on an instance whose
  1 GB disk is already committed to exam audio.
- Two OCR code paths to maintain, and a confidence threshold that will need
  tuning against real photos.
- A ~15–25 MB traineddata download on first use. Lazy-loading keeps it off
  every other page load.
- **Tier 2 is unproven.** No model on either configured provider is confirmed
  vision-capable. This must be probed live before it is built on, following
  the same discipline `llm_shared.py` documents throughout for catalog checks.

## Alternatives considered

**`manga-ocr` server-side.** Best accuracy, wrong infrastructure. Revisit if
the backend ever moves to an instance with room for it.

**Vision LLM only.** One code path and better accuracy than Tesseract, but
every photo costs a call, requires a network round trip, sends the image off
device, and depends on a model we have not confirmed exists.

**Tesseract only.** Free and private, and it will visibly fail on exactly the
material learners most want to read.

## Amendment, 2026-08-26 (plans/023)

**What was assumed:** that client-side Tesseract would be good enough to be the
default, with a vision model only as escalation for hard images.

**What was observed:** it is not. On real photographs — perspective, uneven
lighting, low effective DPI, stylised fonts — `jpn` traineddata returns
character soup. The user's report was blunt: *"every picture return either a
complete mess of characters or wrongs ones."* The escalation tier that was
meant to rescue this was never built, because plan 018's probe reported that no
vision-capable model existed.

**That probe was wrong**, and the correction matters more than the original
finding: it only tested the seven models already hardcoded in
`_PROVIDER_CATALOG`, all of them text-only. It never asked either provider
which models accept images. A 429 from a busy free tier was recorded as
evidence of no capability. Both providers do serve working vision models, free.

**What changes:** the vision tier (`POST /api/ocr`) becomes the **default**
path. Tesseract stays, as an explicit "read on my device" option.

**What does NOT change:** no image is stored. It is forwarded to the model and
dropped; nothing but a per-user daily counter is written.

**What this costs, stated plainly:** on the default path the image now **leaves
the device**, which is exactly the property this ADR originally chose to
protect. That is a real reversal, not a technicality. It is made deliberately,
because an OCR feature that returns garbage protects nobody's privacy — it just
does not work — and the private option remains one tap away for anyone who
wants it.

**Money:** none. The models are on free tiers of accounts this backend already
uses. The constraint that replaces cost is shared quota, which is what the
60/day per-user cap bounds.

### A note on how fast this rots

The two best free vision models were benchmarked at 3/3 in the morning and
returned HTTP 410 "reached its end of life" by the afternoon of the same day,
2026-08-26 — NVIDIA's visible catalog dropped from 95 to 83 models in between.
The replacement primary is on a different provider than the text models, which
is why vision walks its own provider order.

Treat every model id in `vision_models` as perishable. `python -m
scripts.check_llm_models --vision` is the check, and it now probes with the
app's own prompt against clean, degraded and vertical images — because every
candidate scores full marks on clean text and only the hard cases separate them.
