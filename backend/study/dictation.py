"""
書取 — dictation: the clip, and what the learner wrote down.

Two jobs, and they are the whole mode:

  1. THE COLLECTION IS READY. content/listening_clips.py is text; a
     dictation needs audio. Every line resolves to exactly one clip file
     whose name is derived from the line itself (study/exam_tts's
     content key), so the mapping needs no database, no manifest and no
     id allocation: the same line always names the same file, in a fresh
     clone and on a server that has been up for a year.
  2. THE ANSWER IS GRADED. Unlike every other sentence mode in this app
     (reading, translation), this one is NOT self-assessed. There is a
     single right answer and it is text, so the machine can say how
     close the learner got — and it must, because the learner cannot:
     they have not seen the sentence, so they have nothing to compare
     their own transcription against until it is revealed.

── Why grading is generous about script ──────────────────────
A learner who hears 「駅の前で友だちに会います」 correctly and writes
えきのまえでともだちにあいます has done the exercise. They have not
failed a listening test by not writing kanji — that is a different
skill, taught on a different line of this app. So every line carries a
kana reading beside its written form and the answer is graded against
both, keeping whichever scores better. `matched` reports which, so the
screen can show the diff against the form the learner was actually
writing.

── Why the play limit is not enforced here ───────────────────
The mode's rule is two listens. The clip is a static file behind
/exam-audio, and any file behind a URL can be fetched again — so the
limit is the player's (frontend/src/components/study/ClipPlayer.jsx),
and this module RECORDS what the player reports rather than pretending
to police it. That is the honest arrangement: `plays` in dictation_log
is a fact about the session, and a learner determined to defeat their
own practice was never going to be stopped by a counter.
"""
import difflib
import logging
import random
import re
import unicodedata
from functools import lru_cache

from content.listening_clips import BY_LEVEL, LEVELS, all_clips
from study.exam_tts import TTSFailed, content_key, synthesize_dialogue

logger = logging.getLogger(__name__)

# Two listens, and the number lives here rather than in the player so
# the rule is stated once: the route ships it to the screen, and the
# screen counts against it.
MAX_PLAYS = 2

# Every clip is one voice reading one line. The label is arbitrary
# (exam_tts groups turns by it to assign voices, and there is only one
# turn), but it is part of the content key, so changing it renames every
# file in the collection.
SPEAKER = "narrator"

# What a transcription may differ by without being a different answer:
# spacing of any kind, and the marks a listener has no way to hear.
# Kept deliberately short — 「は」 and 「わ」 are NOT the same answer, and
# neither are 「じ」 and 「ぢ」, because hearing the difference is
# precisely the skill.
#
# The 長音符 ー is NOT in here, though it looks like punctuation: it is a
# whole mora, plainly audible, and dropping it would mark けき correct
# for ケーキ. It survives the katakana fold below unchanged, so both
# sides of the comparison spell a long vowel the same way.
_IGNORED = re.compile(r"[\s、。,.!?！？・「」『』（）()〜~]+")


def _to_hiragana(text: str) -> str:
    """Katakana to hiragana, so テレビ and てれび are one answer. The
    same fold study/furigana.py applies for the same reason; done here
    on both sides of the comparison, never on stored data."""
    return "".join(
        chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c
        for c in text
    )


def normalize(text: str) -> str:
    """The form two transcriptions are compared in.

    NFKC first, because a phone's Japanese keyboard emits full-width
    punctuation and a laptop's emits half-width, and the difference is
    the keyboard's rather than the learner's."""
    if not isinstance(text, str):
        return ""
    return _IGNORED.sub("", _to_hiragana(unicodedata.normalize("NFKC", text)))


# ── The clip ─────────────────────────────────────────────────────
def clip_turns(jp: str) -> list[dict]:
    """The synthesizer's view of a line. One turn, so exam_tts's
    dialogue machinery produces a single clip with no joins."""
    return [{"speaker": SPEAKER, "textJp": jp}]


def clip_id(jp: str) -> str:
    """The line's permanent id: the content key of its own audio. Two
    things at once on purpose — the id the client sends back on submit,
    and the name of the file on disk — so a clip can never be addressed
    by an id whose audio belongs to different text."""
    return content_key(clip_turns(jp))


def clip_url(jp: str) -> str:
    return f"/exam-audio/{clip_id(jp)}.mp3"


@lru_cache(maxsize=1)
def _index() -> dict[str, dict]:
    """clip id -> the line, with its level. Built once from the shipped
    bank, so a lookup costs nothing and needs no database."""
    return {clip_id(row["jp"]): row for row in all_clips()}


def entry_for(clip: str) -> dict | None:
    """The line a clip id names, or None — an id this app never issued."""
    return _index().get(clip)


def turns_for_key(key: str) -> list[dict] | None:
    """The script behind a clip file, for study/exam_audio_repair.py.

    The repair path's other source is a stored exam paper, found by
    scanning exam_papers; this one is a dict lookup over shipped
    content, so it is both cheaper and available when the database is
    not. See that module for why a missing file is re-synthesized at all.
    """
    row = _index().get(key)
    return clip_turns(row["jp"]) if row else None


def ensure_clip(jp: str) -> str | None:
    """The URL of this line's audio, synthesizing it if this is the
    first time anyone has asked. None if it could not be made.

    Idempotent and free on the common path: synthesize_dialogue returns
    the existing URL without a network call when the file is already
    there, which after scripts/build_dictation_audio.py has run is every
    line in the collection."""
    try:
        return synthesize_dialogue(clip_turns(jp))
    except TTSFailed as e:
        logger.warning("Could not synthesize dictation audio for %r: %s", jp, e)
        return None


# ── The grade ────────────────────────────────────────────────────
# Where a transcription stops being the same sentence. A dictation is
# not marked out of ten by a human, so these thresholds ARE the mark
# scheme and they are stated once, here.
#
# The score is difflib's ratio, 2*matched/(len(a)+len(b)), so these are
# proportions rather than counts and a longer line tolerates more
# absolute error -- which is right: one mora out of forty IS closer than
# one out of eleven.
#
# 100 is exact after normalization, the only score that means "you wrote
# the sentence". 90 is about a particle out on a short N5 line (one mora
# substituted there scores 91, one dropped 95) -- the sentence was
# heard. Below 60 the learner has caught words rather than the line,
# which is a different result from having missed it entirely and worth
# saying so on the screen.
PERFECT = 100
CLOSE = 90
PARTIAL = 60


def verdict_for(accuracy: int) -> str:
    if accuracy >= PERFECT:
        return "perfect"
    if accuracy >= CLOSE:
        return "close"
    if accuracy >= PARTIAL:
        return "partial"
    return "missed"


def _diff(target: str, answer: str) -> list[dict]:
    """The reference line marked up against what was written, as runs:
    `equal` came through, `missing` was not written, `extra` was written
    and is not in the line.

    Character-level, which is the right grain for Japanese: there are no
    spaces to split on, and a listener's error is a mora — a dropped っ,
    a short vowel heard long — not a word."""
    runs: list[dict] = []

    def add(op: str, text: str) -> None:
        if not text:
            return
        if runs and runs[-1]["op"] == op:
            runs[-1]["text"] += text
        else:
            runs.append({"op": op, "text": text})

    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, target, answer).get_opcodes():
        if tag == "equal":
            add("equal", target[i1:i2])
        elif tag == "delete":
            add("missing", target[i1:i2])
        elif tag == "insert":
            add("extra", answer[j1:j2])
        else:  # replace — both halves, the reference first
            add("missing", target[i1:i2])
            add("extra", answer[j1:j2])
    return runs


def grade(answer: str, row: dict) -> dict:
    """How close `answer` came to the line in `row`.

    Graded against the written form AND the reading, keeping the better
    of the two: see this module's own header on why script is not part
    of what a dictation tests. `matched` names the form that won, so the
    diff the learner is shown is against the one they were writing.
    """
    written = normalize(answer)

    best_form, best_target = "written", normalize(row["jp"])
    best_ratio = difflib.SequenceMatcher(None, best_target, written).ratio()
    reading = normalize(row["kana"])
    reading_ratio = difflib.SequenceMatcher(None, reading, written).ratio()
    if reading_ratio > best_ratio:
        best_form, best_target, best_ratio = "kana", reading, reading_ratio

    accuracy = round(best_ratio * 100)
    return {
        "accuracy": accuracy,
        "verdict": verdict_for(accuracy),
        # The pass/fail the score row and the log record. A dictation
        # that is a particle out was heard, and calling it wrong would
        # teach the learner to distrust their own ear over a typo.
        "correct": accuracy >= CLOSE,
        "matched": best_form,
        "target": best_target,
        "diff": _diff(best_target, written),
    }


# ── The queue ────────────────────────────────────────────────────
def pick(level: str, count: int, exclude: set[str], rng=random) -> list[dict]:
    """`count` lines from `level`'s bank that the session has not heard,
    in a fresh order.

    Falls back to the excluded ones rather than returning nothing: the
    bank is finite (18-20 lines a level), and a learner who has worked
    through it should be given it again rather than an empty screen.
    Already-heard lines come last, so the fallback only shows once the
    fresh ones are gone."""
    if level not in BY_LEVEL:
        return []
    rows = list(BY_LEVEL[level])
    rng.shuffle(rows)
    fresh = [r for r in rows if clip_id(r["jp"]) not in exclude]
    heard = [r for r in rows if clip_id(r["jp"]) in exclude]
    return (fresh + heard)[:count]


__all__ = [
    "LEVELS", "MAX_PLAYS", "clip_id", "clip_url", "ensure_clip", "entry_for",
    "grade", "normalize", "pick", "turns_for_key", "verdict_for",
]
