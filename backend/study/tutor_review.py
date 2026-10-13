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

作文 (composition, plan 125) asks the same tutor about a sentence the
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


def _unfenced(content: str) -> str:
    return re.sub(r"^```(?:\w+)?|```$", "", content.strip(), flags=re.MULTILINE).strip()


def _review_object(content: str) -> dict | None:
    """The JSON object with a `verdict` in `content`, wherever it sits.

    A reply is usually the object and nothing else. But a model that
    thinks out loud in `content` (live-diagnosed 2026-10-12: "We need to
    produce JSON with fields: verdict, summary... First, analyze the
    learner's attempt...") may still finish with the object, and the
    object is the answer however much monologue comes before it. The
    LAST one wins: a monologue quotes drafts, and a learner's sentence
    echoed in it must not outrank the verdict that follows.
    """
    cleaned = _unfenced(content)
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        data = None
    if isinstance(data, dict):
        return data if "verdict" in data else None
    decoder = json.JSONDecoder()
    found = None
    pos = cleaned.find("{")
    while pos != -1:
        try:
            obj, end = decoder.raw_decode(cleaned, pos)
        except json.JSONDecodeError:
            pos = cleaned.find("{", pos + 1)
            continue
        if isinstance(obj, dict) and "verdict" in obj:
            found = obj
        pos = cleaned.find("{", end)
    return found


# ── What may be shown as prose ──
# A reply that is not the shape used to be served as the prose it was,
# "rather than lost". That is right for a tutor who answered in a
# paragraph, and wrong for a model that answered with its own reasoning:
# a wall of "We need to produce JSON... the instruction says..." printed
# to a learner as their review. Prose is now shown only when it reads as
# a review; anything else is as good as no answer.
MAX_PROSE = 700
_LEAK_MARKERS = re.compile(
    r"\bjson\b|\bschema\b|\"?verdict\"?\s*[:,]|grammar_used|<<<|>>>|"
    r"\bthe (?:instruction|prompt|data)s?\b|\bsystem prompt\b",
    re.IGNORECASE,
)
_REASONING_OPENERS = re.compile(
    r"^\W*(?:we need to|we must|we should|we have to|let'?s (?:analy[sz]e|think|see|parse|produce)|"
    r"first,? (?:analy[sz]e|let)|the user (?:wants|asks|is asking)|i need to|"
    r"nous devons|il faut (?:produire|analyser)|analysons)",
    re.IGNORECASE,
)


def usable_prose(content: str) -> str | None:
    """`content` as prose a learner may be shown, or None when it is
    not one: a JSON object cut short, a reply that talks about the
    prompt or its own schema, one that opens like reasoning, or one far
    longer than a review at a glance can be."""
    cleaned = _unfenced(content)
    if not cleaned or len(cleaned) > MAX_PROSE:
        return None
    if cleaned[0] in "{[" or _REASONING_OPENERS.match(cleaned) or _LEAK_MARKERS.search(cleaned):
        return None
    return cleaned


def acceptable_reply(content: str) -> bool:
    """Whether a reply is worth keeping: the shape, or prose a learner
    may read. llm_shared.chat(accept=...) walks on to the next model
    when it is not, which is what a reasoning model that ran out of
    tokens before its answer needs."""
    return _review_object(content) is not None or usable_prose(content) is not None


def parse_review(content: str) -> dict | None:
    """The model's answer as the shape the screen draws, or None when it
    is not that shape at all -- in which case the caller serves the
    prose (usable_prose) or none. Lenient inside the shape: a bad
    verdict becomes "partial", a list too long is cut to its first
    items, an item that is not text is dropped."""
    data = _review_object(content)
    if data is None:
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
        # 作文's alone, like `meaning`: the learner's sentence in
        # Japanese script, when they typed it in romaji.
        "japanese": short(data.get("japanese")),
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
