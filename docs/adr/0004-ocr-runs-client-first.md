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
