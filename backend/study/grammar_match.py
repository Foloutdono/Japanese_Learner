"""
Does a sentence actually use the grammar point it claims to?

Every generator here follows the same rule: the LLM proposes, the code
decides. A sentence that does not contain its target pattern is worse
than no sentence -- `indice_2` would show an example of something else,
and `fill_in` would ask "which rule is at work here?" about a sentence
where it isn't.

Matching is on SURFACE FORM, deliberately. Real morphological analysis
(study/morphology.py) would resolve conjugation, but a grammar pattern is
not a word: 〜ざるを得ない is three morphemes that only mean something
together, and a tokeniser gives back the pieces, not the pattern. A
substring test over the pattern's conjugable stem is both simpler and
closer to the actual question being asked.

Patterns this cannot check honestly are reported as such rather than
guessed at -- see verifiable().
"""
import re

# Bare particles and copulas. Their surface form occurs in almost every
# Japanese sentence regardless of which grammar is being demonstrated, so
# a substring test proves nothing: 「は」 is in 「今日は寒い」 whether or
# not the sentence is about topic marking. These are excluded from
# verification rather than passed, so a caller can tell "verified" apart
# from "unverifiable" instead of receiving a meaningless True.
_UNVERIFIABLE = {
    "は", "が", "を", "に", "で", "と", "も", "の", "へ", "や", "か", "ね", "よ",
    "です／だ", "い形容詞／な形容詞", "自動詞／他動詞",
}

# Trailing inflection to strip so the stem survives conjugation. 〜べきだ
# appears as べきです / べきではない; 〜そうだ as そうです; and the catalogue
# states many points in the polite form a real sentence rarely keeps --
# 〜ています is written 降っている far more often than 降っています.
# Longest alternatives first: Python's alternation takes the first match,
# so ませんでした must be offered before ません and ます.
_TAIL = re.compile(
    r"(ませんでした|ましょう|ません|ました|ます|だ|です|である|する|なる|ある|いる|た|ない)$"
)


def _strip_label(pattern: str) -> str:
    """Drops a leading Japanese grammatical label: 使役形 〜させる."""
    return pattern.rsplit("〜", 1)[-1] if "〜" in pattern else pattern


def alternatives(pattern: str) -> list[str]:
    """
    Every surface form the pattern may legitimately appear as.

    A catalogue entry can record several: 〜てあげる／てくれる／てもらう is
    three real forms, and a sentence using any one of them is using the
    point. The old _pattern_core kept only the first, so two thirds of a
    valid generation for such an entry was thrown away.
    """
    body = pattern.strip()
    # Split alternatives BEFORE stripping the label, so a label attached
    # to the first alternative does not leak into the others.
    parts = [p for p in re.split(r"[／/・]", body) if p.strip()]
    out = []
    for part in parts:
        p = _strip_label(part).strip()
        p = p.split("(")[0].split("（")[0].strip()
        if p:
            out.append(p)
    return out or [body]


def stems(pattern: str) -> list[str]:
    """
    Every substring whose presence would show the pattern at work,
    including forms it takes once conjugated.

    A grammar point is almost never quoted verbatim in a real sentence.
    〜てくれる appears as 手伝ってくれた; 〜べきだ as べきです; 〜させる as
    させて. So each alternative contributes both its full form and the
    truncations that survive inflection: trailing copula/auxiliary
    removed, and a final る or い dropped (the two productive endings).
    Nothing is truncated below 2 characters, where a match stops being
    evidence of anything.
    """
    out: list[str] = []
    for alt in alternatives(pattern):
        # A two-part pattern (〜ば〜ほど) keeps its longest piece: the one
        # least likely to occur by accident.
        piece = max(alt.split("〜"), key=len).strip() if "〜" in alt else alt
        if not piece:
            continue
        candidates = [piece]
        stripped = _TAIL.sub("", piece).strip()
        if stripped and stripped != piece:
            candidates.append(stripped)
        for base in list(candidates):
            if len(base) > 2 and base[-1] in "るい":
                candidates.append(base[:-1])
        out.extend(c for c in candidates if len(c) >= 2)
    # Longest first: the strongest evidence is tried before the loosest.
    return sorted(dict.fromkeys(out), key=len, reverse=True)


def verifiable(pattern: str) -> bool:
    """
    Whether a substring test over this pattern means anything.

    False for bare particles, and for anything whose longest checkable
    stem is a single character -- 〜も against a sentence is not evidence.
    A caller must decide what to do with an unverifiable point rather than
    receive a True that was never checked.
    """
    if pattern.strip() in _UNVERIFIABLE:
        return False
    return any(len(s) >= 2 for s in stems(pattern))


def contains_pattern(sentence: str, pattern: str) -> bool:
    """
    True when `sentence` visibly uses `pattern`.

    Only meaningful when verifiable(pattern); callers that skip that check
    get a conservative answer (a bare particle will usually match, which
    is exactly the false confidence verifiable() exists to prevent).
    """
    if not sentence:
        return False
    return any(s in sentence for s in stems(pattern) if s)
