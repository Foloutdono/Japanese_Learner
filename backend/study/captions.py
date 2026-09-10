# ── Cue ingest: subtitle files and pasted transcripts ─────────────
# A Track is an ordered list of Cues (start, end, text). This module's
# whole job is producing one, from either source, so that everything
# downstream (study/cue_sentences.py, routes/video.py) can treat them
# identically -- see docs/adr/0003-source-agnostic-caption-pipeline.md.
#
# TWO of the three ingests are purely local: a file the learner
# uploaded, or text they pasted. Neither makes a network call, so both
# work identically from a laptop and from a datacenter, and both are
# always available.
#
# The THIRD is fetch_youtube_track, and it is the exception to
# everything this module otherwise guarantees. It was removed
# 2026-08-26 as unusable -- YouTube blocks datacenter IPs, so from
# Render it failed totally -- and restored 2026-09-10 behind a
# ROTATING RESIDENTIAL proxy, which is the one thing that clears that
# wall. Nothing about YouTube changed; what changed is that we now pay
# to stand outside it. It is OFF unless configured, and it refuses to
# run rather than trying and failing. See docs/adr/0003 and the
# section comment above fetch_youtube_track.
#
# parse_video_id serves both the fetch and the player. The player runs
# in the learner's own browser and was never blocked -- so a session
# can name a video with no fetch involved at all, which is what every
# uploaded .srt does.

import logging
import os
import re


logger = logging.getLogger(__name__)


class CaptionParseError(Exception):
    """A subtitle file could not be parsed. Carries what failed, since
    the caller (routes/video.py) shows this to the learner rather than
    guessing at what went wrong."""


class CaptionFetchError(Exception):
    """A caption fetch could not be completed. Deliberately NOT a
    subclass of CaptionParseError: nothing was malformed, so telling
    the learner their subtitles are broken would be a lie. The two are
    caught together in routes/video.py and shown differently."""


# ── Markup stripping ──────────────────────────────────────────────
# SRT/VTT: HTML-like tags (<i>, </i>, <c.colour>, <b>) and VTT's own
# positioning cues ({\an8} appears in some SRT exports too, borrowed
# from ASS convention).
_HTML_TAG_RE = re.compile(r"</?[a-zA-Z][^>]*>")
_ASS_POSITION_TAG_RE = re.compile(r"\{\\an?\d+\}")
# ASS override blocks: {\i1}, {\pos(100,200)}, {\fad(...)} etc. -- any
# brace-delimited backslash-escape run.
_ASS_OVERRIDE_RE = re.compile(r"\{\\[^}]*\}")


def _strip_markup(text: str) -> str:
    text = _HTML_TAG_RE.sub("", text)
    text = _ASS_POSITION_TAG_RE.sub("", text)
    text = _ASS_OVERRIDE_RE.sub("", text)
    return text.strip()


def _merge_duplicate_consecutive(cues: list[dict]) -> list[dict]:
    """YouTube auto-captions render as a ROLLING WINDOW: consecutive
    Cues repeat most of each other's text, one or two words advancing
    at a time (a UI choice for live captioning, preserved in the
    exported/fetched transcript). Concatenating Cues naively without
    this would triple or quadruple most of the video's actual words.

    A Cue whose text is a prefix/suffix of its neighbour, or identical
    to it, is the signature of this. Kept deliberately simple (exact
    containment, not fuzzy matching) -- see the module docstring on
    tuning this against real videos."""
    if not cues:
        return cues
    merged = [cues[0]]
    for cue in cues[1:]:
        prev = merged[-1]
        if cue["text"] == prev["text"] or cue["text"] in prev["text"]:
            # Pure repeat (or a shrinking rolling window) -- the
            # earlier Cue already carries this text; only extend its
            # end time.
            prev["end"] = max(prev["end"], cue["end"])
            continue
        if prev["text"] and prev["text"] in cue["text"]:
            # The rolling window grew: this Cue's text is the previous
            # one PLUS new words. Replace rather than duplicate.
            prev["text"] = cue["text"]
            prev["end"] = max(prev["end"], cue["end"])
            continue
        merged.append(cue)
    return merged


# ── SRT ─────────────────────────────────────────────────────────
_SRT_TIME_RE = re.compile(r"(\d+):(\d{2}):(\d{2}),(\d{3})")
_SRT_ARROW_RE = re.compile(
    rf"{_SRT_TIME_RE.pattern}\s*-->\s*{_SRT_TIME_RE.pattern}"
)


def _srt_time_to_seconds(h, m, s, ms) -> float:
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def _parse_srt(content: str) -> list[dict]:
    cues = []
    blocks = re.split(r"\n\s*\n", content.strip())
    for block in blocks:
        lines = [l for l in block.splitlines() if l.strip()]
        if not lines:
            continue
        arrow_line_idx = next(
            (i for i, l in enumerate(lines) if _SRT_ARROW_RE.search(l)), None
        )
        if arrow_line_idx is None:
            raise CaptionParseError(f"No timestamp line found in block: {block[:80]!r}")
        match = _SRT_ARROW_RE.search(lines[arrow_line_idx])
        start = _srt_time_to_seconds(*match.groups()[0:4])
        end = _srt_time_to_seconds(*match.groups()[4:8])
        text = _strip_markup(" ".join(lines[arrow_line_idx + 1:]))
        if text:
            cues.append({"start": start, "end": end, "text": text})
    return cues


# ── VTT ─────────────────────────────────────────────────────────
_VTT_TIME_RE = re.compile(r"(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})")
_VTT_ARROW_RE = re.compile(
    rf"{_VTT_TIME_RE.pattern}\s*-->\s*{_VTT_TIME_RE.pattern}"
)


def _vtt_time_to_seconds(h, m, s, ms) -> float:
    return (int(h) if h else 0) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def _parse_vtt(content: str) -> list[dict]:
    # Drop the WEBVTT header/NOTE blocks; a cue block is anything
    # containing an arrow timestamp line.
    cues = []
    blocks = re.split(r"\n\s*\n", content.strip())
    for block in blocks:
        lines = [l for l in block.splitlines() if l.strip()]
        arrow_line_idx = next(
            (i for i, l in enumerate(lines) if _VTT_ARROW_RE.search(l)), None
        )
        if arrow_line_idx is None:
            continue  # header, NOTE, STYLE, or a stray cue identifier line
        match = _VTT_ARROW_RE.search(lines[arrow_line_idx])
        start = _vtt_time_to_seconds(*match.groups()[0:4])
        end = _vtt_time_to_seconds(*match.groups()[4:8])
        text = _strip_markup(" ".join(lines[arrow_line_idx + 1:]))
        if text:
            cues.append({"start": start, "end": end, "text": text})
    if not cues and "-->" not in content:
        raise CaptionParseError("No cue timestamps found in VTT content")
    return cues


# ── ASS ─────────────────────────────────────────────────────────
_ASS_TIME_RE = re.compile(r"(\d+):(\d{2}):(\d{2})\.(\d{2})")


def _ass_time_to_seconds(h, m, s, cs) -> float:
    return int(h) * 3600 + int(m) * 60 + int(s) + int(cs) / 100


def _parse_ass(content: str) -> list[dict]:
    cues = []
    in_events = False
    format_fields: list[str] | None = None
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            in_events = stripped.lower() == "[events]"
            continue
        if not in_events or not stripped:
            continue
        if stripped.lower().startswith("format:"):
            format_fields = [f.strip().lower() for f in stripped[len("format:"):].split(",")]
            continue
        if not stripped.lower().startswith("dialogue:"):
            continue
        if format_fields is None:
            raise CaptionParseError("Dialogue line found before a Format: line in [Events]")

        # Text is the LAST field and may itself contain commas, so it's
        # split with a max-split count derived from the format, not a
        # bare .split(",").
        parts = stripped[len("dialogue:"):].split(",", len(format_fields) - 1)
        if len(parts) != len(format_fields):
            raise CaptionParseError(f"Malformed Dialogue line: {stripped[:80]!r}")
        row = dict(zip(format_fields, parts))
        match = _ASS_TIME_RE.search(row.get("start", ""))
        match_end = _ASS_TIME_RE.search(row.get("end", ""))
        if not match or not match_end:
            raise CaptionParseError(f"Malformed timestamp in Dialogue line: {stripped[:80]!r}")
        start = _ass_time_to_seconds(*match.groups())
        end = _ass_time_to_seconds(*match_end.groups())
        text = _strip_markup(row.get("text", "").replace("\\N", " ").replace("\\n", " "))
        if text:
            cues.append({"start": start, "end": end, "text": text})
    return cues


_PARSERS = {"srt": _parse_srt, "vtt": _parse_vtt, "ass": _parse_ass, "ssa": _parse_ass}


def _sniff_format(content: str) -> str:
    head = content[:2000]
    if head.lstrip().upper().startswith("WEBVTT"):
        return "vtt"
    if "[Script Info]" in head or "[Events]" in head:
        return "ass"
    if _SRT_ARROW_RE.search(head):
        return "srt"
    raise CaptionParseError("Could not determine subtitle format from content")


def parse_track(content: str, filename: str) -> list[dict]:
    """A subtitle file as a Track: [{"start": float, "end": float, "text": str}].

    Dispatches on `filename`'s extension; falls back to sniffing
    `content` when the extension is missing or unrecognised. Raises
    CaptionParseError on anything malformed -- never returns a partial
    Track silently.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    parser = _PARSERS.get(ext)
    if parser is None:
        parser = _PARSERS[_sniff_format(content)]

    try:
        cues = parser(content)
    except CaptionParseError:
        raise
    except Exception as e:  # pragma: no cover - defensive: a parser bug must not 500
        raise CaptionParseError(f"Failed to parse subtitle content: {e}") from e

    if not cues:
        raise CaptionParseError("No usable cues found in subtitle content")

    return _merge_duplicate_consecutive(cues)


# ── The fetch: a link, and nothing for the learner to find ────────
# Restored 2026-09-10, having been deleted 2026-08-26. Read
# docs/adr/0003 before touching this -- the deletion was correct on
# the evidence available then, and what reverses it is a price, not a
# discovery.
#
# The wall this clears is the FIRST of the two that ADR records: the
# datacenter IP block. Only a ROTATING RESIDENTIAL pool clears it, and
# the distinction between proxy products is not a preference:
#
#   Proxy Server / datacenter   the same kind of address Render
#                               already has. Blocked identically.
#   Static Residential (ISP)    datacenter-hosted, merely REGISTERED
#                               to an ISP. ASN-detectable, and a
#                               flagged address stays flagged because
#                               there is nothing to rotate to.
#   Rotating Residential        real peer devices. The one that works.
#
# youtube-transcript-api's own README says in as many words not to buy
# the first two. WebshareProxyConfig defaults to rotating residential,
# which is why it is the configured path; YOUTUBE_HTTP_PROXY is the
# escape hatch for a different provider, and carries no such default,
# so whoever sets it owns that choice.
#
# The SECOND wall -- the proof-of-origin token that makes timedtext
# answer a browser with 200 and an empty body -- is not cleared and
# does not need to be. This library performs the same InnerTube
# handshake the ADR measured working from the watch page; it was only
# ever the address it came from that failed.
#
# THIS FUNCTION REFUSES TO RUN UNCONFIGURED, and refuses before it
# imports the library, let alone opens a socket. That ordering is the
# entire guard. The previous fetch looked like it worked in
# development and failed only in production, which is how it wasted a
# release cycle and why tests/test_video.py has carried an assertion
# about it ever since; that test now asserts this refusal instead of
# asserting the function is absent. Unconfigured, the dev-works /
# prod-fails shape is unreachable rather than merely unlikely.

_WEBSHARE_USER_ENV = "WEBSHARE_PROXY_USERNAME"
_WEBSHARE_PASS_ENV = "WEBSHARE_PROXY_PASSWORD"
_GENERIC_PROXY_ENV = "YOUTUBE_HTTP_PROXY"

# The only language this app can teach. A track in anything else is
# not a lesser result, it is the WRONG one: the pasted-transcript
# ingest died of handing learners English translations of Japanese
# videos (docs/adr/0003, 2026-09-01), and a fetch that fell back to
# "whatever track exists" would walk straight back into that. Both
# spellings, because YouTube labels tracks either way.
_JAPANESE_LANGUAGE_CODES = ("ja", "ja-JP")


def proxy_configured() -> bool:
    """Whether a fetch can be attempted at all.

    Read by routes/video.py both to gate the ingest and to answer the
    capabilities probe, so the UI never offers a button this server
    cannot honour -- offering one that always fails is the specific
    mistake docs/adr/0003 is a monument to."""
    if os.environ.get(_GENERIC_PROXY_ENV):
        return True
    return bool(
        os.environ.get(_WEBSHARE_USER_ENV) and os.environ.get(_WEBSHARE_PASS_ENV)
    )


def _proxy_config():
    """The library's ProxyConfig, or None when nothing is set.

    Imports inside the function on purpose: `import study.captions`
    must cost nothing while the feature is dark, which is its default
    and, until someone buys a plan, its only state."""
    username = os.environ.get(_WEBSHARE_USER_ENV)
    password = os.environ.get(_WEBSHARE_PASS_ENV)
    generic = os.environ.get(_GENERIC_PROXY_ENV)

    if username and password:
        from youtube_transcript_api.proxies import WebshareProxyConfig
        # filter_ip_locations is deliberately left unset. A Japanese
        # exit node is not required to read a Japanese caption track,
        # and narrowing the pool shrinks the only thing being paid
        # for -- the supply of addresses YouTube has not yet blocked.
        return WebshareProxyConfig(proxy_username=username, proxy_password=password)

    if generic:
        from youtube_transcript_api.proxies import GenericProxyConfig
        return GenericProxyConfig(http_url=generic, https_url=generic)

    return None


def fetch_youtube_track(video_id: str) -> list[dict]:
    """A video's Japanese caption track, as a Track in exactly the
    shape parse_track returns.

    Everything downstream of Cue is therefore untouched by this
    ingest's existence, which is the promise docs/adr/0003 made about
    any new source and the reason deleting the last one cost nothing.

    Every failure is a CaptionFetchError carrying a sentence meant for
    the learner, including the unconfigured case -- which is what this
    ships as.
    """
    proxy_config = _proxy_config()
    if proxy_config is None:
        raise CaptionFetchError(
            "Fetching subtitles from a link is not enabled on this server."
        )

    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api import (
        CouldNotRetrieveTranscript, NoTranscriptFound, TranscriptsDisabled,
        VideoUnavailable,
    )

    api = YouTubeTranscriptApi(proxy_config=proxy_config)

    try:
        available = api.list(video_id)
    except TranscriptsDisabled:
        raise CaptionFetchError("This video has subtitles turned off.")
    except VideoUnavailable:
        raise CaptionFetchError("This video is unavailable.")
    except CouldNotRetrieveTranscript as e:
        # RequestBlocked and IpBlocked are both subclasses. Logged in
        # full because a rising rate of these is the signal that the
        # proxy tier has stopped being enough -- the learner just gets
        # pointed back at the paths that always work.
        logger.warning("Caption fetch blocked for %s: %s", video_id, e)
        raise CaptionFetchError(
            "YouTube refused the subtitle request for this video."
        )
    except Exception as e:  # pragma: no cover - defensive
        logger.exception("Unexpected error listing captions for %s", video_id)
        raise CaptionFetchError(f"Could not reach YouTube: {e}")

    # Manual before generated. A human-written track is punctuated and
    # segmented by someone deciding what belongs on screen together,
    # which is exactly the unit cue_sentences.py turns into a Sentence
    # (docs/adr/0003, 2026-08-27). An auto-caption is rougher, and
    # still a usable study unit -- so it is the fallback, not a
    # refusal.
    try:
        transcript = available.find_manually_created_transcript(_JAPANESE_LANGUAGE_CODES)
    except NoTranscriptFound:
        try:
            transcript = available.find_generated_transcript(_JAPANESE_LANGUAGE_CODES)
        except NoTranscriptFound:
            raise CaptionFetchError(
                "This video has no Japanese subtitles. Try another video, "
                "or add a subtitle file yourself."
            )

    try:
        fetched = transcript.fetch()
    except CouldNotRetrieveTranscript as e:
        logger.warning("Caption download blocked for %s: %s", video_id, e)
        raise CaptionFetchError(
            "YouTube refused the subtitle request for this video."
        )
    except Exception as e:  # pragma: no cover - defensive
        logger.exception("Unexpected error fetching captions for %s", video_id)
        raise CaptionFetchError(f"Could not read the subtitles: {e}")

    cues = []
    for snippet in fetched:
        # Newlines inside a snippet are a line break on screen, not a
        # cue boundary -- the same flattening _parse_srt does when it
        # joins a block's text lines.
        text = _strip_markup(snippet.text.replace("\n", " "))
        if not text:
            continue
        start = float(snippet.start)
        cues.append({
            "start": start,
            "end": start + float(snippet.duration),
            "text": text,
        })

    if not cues:
        raise CaptionFetchError("This video's Japanese subtitle track is empty.")

    # Auto-captions render as a ROLLING WINDOW, repeating most of each
    # neighbour's text. This is the function that exists for that; see
    # its own docstring.
    return _merge_duplicate_consecutive(cues)

# ── YouTube URL parsing (for the PLAYER, not for fetching) ────────
# `.search`, not `.match`, so m.youtube.com / music.youtube.com and a
# trailing ?si=... or &t=90s all work without their own patterns. The
# {11} id length is what keeps these from matching arbitrary paths.
_YOUTUBE_URL_RES = (
    re.compile(
        r"(?:youtube\.com/watch\?(?:.*&)?v="
        r"|youtube\.com/shorts/"
        r"|youtube\.com/live/"      # premieres and streams keep this path after ending
        r"|youtube\.com/embed/"     # what a copied embed snippet contains
        r")([A-Za-z0-9_-]{11})"
    ),
    re.compile(r"youtu\.be/([A-Za-z0-9_-]{11})"),
)


def parse_video_id(url: str) -> str | None:
    """The 11-character video id from a youtube.com/watch, youtu.be, or
    youtube.com/shorts URL, or None if `url` doesn't match any of them.
    Never raises -- an unrecognised URL is the caller's 400, not this
    function's problem."""
    for pattern in _YOUTUBE_URL_RES:
        match = pattern.search(url)
        if match:
            return match.group(1)
    return None


# ── Pasted transcript (YouTube's own "Show transcript" panel) ──────
# The one ingest that cannot be IP-blocked: the learner's browser
# already rendered this text and they paste it, so no request leaves
# this server and it works identically from a laptop and from Render.
# See plans/025 and docs/adr/0003.
#
# THE FORMAT IS NOT WHAT YOU WOULD GUESS. Captured from a real
# select-all-copy of the panel on 2026-08-26 (fixture:
# tests/fixtures/youtube_transcript_panel_fr_ui.txt):
#
#   Transcription
#
#   Rechercher dans la transcription
#   0:011 seconde[♪♪♪]
#   0:1818 secondes♪ We're no strangers to love ♪
#   1:091 minute et 9 secondes♪ Inside we both know ♪
#
# One line per cue, and between the timestamp and the text sits a
# screen-reader duration label with NO separator on either side --
# "0:18" + "18 secondes" + the caption. The label is a localized,
# humanized rendering of the timestamp ("1 minute et 9 secondes"),
# so it cannot be matched by a fixed pattern across UI languages.
#
# It CAN be stripped reliably, because it is derived from the timestamp
# we already parsed: the non-zero hour/minute/second components appear
# in order, each followed by a unit word. _strip_duration_label rebuilds
# that expectation from the timestamp and only strips on an exact match,
# so a UI in any language works and an unrecognised shape is left
# untouched rather than mangled.
_TIMESTAMP_LINE_RE = re.compile(r"^\s*(?:(\d{1,2}):)?(\d{1,3}):([0-5]\d)(.*)$")

# What the last cue gets, having no successor to bound it. Only affects
# the tail of the window, and only by a few seconds.
_TRAILING_CUE_SECONDS = 5.0

# Characters a duration label's unit word may be built from, beyond
# Latin letters and spaces: the CJK units a Japanese UI renders
# ("1分9秒"). Deliberately just these three -- widening it to "any CJK"
# would let the label eat the caption's first characters.
_CJK_DURATION_UNITS = "時分秒"


def _is_unit_char(ch: str) -> bool:
    if ch.isspace():
        return True
    if ch in _CJK_DURATION_UNITS:
        return True
    # Latin letters only: "minute", "minutes", "et", "and", "seconds".
    return ch.isalpha() and ch.isascii()


def _duration_components(total_seconds: int) -> list[int]:
    """The numbers a humanized duration for `total_seconds` will contain,
    in the order they appear. Zero components are omitted, which is what
    the panel does -- 1:00 renders as "1 minute", not "1 minute and 0
    seconds"."""
    hours, rest = divmod(total_seconds, 3600)
    minutes, seconds = divmod(rest, 60)
    parts = [n for n in (hours, minutes, seconds) if n]
    return parts or [0]


def _strip_duration_label(remainder: str, total_seconds: int) -> str:
    """Remove the panel's screen-reader duration label from the front of
    `remainder`, or return it unchanged when there isn't one.

    Only strips on a full match against the label the timestamp itself
    implies, so this is safe in any UI language and safe when the paste
    has no label at all (a plain "0:18 text" line). Requires at least one
    unit character, which is what stops a caption that merely BEGINS with
    the same number ("0:18" + "18歳です") from being eaten.
    """
    if not remainder or not remainder[0].isdigit():
        return remainder

    pos = 0
    unit_chars = 0
    for component in _duration_components(total_seconds):
        end = pos
        while end < len(remainder) and remainder[end].isdigit():
            end += 1
        if remainder[pos:end] != str(component):
            return remainder
        pos = end
        while pos < len(remainder) and _is_unit_char(remainder[pos]):
            if not remainder[pos].isspace():
                unit_chars += 1
            pos += 1

    if unit_chars == 0:
        return remainder
    return remainder[pos:]


def parse_pasted_transcript(text: str) -> list[dict]:
    """Cues from text copied out of YouTube's "Show transcript" panel.

    Tolerant of the three shapes seen in the wild, because this input is
    hand-assembled by a person:
      - panel copy:   "0:1818 secondes<text>"   (see the module comment)
      - inline:       "0:18 <text>"
      - split lines:  "0:18" then <text> on following lines

    Raises CaptionParseError when no timestamp is found at all, rather
    than returning [] -- an empty transcript surfaces to the learner as a
    mystery, and naming the problem is the whole reason this ingest has
    its own error type.
    """
    cues: list[dict] = []
    current: dict | None = None

    for raw_line in text.splitlines():
        match = _TIMESTAMP_LINE_RE.match(raw_line)
        if match:
            hours, minutes, seconds, remainder = match.groups()
            start = int(hours or 0) * 3600 + int(minutes) * 60 + int(seconds)
            remainder = _strip_duration_label(remainder, start)
            if current is not None:
                cues.append(current)
            current = {"start": float(start), "end": None, "text": remainder.strip()}
        elif current is not None:
            # A continuation line of the cue we're building. Lines BEFORE
            # the first timestamp are dropped on purpose: that is the
            # panel's own header ("Transcription", the search box label,
            # sometimes the video title).
            extra = raw_line.strip()
            if extra:
                current["text"] = f"{current['text']} {extra}".strip()

    if current is not None:
        cues.append(current)

    if not cues:
        raise CaptionParseError(
            "No timestamps found. Copy the whole transcript panel from YouTube "
            "(each line should start with a time like 0:18)."
        )

    # Forgiving with input a human assembled by hand: a paste that got
    # reordered is sorted rather than rejected.
    cues.sort(key=lambda c: c["start"])

    cleaned = []
    for cue in cues:
        cue["text"] = _strip_markup(cue["text"])
        if cue["text"]:
            cleaned.append(cue)

    if not cleaned:
        raise CaptionParseError("The pasted transcript had timestamps but no text.")

    for index, cue in enumerate(cleaned):
        following = cleaned[index + 1]["start"] if index + 1 < len(cleaned) else None
        cue["end"] = following if following is not None else cue["start"] + _TRAILING_CUE_SECONDS

    # A pasted AUTO-generated transcript carries the same rolling-window
    # duplication as a fetched one; reuse the merge that already exists.
    return _merge_duplicate_consecutive(cleaned)
