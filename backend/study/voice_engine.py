# ── 声 — the voice engine (plan 121, docs/adr/0019) ──────────────
# The one module that talks to the speech synthesizer. Everything the
# app says out loud on the server -- the exam listening dialogues, the
# dictation bank, the card readings /api/tts falls back to, and the kana
# deck's syllables -- is made here, by a self-hosted VOICEVOX Nemo
# engine reached over HTTP.
#
# ── Why this engine ──────────────────────────────────────────────
# It replaced edge-tts, a client for Microsoft Edge's consumer "Read
# Aloud" endpoint, which no licence covers for server-side or commercial
# use. VOICEVOX Nemo's terms (voicevox.hiroshiba.jp/nemo/term/) allow
# commercial use of the audio on ONE condition, the credit
# "VOICEVOX Nemo", which THIRD_PARTY_NOTICES.md and the Credits page
# (frontend/src/domain/attributions.js) carry. The same terms forbid
# using the audio for machine learning -- no clip this module makes may
# ever be published as, or fed into, a training set. ADR 0019 has the
# options that were weighed and why this one won.
#
# Nemo's nine voices (女声1-6, 男声1-3 -- the website writes 女性/男性,
# the engine's own /speakers says 女声/男声, and /speakers is what
# counts) are character-free readers, not the anime personas of the
# main VOICEVOX library, and share one flat credit instead of a set of
# per-character terms.
#
# ── Why kana are safe here ───────────────────────────────────────
# The engine reads plain text through Open JTalk, and plain text is
# exactly where a lone kana goes wrong: 「は」 on its own is analysed as
# the topic particle and read "wa", 「へ」 as "e". That is the reason
# frontend/public/sounds/README.md once rejected synthesis for the kana
# deck ("reads as a letter name"). The engine has a second input, an
# AquesTalk-style kana notation (/accent_phrases?is_kana=true), which
# names the mora itself and where the pitch falls -- 「ハ'」 is the
# syllable "ha" and nothing else. say() takes that path for any text
# that is exactly one kana, so every caller gets the right sound
# without having to know the trick.
#
# ── What this module promises its callers ─────────────────────────
# Every failure is TTSFailed: an engine that is not configured, not up,
# busy, answering errors, or returning silence. The callers already
# treat TTSFailed as "skip this item" (exam generation), "drop this
# line" (dictation) or "503" (/api/tts), so an engine outage costs
# audio, never a paper or a page.
import io
import logging
import os
import re
import threading
import time
import wave
from array import array
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

# The name of the voice every stored clip was made with. Clips made
# under another revision are stale: study/exam_tts.py regenerates them
# before serving them (its voice epoch), and the frontend carries the
# same string (VOICE_REV in lib/audio/speech.js, KANA_REV in
# lib/audio/playback.js) so the browser's own caches -- one year
# immutable for /api/tts, thirty days in the service worker -- never
# replay a clip in the old voice. Bump it whenever DEFAULT_VOICES, the
# engine or the synthesis settings change what a clip sounds like;
# tests/test_kana_audio.py fails if the two sides disagree.
VOICE_REV = "nemo2"

# One name per slot, in slot order (study/exam_tts.py maps speaker
# labels onto slots). The owner's choice, by ear, from the audition
# (plan 121b):
#   0 -- the reader: every word, every dictation line, a lone kana, and
#        any script read by one voice;
#   1 -- speaker A of a listening dialogue, a woman (the generator's
#        prompt says so, and its narration names her 女の人) -- the same
#        voice as the reader, the app's main voice;
#   2 -- speaker B, a man (男の人);
#   3 -- the narrator of a dialogue: the scene-setting line and the
#        question, a third voice so it never sounds like a participant.
# Changing a name here is changing what every clip sounds like, so it
# goes with a VOICE_REV bump and a run of scripts/revoice_audio.py.
# TTS_VOICES overrides this for auditions and local work only
# (scripts/audition_voices.py); set in production without a revision
# bump it would mix two voices in one store.
DEFAULT_VOICES = ("女声6", "女声6", "男声1", "女声1")

# A voice's own tempo, multiplied into every speed it is asked for: a
# voice that reads fast by nature is slowed here once rather than at
# every call. 男声1 read noticeably quicker than the voices beside him
# in the audition; 0.9 is 10% slower (scripts/audition_voices.py
# --tempo renders the alternatives). Keyed by voice name, so it follows
# the voice to whichever slot it is given. Part of what a clip sounds
# like, so a change here is a VOICE_REV bump too.
VOICE_TEMPO = {"男声1": 0.9}

# Dialogue and word clips: the engine's own rate, and the bitrate edge-tts
# used to deliver, so a clip costs the same bytes it always did.
DIALOGUE_RATE = 24000
DIALOGUE_KBPS = 48

# How long a lone kana's vowel is held, at least. Spoken as the engine
# would inside a word, a syllable on its own lasts barely a fifth of a
# second and sounds clipped; held a little, it is a syllable someone is
# saying on purpose, which is what a learner listening to one expects.
# The kana deck (scripts/build_kana_audio.py) and a lone kana said
# through say() use the same hold, so the two agree.
LONE_KANA_HOLD_S = 0.25

# Below this peak a "clip" is silence (about -40 dBFS). The engine
# answering 200 with nothing audible in it is not a clip worth caching:
# /api/tts would pin it in a phone for a year.
_SILENT_PEAK = 328

# The engine's own AudioQuery defaults (voicevox_engine's /audio_query,
# 0.23.0), for the kana path, which builds its query rather than asking
# for one: the notation IS the analysis, so there is nothing to ask.
_QUERY_DEFAULTS = {
    "speedScale": 1.0,
    "pitchScale": 0.0,
    "intonationScale": 1.0,
    "volumeScale": 1.0,
    "prePhonemeLength": 0.1,
    "postPhonemeLength": 0.1,
    "pauseLength": None,
    "pauseLengthScale": 1.0,
    "outputSamplingRate": DIALOGUE_RATE,
    "outputStereo": False,
}


class TTSFailed(Exception):
    """Any synthesis failure. Raised here and re-exported by
    study/exam_tts.py, where the callers have always imported it from:
    exam_listening_gen.py skips the item, dictation drops the line,
    /api/tts answers 503."""


class _NotationRefused(Exception):
    """The engine answered 400 to a kana notation -- a combination its
    mora table does not have. say() falls back to reading the text."""


@dataclass(frozen=True)
class Pcm:
    """16-bit signed little-endian mono samples and their rate."""

    frames: bytes
    rate: int

    @property
    def seconds(self) -> float:
        return len(self.frames) / 2 / self.rate


# ── Configuration ────────────────────────────────────────────────
# Read at call time rather than import time, so a test (or a script
# that loads backend/.env late) sees the value it set.

def base_url() -> str | None:
    """The engine's address, or None when none is configured.

    render.yaml fills VOICEVOX_URL from the private service's `hostport`,
    which is `host:port` with no scheme -- so a bare address gets
    http:// rather than being refused. Plain HTTP is right there: the
    private network never leaves Render, and the engine has no TLS of
    its own."""
    raw = (os.environ.get("VOICEVOX_URL") or "").strip().rstrip("/")
    if not raw:
        return None
    if "://" not in raw:
        raw = f"http://{raw}"
    return raw


def configured() -> bool:
    return base_url() is not None


def voices() -> tuple[str, ...]:
    """The voice name for each slot (see DEFAULT_VOICES)."""
    raw = os.environ.get("TTS_VOICES") or ""
    names = tuple(name.strip() for name in raw.split(",") if name.strip())
    return names or DEFAULT_VOICES


def _env_number(name: str, default: float) -> float:
    try:
        value = float(os.environ.get(name) or default)
    except ValueError:
        return default
    return value if value > 0 else default


# ── HTTP ─────────────────────────────────────────────────────────
# One client, built on first use and rebuilt if the address changes.
# httpx.Client is thread-safe, which matters: FastAPI runs the sync
# routes that end up here in a thread pool, and the exam generator runs
# on its own daemon thread.

_CONNECT_TIMEOUT_S = 3.0
# How long a caller waits for a free engine slot before giving up. The
# engine synthesizes one request per core at best; a queue longer than
# this is an outage in the making, and failing fast turns it into the
# TTSFailed every caller already handles.
_BUSY_WAIT_S = 20.0
# Retried: the engine restarting or the private network blinking.
# Not retried: a 500 (the same request will fail the same way) or a
# read timeout (retrying doubles the load on an engine that is already
# too slow).
_RETRY_STATUS = frozenset({502, 503, 504})
_RETRY_BACKOFF_S = (0.5, 2.0)

_state_lock = threading.Lock()
_client: httpx.Client | None = None
_client_url: str | None = None
_slots: threading.BoundedSemaphore | None = None
_styles: dict[str, int] | None = None


def _make_client(url: str) -> httpx.Client:
    """Separate so tests can hand back a client on an
    httpx.MockTransport instead of a socket."""
    timeout = httpx.Timeout(_env_number("VOICEVOX_TIMEOUT_S", 30.0), connect=_CONNECT_TIMEOUT_S)
    return httpx.Client(base_url=url, timeout=timeout)


def reset() -> None:
    """Forget the client, the concurrency slots and the voice table --
    the next call rebuilds all three from the environment. For tests,
    and for a voice list that changed under a running process."""
    global _client, _client_url, _slots, _styles
    with _state_lock:
        if _client is not None:
            _client.close()
        _client = _client_url = _slots = _styles = None


def _connection() -> tuple[httpx.Client, threading.BoundedSemaphore]:
    global _client, _client_url, _slots
    url = base_url()
    if url is None:
        raise TTSFailed("no voice engine is configured (VOICEVOX_URL is unset)")
    with _state_lock:
        if _client is None or _client_url != url:
            if _client is not None:
                _client.close()
            _client = _make_client(url)
            _client_url = url
        if _slots is None:
            _slots = threading.BoundedSemaphore(int(_env_number("VOICEVOX_CONCURRENCY", 2)))
        return _client, _slots


def _request(method: str, path: str, **kwargs) -> httpx.Response:
    client, slots = _connection()
    if not slots.acquire(timeout=_BUSY_WAIT_S):
        raise TTSFailed(f"voice engine busy: no free slot for {path} within {_BUSY_WAIT_S:.0f}s")
    try:
        problem = ""
        for attempt in range(len(_RETRY_BACKOFF_S) + 1):
            try:
                response = client.request(method, path, **kwargs)
            except (httpx.ConnectError, httpx.ConnectTimeout, httpx.RemoteProtocolError) as e:
                problem = f"{type(e).__name__}: {e}"
            except httpx.HTTPError as e:
                raise TTSFailed(f"voice engine {path} failed: {type(e).__name__}: {e}") from e
            else:
                if response.status_code not in _RETRY_STATUS:
                    return response
                problem = f"HTTP {response.status_code}"
            if attempt < len(_RETRY_BACKOFF_S):
                time.sleep(_RETRY_BACKOFF_S[attempt])
        raise TTSFailed(f"voice engine {path} unreachable: {problem}")
    finally:
        slots.release()


def _checked(response: httpx.Response, path: str) -> httpx.Response:
    if response.status_code >= 400:
        raise TTSFailed(f"voice engine {path} answered {response.status_code}: {response.text[:200]}")
    return response


def _json(response: httpx.Response, path: str):
    try:
        return _checked(response, path).json()
    except ValueError as e:
        raise TTSFailed(f"voice engine {path} answered something that is not JSON") from e


def ready(timeout: float = 2.0) -> bool:
    """Is an engine configured and answering? Never raises. Asked
    before anything is spent on the engine's behalf -- the listening
    generator calls it before its paid model call, not after."""
    if not configured():
        return False
    try:
        client, _slots_unused = _connection()
        return client.get("/version", timeout=timeout).status_code == 200
    except (TTSFailed, httpx.HTTPError):
        return False


def version() -> str:
    return str(_json(_request("GET", "/version"), "/version"))


# ── Voices ───────────────────────────────────────────────────────

def _style_table() -> dict[str, int]:
    """Voice name -> the style id to synthesize with, from /speakers,
    fetched once per process (a failed fetch is not remembered). A
    voice's first talk style answers to its bare name ("女声1"); every
    style also answers to "name/style" ("女声1/ノーマル")."""
    global _styles
    with _state_lock:
        if _styles is not None:
            return _styles
    speakers = _json(_request("GET", "/speakers"), "/speakers")
    table: dict[str, int] = {}
    for speaker in speakers if isinstance(speakers, list) else []:
        name = speaker.get("name")
        talk = [s for s in speaker.get("styles") or [] if s.get("type", "talk") == "talk"]
        if not name or not talk:
            continue
        table.setdefault(name, talk[0]["id"])
        for style in talk:
            table[f"{name}/{style['name']}"] = style["id"]
    if not table:
        raise TTSFailed("the voice engine lists no voices")
    with _state_lock:
        _styles = table
    return table


def style_named(name: str) -> int:
    table = _style_table()
    if name in table:
        return table[name]
    known = ", ".join(sorted(n for n in table if "/" not in n))
    raise TTSFailed(f"the voice engine has no voice named {name!r} (it has: {known})")


def voice_for_slot(slot: int) -> str:
    names = voices()
    return names[slot % len(names)]


def style_for_slot(slot: int) -> int:
    return style_named(voice_for_slot(slot))


def tempo_for_slot(slot: int) -> float:
    """The speed multiplier of the voice in `slot` (VOICE_TEMPO), 1.0
    for a voice with none. "男声1/ノーマル" is 男声1's tempo too."""
    return VOICE_TEMPO.get(voice_for_slot(slot).split("/", 1)[0], 1.0)


# ── Speed ────────────────────────────────────────────────────────

_RATE = re.compile(r"^([+-]?\d{1,3})%$")


def speed_scale(rate: str) -> float:
    """A rate in the percentage form the app has always stored ("",
    "-10%", "+20%") as the engine's speedScale. The form survives the
    engine it was invented for because it is part of every dictation
    clip's id (study/dictation.py's RATE)."""
    if not rate:
        return 1.0
    match = _RATE.match(rate.strip())
    if not match:
        raise ValueError(f"not a speaking rate: {rate!r}")
    scale = 1.0 + int(match.group(1)) / 100
    if not 0.5 <= scale <= 2.0:
        raise ValueError(f"speaking rate out of the engine's range: {rate!r}")
    return round(scale, 4)


# ── Kana ─────────────────────────────────────────────────────────

# One full-size kana the engine has as a mora on its own, optionally
# followed by one small kana (キャ, ファ, ウォ, ティ...). Deliberately
# excluded: ッ (a closure, silence by itself), ヮ ヰ ヱ ヵ ヶ, a lone
# small kana, and ー, which the notation does not accept at all -- two
# kana spelling one long vowel (ああ, えい) are the kana deck's own
# business (scripts/build_kana_audio.py), not something to guess at
# from text.
_LONE_KANA = re.compile(r"^[アイウエオカ-ヂツ-モヤユヨラ-ロワヲンヴ][ァィゥェォャュョ]?$")


def to_katakana(text: str) -> str:
    return "".join(chr(ord(ch) + 0x60) if "ぁ" <= ch <= "ゖ" else ch for ch in text)


def lone_kana_notation(text: str) -> str | None:
    """The kana notation for `text` if it is exactly one kana ("は" ->
    "ハ'"), else None. The accent mark after the only mora is what the
    notation requires of every phrase; on one mora it only means "this
    syllable carries the pitch"."""
    if not isinstance(text, str):
        return None
    katakana = to_katakana(text.strip())
    if not _LONE_KANA.match(katakana):
        return None
    return f"{katakana}'"


# ── Speaking ─────────────────────────────────────────────────────

def _pcm_from_wav(data: bytes, rate: int) -> Pcm:
    try:
        with wave.open(io.BytesIO(data)) as clip:
            shape = (clip.getnchannels(), clip.getsampwidth(), clip.getframerate())
            frames = clip.readframes(clip.getnframes())
    except (wave.Error, EOFError) as e:
        raise TTSFailed(f"the voice engine returned audio that is not a WAV: {e}") from e
    if shape != (1, 2, rate):
        raise TTSFailed(f"the voice engine returned {shape} audio, expected mono 16-bit at {rate} Hz")
    samples = array("h", frames)
    if not samples or max(max(samples), -min(samples)) < _SILENT_PEAK:
        raise TTSFailed("the voice engine returned silence")
    return Pcm(frames, rate)


def _synthesize(query: dict, style: int, rate: int) -> Pcm:
    global _styles
    response = _request("POST", "/synthesis", params={"speaker": style}, json=query)
    if response.status_code in (404, 422):
        # An unknown style id: the engine's voice list is not the one
        # this process read. Forget it, so the next call reads it again
        # rather than failing the same way until a restart.
        with _state_lock:
            _styles = None
    return _pcm_from_wav(_checked(response, "/synthesis").content, rate)


def say(text: str, style: int, *, speed: float = 1.0, sample_rate: int = DIALOGUE_RATE) -> Pcm:
    """`text` spoken by the voice `style` (style_for_slot /
    style_named). A lone kana is spoken by its notation (see "Why kana
    are safe here" above); everything else is read as text."""
    notation = lone_kana_notation(text)
    if notation is not None:
        try:
            return say_kana(notation, style, speed=speed, sample_rate=sample_rate, hold=LONE_KANA_HOLD_S)
        except _NotationRefused:
            logger.info("Voice engine refused the notation %r; reading %r as text", notation, text)
    query = _json(_request("POST", "/audio_query", params={"text": text, "speaker": style}), "/audio_query")
    if not isinstance(query, dict):
        raise TTSFailed("the voice engine returned an audio query that is not an object")
    query.update(speedScale=speed, outputSamplingRate=sample_rate, outputStereo=False)
    return _synthesize(query, style, sample_rate)


def say_kana(notation: str, style: int, *, speed: float = 1.0, sample_rate: int = DIALOGUE_RATE,
             level_pitch: bool = False, pad: float | None = None, hold: float | None = None) -> Pcm:
    """Speak a kana notation ("ハ'", "ア'ア"). `hold` is the least time
    the last vowel lasts (LONE_KANA_HOLD_S); `level_pitch` holds every
    voiced mora on the first one's pitch, so a long vowel is one steady
    note rather than a fall; `pad` sets the silence either side. The
    last two are the kana deck's (scripts/build_kana_audio.py)."""
    response = _request("POST", "/accent_phrases",
                        params={"text": notation, "speaker": style, "is_kana": "true"})
    if response.status_code == 400:
        raise _NotationRefused(notation)
    phrases = _json(response, "/accent_phrases")
    if hold is not None and phrases and phrases[-1].get("moras"):
        last = phrases[-1]["moras"][-1]
        last["vowel_length"] = max(last.get("vowel_length") or 0.0, hold)
    if level_pitch:
        voiced = [m for phrase in phrases for m in phrase["moras"] if m.get("pitch")]
        for mora in voiced[1:]:
            mora["pitch"] = voiced[0]["pitch"]
    query = dict(_QUERY_DEFAULTS, accent_phrases=phrases, kana=notation,
                 speedScale=speed, outputSamplingRate=sample_rate)
    if pad is not None:
        query["prePhonemeLength"] = query["postPhonemeLength"] = pad
    return _synthesize(query, style, sample_rate)


# ── Assembling and encoding ──────────────────────────────────────

def silence(seconds: float, rate: int) -> Pcm:
    return Pcm(b"\x00\x00" * max(0, round(seconds * rate)), rate)


def join(parts: list[Pcm]) -> Pcm:
    if not parts:
        raise TTSFailed("nothing to join")
    rate = parts[0].rate
    if any(part.rate != rate for part in parts):
        raise TTSFailed("cannot join clips at different sample rates")
    return Pcm(b"".join(part.frames for part in parts), rate)


def encode_mp3(pcm: Pcm, *, kbps: int = DIALOGUE_KBPS, out_rate: int | None = None) -> bytes:
    """One MP3 at a CONSTANT bitrate. lameenc writes no Xing header, so
    a variable-bitrate file would report a wrong duration -- and the
    exam player draws a seek bar and a clock from that duration.
    `out_rate` resamples on the way (LAME's own resampler): the kana
    voicebank is recorded at 44.1 kHz and the kana set is 48 kHz.

    Imported here rather than at the top so that importing this module
    (and study/exam_tts.py, which main.py imports to mount the audio
    directory) does not need the encoder."""
    import lameenc

    encoder = lameenc.Encoder()
    encoder.set_bit_rate(kbps)
    encoder.set_in_sample_rate(pcm.rate)
    encoder.set_out_sample_rate(out_rate or pcm.rate)
    encoder.set_channels(1)
    encoder.set_quality(2)
    encoder.silence()
    data = bytes(encoder.encode(pcm.frames)) + bytes(encoder.flush())
    if not data:
        raise TTSFailed("the MP3 encoder produced nothing")
    return data


# MPEG audio frame headers, for mp3_summary. Index 0 is "free" and 15
# is invalid in both tables.
_MPEG1_KBPS = (0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320)
_MPEG2_KBPS = (0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160)
_MPEG_RATES = {3: (44100, 48000, 32000), 2: (22050, 24000, 16000), 0: (11025, 12000, 8000)}


def mp3_summary(data: bytes) -> dict:
    """What an MP3 is, read off its Layer III frame headers: sample rate,
    channels, the set of bitrates used (one, for a constant-bitrate
    file), frame count and duration. Enough to hold a generated clip to
    its spec without a decoder -- scripts/build_kana_audio.py --check
    and the tests use it."""
    rates, channels, kbps, frames, samples = set(), set(), set(), 0, 0
    i = 10 + int.from_bytes(data[6:10], "big") if data[:3] == b"ID3" else 0
    while i + 4 <= len(data):
        b1, b2, b3 = data[i + 1], data[i + 2], data[i + 3]
        version, layer = (b1 >> 3) & 3, (b1 >> 1) & 3
        rate_index, kbps_index = (b2 >> 2) & 3, b2 >> 4
        if (data[i] != 0xFF or (b1 & 0xE0) != 0xE0 or version == 1 or layer != 1
                or rate_index == 3 or kbps_index in (0, 15)):
            i += 1
            continue
        rate = _MPEG_RATES[version][rate_index]
        bitrate = (_MPEG1_KBPS if version == 3 else _MPEG2_KBPS)[kbps_index]
        per_frame = 1152 if version == 3 else 576
        size = per_frame // 8 * bitrate * 1000 // rate + ((b2 >> 1) & 1)
        rates.add(rate)
        channels.add(1 if b3 >> 6 == 3 else 2)
        kbps.add(bitrate)
        frames += 1
        samples += per_frame
        i += size
    rate = next(iter(rates)) if len(rates) == 1 else None
    return {
        "sample_rate": rate,
        "channels": next(iter(channels)) if len(channels) == 1 else None,
        "kbps": sorted(kbps),
        "frames": frames,
        "seconds": samples / rate if rate else 0.0,
    }


if not configured():
    logger.warning(
        "No voice engine configured (VOICEVOX_URL is unset): exam listening, dictation "
        "and /api/tts audio will be unavailable. See backend/.env.example."
    )
