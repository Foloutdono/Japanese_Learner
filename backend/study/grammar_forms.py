"""
What a Choisir option prints: the one form of its rule that would stand
in the hole (plan 254).

The catalogue quotes a rule whole -- この／その／あの／どの is a series of
four, から〜まで two pieces around the words they hold -- and a sentence
holds one form of it in one place: あの人はだれですか is blanked on
あの, 九時から五時まで on から. Offered whole, the options asked which
list fills a hole that takes one word, and the answer was the one list
the sentence's word belongs to. So each option is cut to one form:

- the answer to the form the sentence has (its `fill`): the member of
  the series and the piece of the rule the fill is, as the rule writes
  it -- てしまう, not the てしま of てしまいました, which the hole shows
  once it is answered;
- another rule to one member (_offers): the one in the same place of a
  series as long as the answer's (あれ beside あの), else the one the
  lesson's line on the pair names, else the one that opens most like
  the answer (どの beside どんな); and to that member's longest piece
  (しか of 〜しか〜ない), the one study/grammar_match checks is not in
  the sentence already -- unless no lone piece can stand for it (_cut).

A label (命令形 〜ろ／〜え) or a gloss over the whole series
(〜て／〜ないで（依頼）) names which rule a form is of, and stays with
it. A rule with one form is printed as it always was, its leading 〜
off; so is one that names word classes (い形容詞／な形容詞). A question
whose answer cannot be traced to one form, or whose options would print
the same twice, keeps its rules whole.
"""
import re
from functools import lru_cache
from typing import NamedTuple

from content.grammar_points_data import find
from study.furigana import mark_spans
from study.grammar_examples import pattern_furigana
from study.grammar_match import stems

Span = tuple[int, int]
Spans = tuple[Span, ...]


@lru_cache(maxsize=1024)
def _shape(pattern: str) -> tuple[Spans, tuple[Spans, ...], Spans]:
    """(label, members, gloss) of a pattern, as spans of its text: the
    label it opens on (使役形 and its space), each member's pieces (the
    stretches between its 〜) and the gloss that closes a series."""
    start, end = 0, len(pattern)
    label: Spans = ()
    gloss: Spans = ()
    if " " in pattern and "〜" in pattern:
        start = pattern.index(" ") + 1
        label = ((0, start),)
    body = pattern[start:end]
    if re.search(r"[／/]", body) and body.endswith("）") and "（" in body:
        end = start + body.rindex("（")
        gloss = ((end, len(pattern)),)
    members = []
    at = start
    for member in re.split(r"[／/]", pattern[start:end]):
        pieces, p = [], at
        for piece in member.split("〜"):
            if piece.strip():
                pieces.append((p, p + len(piece)))
            p += len(piece) + 1
        if pieces:
            members.append(tuple(pieces))
        at += len(member) + 1
    return label, tuple(members), gloss


def _whole(pattern: str) -> Spans:
    """A rule as an option has always printed it."""
    return ((1 if pattern.startswith(("〜", "～")) else 0, len(pattern)),)


def _longest(pieces: Spans) -> Span:
    return max(pieces, key=lambda s: s[1] - s[0])


def _one(members: tuple[Spans, ...]) -> bool:
    """A rule with one form: one member, in one piece."""
    return len(members) <= 1 and all(len(m) == 1 for m in members)


def _text(pattern: str, spans: Spans) -> str:
    return "".join(pattern[a:b] for a, b in spans)


def _parts(pattern: str, spans: Spans) -> list[dict] | None:
    """The form's furigana, cut from the rule's own (the catalogue's
    reading), or None for a form with no kanji or none the cut keeps."""
    found = find(pattern)
    if not found or not found[1].get("reading"):
        return None
    marked = mark_spans(pattern_furigana(pattern, found[1]["reading"]), list(spans))
    parts = [{k: v for k, v in p.items() if k != "highlight"} for p in marked if p.get("highlight")]
    if "".join(p["text"] for p in parts) != _text(pattern, spans) or not any(p.get("reading") for p in parts):
        return None
    return parts


class Hole(NamedTuple):
    """The answer's place in its rule: how many members the rule has,
    the one the sentence holds (None for a rule with one form), and the
    form itself."""
    count: int
    member: int | None
    form: str


@lru_cache(maxsize=4096)
def _hole(answer: str, fill: str) -> tuple[Hole, Spans] | None:
    """Where the sentence's `fill` sits in the answer's rule, and the
    answer's form; None where it is no piece of the rule."""
    label, members, gloss = _shape(answer)
    if _one(members):
        spans = _whole(answer)
        return Hole(len(members), None, _text(answer, spans)), spans
    for i, pieces in enumerate(members):
        for a, b in pieces:
            if fill == answer[a:b] or fill in stems(answer[a:b]):
                return Hole(len(members), i, answer[a:b]), label + ((a, b),) + gloss
    return None


def _common(a: str, b: str) -> int:
    """How many characters `a` and `b` open on alike."""
    n = 0
    while n < min(len(a), len(b)) and a[n] == b[n]:
        n += 1
    return n


def _cut(pattern: str, member: Spans) -> Span | None:
    """The one piece a member of another rule prints, or None where no
    piece can stand for it: a member whose pieces are single characters
    (〜か〜か, 〜に〜回), whose lone か or に is another rule and fits the
    hole as one (電話＿＿メール takes か), or one that opens on its own
    one-character prefix (お〜になる), whose になる alone is "become"."""
    piece = _longest(member)
    if piece[1] - piece[0] < 2:
        return None
    first = member[0]
    if len(member) > 1 and first[1] - first[0] == 1 and (first[0] == 0 or pattern[first[0] - 1] in "／/ "):
        return None
    return piece


@lru_cache(maxsize=8192)
def _offers(hole: Hole, pattern: str, line: str) -> tuple[Spans, ...]:
    """The forms another rule may print beside the answer, the likeliest
    first: the member in the answer's place of a series as long as its
    own, the one the lesson's line on the pair names (ませんでした, where
    まだ〜ていません is told from 〜ました／〜ませんでした), the one that opens
    most like the answer (てくれる beside てくださる, どの beside どんな),
    then the rest in order -- each by its longest piece, or whole where
    no piece stands for it (_cut). A rule that names word classes
    (い形容詞／な形容詞) has no form to print: it stays whole."""
    label, members, gloss = _shape(pattern)
    if _one(members) or any(pattern[m[-1][1] - 1] == "詞" for m in members):
        return (_whole(pattern),)
    word = [pattern[slice(*_longest(m))] for m in members]
    order: list[int] = []
    if hole.member is not None and len(members) == hole.count:
        order.append(hole.member)
    named = [i for i, w in enumerate(word) if len(w) > 1 and w in line]
    if len(named) == 1:
        order += named
    order += sorted(range(len(members)), key=lambda i: -_common(word[i], hole.form))
    return tuple(
        label + (_cut(pattern, members[i]) or (members[i][0][0], members[i][-1][1]),) + gloss
        for i in dict.fromkeys(order)
    )


def _resolve(answer: str, fill: str, choices: list[str], lines: dict[str, str]) -> dict[str, Spans]:
    whole = {c: _whole(c) for c in choices}
    found = _hole(answer, fill)
    if found is None:
        return whole
    hole, spans = found
    out = {answer: spans}
    taken = {_text(answer, spans)}
    for choice in choices:
        if choice == answer:
            continue
        offers = _offers(hole, choice, lines.get(choice, ""))
        pick = next((s for s in offers if _text(choice, s) not in taken), _whole(choice))
        out[choice] = pick
        taken.add(_text(choice, pick))
    # Two options printing alike: the rules whole, as they always were.
    return out if len(taken) == len(choices) else whole


class Form(NamedTuple):
    text: str
    parts: list[dict] | None


def choice_forms(answer: str, fill: str, choices: list[str],
                 lines: dict[str, str] | None = None) -> dict[str, Form]:
    """{pattern: the form its option prints, and that form's furigana}
    for every one of `choices`, the answer among them; `fill` is what the
    sentence has in the hole, `lines` the lesson's line on each rival.
    Earlier choices are served first where two would print alike."""
    spans = _resolve(answer, fill, choices, lines or {})
    return {c: Form(_text(c, spans[c]), _parts(c, spans[c])) for c in choices}


def form_text(answer: str, fill: str, pattern: str) -> str:
    """What `pattern` would print as an option of this question, alone."""
    return _text(pattern, _resolve(answer, fill, [answer, pattern], {})[pattern])
