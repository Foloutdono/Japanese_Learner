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

## Amendment, 2026-08-26 (plans/025, plans/026)

Three corrections after this shipped and was used in production.

**"Expect it to fail intermittently" was wrong. From Render it fails
totally.** Measured 2026-08-26: `YouTubeTranscriptApi().list(...)` succeeds from
a residential IP — returning, for one test video, `[('en', False),
('de-DE', False), ('ja', False), ...]` including a manually created Japanese
track — and fails from the deployed backend for the same video. The code is
correct; the environment is the whole story. Calling it *intermittent*
understated it and left the URL box looking like the primary route when it
never works there. The user's report was blunt: *"Every link i try doesnt
work."*

**The decision itself was right, and this is the evidence.** A third ingest —
a transcript pasted from YouTube's own "Show transcript" panel — was added in
plans/025 with **no change to anything downstream of `Cue`**:
`cue_sentences.py`, `analysis.py`, the job worker, `SentenceBreakdown` and
mining were all untouched. That is what ingesting Cues rather than YouTube
bought.

**"Client-side fetch is not possible without an extension" was true but drew
the wrong conclusion.** CORS does block a browser from *fetching* the caption
track. It does not stop the learner from **copying text their browser has
already rendered**. Pasting cannot be IP-blocked, needs no proxy, key or
cookie, works for any video they can watch, and is unambiguously within terms
in a way the fetch is not — the learner is copying their own screen. It is now
a first-class ingest alongside upload.

Note also that **only the fetch was ever blocked, never playback**: the IFrame
player runs in the learner's browser on their own IP and always worked. So a
pasted transcript still gets a synced player, because `source_ref` still
carries the video id.

**Consequently the URL path is now positioned as a convenience that may work**,
not as the primary route. Paste and upload are primary. A proxy is supported
(`WEBSHARE_PROXY_USERNAME`/`_PASSWORD`, or `YOUTUBE_HTTP_PROXY`), opt-in, off by
default, and never assumed — it is expected to degrade as YouTube escalates,
which is precisely why nothing depends on it.

**Still rejected, and now explicitly:** supplying YouTube cookies or an account
session to get past the block. It attaches a real person's logged-in identity
to automated fetches, is against the terms in a way pasting is not, and breaks
constantly.

## Amendment, 2026-08-26 (second): the YouTube fetch is removed

The URL ingest is gone. Not deprioritised — deleted, along with
`fetch_youtube_track`, the optional proxy, and the `youtube-transcript-api`
dependency.

**Why: a server cannot get YouTube captions for free, by any route.** Two
independent walls, both measured rather than assumed:

1. **Datacenter IPs are blocked.** From Render, every fetch returns
   `RequestBlocked`. The same call from a residential IP succeeds.
2. **The endpoint needs a player-generated token.** This one is new, and it
   invalidates the reasoning in the *first* amendment above. That amendment said
   a browser-side fetch was impossible because of CORS. **CORS is no longer the
   blocker** — measured from a third-party origin, `api/timedtext` answers with
   `type: "cors"` and HTTP 200. But the body is **empty**, for every variant
   tried (signed URL, unsigned, `fmt=json3`, `fmt=srv3`). YouTube now requires a
   proof-of-origin token its own player mints on the page, which a third-party
   site cannot produce.

So the wall moved rather than fell, and the conclusion survives for a different
reason than the one previously recorded. Anyone re-deriving "we could just fetch
it from the browser now that CORS is open" will get 200s and nothing in them.

**The remaining ingests are both purely local**: a subtitle file, or a pasted
transcript. Neither makes a network call, so both behave identically on a laptop
and on Render — which is what the source-agnostic decision was for, and it is why
removing an entire ingest touched nothing downstream of `Cue`.

**A URL is still accepted, for one thing only: naming a video to embed.** The
IFrame player runs in the learner's own browser and was never blocked. That is
now modelled honestly — `video_sessions.video_id` is its own nullable column,
independent of `source`, so an uploaded `.srt` can name a video to play beside
it, and a transcript with no video is a normal session with no player.

**The file is now the primary path, and the UI says so.** Two reasons beyond
reliability: a subtitle file names its own language, whereas YouTube's transcript
panel defaults to a *translation* — learners kept getting English for Japanese
videos — and the panel is genuinely hard to find. The screen now shows the
`yt-dlp` command (with `--sub-langs ja`, which is the part that prevents an
English translation) so obtaining a Japanese `.srt` is answered in place rather
than left as an exercise.

**Rejected, restated:** proxies (cost, and an arms race nothing should depend
on), YouTube cookies (attaches a real identity to automated fetches, against the
terms in a way pasting is not), and self-hosted ASR.

---

## Amendment, 2026-08-27 — a Cue *is* a Sentence

The Consequences above closed with:

> Cue boundaries are not Sentence boundaries, and Japanese auto-captions arrive
> with no punctuation at all. Reconstructing Sentences from Cues and mapping them
> back to time ranges is a real component, not a formatting step.

The first half of that is **withdrawn**. It was a reasonable guess about
auto-captions, generalised to every Track, and a real file disproved it.

**The evidence.** A 47-cue authored `.vtt` of song lyrics came back as five walls
of text — one of them 200+ characters spanning a dozen unrelated lines, Japanese
and Korean mixed together with furigana drawn over the Hangul. The learner's
report was exactly right: *"a big mess of text instead of the phrase by phrase
structure of the vtt file."*

**The mechanism** is worth recording, because the module was not obviously wrong.
It concatenated the Window and ran `split_sentences`, with a fallback to
one-Sentence-per-Cue when the *whole Window* produced a single Sentence. Lyrics
carry a little punctuation — a `？` here, a `！` there — so the Track landed
between the two cases: enough terminators that the fallback never fired, far too
few to produce readable units. The failure needed *some* punctuation, which is
why an unpunctuated auto-caption sample never showed it.

**The correction.** An authored `.srt`/`.vtt` Cue is not a display artifact. It
is a line somebody chose to put on screen together, which is precisely the unit a
learner wants to study. So one Cue in, one or more Sentences out — more only when
the Cue's own text carries punctuation — and never a merge across Cues.

Auto-caption Cues are rougher, and this does mean a phrase-sized Sentence rather
than a reconstructed one. That is an acceptable trade: a rough one-phrase
Sentence is still a usable study unit, their rolling-window duplication is
already handled upstream by `_merge_duplicate_consecutive`, and the alternative
demonstrably produces garbage on the input people actually have. If
fragmentation on auto-captions becomes a real complaint, that is a separate
change with its own evidence — not a reason to keep this one.

**Cues with no Japanese are now dropped.** The Korean verses of that Track were
being segmented, furigana'd and graded as though they were Japanese. The app
cannot teach them, so they are not Sentences. The test is "contains any Japanese
at all" rather than a tuned ratio: on real mixed-language subtitles the split is
absolute — Japanese lines score 0.4–1.0 on `japanese_ratio`, Korean and English
lines score exactly 0.0.

**The Window is now optional and uncapped** (it was 5 minutes). It was protecting
against unbounded analysis work, and `MAX_SENTENCES` already does that — the
Window was a second, blunter cap on the same thing, and one the learner had to
think about. See `routes/video.py`.

`_build_concatenation`, `_owning_cue` and the character offsets they produced are
gone with the old model. Nothing outside the module's own tests ever read those
offsets; `_video_worker` only ever wanted `text`, `cue_start` and `cue_end`.
