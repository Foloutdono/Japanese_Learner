# Plan 026: Make the URL path honest, and optionally make it work

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2552915..HEAD -- backend/study/captions.py backend/routes/video.py frontend/src/screens/VideoScreen.jsx docs/adr/0003-source-agnostic-caption-pipeline.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW — the default configuration changes no behaviour except the
  failure message
- **Depends on**: `plans/025-paste-transcript-ingest.md` (**hard** — the failure
  state hands off to the paste panel that plan builds)
- **Category**: DX / direction
- **Planned at**: commit `2552915`, 2026-08-26

## Why this matters

Plan 025 gives the learner a route that always works. This plan deals with the
route they will reach for **first** — pasting a URL — which on Render always
fails.

Two separate problems, and it is worth being precise about which is which:

**The message is unhelpful.** Today a blocked fetch surfaces as:

```jsx
        {stage === 'failed' && (
          <div className="card phrase-error-card">
            <div>{t.captionsUnavailable ?? "Couldn't get this video's captions."}</div>
            {isYoutubeError && <div>{t.captionsBlockedHint}</div>}
```

A dead end, phrased as though something went wrong with the video. Nothing
*did* go wrong: the server is simply not allowed to ask. After plan 025 there is
a working alternative sitting one panel away, and the failure state should walk
the learner into it — with their URL already carried over, so they do not retype
anything.

**There is no way to make the fetch work, even for someone willing to pay.**
`youtube-transcript-api` ships first-class proxy support — confirmed present in
the installed version:

```
proxy classes: ['GenericProxyConfig', 'InvalidProxyConfig', 'ProxyConfig', 'RequestsProxyConfigDict', 'WebshareProxyConfig']
```

Routing the fetch through a residential proxy is the one thing that makes the
URL path genuinely work from a datacenter. It costs money and it is an ongoing
arms race, which is why it must be **opt-in, off by default, and configured by
the operator** — never a dependency this app assumes.

Together: the default deployment gets an honest, useful failure; an operator who
wants URLs to work can have them by setting two environment variables.

## Current state

`fetch_youtube_track` constructs the API with no configuration:

```python
    try:
        transcript_list = YouTubeTranscriptApi().list(video_id)
```

and its docstring already tells the truth:

> Expected to raise CaptionsUnavailable from a datacenter IP (Render, where this
> deploys) even for a video that genuinely has Japanese captions.

Verified 2026-08-26 from a residential IP: the code path is **correct** —
`.list("dQw4w9WgXcQ")` returned `[('en', False), ('de-DE', False), ('ja', False), ...]`.
Nothing here is broken except where it runs.

URL parsing covers three shapes:

```python
_YOUTUBE_URL_RES = (
    re.compile(r"(?:youtube\.com/watch\?(?:.*&)?v=|youtube\.com/shorts/)([A-Za-z0-9_-]{11})"),
    re.compile(r"youtu\.be/([A-Za-z0-9_-]{11})"),
)
```

Because these use `.search()`, `m.youtube.com`, `music.youtube.com` and a
`?si=...` suffix all already work. Two real shapes are missing:
`youtube.com/live/<id>` and `youtube.com/embed/<id>`.

## Scope

**In scope:**
- `backend/study/captions.py` — proxy config, two URL patterns
- `backend/.env.example` — document the new variables
- `backend/tests/test_captions.py` — extend
- `frontend/src/screens/VideoScreen.jsx` — the failure state
- `frontend/src/locales/{en,fr}/index.js` — new keys
- `docs/adr/0003-source-agnostic-caption-pipeline.md` — amend

**Out of scope — do not touch:**
- `parse_pasted_transcript` or `parse_track`.
- The job/worker/polling machinery in `routes/video.py`.
- Anything that would make a proxy **required**, or check a proxy in.
- Cookie-based authentication to YouTube. See STOP conditions.

## Steps

### Step 1 — Optional proxy, off by default

In `study/captions.py`:

```python
# ── Optional proxy (opt-in, off by default) ───────────────────────
# YouTube blocks datacenter IPs, so from Render every fetch fails --
# see the module docstring and plans/026. A residential proxy is the
# only thing that changes that. It is deliberately OPT-IN: this app
# must deploy and work with no proxy at all (the upload and paste
# ingests do not need one), and nobody should be surprised by outbound
# traffic through a third party they did not configure.
#
# Two ways, checked in this order:
#   WEBSHARE_PROXY_USERNAME + WEBSHARE_PROXY_PASSWORD
#       -> WebshareProxyConfig, the library's own supported path
#   YOUTUBE_HTTP_PROXY [+ YOUTUBE_HTTPS_PROXY]
#       -> GenericProxyConfig, for any other provider
# Neither set: no proxy, and fetch_youtube_track behaves exactly as it
# always has.
def _proxy_config():
    ...
```

Return `None` when nothing is configured. Build it **once at import time** into
a module-level `_PROXY_CONFIG`, and pass it through:

```python
        transcript_list = YouTubeTranscriptApi(proxy_config=_PROXY_CONFIG).list(video_id)
```

Log **once at import**, not per request, whether a proxy is active — and never
log the credentials.

**Verify** the default path is unchanged:

```bash
cd backend && python -c "
import study.captions as c
print('proxy config:', c._PROXY_CONFIG)
"
```

Expected: `proxy config: None`.

Then confirm it wires up when set (no network call needed — just construction):

```bash
cd backend && WEBSHARE_PROXY_USERNAME=u WEBSHARE_PROXY_PASSWORD=p python -c "
import study.captions as c
print(type(c._PROXY_CONFIG).__name__)
"
```

Expected: `WebshareProxyConfig`.

### Step 2 — Two more URL shapes

```python
_YOUTUBE_URL_RES = (
    re.compile(
        r"(?:youtube\.com/watch\?(?:.*&)?v="
        r"|youtube\.com/shorts/"
        r"|youtube\.com/live/"      # premieres and streams, which keep this path after ending
        r"|youtube\.com/embed/"     # what a copied embed snippet contains
        r")([A-Za-z0-9_-]{11})"
    ),
    re.compile(r"youtu\.be/([A-Za-z0-9_-]{11})"),
)
```

Add cases to `tests/test_captions.py` for `live/`, `embed/`, `m.youtube.com`, a
`?si=` suffix, and a `&t=90s` suffix. Keep the existing negative case (a
non-YouTube URL returns `None`).

**Verify:**

```bash
cd backend && python -m pytest tests/test_captions.py -v
```

Expected: all pass, new cases included.

### Step 3 — Document the variables

Append to `backend/.env.example`:

```
# ── Optional: make the YouTube URL ingest work from a datacenter ──
# YouTube blocks datacenter IPs, so on Render the URL path always fails
# and learners use the paste or upload ingest instead (both work with
# no configuration). Setting either pair below routes caption fetches
# through a proxy, which is the only thing that makes URLs work there.
# Entirely optional -- leave unset and nothing else changes.
# WEBSHARE_PROXY_USERNAME=
# WEBSHARE_PROXY_PASSWORD=
# YOUTUBE_HTTP_PROXY=
# YOUTUBE_HTTPS_PROXY=
```

Do **not** add them to `render.yaml`. An operator who wants this sets it in the
Render dashboard; putting empty placeholders in a tracked deploy file invites
someone to paste credentials into git.

### Step 4 — A failure state that goes somewhere

Rewrite `VideoScreen.jsx`'s `stage === 'failed'` branch. It must:

1. Say plainly that **captions could not be fetched from the server**, not that
   the video is broken.
2. Render the paste panel from plan 025 **inline, right there**, with the URL
   the learner already typed carried over — no retyping, no navigating back.
3. Show the same numbered "how to copy a transcript" hint, with a direct
   `target="_blank" rel="noopener noreferrer"` link to the video.
4. Keep the subtitle-file upload visible as the third option.

Do not clear the entered URL on failure. Losing it is what makes the current
state feel like a dead end.

Keep the existing `isYoutubeError` distinction: a genuinely malformed URL
(a 400 from `parse_video_id` returning `None`) should say *that*, not offer a
transcript paste for a video that does not exist.

### Step 5 — Locale keys

New keys for the reworked failure copy — for example `captionsServerBlocked`,
`captionsTryPaste`, `captionsKeepUrl`. Reuse plan 025's `pasteTranscript*` and
`openOnYoutube` keys rather than duplicating them.

**Check for collisions before adding**, as in plans 024 and 025:

```bash
cd frontend && for k in captionsServerBlocked captionsTryPaste captionsKeepUrl; do
  echo "$k: $(grep -c "^\s*$k:" src/locales/en/index.js)"
done
```

Expected `0` for each. Re-check after editing that each is exactly `1`.

If `captionsBlockedHint` becomes unused, **delete it from both locale files** —
the repo retired eight dead French-only keys in commit `2f9346e` and has a
parity test precisely to keep this tidy.

**Verify:**

```bash
cd frontend && npm test -- --run && npm run lint
```

Expected: tests pass; lint 0 errors.

### Step 6 — Amend ADR-0003

Append a dated amendment to
`docs/adr/0003-source-agnostic-caption-pipeline.md`. Record:

- The source-agnostic decision was **right**, and this is the evidence: a third
  ingest (paste) was added in plan 025 with no change to anything downstream of
  `Cue`.
- The word *intermittently* was wrong. From Render the block is **total**,
  measured 2026-08-26; the same code succeeds from a residential IP.
- Consequently the URL path is now positioned as a **convenience that may
  work**, not the primary route. Paste and upload are the primary routes.
- A proxy is supported, opt-in, and never assumed.

Being explicit that a previously documented expectation was wrong is the point —
a future reader must not re-derive "it usually works" from the old wording.

## STOP conditions

- **Any proxy credential ends up in a tracked file.** `.env.example` gets
  commented-out empty keys and nothing else. If you find yourself testing with a
  real credential, verify with `git diff --staged` before committing.
- **A proxy becomes required** — if `_PROXY_CONFIG is None` changes any
  behaviour other than "no proxy is used", back it out.
- **Anyone suggests supplying YouTube cookies** (`cookies.txt`, an account
  session) to get past the block. Do not implement it: it attaches a real
  person's logged-in identity to automated fetches, it is squarely against
  YouTube's terms in a way the paste ingest is not, and it breaks constantly.
  STOP and report instead.
- The reworked failure state cannot reach plan 025's paste panel — that plan is
  a hard dependency; confirm it landed first.

## Test plan

Automated: Steps 1, 2, 5.

Manual:

1. **Default (no proxy), deployed**: paste a YouTube URL. **Expected**: a clear
   message that the server cannot fetch captions, the paste panel right there
   with the URL retained, and a working link to the video. Complete the flow by
   pasting — it should behave exactly as plan 025's manual test.
2. **Locally (residential IP)**: the same URL should fetch **successfully** with
   no proxy, proving Step 1 did not break the working path.
3. **With a proxy configured** (only if the operator has one): the same URL now
   fetches from the deployed backend. If no proxy is available, say so in the
   execution note rather than claiming this was verified — the honesty rule this
   wave has followed throughout.

## Maintenance note

The proxy path is an arms race and is expected to degrade; that is why nothing
depends on it. If it stops working, the correct response is to unset the
variables, not to escalate to cookies or scraping.

The URL patterns will need extending again — YouTube adds link shapes
regularly. The pattern list plus its tests is the cheap place to do that; the
`{11}` id length is the invariant that keeps the regexes from matching
arbitrary paths.

Watch in review: any change that makes the URL path *appear* to be the primary
ingest again (for example, hiding paste/upload until the URL fails). The
ordering in the UI is a deliberate statement about which routes actually work.
