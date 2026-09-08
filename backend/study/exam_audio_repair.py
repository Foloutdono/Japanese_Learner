# ── Restoring a listening clip whose file is gone ────────────────
# study/exam_tts.py's contract is "synthesized once, served from disk
# forever after". The second half of that only holds while the disk
# outlives the deploy, and in production it did not: EXAM_AUDIO_DIR
# named a persistent-disk path that was not actually mounted, so every
# clip landed on the container filesystem and was wiped on the next
# deploy -- while the URL naming it stayed baked into the stored paper
# in exam_papers forever. The result was a listening exam that served
# perfectly good questions pointing at audio that no longer existed.
#
# Nothing about that is unrecoverable, because the clip is a pure
# function of a script the paper still carries: `scriptJp` ships inside
# every listening question (the frontend reveals it in review), and it
# is the very text synthesize_dialogue built the clip FROM. So a missing
# file is re-synthesized on demand from the paper that references it --
# free, idempotent, and needing no state that a deploy can wipe.
#
# This is a repair path, not the normal path. A correctly mounted disk
# means it never runs after the first deploy; an unmounted one means it
# runs once per clip per deploy. Either way the learner gets audio.
import logging
import os
import re
import threading

from core.db import db_conn
from study.exam_tts import TTSFailed, audio_dir, content_key, synthesize_dialogue

logger = logging.getLogger(__name__)

# Exactly the shape exam_tts.content_key produces (sha256 hex, 24 chars)
# plus the extension synthesize_dialogue appends. Matching strictly is
# what keeps this route from being an open synthesis endpoint: a name
# that is not a content key cannot address any work at all, and a name
# that IS one still has to match a script stored in a real paper below.
_CLIP_NAME = re.compile(r"^([0-9a-f]{24})\.mp3$")

# One lock per clip, not one global lock: a listening paper's questions
# all load at once, so a page open right after a deploy asks for eight
# missing clips simultaneously. Sharing a lock would synthesize them one
# after another with seven requests waiting on the first; per-clip locks
# only serialize duplicate work on the SAME clip, which is exactly the
# work worth collapsing.
_locks_guard = threading.Lock()
_locks: dict[str, threading.Lock] = {}


def _lock_for(key: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(key, threading.Lock())


def turns_from_script(script_jp: str) -> list[dict] | None:
    """The inverse of exam_listening_gen.py's
    "\\n".join(f"{speaker}: {textJp}") -- None if the text does not have
    that shape. partition() splits on the FIRST ": ", so a spoken line
    that itself contains one survives the round trip intact.

    Reconstruction being merely plausible is not enough to synthesize
    from, which is why every caller checks the result against the
    content key rather than trusting this."""
    turns = []
    for line in script_jp.split("\n"):
        speaker, sep, text = line.partition(": ")
        if not sep or not speaker or not text:
            return None
        turns.append({"speaker": speaker, "textJp": text})
    return turns or None


def _questions_with_audio(node):
    """Every dict carrying an audioSrc, anywhere in a paper. A recursive
    walk rather than sections -> mondai -> questions: paper shapes
    already differ per generator (reading nests questions under
    passages), and a repair path is the last place that should break
    when one of them gains a level of nesting."""
    if isinstance(node, dict):
        if "audioSrc" in node:
            yield node
        for value in node.values():
            yield from _questions_with_audio(value)
    elif isinstance(node, list):
        for value in node:
            yield from _questions_with_audio(value)


def _turns_for_clip(filename: str, key: str) -> list[dict] | None:
    """The script a stored paper says this clip was made from, verified
    against the clip's own content key -- so this can only ever
    re-synthesize audio that a real paper already refers to, exactly as
    it was first synthesized.

    The LIKE scan reads every paper row. That is fine here and nowhere
    else: exam_papers holds a handful of rows per exam id, and this runs
    only when a file is actually missing. `filename` is checked against
    _CLIP_NAME before it gets here, so it carries no LIKE wildcards."""
    src = f"/exam-audio/{filename}"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT paper FROM exam_papers WHERE paper::text LIKE %s",
                (f"%{filename}%",),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    for (paper,) in rows:
        for question in _questions_with_audio(paper):
            if question.get("audioSrc") != src:
                continue
            turns = turns_from_script(question.get("scriptJp") or "")
            if turns and content_key(turns) == key:
                return turns
    return None


def restore_clip(filename: str) -> bool:
    """Re-synthesize a missing clip from the paper that references it.
    True if the file is on disk afterwards.

    Never raises: the caller is main.py's static mount serving a
    request, and every failure here has the same correct answer for the
    learner -- 404, the same one they would have got without this."""
    match = _CLIP_NAME.match(filename)
    if not match:
        return False
    key = match.group(1)

    with _lock_for(key):
        if os.path.exists(os.path.join(audio_dir(), filename)):
            return True  # another request restored it while this one waited

        try:
            turns = _turns_for_clip(filename, key)
        except Exception:
            logger.exception("Could not look up the script for exam audio %s", filename)
            return False
        if turns is None:
            logger.warning("No stored listening script matches exam audio %s", filename)
            return False

        try:
            synthesize_dialogue(turns)
        except TTSFailed as e:
            logger.warning("Could not re-synthesize exam audio %s: %s", filename, e)
            return False

    logger.info("Re-synthesized missing exam audio %s", filename)
    return True
