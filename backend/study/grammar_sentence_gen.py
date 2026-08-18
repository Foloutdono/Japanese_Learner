"""
Example sentences for the grammar catalogue.

content/grammar_points.json holds pattern / structure / gloss and no
sentences at all -- deliberately, since the point of that file is to owe
nothing to the scraped grammar_data.py. These are generated instead, once
per (level, pattern), and cached forever.

Two consumers:
  indice_2   shows the sentences with the translation hidden until asked
  fill_in    shows one intact and asks which rule is at work

── Prompt economy ────────────────────────────────────────────
The existing exam generators paste the entire allowed-kanji list into
every prompt -- 2,212 characters for N1, on a call that produces one
sentence. That list is a CONSTRAINT, and constraints are cheaper to check
than to state: sentence_kanji_ok() already tests the result in code, so
the prompt names the level and the checker does the rest. When a sentence
does fail, the retry names only the offending characters, which is a few
tokens rather than two thousand.

Two further economies, same principle:
  - BATCH. One instruction block serves a whole batch of points, so its
    cost is divided by the batch size rather than paid per sentence.
  - POSITIONAL output. [["jp","en"],...] rather than a list of objects:
    JSON keys repeated once per item are pure overhead when position
    already says which field is which.

Everything the model returns is checked before it is kept -- the sentence
must contain the pattern (study/grammar_match), the kanji must be within
level, and the pair must be non-empty. Failures are retried per item, not
per batch, so one bad sentence doesn't discard a good batch.
"""
import json
import logging
import re

from study.grammar_match import contains_pattern, verifiable
from study.llm_shared import chat, sentence_kanji_ok, OPENROUTER_API_KEY

logger = logging.getLogger(__name__)

_PLACEHOLDER = re.compile(r"^(文\d*[ab]?|en|english|japanese|\.\.\.)$", re.I)

GENERATOR_VERSION = "1"

# Per point. Two gives indice_2 something to compare and leaves fill_in a
# spare when one sentence turns out to be the weaker example.
SENTENCES_PER_POINT = 2

# Points per LLM call. Large enough to amortise the instructions, small
# enough that a malformed response loses little and stays inside the
# output cap.
BATCH_SIZE = 8

# ~70 output tokens per sentence pair, plus JSON punctuation and headroom.
_MAX_TOKENS = 220 * BATCH_SIZE

# Measured against two alternatives on the same 8 points (see the module
# docstring for the economy rationale). A looser "2 short natural
# sentences" and a terser variant BOTH returned output this parser could
# not read at all -- 649 and 660 tokens for zero usable sentences. What
# makes this one hold together is being explicit about the COUNT in three
# places at once: "EXACTLY 2", the entry count, and an output example whose
# placeholders are positionally labelled. 58 tokens per kept sentence.
_PROMPT = """Write JLPT {level} Japanese example sentences.

For EACH of the {count} numbered points below, write EXACTLY {n} sentences, each with a literal English translation.

- COMPLETE sentences with a subject and a predicate, ending in 。 — not fragments or noun phrases. 12-30 characters.
- Each sentence must literally contain the pattern, conjugated naturally.
- Kanji: JLPT {level} or easier only; kana otherwise.

Points:
{points}

Output ONLY a JSON array of {count} entries, each entry exactly {n} pairs, same order:
[[["文1a","en"],["文1b","en"]],[["文2a","en"],["文2b","en"]],...]"""


def _points_block(points: list[dict]) -> str:
    return "\n".join(
        f"{i}. {p['pattern']} ({p['structure']}) = {p['meaning']}"
        for i, p in enumerate(points, 1)
    )


def build_prompt(points: list[dict], level: str, n: int = SENTENCES_PER_POINT) -> str:
    return _PROMPT.format(
        level=level, n=n, count=len(points), points=_points_block(points),
    )


def _scan_groups(text: str) -> list:
    """
    Pull out the top-level groups by bracket depth, decoding each on its
    own.

    A whole-document json.loads is all-or-nothing, and this model is
    unreliable enough that insisting on it throws away good sentences
    because of a malformed tail: a failed parse costs 100% of the call's
    tokens, whether it failed on the first group or the last. Scanning
    per group means a response that goes wrong halfway still yields its
    first half.
    """
    groups, depth, start = [], 0, None
    for i, ch in enumerate(text):
        if ch == "[":
            if depth == 1 and start is None:
                start = i
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 1 and start is not None:
                chunk = text[start:i + 1]
                try:
                    groups.append(json.loads(chunk))
                except json.JSONDecodeError:
                    # A HOLE, not a skip. The caller zips these against
                    # the points it asked about, so dropping a group from
                    # the middle would slide every later sentence onto the
                    # wrong grammar point -- and for the 18 unverifiable
                    # patterns contains_pattern() could not catch it.
                    groups.append(None)
                start = None
            elif depth <= 0:
                break
    return groups


def _parse(content: str):
    """
    The model's reply as a list of per-point groups, best effort.

    Order matters and is load-bearing: the caller zips these against the
    points it asked about, so a group dropped from the MIDDLE would shift
    every later sentence onto the wrong grammar point. _scan_groups keeps
    position by appending in encounter order, and a group that fails to
    decode is preserved as a hole rather than skipped -- see below.
    """
    cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass
    groups = _scan_groups(cleaned)
    return groups or None


def check_sentence(jp: str, en: str, pattern: str, level: str) -> str | None:
    """
    None when the pair is usable, else a short reason. The reason is fed
    back verbatim on retry, so it is phrased for the model, not a log.
    """
    if not jp or not en or not jp.strip() or not en.strip():
        return "empty"
    # The output example in the prompt uses positional placeholders, and a
    # struggling model sometimes returns them verbatim instead of writing
    # anything. They pass a naive non-empty test, so they are named here.
    if _PLACEHOLDER.match(jp) or _PLACEHOLDER.match(en):
        return "placeholder echoed back"
    if len(jp) < 8 or len(jp) > 60:
        return "wrong length"
    # A fragment technically "contains the pattern" and passes every other
    # check, but it does not show the grammar DOING anything: 血まみれ and
    # 父をおいて are noun phrases, and 「コーヒーとともだち」 is a list. An
    # example that is not a sentence teaches the learner nothing about how
    # the point attaches, which is the entire purpose of indice_2.
    if jp[-1] not in "。！？":
        return "not a complete sentence (must end in 。)"
    if not sentence_kanji_ok(jp, level):
        # A kanji that is part of the PATTERN ITSELF is exempt. 〜次第だ is
        # an N3 point whose own 第 is not an N3 deck kanji, so no sentence
        # demonstrating it could ever pass a strict gate -- and writing it
        # as しだい stops demonstrating the pattern at all. The learner is
        # being taught 次第 on this very card; seeing it is the point.
        # Same for 〜に違いない, 〜際に and the others whose citation form
        # outruns their level's kanji set.
        allowed_extra = set(pattern)
        bad = sorted({
            c for c in jp
            if "一" <= c <= "鿿" and c not in allowed_extra
            and not sentence_kanji_ok(c, level)
        })
        if bad:
            return "uses kanji above " + level + ": " + "".join(bad)
    if verifiable(pattern) and not contains_pattern(jp, pattern):
        return "does not contain " + pattern
    return None


def generate_for_points(points: list[dict], level: str,
                        n: int = SENTENCES_PER_POINT) -> dict[str, list[dict]]:
    """
    {pattern: [{"jp": ..., "en": ...}, ...]} for as many points as came
    back usable. A point the model failed on is simply absent -- callers
    treat a missing entry as "no sentences yet" and the mode hides
    accordingly, rather than showing a wrong example.
    """
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not configured")
    if not points:
        return {}

    content = chat(
        [{"role": "system", "content": build_prompt(points, level, n)},
         {"role": "user", "content": "Generate."}],
        max_tokens=_MAX_TOKENS,
        # See llm_shared.chat: with reasoning on, this model spends its
        # whole budget thinking about a batched request and then returns
        # the prompt's placeholders. Measured 0 usable sentences with it
        # on, versus real output at ~500 completion tokens with it off.
        reasoning=False,
    )
    groups = _parse(content)
    if not isinstance(groups, list):
        logger.warning("grammar sentences: unparseable response for %s", level)
        return {}

    out: dict[str, list[dict]] = {}
    for point, group in zip(points, groups):
        if not isinstance(group, list):
            continue
        kept = []
        for pair in group:
            if not (isinstance(pair, (list, tuple)) and len(pair) >= 2):
                continue
            jp, en = str(pair[0]).strip(), str(pair[1]).strip()
            reason = check_sentence(jp, en, point["pattern"], level)
            if reason is None:
                kept.append({"jp": jp, "en": en})
            else:
                logger.info("rejected %s: %s (%s)", point["pattern"], reason, jp[:24])
        if kept:
            out[point["pattern"]] = kept
    return out


def batches(points: list[dict], size: int = BATCH_SIZE):
    for i in range(0, len(points), size):
        yield points[i:i + size]
