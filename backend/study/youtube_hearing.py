# ── A YouTube video's speech, heard by Gemini (plan 265) ──────────
# The one road to a video with no subtitle track at all. Every other
# road this file's neighbours keep needs the words written somewhere
# (a track, a file) or the sound in hand (a recording the browser
# keeps), and a YouTube video gives neither: its media answers 403 to
# anything but YouTube's own player (docs/adr/0003, 2026-10-16), and
# that player's sound is a cross-origin iframe no page can read.
#
# Google's Gemini API takes a public YouTube video's address itself
# (`fileData.fileUri`) and watches it on Google's side, so this server
# never fetches the video, and YouTube's own owner does the reading.
# Asked for the Japanese said in it, line by line, each with when it is
# said, it answers JSON this module reads to a Track like any other.
#
# What it is not, and the screen says so: a speech recogniser. It is a
# general model listening, so it can miss a line or write one nobody
# said, and its times are a second's, never a word's (the analyser
# spreads a line's words over it, as it does for a file with none). A
# line it repeats back to back is the loop such a model falls into,
# kept once.
#
# Rationed as a recording is: the window's minutes (at most a session's
# length) are claimed from the learner's day of listening before the
# call, in core/daily_limit, and the app's day is summed from the
# sessions (routes/video.py). The model and its address are
# env-overridable: the ids in study/llm_shared.py are unverified, and a
# model that cannot watch YouTube answers 400, which reads here as
# `video_unavailable`.
import json
import logging
import os
import re

import httpx

from study.captions import CaptionFetchError, _cue, _strip_markup

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# Flash rather than Flash-Lite: the same reason OCR uses it
# (llm_shared.GOOGLE_VISION_MODEL), the cheap tier is the one measured
# to miss what is hard to read, and spoken Japanese is.
MODEL = os.environ.get("YOUTUBE_HEAR_MODEL") or os.environ.get("GOOGLE_VISION_MODEL", "gemini-3.1-flash")
_TIMEOUT_SECONDS = 300
# A half-hour of Japanese speech is under ten thousand characters; the
# JSON around each line roughly doubles it.
_MAX_OUTPUT_TOKENS = 32768


def _api_key() -> str | None:
    return os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")


def configured() -> bool:
    return bool(_api_key())


_PROMPT = (
    "Transcribe the Japanese speech in this video, exactly as it is said, in Japanese "
    "script (kanji and kana as a native writer would write them), with Japanese "
    "punctuation. One entry per spoken sentence or short phrase. For each, give when it "
    "starts and ends, in seconds with one decimal, counted from the start of the clip you "
    "are given (its first frame is 0). Leave out music, sound effects, on-screen text that "
    "is not spoken, and speech that is not Japanese. If nothing Japanese is said, return "
    "an empty list. Never translate, summarise or invent a line."
)

_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "lines": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "start": {"type": "NUMBER"},
                    "end": {"type": "NUMBER"},
                    "text": {"type": "STRING"},
                },
                "required": ["start", "text"],
            },
        },
    },
    "required": ["lines"],
}


def _seconds(value) -> float | None:
    """A time as the model wrote it: seconds, or "MM:SS(.s)" / "H:MM:SS"."""
    if isinstance(value, (int, float)):
        return float(value) if value >= 0 else None
    if isinstance(value, str):
        parts = value.strip().split(":")
        try:
            total = 0.0
            for part in parts:
                total = total * 60 + float(part)
            return total if total >= 0 else None
        except ValueError:
            return None
    return None


def cues_from_lines(lines: list, start: float, length: float) -> list[dict]:
    """The model's lines as a Track, on the video's clock. The prompt
    asks for times counted from the clip's start; a model that counted
    from the video's own start instead is told apart by its times
    running past the clip's length while none comes before its start."""
    rows = []
    for line in lines or []:
        if not isinstance(line, dict):
            continue
        text = _strip_markup(re.sub(r"\s+", " ", str(line.get("text") or "")))
        at = _seconds(line.get("start"))
        if not text or at is None:
            continue
        rows.append((at, _seconds(line.get("end")), text))
    if not rows:
        return []
    rows.sort(key=lambda r: r[0])
    absolute = start > 1 and rows[0][0] >= start - 2 and rows[-1][0] > length + 5
    offset = 0.0 if absolute else start
    cues = []
    for i, (at, end, text) in enumerate(rows):
        if cues and cues[-1]["text"] == text:
            continue
        nxt = rows[i + 1][0] if i + 1 < len(rows) else None
        if end is None or end <= at:
            end = nxt if nxt is not None and nxt > at else at + 3.0
        if nxt is not None and nxt > at:
            end = min(end, nxt)
        cues.append(_cue(round(at + offset, 2), round(end + offset, 2), text))
    return cues


def transcribe(video_id: str, start: float, end: float) -> list[dict]:
    """The video's Japanese speech between `start` and `end` (seconds)
    as a Track, or CaptionFetchError with a code the client words."""
    key = _api_key()
    if not key:
        raise CaptionFetchError("No Gemini key is configured", "transcribe_disabled")
    body = {
        "contents": [{
            "parts": [
                {
                    "fileData": {"fileUri": f"https://www.youtube.com/watch?v={video_id}", "mimeType": "video/*"},
                    "videoMetadata": {"startOffset": f"{int(start)}s", "endOffset": f"{int(end)}s"},
                },
                {"text": _PROMPT},
            ],
        }],
        "generationConfig": {
            "temperature": 0,
            "responseMimeType": "application/json",
            "responseSchema": _SCHEMA,
            "maxOutputTokens": _MAX_OUTPUT_TOKENS,
            # The words are in the sound; the frames only cost tokens.
            "mediaResolution": "MEDIA_RESOLUTION_LOW",
        },
    }
    try:
        r = httpx.post(
            GEMINI_URL.format(model=MODEL), headers={"x-goog-api-key": key},
            json=body, timeout=_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as e:
        logger.warning("Gemini unreachable for a YouTube hearing: %s", e)
        raise CaptionFetchError("Gemini could not be reached", "transcribe_failed") from e
    if r.status_code == 429:
        raise CaptionFetchError("Gemini is busy", "transcribe_busy")
    if r.status_code in (400, 403, 404):
        # A private, removed or region-locked video, or a model that
        # cannot watch one: nothing the learner can retry.
        logger.warning("Gemini refused a YouTube video: %s %s", r.status_code, r.text[:300])
        raise CaptionFetchError("Gemini could not watch this video", "video_unavailable")
    if r.status_code >= 400:
        logger.warning("Gemini failed a YouTube hearing: %s %s", r.status_code, r.text[:300])
        raise CaptionFetchError("Gemini failed", "transcribe_failed")
    try:
        data = r.json()
        candidate = (data.get("candidates") or [{}])[0]
        text = "".join(p.get("text", "") for p in candidate.get("content", {}).get("parts", []))
        lines = json.loads(text).get("lines") if text else []
    except (ValueError, AttributeError, IndexError) as e:
        raise CaptionFetchError("Gemini answered nonsense", "transcribe_failed") from e
    cues = cues_from_lines(lines, start, end - start)
    if not cues:
        raise CaptionFetchError("No Japanese speech was heard in the video", "no_speech")
    return cues
