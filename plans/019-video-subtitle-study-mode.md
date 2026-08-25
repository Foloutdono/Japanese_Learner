# Plan 019: Study a video's Japanese subtitles, live, with a full breakdown on demand

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat d4911a6..HEAD -- backend/routes backend/study/sentences.py frontend/src/components/analysis frontend/src/config`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH — one ingest path depends on a third party that actively blocks servers
- **Depends on**: `plans/017-mine-sentences-into-decks.md` (hard)
- **Category**: direction
- **Planned at**: commit `d4911a6`, 2026-08-25

## Why this matters

Video is where most learners actually meet Japanese, and subtitles are the one
form of authentic input that arrives already timed, already segmented into
display units, and paired with audio. What is missing is everything this app
already computes: which words the learner knows, which they do not, what
grammar is at work, and a way to keep any of it.

By this point in the wave, all of that is a component (`SentenceBreakdown`)
fed by a free local tier. This plan supplies it from a video's captions and
syncs it to a player clock.

Read `docs/adr/0003-source-agnostic-caption-pipeline.md` before starting. Its
central decision — and the reason this plan is shaped the way it is — is that
**the pipeline ingests Cues, not YouTube**.

## Current state

### The two hard constraints

**YouTube blocks datacenter IPs** for its caption endpoints, and this backend
deploys to Render (`render.yaml`), which is one. A YouTube-shaped feature works
locally and fails unpredictably in production, with no fix available to us.
This is why upload is a first-class ingest and not a fallback.

**We cannot generate captions.** Both providers in
`backend/study/llm_shared.py:91` are chat-completions endpoints; neither
transcribes audio, and a self-hosted Whisper does not fit the instance. The
feature relies on YouTube's own auto-captions, which exist for most Japanese
content. Do not attempt ASR.

### The job pattern to reuse — do not invent one

`backend/routes/exams.py` already solved "work that outlives a request", and
its comment at line 241 explains the choice:

> A plain daemon thread rather than FastAPI's BackgroundTasks: those run
> after the response is sent but still inside the request's threadpool
> slot and lifecycle, so a client that disconnects mid-generation would
> take the generation with it — exactly the case this needs to survive,
> since the whole point is that the work outlives the request.

The claim lock, `backend/routes/exams.py:346`:

> The INSERT ... ON CONFLICT DO NOTHING is the lock: whichever caller
> comes back with rowcount 1 is the only one that generates. This is
> what makes the retry button, a refresh, and a second tab cost
> nothing instead of each starting their own full cascade.

and its three constants at `exams.py:248-258`: `_FAILED_COOLDOWN_SECONDS = 300`,
`_UNAVAILABLE_COOLDOWN_SECONDS = 900`, `_STALE_RUNNING_SECONDS = 900` (the last
being "a 'running' row older than this is assumed abandoned"). The response
shape is `202 {"status": "generating", ...}` and the client polls.

Copy this structure. Do not use `BackgroundTasks`.

### What already exists to build on

- `backend/study/sentences.py` — `split_sentences(text)` from plan 016,
  returning `{"text", "start", "end"}` with offsets into the original, and
  `MAX_SENTENCES`. Its "no terminator returns one Sentence" behaviour was
  written for exactly this plan's input.
- `backend/study/analysis.py` — `analyze_local` / `attach_user_state`.
- `frontend/src/components/analysis/SentenceBreakdown.jsx` with its `layout`
  prop, plus mining from plan 017.
- `frontend/src/config/stations.js:47` — the station metadata shape, e.g.
  `'/phrase-analyzer': { code: 'KS', kana: 'かいせき' }` — and
  `frontend/src/config/navLinks.js:39` for the home-screen entry.
- `phrase_history.source` / `source_ref`, created with defaults by plan 016
  for this plan to populate.

### Repo conventions

- Routers are registered in `backend/main.py` (see the `include_router` block
  at line 81).
- New locale keys in **both** locale files; parity test enforced.
- `apiJson` / `apiJsonWithTimeout` from `frontend/src/lib/api.js` for new calls.

### Vocabulary (from `CONTEXT.md`)

- **Cue** — one timed caption unit: start, end, text. The unit a subtitle file
  is made of. **Cue boundaries are a display artifact and do not correspond to
  Sentence boundaries.**
- **Track** — an ordered list of Cues from one source.
- **Window** — the bounded time range a learner asks to analyze. Bounded on
  purpose: cost scales with it.
- **Sentence** — the atom of analysis.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Backend tests | `cd backend && pytest` | all pass |
| Frontend tests | `cd frontend && npm test` | all pass |
| Lint / build | `cd frontend && npm run lint && npm run build` | both exit 0 |

## Scope

**In scope**:
- `backend/study/captions.py` (create — parsing and fetching)
- `backend/study/cue_sentences.py` (create — Cue-to-Sentence reconstruction)
- `backend/routes/video.py` (create), registered in `backend/main.py`
- `backend/srs/data_structure.sql` + an in-code migration for two new tables
- `backend/requirements.txt` (`youtube-transcript-api`)
- `backend/tests/test_captions.py`, `backend/tests/test_cue_sentences.py` (create)
- `frontend/src/screens/VideoScreen.jsx` (create)
- `frontend/src/components/video/` (create)
- `frontend/src/App.jsx`, `config/stations.js`, `config/navLinks.js`
- both locale files

**Out of scope** (do NOT touch):
- **Any form of audio or video download.** Playback is the official YouTube
  IFrame Player. Nothing is fetched but caption text.
- ASR / speech-to-text of any kind.
- `SentenceBreakdown` and the mining components — consume them as they are.
  If they need a change, that is a signal to add a `layout`, not to fork.
- `backend/routes/exams.py` — read its job pattern; do not refactor it into
  something shared. A premature extraction across two very different payloads
  would cost more than the duplication.
- Raising `MAX_SENTENCES` above what a Window justifies. Cap the Window
  instead.

## Git workflow

- Branch: `advisor/019-video-subtitle-study-mode`
- Commit per step; conventional commits, e.g. `feat(video): study subtitles`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Parse subtitle files into Cues

Create `backend/study/captions.py` with:

```python
def parse_track(content: str, filename: str) -> list[dict]:
    """A subtitle file as Cues: [{"start": float, "end": float, "text": str}]."""
```

Support `.srt`, `.vtt` and `.ass`, dispatching on the filename extension and
falling back to sniffing the content. Requirements:

- Times in **seconds as floats**, from all of `HH:MM:SS,mmm` (SRT),
  `HH:MM:SS.mmm` (VTT) and `H:MM:SS.cc` (ASS).
- Strip markup: SRT/VTT tags (`<i>`, `<c.colour>`, `{\an8}`) and ASS override
  blocks (`{\...}`). A learner must never see a tag in a Sentence.
- Drop Cues whose text is empty after stripping.
- **Merge duplicate consecutive Cues.** YouTube auto-captions repeat a rolling
  window of text across consecutive Cues; naive parsing triples every word.
  This is the single most important behaviour in this module — get it wrong and
  every downstream Sentence is garbage.
- Malformed input raises a `CaptionParseError` carrying what failed. Never
  return a partial Track silently.

**Verify**: `cd backend && pytest tests/test_captions.py -v` → all pass

### Step 2: Fetch a YouTube Track, and fail honestly

In the same module:

```python
def fetch_youtube_track(video_id: str) -> list[dict]:
    """Cues from YouTube's own Japanese caption track."""
```

Add `youtube-transcript-api` to `backend/requirements.txt`, with a comment in
the same style as the existing `edge-tts` entry — say what it is, that it
scrapes rather than using an official API, and that it is expected to fail from
a datacenter IP.

Prefer a manual `ja` track over an auto-generated one when both exist; take the
auto one otherwise.

On **any** failure, raise a `CaptionsUnavailable` carrying a message the UI can
show verbatim, naming the upload path as the alternative. Log at warning, not
error: from Render this is the expected case, not an incident, and logging it
as an error would train everyone to ignore the log.

Also add a URL parser that accepts `youtube.com/watch?v=`, `youtu.be/` and
`youtube.com/shorts/` forms and returns a video id, rejecting anything else.

**Verify**: `cd backend && python -c "from study.captions import parse_video_id; print(parse_video_id('https://youtu.be/dQw4w9WgXcQ'))"`
→ prints the id

### Step 3: Reconstruct Sentences from Cues

Create `backend/study/cue_sentences.py`:

```python
def sentences_from_cues(cues: list[dict], start: float, end: float) -> list[dict]:
    """Cues in a Window as Sentences, each with its own time range."""
```

This is the heart of the plan. Cue boundaries are not Sentence boundaries, and
Japanese auto-captions arrive with **no punctuation at all**.

Algorithm:

1. Select Cues overlapping `[start, end]`.
2. Concatenate their text, recording for each character which Cue it came from.
3. `split_sentences` on the concatenation (plan 016).
4. Map each Sentence back to a time range: `start` from the Cue owning its
   first character, `end` from the Cue owning its last.

Return `[{"text", "start", "end", "cue_start", "cue_end"}]` where the first two
are character offsets and the last two are seconds.

When the concatenation has no terminator at all — the auto-caption case —
`split_sentences` returns one enormous Sentence. That is correct but useless.
Fall back to **Cue-boundary Sentences** (one Sentence per merged Cue) when the
split yields a single Sentence longer than ~120 characters. Comment this
clearly: it is a heuristic standing in for punctuation that is not there, and
it is the thing most likely to need tuning against real videos.

**Verify**: `cd backend && pytest tests/test_cue_sentences.py -v` → all pass

### Step 4: The session job

Two tables, declared in `backend/srs/data_structure.sql` and created by an
idempotent in-code migration (pattern: `backend/routes/decks.py:312`, wrapped
per `backend/routes/phrase.py:99`):

- `video_sessions` — id, user_id, source kind (`youtube` | `upload`),
  source_ref, window start/end, status, error, created_at
- `video_session_jobs` — session_id primary key, status, error, retry_after,
  started_at. This is the claim lock; mirror `exam_generation_jobs`.

Create `backend/routes/video.py`:

```
POST /api/video/session          {url} or multipart {file}, plus start/end  -> 202 {sessionId, status}
GET  /api/video/session/{id}                                                -> status, or Sentences with local analysis
POST /api/video/session/{id}/sentence/{n}/explain                           -> deep tier, one Sentence
```

Requirements:

- Claim with `INSERT ... ON CONFLICT DO NOTHING`; spawn a **plain daemon
  thread**; return `202` immediately. Reuse `exams.py`'s three cooldown/stale
  constants and its reasoning.
- The worker parses or fetches the Track, reconstructs Sentences, runs
  `analyze_local` on each, and stores the result. It **never** calls a model.
- `GET` attaches per-user SRS state with `attach_user_state` at read time, so
  badges reflect current progress rather than the moment of analysis — the same
  principle as `docs/adr/0002`.
- **Cap the Window at 5 minutes** and cap Sentences at `MAX_SENTENCES`. When
  either bites, report it in the response as an explicit count. Never truncate
  silently — the previous wave's index records "no silent caps" as a house rule.
- The explain endpoint takes one Sentence index and posts it through the same
  deep-tier path as `/api/phrase/analyze`, so it shares
  `phrase_analysis_cache`. Never explain a whole session.
- Cap upload size (1 MB is generous for subtitles) and reject larger with 413.

**Verify**: `cd backend && pytest` → all pass

### Step 5: The player screen

Create `frontend/src/screens/VideoScreen.jsx` and `frontend/src/components/video/`.

- Load the **YouTube IFrame Player API** and mount a player. Playback stays in
  the official player: the view counts, ads serve, nothing is downloaded.
- Poll `getCurrentTime()` at roughly 250 ms — do not attempt frame accuracy —
  and select the Sentence whose `cue_start`/`cue_end` contains it.
- Render the active Sentence with `SentenceBreakdown`, colour-coded live by the
  learner's own SRS state.
- Tapping a word **pauses** the video and opens `WordDetail`. Resuming is
  explicit; do not auto-resume.
- **Break this down** buys the deep tier for that one Sentence.
- Mining works exactly as plan 017 built it, with no new mechanism.
- A transcript list beside the player: every Sentence, i+1 marked, click to
  seek.
- For an uploaded Track with no video, render the same list with no player.
  The pipeline is source-agnostic, so this must work.

Register the route in `frontend/src/App.jsx`, add a station entry in
`frontend/src/config/stations.js` (following `'/phrase-analyzer': { code: 'KS', kana: 'かいせき' }`)
and a home entry in `frontend/src/config/navLinks.js`.

**Verify**: `cd frontend && npm run lint && npm run build` → both pass

### Step 6: Provenance, locale keys, tests

Sentences kept from a session record `source: "video"` and a `source_ref` of
video id plus timestamp, through plan 016's existing columns.

Locale keys in **both** files: `videoTitle`, `videoDesc`, `pasteVideoUrl`,
`uploadSubtitles`, `captionsUnavailable`, `captionsBlockedHint`,
`windowStart`, `windowEnd`, `windowCapped`, `analyzing`, `breakThisDown`,
`transcript`, `seekToSentence`, `noCaptionTrack`, `subtitleTooLarge`.

`captionsBlockedHint` must name the upload path — it is the message a learner
sees on the expected production failure, and it has to be actionable.

Tests, `backend/tests/test_captions.py`:

- SRT, VTT and ASS fixtures each parse to the same Cues
- markup and ASS override blocks are stripped
- **duplicate consecutive auto-caption Cues are merged** (fixture: the rolling
  repeated text YouTube produces)
- malformed input raises `CaptionParseError`
- `parse_video_id` handles all three URL forms and rejects a non-YouTube URL

`backend/tests/test_cue_sentences.py`:

- punctuated Cues split on sentence boundaries, not Cue boundaries
- a Sentence spanning three Cues gets the first Cue's start and the third's end
- **unpunctuated input falls back to Cue-boundary Sentences** rather than one
  giant Sentence
- a Window selects only overlapping Cues
- offsets satisfy `text[start:end] == sentence_text`

Do not write a test that calls YouTube.

**Verify**: `cd backend && pytest && cd ../frontend && npm test` → all pass

## Test plan

Cases in Step 6. Two are load-bearing:

- **duplicate-Cue merging** — without it every auto-captioned video produces
  tripled text and the feature looks broken on its most common input;
- **the unpunctuated fallback** — the majority of Japanese auto-captions have
  no punctuation, so this is the default path, not the edge case.

Fixtures go beside the tests as small inline strings, not as sample files
downloaded from anywhere.

**Verification**: `cd backend && pytest && cd ../frontend && npm test && npm run lint && npm run build`.

## Done criteria

ALL must hold:

- [ ] `cd backend && pytest` exits 0
- [ ] `cd frontend && npm test && npm run lint && npm run build` all exit 0
- [ ] Uploading a `.srt` produces a full analyzed transcript with **no network call to YouTube** (verify by running with no outbound access)
- [ ] A YouTube fetch failure shows `captionsBlockedHint` naming the upload path — not a stack trace, not a generic error
- [ ] `grep -rn "yt-dlp\|youtube-dl\|ffmpeg" backend/ frontend/src/` → no matches
- [ ] `grep -n "BackgroundTasks" backend/routes/video.py` → no matches (daemon thread, per `exams.py:241`)
- [ ] A Window longer than 5 minutes is capped **and the cap is reported** in the response
- [ ] Every new locale key exists in both `en` and `fr`
- [ ] `plans/README.md` status row for 019 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `youtube-transcript-api` cannot be installed or its API has changed such that
  a Japanese track cannot be requested. The upload path still delivers the
  feature; land it and mark Step 2 blocked.
- You find yourself wanting to download audio or video **for any reason**. That
  is out of scope, out of ADR 0003, and not a judgment call.
- The unpunctuated fallback in Step 3 produces Sentences that are obviously
  wrong on a real auto-captioned video. Report samples; the heuristic needs
  tuning with evidence, not another heuristic layered on top.
- A five-minute Window takes more than ~30 seconds to analyze locally. The
  local tier should manage roughly 100 Sentences in a few seconds; a large gap
  means something per-request is being rebuilt that should be built once at
  import.
- `SentenceBreakdown` needs a structural change to serve the subtitle overlay.
  Report what it cannot do rather than forking it.

## Maintenance notes

- **The YouTube path is expected to fail in production.** That is designed for,
  not a bug to chase. If it starts working reliably, do not remove the upload
  path — it is what makes the feature survive.
- **Duplicate-Cue merging and the unpunctuated fallback are the two heuristics
  here.** Both will need tuning against real videos; both are commented as
  heuristics for that reason. A reviewer should check the comments are still
  honest.
- **The 5-minute Window cap and `MAX_SENTENCES` are the cost controls.** Plan
  016 flagged `MAX_SENTENCES = 50` as a guess to revisit here — do so with
  measurements from real sessions.
- **Deliberately deferred**: a paid ASR provider for videos with no caption
  track at all. It is the obvious extension and it is an operator decision with
  a per-minute cost, so it needs its own plan.
- **`video_sessions` will grow.** Nothing prunes it. `backend/scripts/prune_exam_papers.py`
  is the existing precedent for a retention script; write the equivalent when
  the table becomes large, not before.
