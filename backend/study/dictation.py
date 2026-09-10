"""
書取 — dictation: the clip, and what the learner wrote down.

Two jobs, and they are the whole mode:

  1. THE COLLECTION IS READY. content/listening_clips.py is text; a
     dictation needs audio. Every line resolves to exactly one clip file
     whose name is derived from the line itself (study/exam_tts's
     content key), so the mapping needs no database, no manifest and no
     id allocation: the same line always names the same file, in a fresh
     clone and on a server that has been up for a year.
  2. THE ANSWER IS MEASURED — and, since docs/adr/0012, not GRADED.
     The learner rates their own transcription on the app's rating bar,
     the way every other sentence mode works; what this module produces
     is one number, how close the two texts came, to help them do it.
     The distinction is the whole of 0012: a measurement can afford to
     be approximate, and a grade cannot.

── Three ways to write the same sentence, all of them right ──
The learner may answer in kanji, in kana, or in romaji, and the last is
the common case: a Japanese keyboard is a separate install on a laptop
and a separate keyboard on a phone, and a beginner practising listening
has not got that far. None of those is better hearing than the others,
so the answer is measured against all three forms the line carries and
the best score is the one reported. `matched` names the form that won.

Romaji brings a second problem on top — shinbun or shimbun, chiisai or
chisai, si or shi — which study/romaji.fold settles by collapsing every
spelling choice and keeping every sound.

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
from study import romaji as romaji_lib
from study.exam_tts import TTSFailed, content_key, synthesize_dialogue
from study.furigana import align_deck

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

# Slower than the service's default, and the reason is the exercise
# rather than the language: a listener following a sentence keeps up
# fine at full speed, but a listener TRANSCRIBING one is working at the
# speed of their hand and loses the tail of the line while writing its
# head. Two listens do not fix that; a slower reading does.
#
# It is part of the content key (study/exam_tts.content_key), so
# changing this number renames every clip in the collection and the next
# request re-synthesizes it at the new speed. That is the intended
# behaviour and the reason the rate is keyed at all.
RATE = "-10%"

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
    return content_key(clip_turns(jp), RATE)


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


def restore(key: str) -> bool:
    """Re-make the clip file `key` names, if it is one of this
    collection's. False if the key is not ours or could not be made.

    A function rather than the turns themselves, which is what
    study/exam_audio_repair.py asked for at first: the turns alone lose
    RATE, and synthesizing them without it writes a DIFFERENT file — the
    rate is part of the content key. The repair would then have made a
    clip nothing ever asks for and left the missing one missing, on
    every request, forever. So the rate stays with the code that owns
    it and the repair path calls in rather than reaching in."""
    row = _index().get(key)
    if row is None:
        return False
    return ensure_clip(row["jp"]) is not None


def ensure_clip(jp: str) -> str | None:
    """The URL of this line's audio, synthesizing it if this is the
    first time anyone has asked. None if it could not be made.

    Idempotent and free on the common path: synthesize_dialogue returns
    the existing URL without a network call when the file is already
    there, which after scripts/build_dictation_audio.py has run is every
    line in the collection."""
    try:
        return synthesize_dialogue(clip_turns(jp), RATE)
    except TTSFailed as e:
        logger.warning("Could not synthesize dictation audio for %r: %s", jp, e)
        return None


# ── The measurement ──────────────────────────────────────────────
# One number: how much of the sentence the learner got down. NOT a
# grade — the rating bar on the screen is the grade (docs/adr/0012) —
# which is what lets this be forgiving where a mark scheme could not be.
#
# difflib's ratio, 2*matched/(len(a)+len(b)), so it is a proportion
# rather than a count and a longer line tolerates more absolute error.
# That is right for the thing being measured: one mora out of forty IS
# closer than one out of eleven.


def _ratio(target: str, answer: str) -> float:
    return difflib.SequenceMatcher(None, target, answer).ratio()


def measure(answer: str, row: dict) -> dict:
    """How close `answer` came to the line in `row`, and which of the
    three ways of writing it the learner was using.

    Every form is tried and the best score wins, so nothing has to
    detect what the learner typed: an answer in romaji simply scores
    near zero against the kana and near one against the romaji. The one
    thing that does need deciding is which normalizer to compare under,
    and that is per-form rather than per-answer — the Latin forms fold
    (study/romaji), the Japanese ones normalize.
    """
    japanese = normalize(answer)
    latin = romaji_lib.fold(answer)

    scores = {
        "written": _ratio(normalize(row["jp"]), japanese),
        "kana": _ratio(normalize(row["kana"]), japanese),
        "romaji": _ratio(romaji_lib.fold(row["romaji"]), latin),
    }
    matched = max(scores, key=scores.get)
    return {"accuracy": round(scores[matched] * 100), "matched": matched}


def reveal(row: dict) -> dict:
    """Everything the screen shows once the answer is in: the line, its
    reading, its romaji, its gloss — and the furigana, which is the one
    part that is computed rather than stored.

    Built from the bank's own kana rather than from a guessed reading,
    so study/furigana has exact data to divide and the ruby over 九時 is
    くじ and not きゅうじ. A run it cannot divide comes back carrying the
    whole reading, which is that module's own rule: a coarse furigana is
    honest, a wrong one is not."""
    return {
        "jp": row["jp"],
        "kana": row["kana"],
        "romaji": row["romaji"],
        "furigana": align_deck(row["jp"], row["kana"]),
        "translation": row["en"],
        # English regardless of the UI language, exactly as reading
        # practice reports its own: this app has no translation layer
        # for its sentence data, and the screen labels what it shows
        # rather than implying it is in the learner's language. See
        # routes/reading.py's get_reading_batch docstring.
        "translation_lang": "en",
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
    "LEVELS", "MAX_PLAYS", "RATE", "clip_id", "clip_url", "ensure_clip",
    "entry_for", "measure", "normalize", "pick", "restore", "reveal",
]
