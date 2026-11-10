"""── 歌 — a song's lines from its audio (plan 317) ─────────────────────

The analyser's song ingest, the owner's pick S1 of the canvas "Tsuji
analyser — a song from an audio file". A learner adds a song as an
audio file; the browser decodes it and sends it here as a small WAV --
16 kHz, one channel, 16-bit, cut at MAX_SECONDS (frontend
lib/songAudio.js) -- and this module asks a model that hears for the
sung lines and when each one is sung. What it returns is a Track as
study/captions.py reads one, [{"start", "end", "text"}], so the
session's worker turns it into lines exactly as it does a subtitle
file's (routes/video.py), and the audio itself is never kept: the
learner's device keeps the song, the server keeps its lines.

Two asks, one call each:

  - transcribe: no lyrics given, the model writes the lines it hears
    and times them;
  - time: the learner pasted the lyrics, so the lines studied are
    theirs, and the model says only when each numbered line is sung.
    A word the model would have misheard is then never learnt; a line
    it cannot place is simply left out of the timed track.

Only a provider whose model takes an `input_audio` part is asked
(llm_shared.chat(audio=True)): Google's, in this project. The route
claims the learner's slot of SONG_DAILY_LIMIT before the worker starts,
scripts/llm_cost_model.py costs it, and two bounds keep the audio's
memory in hand on a 512 MB instance: _SLOTS, how many songs are heard
at once (each is its bytes, their base64 and the request's body while
it is), and _HELD, how many the process holds at all, heard or waiting
for a slot. A song past _HELD is refused at the door (hold()), before
its body is read or the learner's allowance counted.
"""
import base64
import json
import logging
import math
import os
import re
import struct
import threading

from study.cue_sentences import is_japanese
from study.llm_shared import chat

logger = logging.getLogger(__name__)

# core/daily_limit.py's key, and how many songs a learner may add a day.
FEATURE = "song_transcribe"
SONG_DAILY_LIMIT = int(os.environ.get("SONG_DAILY_LIMIT", "5"))

# The longest stretch of a song heard, in seconds: the client cuts the
# audio there, and a longer one is refused here.
MAX_SECONDS = 7 * 60
# The audio as the client sends it: what the model hears at anyway.
RATE = 16_000
BYTES_PER_SECOND = RATE * 2
# The largest WAV accepted: MAX_SECONDS of it, its header and a little
# slack for the chunks a writer may add.
MAX_WAV_BYTES = 44 + BYTES_PER_SECOND * MAX_SECONDS + 4096

# Pasted lyrics, bounded as any text a route reads (plan 211).
MAX_LYRICS_CHARS = 8_000
MAX_LYRIC_LINES = 200
MAX_LINE_CHARS = 200

# A line's end the model left out, or put before its start: the next
# line's start, or this long after its own.
_FALLBACK_SPAN = 4.0
# Shorter than this, a timed line is noise.
_MIN_SPAN = 0.2

# Songs heard at once, process-wide.
_SLOTS = threading.BoundedSemaphore(int(os.environ.get("SONG_CONCURRENCY", "2")))
# Songs held at once, heard or waiting for a slot: what one worker's
# memory can carry of them (plan 211: nothing a learner sends is
# unbounded). The route takes one before it reads a song and the
# worker gives it back.
_HELD = threading.BoundedSemaphore(int(os.environ.get("SONG_HELD", "4")))


def hold() -> bool:
    """A place for one more song in this process, or False when it holds
    as many as it may. Each True is given back once by release()."""
    return _HELD.acquire(blocking=False)


def release() -> None:
    _HELD.release()


class SongError(RuntimeError):
    """A song that gave no lines to study, with the code the client
    words (frontend components/analysis/videoErrors.js)."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


# ── The audio ─────────────────────────────────────────────────────
def wav_seconds(wav: bytes) -> float:
    """How long a PCM WAV plays, in seconds. ValueError for anything
    that is not one: the client always sends one, so anything else is a
    client that should not be answered with a model call."""
    if len(wav) < 44 or wav[:4] != b"RIFF" or wav[8:12] != b"WAVE":
        raise ValueError("not a WAV file")
    pos = 12
    fmt = None
    data = None
    while pos + 8 <= len(wav):
        chunk = wav[pos:pos + 4]
        (size,) = struct.unpack("<I", wav[pos + 4:pos + 8])
        body = pos + 8
        if chunk == b"fmt " and size >= 16 and body + 16 <= len(wav):
            fmt = struct.unpack("<HHIIHH", wav[body:body + 16])
        elif chunk == b"data":
            data = min(size, len(wav) - body)
            break
        pos = body + size + (size & 1)
    if fmt is None or data is None:
        raise ValueError("a WAV needs its fmt and data chunks")
    audio_format, channels, rate, byte_rate, _align, bits = fmt
    if audio_format != 1 or channels < 1 or rate <= 0 or byte_rate <= 0 or bits not in (8, 16, 24, 32):
        raise ValueError("only PCM WAV is heard")
    return data / byte_rate


def lyric_lines(text: str | None) -> list[str]:
    """Pasted lyrics as their lines: blank ones and the space around
    each gone, each cut at MAX_LINE_CHARS, MAX_LYRIC_LINES at most."""
    lines = []
    for raw in (text or "")[:MAX_LYRICS_CHARS].splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if line:
            lines.append(line[:MAX_LINE_CHARS])
        if len(lines) == MAX_LYRIC_LINES:
            break
    return lines


# ── The asks ──────────────────────────────────────────────────────
TRANSCRIBE_PROMPT = """Transcribe the lyrics sung in this recording, as the song's lyric sheet would print them: Japanese in its usual kanji and kana (never romaji), one sung line per entry, in the order they are sung, a line repeated each time it is sung. Leave out what is not sung: an instrumental passage, a spoken introduction, a count-in. Give each line the time it starts and the time it ends, in seconds from the start of the recording, to a tenth of a second.

Answer with JSON only, no other text: {"lines": [{"start": 12.3, "end": 15.8, "text": "..."}]}. If nothing is sung, answer {"lines": []}."""

TIME_PROMPT = """These are the lyrics of the song in this recording, one numbered line each:

{numbered}

Say when each line is sung: its number, the time it starts and the time it ends, in seconds from the start of the recording, to a tenth of a second, in the order the lines are sung. A line sung twice is listed twice; a line that is not sung is left out.

Answer with JSON only, no other text: {{"lines": [{{"n": 1, "start": 12.3, "end": 15.8}}]}}."""


def transcribe(wav: bytes, lyrics: list[str] | None = None) -> list[dict]:
    """The song's Track, [{"start", "end", "text"}] in the order sung.

    Raises ValueError for audio that is not a PCM WAV, SongError when
    the song gives nothing to study, and LLMUnavailable as chat() does."""
    seconds = wav_seconds(wav)
    prompt = (TIME_PROMPT.format(numbered="\n".join(f"{i}. {line}" for i, line in enumerate(lyrics, 1)))
              if lyrics else TRANSCRIBE_PROMPT)
    with _SLOTS:
        # The base64 made only once a slot is free: a song waiting for one
        # holds its bytes alone.
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "input_audio", "input_audio": {"data": base64.b64encode(wav).decode("ascii"), "format": "wav"}},
            ],
        }]
        reply = chat(messages, timeout=180, max_tokens=6000, audio=True, task="song",
                     accept=lambda text: _lines_of(text) is not None)
        del messages
    cues = cues_from(_lines_of(reply) or [], seconds, lyrics)
    if not cues:
        if lyrics:
            raise SongError("song_lyrics_unmatched", "None of the lyrics pasted could be placed in the song")
        raise SongError("song_unheard", "No sung line was heard in the song")
    if not any(is_japanese(cue["text"]) for cue in cues):
        raise SongError("song_not_japanese", "The song has no Japanese line")
    return cues


# ── The answer ────────────────────────────────────────────────────
def _lines_of(reply: str | None) -> list | None:
    """The `lines` list a reply holds, or None when it holds none: a
    fence around the JSON, or words before it, are tolerated."""
    if not reply:
        return None
    start, end = reply.find("{"), reply.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        payload = json.loads(reply[start:end + 1])
    except ValueError:
        return None
    lines = payload.get("lines") if isinstance(payload, dict) else None
    return lines if isinstance(lines, list) else None


_CLOCK = re.compile(r"^(?:(\d+):)?(\d+):(\d+(?:\.\d+)?)$")


def seconds_of(value) -> float | None:
    """A time as a model writes one -- 72.5, "72.5", "1:12.5",
    "0:01:12.5" -- in seconds, or None."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        out = float(value)
    elif isinstance(value, str):
        text = value.strip()
        clock = _CLOCK.match(text)
        if clock:
            hours, minutes, secs = clock.groups()
            out = int(hours or 0) * 3600 + int(minutes) * 60 + float(secs)
        else:
            try:
                out = float(text)
            except ValueError:
                return None
    else:
        return None
    return out if math.isfinite(out) else None


def cues_from(items: list, seconds: float, lyrics: list[str] | None = None) -> list[dict]:
    """The lines a model answered, as a Track: each with its text (the
    learner's own line, by its number, when lyrics were pasted), a start
    inside the song and an end after it, in the order sung, none
    overlapping the next. What does not read is left out."""
    timed = []
    for item in items:
        if not isinstance(item, dict):
            continue
        start = seconds_of(item.get("start"))
        if start is None or start < 0 or start > seconds + 1:
            continue
        if lyrics:
            n = item.get("n")
            if isinstance(n, str) and n.strip().isdigit():
                n = int(n)
            if isinstance(n, bool) or not isinstance(n, int) or not 1 <= n <= len(lyrics):
                continue
            text = lyrics[n - 1]
        else:
            text = re.sub(r"\s+", " ", str(item.get("text") or "")).strip()[:MAX_LINE_CHARS]
            if not text:
                continue
        timed.append({"start": start, "end": seconds_of(item.get("end")), "text": text})

    timed.sort(key=lambda cue: cue["start"])
    out = []
    for i, cue in enumerate(timed):
        following = timed[i + 1]["start"] if i + 1 < len(timed) else None
        end = cue["end"]
        if end is None or end <= cue["start"]:
            end = following if following is not None and following > cue["start"] else cue["start"] + _FALLBACK_SPAN
        if following is not None and following > cue["start"]:
            end = min(end, following)
        end = min(end, seconds + 1)
        if end - cue["start"] < _MIN_SPAN:
            continue
        if out and out[-1]["text"] == cue["text"] and abs(out[-1]["start"] - cue["start"]) < _MIN_SPAN:
            continue
        out.append({"start": round(cue["start"], 2), "end": round(end, 2), "text": cue["text"]})
    return out
