# Plan 025: Paste the transcript — a video ingest that cannot be IP-blocked

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2552915..HEAD -- backend/study/captions.py backend/routes/video.py frontend/src/screens/VideoScreen.jsx frontend/src/locales`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0
- **Effort**: M
- **Risk**: LOW — adds a third ingest; the two existing ones are untouched
- **Depends on**: —
- **Category**: correctness / direction
- **Planned at**: commit `2552915`, 2026-08-26

## Why this matters

Real user report, 2026-08-26: *"Every link i try doesnt work."*

That is not a bug. It is the risk `docs/adr/0003` named and `plans/019` accepted:

> **YouTube blocks datacenter IPs** for its caption endpoints, and this backend
> deploys to Render (`render.yaml`), which is one.

Verified on 2026-08-26. From a **residential** IP, the existing code works
perfectly — `YouTubeTranscriptApi().list("dQw4w9WgXcQ")` returns
`[('en', False), ('de-DE', False), ('ja', False), ...]`, including a manually
created Japanese track. So `study/captions.py` is **correct**; the deployed
environment simply cannot reach YouTube.

Where plan 019 got it wrong was the word *intermittently*. From Render it is not
intermittent, it is total. A feature whose headline input never works reads as a
broken feature, which is exactly what happened.

**The crucial observation this plan is built on:** only the *caption fetch* is
blocked. The **player is not**. The YouTube IFrame API runs in the learner's own
browser, on their own residential IP, and embeds fine — `VideoPlayer.jsx`
already works. What is missing is a way to get the caption text there without
routing it through a datacenter.

The learner's browser already has it. YouTube's own **"Show transcript"** panel
displays the full timed transcript for any video that has captions, and it is
plain selectable text. Copying it and pasting it into the app:

- **cannot be IP-blocked** — no server ever contacts YouTube,
- **needs no proxy, key, or cookie** — nothing to buy, nothing to rotate,
- is **unambiguously legitimate** — the learner is copying text their own
  browser was served, for their own study,
- **works for every video** they can watch, including region-locked ones,
- and lands in the *same* `Cue` shape as the other two ingests, so nothing
  downstream changes.

It costs the learner about ten seconds. That is strictly better than a feature
that does not work.

## Current state

`routes/video.py`'s handler already branches on request shape, so a third
ingest fits without restructuring:

```python
async def create_video_session(request: Request, user_id: str = Depends(get_user_id)):
    """Accepts EITHER a JSON body {url, start, end} (YouTube) or a
    multipart upload {file, start, end} (a subtitle file) ..."""
    content_type = request.headers.get("content-type", "")

    if content_type.startswith("multipart/form-data"):
        ...
        source = "upload"
        source_ref = upload.filename or "upload"
    else:
        try:
            body = await request.json()
```

`study/captions.py` states the contract this plan extends:

> A Track is an ordered list of Cues (start, end, text). This module's whole job
> is producing one, from either source, so that everything downstream
> (study/cue_sentences.py, routes/video.py) can treat them identically.

Adding a third producer of Cues is precisely what that design anticipated. See
`docs/adr/0003-source-agnostic-caption-pipeline.md`.

The `video_sessions` table already stores `source` and `source_ref` as free
text, so a new source value needs **no migration**.

## Scope

**In scope:**
- `backend/study/captions.py` — `parse_pasted_transcript`
- `backend/routes/video.py` — accept `transcript` in the JSON body
- `backend/tests/test_captions_paste.py` — new
- `backend/tests/test_video.py` — extend
- `frontend/src/screens/VideoScreen.jsx` — the paste UI
- `frontend/src/index.css` — additive only
- `frontend/src/locales/{en,fr}/index.js` — new keys

**Out of scope — do not touch:**
- `fetch_youtube_track` or `parse_track`. Both are correct. Making the URL path
  *honest about failing* is **plan 026**, deliberately separate so this plan can
  land on its own.
- `cue_sentences.py`, `analysis.py`, `SentenceBreakdown`, mining. A Cue is a Cue.
- The `video_sessions` / `video_session_jobs` schema.
- `VideoPlayer.jsx` — it already works, which is the whole premise here.

## Steps

### Step 1 — The parser

Add to `study/captions.py`:

```python
# ── Pasted transcript (YouTube's own "Show transcript" panel) ──────
# The one ingest that cannot be IP-blocked: the learner's browser
# already rendered this text, and they paste it. No network call, so it
# works identically from a laptop and from Render. See plans/025.
_TIMESTAMP_RE = re.compile(r"^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*(.*)$")
# What the last Cue gets, having no successor to bound it. Only affects
# the tail of the window, and only by a few seconds.
_TRAILING_CUE_SECONDS = 5.0
```

`parse_pasted_transcript(text: str) -> list[dict]` must handle **both** layouts
YouTube produces, because which one you get depends on the UI version and on how
the selection was made:

```
0:00                        0:00 こんにちは
こんにちは            and   0:04 今日は日本語を勉強します
0:04
今日は日本語を勉強します
```

Rules:
- A line matching `_TIMESTAMP_RE` starts a new Cue. Trailing text on that same
  line is the Cue's first text line; otherwise subsequent non-timestamp lines
  accumulate until the next timestamp.
- Support `M:SS`, `MM:SS`, `H:MM:SS`, `HH:MM:SS`. Seconds are always two digits;
  the hour group is optional. Convert to float seconds.
- Text lines before the first timestamp are **discarded** (the panel's header,
  a video title, "Transcript", a language name). Comment this.
- Each Cue's `end` is the **next** Cue's `start`; the last gets
  `start + _TRAILING_CUE_SECONDS`.
- Run each Cue's text through the existing `_strip_markup`.
- Drop Cues whose text is empty after stripping.
- Reuse `_merge_duplicate_consecutive` — a pasted **auto-generated** transcript
  carries the same rolling-window duplication as a fetched one, and that
  function already exists for exactly this.
- If **no** timestamp is found anywhere, raise `CaptionParseError` with a
  message naming what was expected, since silently returning `[]` would surface
  as a mysterious empty transcript.
- If timestamps are found but every Cue is empty, raise `CaptionParseError` too.

Non-monotonic timestamps (a paste that got scrambled) should be **sorted by
start** rather than rejected — be forgiving with input a human hand-assembled.

**Verify:**

```bash
cd backend && python -c "
from study.captions import parse_pasted_transcript as p
import json
same = p('0:00 これはテストです。\n0:04 猫が公園を歩いています。')
sep  = p('0:00\nこれはテストです。\n0:04\n猫が公園を歩いています。')
print(json.dumps(same, ensure_ascii=False))
print('layouts agree:', same == sep)
print('hours:', p('1:02:03 テスト')[0]['start'])
"
```

Expected: two cues, `start` 0.0 and 4.0, first `end` 4.0; `layouts agree: True`;
`hours: 3723.0`.

### Step 2 — Accept it in the API

In `routes/video.py`'s JSON branch, add `transcript` (optional string). When it
is present and non-blank:

- `url` is still **required** — it supplies the video id the player embeds. A
  transcript with no video is not a session this screen can render.
- Parse with `parse_pasted_transcript`; map `CaptionParseError` → **400** with
  the parser's own message.
- Set `source = "paste"`, `source_ref = <video id>`.
- **Skip `fetch_youtube_track` entirely.** Do not "try the fetch first and fall
  back" — the whole point is that no request leaves the server on this path.
- Apply the same window clamp (`_MAX_WINDOW_SECONDS`) and the same
  `MAX_SENTENCES` truncation reporting as the other ingests. Do not special-case
  it.

The worker path, polling, and `GET` response shape stay **byte-for-byte the
same** — `source: "paste"` behaves like `"youtube"` for the player (both have a
video id in `source_ref`), which the frontend already keys on.

Check how `VideoScreen.jsx` decides to render the player:

```jsx
            {sessionInfo?.source === 'youtube' && (
              <VideoPlayer ref={playerRef} videoId={sessionInfo.sourceRef} ... />
```

That condition must become `=== 'youtube' || === 'paste'`. Missing this is the
most likely way to finish this plan with a transcript that works and no video.

**Verify:**

```bash
cd backend && python -m pytest tests/test_video.py -q
```

Expected: existing video tests still pass.

### Step 3 — Backend tests

`backend/tests/test_captions_paste.py`:
- both layouts (inline / separate-line) produce identical Cues
- `H:MM:SS` parses
- header junk before the first timestamp is dropped
- `end` chains to the next `start`; the last Cue gets the trailing default
- rolling-window duplication is merged
- out-of-order timestamps are sorted, not rejected
- text with no timestamps raises `CaptionParseError`
- markup (`<i>`, `{\an8}`) is stripped

Extend `backend/tests/test_video.py`:
- a JSON body with `transcript` creates a session that becomes `ready`, **with
  `fetch_youtube_track` monkeypatched to raise** — proving the paste path never
  calls it. This is the single most important test in the plan.
- `source` comes back as `"paste"` and `sourceRef` is the video id
- a `transcript` with no `url` → 400
- an unparseable `transcript` → 400
- the window clamp applies to the paste path too

Use a **unique** Japanese phrase not used elsewhere in the suite — see the
`phrase_analysis_cache` cross-test collision recorded in `plans/README.md`.

**Verify:**

```bash
cd backend && python -m pytest tests/test_captions_paste.py tests/test_video.py -v
cd backend && python -m pytest -q
```

Expected: new tests pass; full suite still green.

### Step 4 — The paste UI

In `VideoScreen.jsx`'s `setup` stage, add a third option below the URL and file
inputs: **"Paste a transcript"** — a `<textarea>` plus a submit button, sending
`{ url, transcript, start, end }`.

Make it **discoverable rather than a consolation prize**. Alongside it, show a
short numbered hint (`t.pasteTranscriptHow`):

1. Open the video on YouTube
2. Below the video: **… more** → **Show transcript**
3. Select the panel, copy, paste it here

When a `url` has already been typed, render a direct link to it
(`https://www.youtube.com/watch?v=<id>`) with `target="_blank"` and
`rel="noopener noreferrer"` so step 1 is one click.

Client-side guards before sending: require a non-empty `url` **and** a
transcript over a small minimum length; surface the backend's 400 message
verbatim rather than a generic failure — the parser's message says what was
wrong with the paste, which is the useful thing.

Plan 026 wires this same panel into the URL path's *failure* state. Building it
as a first-class option here is what makes that wiring trivial.

### Step 5 — Locale keys

Add to **both** locale files: `pasteTranscript`, `pasteTranscriptHow`,
`pasteTranscriptStep1/2/3`, `openOnYoutube`, `transcriptTooShort`,
`transcriptParseFailed`, `useTranscript`.

**Check each for a collision first** — this bit the wave twice:

```bash
cd frontend && for k in pasteTranscript pasteTranscriptHow openOnYoutube useTranscript transcriptTooShort transcriptParseFailed; do
  echo "$k: $(grep -c "^\s*$k:" src/locales/en/index.js)"
done
```

Expected `0` for each new key. `2+` after your edit is a **silent** collision —
the later spread wins, your string is dead code, and nothing warns you.

**Verify:**

```bash
cd frontend && npm test -- --run && npm run lint
```

Expected: tests pass (locale parity included); lint 0 errors.

## STOP conditions

- **`parse_pasted_transcript` cannot handle a real copy-paste** from the YouTube
  panel. Do not guess at the format — capture one real paste, commit it as a
  test fixture, and parse *that*. If it looks nothing like either layout above,
  STOP and report the actual text.
- **The paste path calls `fetch_youtube_track`.** The Step 3 test must fail if
  it does; if you cannot make that test fail by deliberately re-adding the call,
  the test is not wired correctly.
- **The player does not render for `source: "paste"`.** Check the
  `sessionInfo?.source === 'youtube'` condition in Step 2.
- A locale collision check returns `2+`.

## Test plan

Automated: Steps 3 and 5.

Manual, end to end — this is the check that closes the original report:

1. Open a Japanese YouTube video with captions. Copy its transcript panel.
2. In the app: paste the video URL **and** the transcript, set a window, submit.
3. **Expected**: the player embeds and plays; the transcript lists the sentences;
   playback advances the active sentence; clicking a row seeks; a word opens its
   detail; **Break this down** buys the deep tier; mining works.
4. Confirm in the Render log that **no** outbound YouTube request was made.
5. Repeat with an **auto-generated** (unpunctuated, rolling-window) transcript —
   this is the harder case, and it exercises both `_merge_duplicate_consecutive`
   and `cue_sentences.py`'s unpunctuated fallback. Note the result quality in the
   execution note.

## Maintenance note

The parser's input is a UI's clipboard output, so it will drift when YouTube
restyles the transcript panel — and it will drift **silently**, as a
`CaptionParseError` a learner sees and nobody else does. Keep the committed real
paste fixture from the STOP condition, and add a new one each time the format
changes rather than loosening the regex until everything matches.

Deliberately **not** done here: scraping the panel for the learner, or accepting
a "paste the whole page" blob. Both re-create the coupling to YouTube's markup
that this plan exists to remove.

Watch in review: any change that makes the paste path "try the fetch first" — it
would reintroduce the exact blocking that makes the fetch useless in production,
and would do it invisibly, since the fetch failure is caught.
