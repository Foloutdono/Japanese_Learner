# ── A recording as a Track: speech recognition (plan 265) ─────────
# The fourth way a Track is made, and the first that reads sound
# rather than text: a recording the learner holds (a film, an episode,
# a podcast) has no subtitles at all, and its words are what a speech
# recogniser hears. docs/adr/0003's first premise -- "no provider does
# audio transcription" -- was true of the chat-completions catalog it
# was written against and stopped being true when plan 092 bought an
# OpenAI account: the same key reaches /v1/audio/transcriptions.
#
# What reaches this module is never the learner's file. The browser
# keeps the sound alone, mono at 16 kHz, cut to the window asked for,
# and encodes it as a small MP3 (frontend/src/lib/mediaAudio.js): ten
# minutes is ~2.4 MB rather than a film's gigabyte. The server reads
# its length from the MP3's own frames (mp3_duration), which is what
# the allowance is counted in, sends it to the recogniser, and keeps
# nothing: the bytes live in the worker's memory for one call.
#
# whisper-1, not a newer model, because it is the one OpenAI model that
# gives each WORD its time (verbose_json with timestamp_granularities),
# and the analyser lights the words as they are said
# (study/word_timing.py's reason for being). The endpoint and the model
# are env-overridable together: any OpenAI-compatible transcription
# endpoint that answers verbose_json with word times will do (Groq's
# whisper-large-v3 does, at a fraction of the price).
#
# Recognition is not transcription. A learner memorises what they are
# shown, so the session says where its lines came from (source
# "media"/"podcast"), and the segments the recogniser itself doubts --
# the silence Whisper fills with ご視聴ありがとうございました, a loop
# of one phrase -- are left out rather than taught.
import logging
import math
import os
import re

import httpx

from study.captions import CaptionFetchError, _cue, _strip_markup, _tidy_anchors

logger = logging.getLogger(__name__)

TRANSCRIBE_URL = os.environ.get("TRANSCRIBE_URL", "https://api.openai.com/v1/audio/transcriptions")
TRANSCRIBE_MODEL = os.environ.get("TRANSCRIBE_MODEL", "whisper-1")


def _api_key() -> str | None:
    return os.environ.get("TRANSCRIBE_API_KEY") or os.environ.get("OPENAI_API_KEY")


def configured() -> bool:
    """Whether this deployment can transcribe at all: a key, and nothing
    else. Read on every call, like the link fetch's proxy, so setting
    the key turns the door on with no deploy."""
    return bool(_api_key())


# What one recording may be, and what a learner and the whole app may
# spend in a day. A recogniser bills by the minute (whisper-1: $0.006),
# so these are spending decisions, read from the environment for the
# same reason the link fetch's budget is (routes/video.py).
MAX_SECONDS = int(os.environ.get("TRANSCRIBE_MAX_SECONDS", str(30 * 60)))
DAILY_MINUTES = int(os.environ.get("TRANSCRIBE_DAILY_MINUTES", "60"))
DAILY_MINUTES_TOTAL = int(os.environ.get("TRANSCRIBE_DAILY_MINUTES_TOTAL", "600"))
# The MP3 the browser makes is ~4 KB a second (32 kbps); a byte bound
# with room for a higher rate, under the endpoint's own 25 MB.
MAX_AUDIO_BYTES = 16 * 1024 * 1024
# How long the recogniser may take: a half-hour recording is under a
# minute on whisper-1, so this is a hung call, not a slow one.
_TIMEOUT_SECONDS = 300
# Whisper writes Japanese with no punctuation unless the prompt shows
# some; a line of ordinary written Japanese is the documented nudge.
_PROMPT = "こんにちは。今日は、いい天気ですね。そうですね！"


def minutes(seconds: float) -> int:
    """What a recording costs of the allowance: whole minutes, rounded
    up, as the recogniser bills."""
    return max(1, math.ceil(seconds / 60))


# ── The MP3's own length ──────────────────────────────────────
# Read from its frames rather than taken from the client: the length
# is what the allowance is counted in, and a frame header says exactly
# how many samples follow it. Layer III only, which is what the
# browser's encoder writes; anything else is not ours and is refused.
_BITRATES = {
    1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
}
_SAMPLE_RATES = {1: [44100, 48000, 32000], 2: [22050, 24000, 16000], 25: [11025, 12000, 8000]}


def _id3_size(data: bytes) -> int:
    if len(data) >= 10 and data[:3] == b"ID3":
        size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9]
        return 10 + size + (10 if data[5] & 0x10 else 0)
    return 0


def mp3_duration(data: bytes) -> float | None:
    """Seconds of sound in an MPEG Layer III stream, or None when it is
    not one (fewer than ten frames in a row could be found)."""
    i, samples, frames, rate = _id3_size(data), 0, 0, None
    n = len(data)
    lost = 0
    while i + 4 <= n:
        b1, b2, b3 = data[i + 1], data[i + 2], data[i + 3]
        if data[i] != 0xFF or (b1 & 0xE0) != 0xE0:
            i += 1
            lost += 1
            if lost > 64 * 1024:
                break
            continue
        version_bits = (b1 >> 3) & 0x3
        layer_bits = (b1 >> 1) & 0x3
        bitrate_index = b2 >> 4
        rate_index = (b2 >> 2) & 0x3
        if version_bits == 1 or layer_bits != 1 or bitrate_index in (0, 15) or rate_index == 3:
            i += 1
            continue
        version = {3: 1, 2: 2, 0: 25}[version_bits]
        sr = _SAMPLE_RATES[version][rate_index]
        kbps = _BITRATES[1 if version == 1 else 2][bitrate_index]
        padding = (b2 >> 1) & 0x1
        per_frame = 1152 if version == 1 else 576
        length = (per_frame // 8) * kbps * 1000 // sr + padding
        if length < 4:
            i += 1
            continue
        if rate is None:
            rate = sr
        elif sr != rate:
            i += 1
            continue
        samples += per_frame
        frames += 1
        lost = 0
        i += length
    if frames < 10 or not rate:
        return None
    return samples / rate


# ── The recogniser's answer, as cues ──────────────────────────
def _doubted(seg: dict) -> bool:
    """A segment the recogniser itself doubts, by Whisper's own
    thresholds: speech it thinks is silence, heard with low confidence
    (the ご視聴ありがとうございました it writes over a quiet end), or
    text so repetitive it compresses past 2.4 (one phrase on a loop)."""
    try:
        no_speech = float(seg.get("no_speech_prob") or 0)
        logprob = float(seg.get("avg_logprob") or 0)
        ratio = float(seg.get("compression_ratio") or 0)
    except (TypeError, ValueError):
        return False
    return (no_speech > 0.6 and logprob < -1.0) or ratio > 2.4


def cues_from_whisper(result: dict, offset: float = 0.0) -> list[dict]:
    """A verbose_json transcription as a Track: a cue a segment, each
    word the recogniser timed anchored where it starts (the `words`
    study/captions.py's parsers give a karaoke track), every time moved
    by `offset`, where the recording starts in the video."""
    segments = [s for s in result.get("segments") or [] if isinstance(s, dict)]
    words = [w for w in result.get("words") or [] if isinstance(w, dict)]
    cues, w = [], 0
    for seg in segments:
        try:
            start, end = float(seg["start"]), float(seg["end"])
        except (KeyError, TypeError, ValueError):
            continue
        text = _strip_markup(re.sub(r"\s+", " ", str(seg.get("text") or "")))
        # The words that start inside this segment, in order; one that
        # starts before it belongs to a segment left out.
        mine = []
        while w < len(words):
            try:
                ws = float(words[w].get("start"))
            except (TypeError, ValueError):
                w += 1
                continue
            if ws >= end:
                break
            if ws >= start - 0.05:
                mine.append((str(words[w].get("word") or "").strip(), ws))
            w += 1
        if not text or _doubted(seg) or end <= start:
            continue
        anchors, cursor = [], 0
        for word, ws in mine:
            if not word:
                continue
            at = text.find(word, cursor)
            if at < 0:
                continue
            anchors.append((at, ws + offset))
            cursor = at + len(word)
        cues.append(_cue(round(start + offset, 3), round(end + offset, 3), text,
                         _tidy_anchors(text, anchors, 0) if len(anchors) > 1 else None))
    return cues


# ── The call ──────────────────────────────────────────────────
def transcribe(audio: bytes, offset: float = 0.0) -> list[dict]:
    """The recording's Track, or CaptionFetchError with a code the
    client words: nothing was malformed, the recogniser just would not
    or could not answer (routes/video.py catches the two together)."""
    key = _api_key()
    if not key:
        raise CaptionFetchError("No transcription key is configured", "transcribe_disabled")
    files = {"file": ("audio.mp3", audio, "audio/mpeg")}
    data = [
        ("model", TRANSCRIBE_MODEL),
        ("language", "ja"),
        ("response_format", "verbose_json"),
        ("timestamp_granularities[]", "segment"),
        ("timestamp_granularities[]", "word"),
        ("temperature", "0"),
        ("prompt", _PROMPT),
    ]
    try:
        r = httpx.post(
            TRANSCRIBE_URL, headers={"Authorization": f"Bearer {key}"},
            data=data, files=files, timeout=_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as e:
        logger.warning("transcription unreachable: %s", e)
        raise CaptionFetchError("The speech recogniser could not be reached", "transcribe_failed") from e
    if r.status_code == 429:
        raise CaptionFetchError("The speech recogniser is busy", "transcribe_busy")
    if r.status_code >= 400:
        # The body is the provider's, never shown: it is logged, short.
        logger.warning("transcription refused: %s %s", r.status_code, r.text[:300])
        raise CaptionFetchError("The speech recogniser refused the recording", "transcribe_failed")
    try:
        result = r.json()
    except ValueError as e:
        raise CaptionFetchError("The speech recogniser answered nonsense", "transcribe_failed") from e
    cues = cues_from_whisper(result, offset)
    if not cues:
        raise CaptionFetchError("No speech was recognised in the recording", "no_speech")
    return cues
