# 0003 — Video analysis ingests Cues, not YouTube

- **Status**: accepted
- **Date**: 2026-08-25

## Context

The requested feature is "paste a YouTube link and study the subtitles". The
obvious implementation is a YouTube integration. Two facts make that the wrong
shape.

**Caption fetching from a server is unreliable by design.** YouTube blocks
datacenter IP ranges for its timedtext endpoints, and this backend is
deployed on Render (`render.yaml`), which is exactly such a range. A
YouTube-shaped feature would work in local development and fail
unpredictably in production, with no fix available to us.

**Generating captions ourselves is not viable here.** No provider in
`study/llm_shared.py`'s catalog does audio transcription — both are
chat-completions endpoints — and a self-hosted Whisper does not fit the
Render instance. "Create them if they don't exist" cannot be honoured.

## Decision

The pipeline's input is a **Track**: an ordered list of **Cues**, each a start
time, an end time and text. Nothing downstream knows where the Track came
from.

Two ingest paths produce a Track:

- **Upload** — `.srt` / `.vtt` / `.ass` parsed locally. Always works.
- **YouTube URL** — best-effort fetch. On failure, fail *clearly* and point
  the learner at the upload path.

No self-hosted ASR. We rely on YouTube's own auto-captions, which exist for
most Japanese content.

Playback stays in the official YouTube IFrame Player: the view is counted,
ads are served, and no video or audio is ever downloaded. Analysis and
playback are decoupled — the player supplies a clock, nothing more.

## Consequences

- The feature is never dead. When the fetch is blocked, the learner exports
  or downloads a subtitle file and everything downstream is identical.
- The same pipeline serves any future source — a podcast transcript, a
  Netflix export, a pasted script — at no additional cost.
- Cue boundaries are not Sentence boundaries, and Japanese auto-captions
  arrive with no punctuation at all. Reconstructing Sentences from Cues and
  mapping them back to time ranges is a real component, not a formatting step.
- We take on a subtitle-parsing surface (three formats) we would not otherwise
  have.

## Alternatives considered

**YouTube-only.** One input, simpler UI, and an unfixable production failure
mode. Rejected outright.

**Proxy the fetch through a residential IP.** Would make the YouTube path
reliable. Costs money, adds a third-party dependency in the request path, and
does nothing for videos that have no caption track at all.

**Client-side fetch from the learner's own browser.** Their IP is residential,
so the block does not apply — but CORS does, and YouTube serves no permissive
headers for these endpoints. Not possible without an extension.

## Note on terms of service

Fetching caption tracks is outside what YouTube's API is for, even though
playback stays in the official player and nothing is downloaded. The upload
path is unambiguously clean, and that is a reason it is a first-class ingest
rather than a fallback bolted on afterwards.
