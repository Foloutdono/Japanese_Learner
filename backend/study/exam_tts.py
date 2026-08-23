# ── 聴解 (listening) speech synthesis ─────────────────────────────
# edge-tts (https://pypi.org/project/edge-tts/), a thin async client
# for Microsoft Edge's free consumer "Read Aloud" service -- the exact
# same voices a browser's built-in read-aloud feature uses, reached
# directly rather than through a paid proxy. No API key, no vendor
# account, no per-character billing.
#
# This project evaluated two paid options first (Google Cloud TTS, then
# freetts.org) before landing here. freetts.org specifically turned out
# to only offer its "no API key" claim for its own website widget --
# live-testing (not just reading its docs) showed POST /api/tts 403s
# with "This endpoint is for browser use", and /api/v1/tts (the real
# programmatic path) 401s without an x-api-key header that only exists
# on a paid PRO/Creator plan. Its own /voices catalog turned out to
# blend real free edge voices ("Source": "edge") with paid Azure/Google
# voices it was reselling access to -- confirmed by calling edge_tts's
# OWN list_voices() directly, which returns only the 2 genuinely free
# ja-JP voices (KeitaNeural, NanamiNeural), not the larger Azure/Google
# set freetts.org's catalog implied were free.
#
# Audio is synthesized once per distinct dialogue script (content-
# keyed, see synthesize_dialogue's own comment) and served from disk
# forever after, never regenerated per learner/request -- this app's
# real volume is a handful of items per level, not a live per-request
# workload, so the free service's informal nature is a good fit.
import asyncio
import hashlib
import json
import logging
import os
from functools import lru_cache

import edge_tts

logger = logging.getLogger(__name__)

_BASE_DIR = os.path.dirname(os.path.dirname(__file__))
_AUDIO_DIR = os.path.join(_BASE_DIR, "datas", "exam_audio")


class TTSFailed(Exception):
    """Raised on any synthesis failure -- callers (exam_listening_gen.py)
    catch this the same way every other generator catches
    GenerationFailed/RuntimeError from an LLM call: skip the item,
    don't crash the whole paper."""


def _run(coro):
    # Every caller here (routes/exams.py's sync FastAPI handlers, via
    # exam_listening_gen.py) is plain sync code, not an async route --
    # FastAPI runs those in a worker thread, so asyncio.run() starting
    # a fresh event loop per call is safe here (no already-running loop
    # on this thread to conflict with).
    return asyncio.run(coro)


@lru_cache(maxsize=None)
def _ja_voices() -> tuple[str, ...]:
    async def _list():
        voices = await edge_tts.list_voices()
        return sorted(v["ShortName"] for v in voices if v["Locale"] == "ja-JP")

    try:
        names = _run(_list())
    except Exception as e:
        raise TTSFailed(f"Could not list ja-JP voices: {e}")
    if not names:
        raise TTSFailed("No ja-JP voices available")
    return tuple(names)


def voice_for_speaker(speaker_index: int) -> str:
    """Deterministic speaker-index -> voice-name mapping, so the same
    speaker slot always gets the same voice within one synthesis run.
    Only 2 free ja-JP voices exist (Keita/Nanami) -- with 3 speaker
    slots (narrator + two dialogue participants), one voice is reused
    for two of them; still gives every dialogue 2 distinct voices,
    which is what actually matters for telling participants apart."""
    voices = _ja_voices()
    return voices[speaker_index % len(voices)]


def synthesize(text: str, voice_name: str) -> bytes:
    async def _synth():
        chunks = []
        communicate = edge_tts.Communicate(text, voice_name)
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        return b"".join(chunks)

    try:
        audio = _run(_synth())
    except Exception as e:
        raise TTSFailed(f"Synthesis failed for voice {voice_name}: {e}")
    if not audio:
        raise TTSFailed(f"Synthesis returned no audio for voice {voice_name}")
    return audio


def _content_key(turns: list[dict]) -> str:
    # Keyed by the turns' own content, not by exam_id/question_id: no
    # generator today gets its own exam_id passed down (routes/exams.py
    # calls every generator as generate(seed), exam_id stays private to
    # the route layer) -- deriving the cache key from content itself
    # sidesteps threading exam_id through every generator's call
    # signature, and as a bonus de-duplicates identical dialogue text for
    # free (same script -> same audio file, even across different
    # exam_ids/regenerations) instead of ever re-synthesizing text this
    # function has already produced audio for.
    raw = json.dumps([[t["speaker"], t["textJp"]] for t in turns], ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def synthesize_dialogue(turns: list[dict]) -> str:
    """turns: [{"speaker": <any hashable label>, "textJp": "..."}], read
    in order onto ONE combined audio clip -- QuestionRenderer.jsx's
    existing ListeningBlock expects a single question.audioSrc, not one
    clip per turn (it already ships a working <audio> player + "pending"
    placeholder + devMode script-reveal built for exactly this shape;
    see its own AUDIO NOTE comment). `speaker` is just a same-voice
    grouping key within this call, not literally a gender/identity --
    e.g. "narrator" for scene-setting/question lines read by a third
    voice, "A"/"B" for the two dialogue participants.

    Concatenates each turn's MP3 bytes directly rather than pulling in
    an audio-editing dependency (ffmpeg/pydub) for one join operation --
    each edge-tts response is itself a complete, self-framed MPEG audio
    stream, and raw concatenation of such streams plays back correctly
    end-to-end in every mainstream browser/media player. No inter-turn
    silence padding; acceptable for a study app, not attempting to be
    broadcast-quality.

    Idempotent by design: returns the existing URL without any network
    call at all if this exact turn content has been synthesized before.
    Necessary because routes/exams.py's generation worker only persists
    a paper to exam_papers once ALL its mondai succeed -- a retry after
    a later mondai fails validation shouldn't re-synthesize audio an
    earlier, otherwise-discarded attempt already produced.
    """
    os.makedirs(_AUDIO_DIR, exist_ok=True)
    key = _content_key(turns)
    filename = f"{key}.mp3"
    path = os.path.join(_AUDIO_DIR, filename)
    url = f"/exam-audio/{filename}"
    if os.path.exists(path):
        return url

    seen_speakers: list = []
    chunks = []
    for turn in turns:
        speaker = turn["speaker"]
        if speaker not in seen_speakers:
            seen_speakers.append(speaker)
        voice = voice_for_speaker(seen_speakers.index(speaker))
        chunks.append(synthesize(turn["textJp"], voice))

    with open(path, "wb") as f:
        for chunk in chunks:
            f.write(chunk)
    return url
