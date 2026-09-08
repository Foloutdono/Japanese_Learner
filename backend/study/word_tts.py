# ── 単語の音声 — audio for a card's reading ──────────────────────
# docs/adr/0006 sent study audio to the browser's own SpeechSynthesis
# and kept edge-tts for exams, on three grounds: an endpoint for
# ARBITRARY text is an unbounded proxy to a consumer service, its disk
# use is unbounded too, and every play costs a round trip. All three
# arguments are about arbitrary text. A card's reading is not arbitrary:
# it is one of a fixed set of strings this app ships in content/, the
# same "small, fixed, and worth caching" shape the ADR reserved edge-tts
# for.
#
# It needs to exist because the browser path does not reach a large part
# of the phones this app is used on:
#
#   - Android's WebView -- what the Capacitor shell runs in -- has no
#     Web Speech API at all. window.speechSynthesis is undefined, so
#     there is nothing to fall back FROM.
#   - Android Chrome has the API, but a Japanese voice only if the
#     device's TTS engine has Japanese data installed, which on a
#     French-locale phone it usually does not.
#   - iOS ships Kyoko, but refuses to speak unless the very first
#     speak() of the page happened inside a user gesture, and answers a
#     refusal with silence rather than an error.
#
# The frontend still tries the device first (lib/audio/speech.js): it is
# instant, free, and needs no network. This is what it falls back to.
#
# ── What keeps it from being the proxy the ADR refused ───────────
# Text is accepted only if it is a reading (or a written form) this app
# ships -- membership in the decks below, plus the JMdict pool the
# dictionary itself serves; not a length check or a character class. So
# the set of clips that can ever exist is the content set, every one of
# them is worth caching, and no input a caller invents reaches the
# synthesizer at all. The store is capped on top of that, since the pool
# is far larger than any learner will ever hear.
import contextlib
import logging
import os
import re
import sqlite3
import tempfile
import threading

from functools import lru_cache

import content.vocab_jmdict_data as jmdict
from content.kana_data import get_all_kana
from content.kanji_data import KANJI_BY_LEVEL
from content.vocab_data import VOCAB_BY_LEVEL
from study.exam_tts import TTSFailed, audio_dir, content_key, synthesize, voice_for_speaker

logger = logging.getLogger(__name__)

# A packed reading field carries every reading a word or kanji has:
# vocab_data.py joins with "/", the kanji deck with "・", and both decks
# have entries using ";". Speaking the packed string reads the
# separators out loud ("まいげつ slash まいつき"), so one reading is
# spoken -- the first, which is the data's own primary (see
# frontend/src/domain/readingPick.js on why the source order is where a
# primary reading is marked).
_SEPARATORS = re.compile(r"[/・;；、]")


def spoken_form(text: str) -> str:
    """The one reading to actually say, out of whatever the card
    carried. Mirrors lib/audio/speech.js's spokenForm exactly -- the
    client normalizes before asking, and this normalizes again so the
    catalog is only ever consulted with the same shape it was built
    from.

    The okurigana dot goes away rather than truncating: さ.げる is the
    word さげる, of which only さ is written inside the kanji, and
    "さ" alone is not what a learner is trying to hear."""
    if not isinstance(text, str):
        return ""
    first = _SEPARATORS.split(text, 1)[0]
    # "~" (and its fullwidth twin) marks a variant form, not a reading.
    return first.lstrip("~～").replace(".", "").replace("．", "").strip()


@lru_cache(maxsize=1)
def _catalog() -> frozenset[str]:
    """Every string this app can ask to have spoken: each deck entry's
    written form and each of its readings, normalized the way an
    incoming request will be.

    Built from the content modules rather than the database -- these are
    the decks themselves, identical for every learner, so this is a
    constant of the deployment and not per-user state."""
    words: set[str] = set()

    def add(raw: str | None) -> None:
        for part in _SEPARATORS.split(raw or ""):
            form = spoken_form(part)
            if form:
                words.add(form)

    for level_entries in VOCAB_BY_LEVEL.values():
        for entry in level_entries:
            add(entry.get("kanji"))
            add(entry.get("kana"))
    for level_entries in KANJI_BY_LEVEL.values():
        for entry in level_entries:
            add(entry.get("kanji"))
            add(entry.get("kana"))
    for entry in get_all_kana():
        add(entry.get("kana"))

    logger.info("Study-audio catalog: %d speakable forms", len(words))
    return frozenset(words)


def speakable(text: str) -> str | None:
    """The text to synthesize, or None if this app never says it."""
    form = spoken_form(text)
    if not form:
        return None
    if form in _catalog():
        return form
    # The dictionary reaches past the curated decks into the JMdict pool,
    # and its entries have the same speaker button on them. That pool is
    # shipped data as well -- 292k rows in a SQLite file that is
    # deliberately never loaded into memory (see
    # content/vocab_jmdict_data.py's MEMORY NOTE), so membership is asked
    # of it per request rather than added to the set above. Two indexed
    # lookups, ~0.03 ms.
    try:
        return form if jmdict.has_form(form) else None
    except sqlite3.Error as e:
        # A shipped file that cannot be read is the dictionary's problem
        # to report, not this route's: answer "cannot say it" and let the
        # learner have silence rather than a 500 on an audio element.
        logger.warning("Could not consult the JMdict pool for %r: %s", form, e)
        return None


# ── The clip store ───────────────────────────────────────────────
# A subdirectory of the exam audio store, so one setting (EXAM_AUDIO_DIR)
# and one writability probe cover both. Separate from the exam clips
# beside it because these are DISPOSABLE in a way those are not: the
# text is in the URL, so any clip deleted here is regenerated by the
# next request that wants it, while an exam clip's script only exists
# inside a stored paper. That is what makes the cap below safe.
_WORDS_SUBDIR = "words"
# Roughly ten thousand clips at the ~10 KB a spoken word comes to. The
# catalog is larger than that, but a learner touches a few hundred
# words; the cap exists so a crawler cannot turn the whole catalog into
# disk on a volume the SRS data also lives on.
_MAX_BYTES = 100 * 1024 * 1024
# Evicting exactly down to the cap would evict again on the very next
# write. Falling to three quarters buys a few thousand clips between
# sweeps.
_EVICT_TO = int(_MAX_BYTES * 0.75)

# Same per-key locking as study/exam_audio_repair.py, for the same
# reason: a screen asking for one word twice (a replay button pressed
# during the first fetch) should wait, not synthesize twice.
_locks_guard = threading.Lock()
_locks: dict[str, threading.Lock] = {}


def _lock_for(key: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(key, threading.Lock())


def words_dir() -> str:
    return os.path.join(audio_dir(), _WORDS_SUBDIR)


def _evict_if_over_cap(directory: str) -> None:
    """Oldest first, by modification time, until the store is back under
    _EVICT_TO. Runs only after a clip was actually written -- a cache
    hit costs no directory scan."""
    try:
        entries = []
        total = 0
        with os.scandir(directory) as it:
            for entry in it:
                if not entry.is_file():
                    continue
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
        logger.info("Study-audio store trimmed to %d bytes", total)
    except OSError as e:
        # A full store is a housekeeping problem, never a reason to fail
        # the request that just successfully made a clip.
        logger.warning("Could not trim the study-audio store: %s", e)


def clip_for(text: str) -> str:
    """Path to the mp3 for `text`, synthesizing it if this is the first
    time anyone asked. Raises TTSFailed if it cannot be made, and
    ValueError if the text is not something this app says."""
    form = speakable(text)
    if not form:
        raise ValueError(f"not a reading this app teaches: {text!r}")

    directory = words_dir()
    key = content_key([{"speaker": "reader", "textJp": form}])
    path = os.path.join(directory, f"{key}.mp3")
    if os.path.exists(path):
        return path

    with _lock_for(key):
        if os.path.exists(path):
            return path
        # voice_for_speaker(0) rather than a name spelled out here: the
        # ja-JP voice list is edge-tts's to know, and exam_tts.py already
        # asks it (there are two, and this deterministically takes the
        # first, so one word always sounds the same).
        audio = synthesize(form, voice_for_speaker(0))
        # Written aside and renamed in, exactly as exam_tts.py does and
        # for the same reason: os.replace is atomic, so a file that
        # exists is a complete clip rather than however much of one
        # survived a restart.
        try:
            os.makedirs(directory, exist_ok=True)
            fd, partial = tempfile.mkstemp(dir=directory, suffix=".part")
            try:
                with os.fdopen(fd, "wb") as f:
                    f.write(audio)
                os.replace(partial, path)
            except OSError:
                with contextlib.suppress(OSError):
                    os.remove(partial)
                raise
        except OSError as e:
            raise TTSFailed(f"Could not write {path}: {e}")
        _evict_if_over_cap(directory)
    return path
