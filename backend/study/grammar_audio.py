# ── 発見の声 — the tour's voices (plan 187d) ──────────────────────
# A grammar point's tour plays its sentences: the examples it opens on
# (in the reader's voice, as a card's reading is) and the scene, where the
# other person and the learner each speak in a voice of their own -- the
# two dialogue speakers exam listening already uses (exam_tts's A and B,
# voice_engine.DEFAULT_VOICES' slots 1 and 2).
#
# Not an open speech endpoint, for study/word_tts.py's reasons (ADR
# 0006): a line is accepted only if the catalogue says it, by that
# speaker -- an example sentence, a twist, a line of a scene or one of
# the learner's replies -- so the clips that can ever exist are the
# content set, every one worth keeping. The store is capped on top of
# that, like the word store beside it, and a clip an earlier voice made
# is remade by the request that finds it (exam_tts's voice epoch).
#
# The clip is named by content_key over (speaker label, text), the same
# derivation the exam and dictation clips use, so
# scripts/build_grammar_audio.py and the request derive one name.
import logging
import os
import threading
from functools import lru_cache

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from study import voice_engine as engine
from study.exam_tts import (  # noqa: F401 -- TTSFailed: clip_for's contract
    FIXED_SLOTS, READER_SLOT, TTSFailed, audio_dir, content_key, is_current, write_clip,
)

logger = logging.getLogger(__name__)

# Who says a line, and the exam speaker label (so the voice slot) that
# speaks it: the reader for the examples and the twist, A for the other
# person in a scene, B for the learner.
SPEAKERS = {"reader": "reader", "them": "A", "me": "B"}

_SUBDIR = "grammar"
# The catalogue's lines come to a few thousand clips of ~20 KB.
_MAX_BYTES = 120 * 1024 * 1024
_EVICT_TO = int(_MAX_BYTES * 0.75)

_locks_guard = threading.Lock()
_locks: dict[str, threading.Lock] = {}


def _lock_for(key: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(key, threading.Lock())


@lru_cache(maxsize=1)
def catalog() -> dict[str, frozenset[str]]:
    """Every line the tours say, by who says it."""
    said: dict[str, set[str]] = {who: set() for who in SPEAKERS}
    for entries in GRAMMAR_POINTS_BY_LEVEL.values():
        for entry in entries:
            for example in entry.get("examples", []):
                if example.get("jp"):
                    said["reader"].add(example["jp"])
            tour = entry.get("tour")
            if not tour:
                continue
            said["reader"].update(twist["jp"] for twist in tour["twists"])
            scene = tour["scene"]
            for line in [*scene["lines"], scene["ask"]["cue"]]:
                said[line["who"]].add(line["jp"])
            # The learner's reply, whichever they pick, is heard in
            # their own voice.
            said["me"].update(scene["ask"]["choices"])
    return {who: frozenset(lines) for who, lines in said.items()}


def speakable(text: str, who: str) -> bool:
    return who in SPEAKERS and isinstance(text, str) and text in catalog()[who]


def clip_dir() -> str:
    return os.path.join(audio_dir(), _SUBDIR)


def clip_name(text: str, who: str) -> str:
    return content_key([{"speaker": SPEAKERS[who], "textJp": text}]) + ".mp3"


def _evict_if_over_cap(directory: str) -> None:
    try:
        entries, total = [], 0
        with os.scandir(directory) as it:
            for entry in it:
                if entry.is_file():
                    stat = entry.stat()
                    entries.append((stat.st_mtime, stat.st_size, entry.path))
                    total += stat.st_size
        if total <= _MAX_BYTES:
            return
        entries.sort()
        for _mtime, size, path in entries:
            if total <= _EVICT_TO:
                break
            os.remove(path)
            total -= size
        logger.info("Grammar-audio store trimmed to %d bytes", total)
    except OSError as e:
        logger.warning("Could not trim the grammar-audio store: %s", e)


def clip_for(text: str, who: str, *, force: bool = False) -> str:
    """Path to the mp3 of `text` said by `who`, made if it is missing or
    an earlier voice made it. ValueError if the catalogue does not say
    it; TTSFailed if it cannot be made."""
    if not speakable(text, who):
        raise ValueError(f"not a line the tours say: {who} {text!r}")
    directory = clip_dir()
    path = os.path.join(directory, clip_name(text, who))
    if not force and is_current(path):
        return path
    key = os.path.basename(path)
    with _lock_for(key):
        if not force and is_current(path):
            return path
        slot = FIXED_SLOTS[SPEAKERS[who]]
        pcm = engine.say(text, engine.style_for_slot(slot), speed=engine.tempo_for_slot(slot))
        write_clip(directory, path, engine.encode_mp3(pcm, kbps=engine.DIALOGUE_KBPS))
        _evict_if_over_cap(directory)
    return path


__all__ = ["SPEAKERS", "READER_SLOT", "TTSFailed", "catalog", "speakable", "clip_for", "clip_dir", "clip_name"]
