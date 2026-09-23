# ── 聴解 (listening) audio: the clip store ────────────────────────
# Where every synthesized clip lives, what it is called, and how a
# dialogue becomes one file. The speaking itself is study/voice_engine.py
# (a self-hosted VOICEVOX Nemo engine, plan 113 / docs/adr/0018); this
# module only reaches it through that module's say() and encode_mp3().
#
# It used to hold edge-tts -- a client for Microsoft Edge's consumer
# "Read Aloud" service, reached without an account. No licence covers
# that for a product that is sold, which is why it is gone rather than
# kept as a fallback: a fallback is a path that ships.
#
# Audio is synthesized once per distinct script (content-keyed, see
# content_key's own comment) and served from disk forever after, never
# regenerated per learner or per request -- until the VOICE changes,
# which is what the voice epoch below is for.
import contextlib
import hashlib
import json
import logging
import os
import tempfile
import threading
from functools import lru_cache

from study import voice_engine as engine
from study.voice_engine import TTSFailed  # noqa: F401 -- re-exported: every caller imports it from here

logger = logging.getLogger(__name__)

_BASE_DIR = os.path.dirname(os.path.dirname(__file__))
# Where clips live when EXAM_AUDIO_DIR is unset or unusable. In-repo, so
# a dev checkout needs no configuration at all; wiped on every deploy,
# which is fine because a missing clip is re-synthesized on demand
# (study/exam_audio_repair.py).
_FALLBACK_DIR = os.path.join(_BASE_DIR, "datas", "exam_audio")


def _usable(path: str) -> bool:
    """Can this process create `path` and write a file inside it?

    Asked rather than assumed, because in production the answer was no:
    EXAM_AUDIO_DIR was set to /data/exam_audio while the persistent disk
    render.yaml declares was not actually mounted on the instance, so
    os.makedirs recursed up to mkdir("/data") on a read-only root and
    raised PermissionError. That escaped as an *unexpected* error --
    past synthesize_dialogue, past every generator's `except TTSFailed`
    and `except GenerationFailed` -- and killed the whole listening
    paper rather than one item.

    A real write, not os.access: makedirs(exist_ok=True) succeeds on an
    existing read-only directory without proving anything, and
    os.access answers for the wrong thing entirely when the process
    runs as root."""
    probe = os.path.join(path, ".write-probe")
    try:
        os.makedirs(path, exist_ok=True)
        with open(probe, "wb"):
            pass
        os.remove(probe)
    except OSError as e:
        logger.warning("Exam audio directory %s is not usable: %s", path, e)
        return False
    return True


@lru_cache(maxsize=1)
def _resolve_audio_dir() -> str:
    """The one directory clips are written to AND served from, resolved
    once per process (main.py mounts what this returns, so a second
    opinion here would serve files from a place nothing writes to).

    On Render, EXAM_AUDIO_DIR points at the mounted persistent disk
    (render.yaml mounts it at /data) so generated audio survives a
    deploy -- the container filesystem outside that mount is wiped on
    every deploy, while the URL naming the file is stored permanently in
    exam_papers. When that directory cannot be written to, falling back
    keeps listening exams working (audio then only lasts until the next
    deploy, and is re-synthesized on demand after it) instead of taking
    the whole section down with the disk. The log line is an error, not
    a warning: the fallback is a way to stay up, never the intended
    configuration."""
    preferred = os.environ.get("EXAM_AUDIO_DIR") or _FALLBACK_DIR
    if _usable(preferred):
        return preferred
    for alternative in (_FALLBACK_DIR, os.path.join(tempfile.gettempdir(), "exam_audio")):
        if alternative != preferred and _usable(alternative):
            logger.error(
                "EXAM_AUDIO_DIR=%s cannot be written to -- writing and serving exam audio "
                "from %s instead. Clips will not survive a deploy (they are re-synthesized "
                "on demand); fix the persistent disk mount to make them permanent.",
                preferred, alternative,
            )
            return alternative
    logger.error(
        "No writable directory for exam audio (tried %s): listening synthesis will fail.",
        preferred,
    )
    return preferred


def audio_dir() -> str:
    """Public name for the resolved directory -- imported by main.py's
    static mount and by study/exam_audio_repair.py."""
    return _resolve_audio_dir()


# ── The voice epoch ──────────────────────────────────────────────
# A clip made before the current voice is never served. The marker file
# below holds the voice revision (voice_engine.VOICE_REV); when it is
# missing or names another revision it is rewritten, and its mtime from
# then on is the EPOCH: a clip whose file is older than that was made by
# an earlier voice and counts as missing. Deploying a new voice
# therefore retires every old clip at once, with no list to keep:
#
#   - an exam or dictation clip is remade in place the next time anyone
#     asks for it (main.py's mount, study/exam_audio_repair.py), or all
#     at once by scripts/revoice_audio.py;
#   - a word clip (study/word_tts.py) is remade by the /api/tts request
#     that wants it.
#
# In place, under the same name: the name is the content key, and that
# is stored in dictation_log and inside exam_papers, so it cannot move.
_EPOCH_MARKER = ".voice-rev"

_epoch_lock = threading.Lock()
_epochs: dict[str, float] = {}


def _stamp_epoch(directory: str) -> float:
    marker = os.path.join(directory, _EPOCH_MARKER)
    try:
        with open(marker, encoding="utf-8") as f:
            if f.read().strip() == engine.VOICE_REV:
                return os.path.getmtime(marker)
    except OSError:
        pass
    try:
        os.makedirs(directory, exist_ok=True)
        fd, partial = tempfile.mkstemp(dir=directory, suffix=".part")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(f"{engine.VOICE_REV}\n")
        os.replace(partial, marker)
    except OSError as e:
        # A directory that cannot take a marker cannot take a clip
        # either, so nothing could be remade anyway: serving what is
        # there beats serving nothing.
        logger.error("Could not stamp voice revision %s in %s: %s", engine.VOICE_REV, directory, e)
        return 0.0
    logger.info("Voice revision %s starts now in %s: older clips will be remade", engine.VOICE_REV, directory)
    return os.path.getmtime(marker)


def voice_epoch() -> float:
    """When the current voice started, for the clip store in use."""
    directory = audio_dir()
    with _epoch_lock:
        if directory not in _epochs:
            _epochs[directory] = _stamp_epoch(directory)
        return _epochs[directory]


def is_current(path: str) -> bool:
    """Does `path` exist, made by the current voice?"""
    epoch = voice_epoch()
    try:
        return os.path.getmtime(path) >= epoch
    except OSError:
        return False


def is_stale(path: str) -> bool:
    """Does `path` exist, but predate the current voice?"""
    return os.path.exists(path) and not is_current(path)


def write_clip(directory: str, path: str, data: bytes) -> None:
    """Write `data` beside `path` and rename it in.

    os.replace is atomic, which every existence check here depends on
    for its meaning: a file that exists is a COMPLETE clip. Written in
    place instead, a process restart mid-write -- or two workers
    restoring the same missing clip at once
    (study/exam_audio_repair.py) -- leaves a truncated or interleaved
    file that every later call then happily returns, forever, because
    it exists. It also keeps a clip that is being remade served, whole,
    until the new one lands.

    OSError -> TTSFailed like every other failure in this module: a
    directory that turned unwritable after startup costs one clip, not
    the paper and not the request."""
    # The epoch is stamped BEFORE the first clip is written, never after
    # it: stamped lazily by the next freshness check instead, the marker
    # would postdate the very clip it was meant to vouch for, and that
    # clip would read as stale the moment it existed.
    voice_epoch()
    try:
        os.makedirs(directory, exist_ok=True)
        fd, partial = tempfile.mkstemp(dir=directory, suffix=".part")
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(data)
            os.replace(partial, path)
        except OSError:
            # Best-effort: the write failure is the one worth reporting.
            with contextlib.suppress(OSError):
                os.remove(partial)
            raise
    except OSError as e:
        raise TTSFailed(f"Could not write {path}: {e}")


# ── Who speaks which line ────────────────────────────────────────
# A script's speaker labels map onto voice_engine's slots: the narrator
# (and the reader of every single-voice clip) is slot 0, the dialogue's
# A and B are slots 1 and 2 -- a woman and a man, which is what the
# listening generator's prompt tells the model they are. Three distinct
# voices, the way a real JLPT listening track is performed.
#
# A label the model invents instead (it sometimes writes 女 / 男, or
# 女の人) takes the dialogue slot its first character names when that
# slot is free, and otherwise the first free one, in order of
# appearance. Never slot 0: a participant must not sound like the
# narrator.
FIXED_SLOTS = {"narrator": 0, "reader": 0, "A": 1, "B": 2}
_GENDERED_SLOTS = {"女": 1, "男": 2}


def voice_slots(turns: list[dict]) -> dict:
    """Speaker label -> voice slot, for one script."""
    labels = list(dict.fromkeys(t["speaker"] for t in turns))
    slots = {label: FIXED_SLOTS[label] for label in labels if label in FIXED_SLOTS}
    taken = set(slots.values())
    for label in labels:
        if label in slots:
            continue
        slot = _GENDERED_SLOTS.get(str(label)[:1])
        if slot is None or slot in taken:
            slot = 1
            while slot in taken:
                slot += 1
        slots[label] = slot
        taken.add(slot)
    return slots


def content_key(turns: list[dict], rate: str = "") -> str:
    # Keyed by the turns' own content, not by exam_id/question_id: no
    # generator today gets its own exam_id passed down (routes/exams.py
    # calls every generator as generate(seed), exam_id stays private to
    # the route layer) -- deriving the cache key from content itself
    # sidesteps threading exam_id through every generator's call
    # signature, and as a bonus de-duplicates identical dialogue text for
    # free (same script -> same audio file, even across different
    # exam_ids/regenerations) instead of ever re-synthesizing text this
    # function has already produced audio for.
    # `rate` joins the key because it changes the AUDIO: two clips of
    # the same script at different speeds are different files, and a
    # key that ignored it would serve one where the other was asked
    # for. Empty appends nothing at all, so every clip synthesized
    # before this argument existed keeps the name it already has on
    # disk and in its stored paper.
    raw = json.dumps([[t["speaker"], t["textJp"]] for t in turns], ensure_ascii=False)
    if rate:
        raw += f"@rate={rate}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


# Silence between two turns, and between a turn and the narrator --
# longer there, the way a recorded paper leaves room between the scene,
# the conversation and the question.
_TURN_GAP_S = 0.4
_NARRATOR_GAP_S = 0.8


def synthesize_dialogue(turns: list[dict], rate: str = "", *, force: bool = False) -> str:
    """turns: [{"speaker": <label>, "textJp": "..."}], read in order onto
    ONE combined audio clip -- QuestionRenderer.jsx's existing
    ListeningBlock expects a single question.audioSrc, not one clip per
    turn (see its own AUDIO NOTE comment). `speaker` picks the voice
    (voice_slots above): "narrator" for scene-setting and question lines,
    "A"/"B" for the two dialogue participants. `rate` is a speaking rate
    in the app's percentage form ("-10%"); it is part of the key.

    The turns are joined as samples, with a pause between them, and
    encoded ONCE -- rather than one MP3 per turn concatenated, which is
    what the edge-tts version did and why its dialogues ran together
    with no gap at all.

    Idempotent by design: returns the existing URL without any work at
    all if this exact content was already synthesized by the current
    voice. Necessary because routes/exams.py's generation worker only
    persists a paper to exam_papers once ALL its mondai succeed -- a
    retry after a later mondai fails validation shouldn't re-synthesize
    audio an earlier, otherwise-discarded attempt already produced.
    `force` remakes it anyway (scripts/revoice_audio.py,
    build_dictation_audio --force); the old file keeps being served
    until the new one is renamed over it.
    """
    directory = audio_dir()
    key = content_key(turns, rate)
    filename = f"{key}.mp3"
    path = os.path.join(directory, filename)
    url = f"/exam-audio/{filename}"
    if not force and is_current(path):
        return url

    try:
        speed = engine.speed_scale(rate)
    except ValueError as e:
        raise TTSFailed(str(e))
    slots = voice_slots(turns)
    styles: dict[int, int] = {}
    parts = []
    previous = None
    for turn in turns:
        slot = slots[turn["speaker"]]
        if slot not in styles:
            styles[slot] = engine.style_for_slot(slot)
        if previous is not None:
            at_narrator = slot != previous and 0 in (slot, previous)
            parts.append(engine.silence(_NARRATOR_GAP_S if at_narrator else _TURN_GAP_S,
                                        engine.DIALOGUE_RATE))
        parts.append(engine.say(turn["textJp"], styles[slot], speed=speed,
                                sample_rate=engine.DIALOGUE_RATE))
        previous = slot

    write_clip(directory, path, engine.encode_mp3(engine.join(parts), kbps=engine.DIALOGUE_KBPS))
    return url
