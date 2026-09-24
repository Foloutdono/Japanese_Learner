"""
The tutor's review as a shape, shared by the modes that buy one.

routes/translation.py wrote this on 2026-09-13, owner-directed: the
tutor used to answer in a paragraph -- five sentences, one colour, the
praise and the error in the same breath -- and a learner on a phone
read none of it. The review is a fixed shape the screen draws as a
verdict, a line, and rows a learner tells apart at a glance: what
worked (+), what to fix (- with the fix under it), and their own
sentence corrected. The model proposes the shape; parse_review decides
what of it is usable, and a reply that is not the shape at all is
served as the prose it is rather than lost.

作文 (composition, plan 124) asks the same tutor about a sentence the
learner wrote from a grammar point rather than from a translation
prompt, and draws the same shape (components/study/TutorReview.jsx). So
the shape lives here and neither route owns it: the fence that keeps a
learner's text from reading as instructions, the parser, the corrected
sentence as furigana parts with the changes marked, and the text form
an older client prints and the log shows. routes/translation.py keeps
its old private names as aliases of these.

One key the translation prompt never asks for: `meaning`, what the
learner's sentence actually says, in their own language. A translation
attempt has its prompt to say that; a composed sentence has nothing
but the tutor. Absent from a reply, it is "" and nothing draws it.
"""
import difflib
import json
import re

from study.furigana import align_sentence, mark_spans
from study.romaji import sentence_romaji

VERDICTS = ("correct", "acceptable", "partial", "incorrect")
MAX_ITEMS = 3


def short(value, limit: int = 240) -> str:
    return value.strip()[:limit] if isinstance(value, str) else ""


def fenced(value: str) -> str:
    """`value`, safe to place between <<< and >>> in a tutor prompt.

    The delimiter is only a soft signal to the model, not a real parser
    boundary -- so a value that contains a literal <<< or >>> could
    otherwise "close" the data block early and have its tail read back
    as part of the surrounding instructions. Breaking up the marker
    (zero-width joiner) keeps it visibly the same text to the model
    without ever reproducing the exact sequence the prompt uses as a
    boundary.
    """
    return value.replace("<<<", "<‍<<").replace(">>>", ">‍>>")


def parse_review(content: str) -> dict | None:
    """The model's answer as the shape the screen draws, or None when it
    is not that shape at all -- in which case the caller serves the
    prose. Lenient inside the shape: a bad verdict becomes "partial", a
    list too long is cut to its first items, an item that is not text
    is dropped."""
    cleaned = re.sub(r"^```(?:\w+)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or "verdict" not in data:
        return None

    verdict = data.get("verdict") if data.get("verdict") in VERDICTS else "partial"
    good = []
    if isinstance(data.get("good"), list):
        good = [short(item) for item in data["good"] if short(item)][:MAX_ITEMS]
    fix = []
    if isinstance(data.get("fix"), list):
        for item in data["fix"]:
            if isinstance(item, dict) and short(item.get("issue")):
                fix.append({"issue": short(item.get("issue")), "fix": short(item.get("fix"))})
            elif short(item):
                fix.append({"issue": short(item), "fix": ""})
    fix = fix[:MAX_ITEMS]
    grammar_used = data.get("grammar_used")
    return {
        "verdict": verdict,
        "summary": short(data.get("summary")),
        "meaning": short(data.get("meaning")),
        "good": good,
        "fix": fix,
        "grammar_used": grammar_used if isinstance(grammar_used, bool) else None,
        "better": short(data.get("better")) if fix else "",
    }


# ── The corrected sentence, as the screen draws it (2026-09-22) ──
# "better" is the learner's own sentence with the fixes applied, and it
# was served as a bare string: a line of Japanese with no readings, no
# romaji, and no sign of WHICH part of it is the correction. A learner
# who cannot yet read 新聞 cannot read the fix either, and one who can
# still has to diff two sentences by eye to find it.
#
# So it is served the way every other sentence in the app is: furigana
# parts (study/furigana.align_sentence), the romaji under it, and the
# spans that differ from what the learner actually wrote marked. The
# marking is a plain character diff -- the model is not asked to say
# what it changed, because a model that reports its own edits is one
# more thing that can be wrong about them, and difflib cannot be.
def changed_spans(before: str, after: str) -> list[tuple[int, int]]:
    """[start, end) of every stretch of `after` that is not in `before`.

    autojunk off: it treats a character appearing in more than 1% of a
    long string as noise, and Japanese runs on a small set of particles
    and kana -- exactly the characters it would throw away.
    """
    matcher = difflib.SequenceMatcher(None, before, after, autojunk=False)
    return [
        (j1, j2) for tag, _i1, _i2, j1, j2 in matcher.get_opcodes()
        if tag in ("replace", "insert") and j2 > j1
    ]


def corrected(better: str, user_answer: str) -> dict:
    """`better` as parts, marked, with its romaji -- the two keys the
    review carries beside the plain string."""
    parts = align_sentence(better)
    # align_sentence is the tokenizer's, and the tokenizer is optional
    # (study/morphology.py's graceful degradation) -- so never trust the
    # parts to spell the sentence back. The offsets below are into that
    # spelling, and a mark placed against a different one is a mark in
    # the wrong place.
    if "".join(part["text"] for part in parts) != better:
        parts = [{"text": better}]
    spans = changed_spans(user_answer.strip(), better)
    # Everything changed, so nothing is worth pointing at: a sentence
    # marked end to end says only that it is a sentence. That is the
    # answer written in romaji, or in an alphabet the reference does not
    # share -- where the correction IS the whole line.
    if sum(end - start for start, end in spans) >= len(better):
        spans = []
    return {"better_parts": mark_spans(parts, spans), "better_romaji": sentence_romaji(better)}


def review_as_text(review: dict) -> str:
    """The shape read out as lines -- what an older client prints, and
    what the log shows. `meaning` only when the prompt asked for one, so
    a translation review reads exactly as it did before the key
    existed."""
    lines = [review["summary"]] if review["summary"] else []
    if review.get("meaning"):
        lines.append(review["meaning"])
    lines += [f"+ {item}" for item in review["good"]]
    lines += [f"- {item['issue']}" + (f" -> {item['fix']}" if item["fix"] else "") for item in review["fix"]]
    if review["better"]:
        lines.append(review["better"])
    return "\n".join(lines)
