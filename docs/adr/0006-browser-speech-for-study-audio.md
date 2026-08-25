# 0006 — Study audio uses the browser's speech synthesis; edge-tts stays for exams

- **Status**: accepted
- **Date**: 2026-08-25

## Context

The analyzer and the video mode want to pronounce a Sentence or a single word
on demand. `study/exam_tts.py` already synthesizes Japanese speech — edge-tts
against Microsoft's free consumer voices, content-keyed and cached to disk —
so reusing it looks obvious.

It is the wrong fit here, for reasons of kind rather than quality:

- **Disk.** Exam audio is cached on the Render persistent disk, sized 1 GB in
  `render.yaml`. Exam content is a small fixed set; arbitrary study text is
  not. A handful of video sessions at ~100 Sentences each fills the volume,
  and exam audio is the thing that cannot be cheaply regenerated.
- **Shape.** An endpoint that synthesizes arbitrary user-supplied text is a
  proxy to a third-party consumer service with no natural bound on input.
- **Latency.** Every playback becomes a network round trip for something the
  learner expects to be instant.

## Decision

Use the browser's `SpeechSynthesis` API with a `ja-JP` voice for analyzer and
video playback.

Keep `study/exam_tts.py` exclusively for exam listening sections, where voice
quality is part of what is being assessed and the content set is small,
fixed, and worth caching.

## Consequences

- Playback is instant, free, needs no network, and adds nothing to the disk.
- No new endpoint, therefore no new abuse surface.
- **Voice quality varies by platform** and some Linux browsers ship no
  Japanese voice at all. The control must detect voice availability and hide
  or disable itself rather than failing silently.
- Two speech paths exist in the codebase. This ADR is the answer to "why?".
- Nothing about study audio is reproducible server-side, so it cannot be used
  in generated content.

## Alternatives considered

**One `GET /api/tts` on top of edge-tts, capped and rate-limited.** Uniform
quality everywhere. Still a proxy, still competes with exam audio for the
disk, still a round trip per play, and the caps are a permanent tuning
problem.

**edge-tts without persisting — stream and discard.** Removes the disk
problem, keeps the proxy and the latency, and throws away the caching that
makes the exam path cheap.
