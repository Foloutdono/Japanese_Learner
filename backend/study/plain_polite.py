"""
The same ending in the other register (plan 241).

Construire (plan 194) gives a sentence's translation and asks for the
point, and a translation never says whether the sentence is polite or
plain: « Demain, c'est l'examen » is あしたはテストです as much as
あしたはテストだ, so a learner who types です in that hole has written
the sentence right. Where the hole closes its sentence, other_register
reads its ending in the other register, both ways:

    copula      だ ⇄ です, だった ⇄ でした, だろう ⇄ でしょう
    adjective   高い ⇄ 高いです, 高かった ⇄ 高かったです,
                ない ⇄ ありません or ないです
    verb        行く ⇄ 行きます, 行かない ⇄ 行きません,
                行った ⇄ 行きました, 行かなかった ⇄ 行きませんでした

and nowhere else, since everywhere else the register is not free: a
clause inside the sentence stays plain (学生だと思います, never
学生ですと思います), and です after an い-adjective has no だ (高いです,
never 高いだ). Nor:

  - polite to plain before か (休みですか is not 休みだか; 行きますか,
    an offer or a request, is not asked by 行くか), but でしょうか,
    whose plain だろうか asks the same;
  - polite to plain in a sentence polite elsewhere (テストですが、
    行きたくないです stays polite to its end);
  - a verb where the point is the polite ending itself (〜ます／〜ません)
    or a form (た形: 行った is not 行きました), nor the verbs that are
    only ever polite (でございます, 申します, おります).

Read through the tokenizer; without it there is no other reading, and
Construire's check is what it was.
"""
import re
from functools import lru_cache

from study.morphology import kata_to_hira, tokenize

POLITE, PLAIN = "polite", "plain"

# The particles that may follow the ending and still close the sentence.
_FINAL = ("よ", "ね", "か")
_CLOSE = ("。", "！", "？", "!", "?")
# The verbs only ever said politely: their plain form is another style
# of speech, not the same sentence.
_POLITE_ONLY = frozenset(("ござる", "おる", "もうす", "もうしあげる", "いたす", "まいる", "ぞんずる", "ぞんじる"))
# The ラ行 honorifics whose ます stem ends in い: いらっしゃいます.
_I_STEM = frozenset(("いらっしゃる", "おっしゃる", "くださる", "なさる", "ござる"))
# A point that is the polite ending itself, not something said with it.
_POLITE_POINTS = frozenset(("ます", "ません", "ました", "ませんでした"))

# A godan verb's row, as its ctype names it: (a, i, u), and its past.
_ROWS = {"カ": "かきく", "ガ": "がぎぐ", "サ": "さしす", "タ": "たちつ", "ナ": "なにぬ",
         "バ": "ばびぶ", "マ": "まみむ", "ラ": "らりる", "ワア": "わいう"}
_TA = {"カ": "いた", "ガ": "いだ", "サ": "した", "タ": "った", "ラ": "った", "ワア": "った",
       "ナ": "んだ", "バ": "んだ", "マ": "んだ"}

_KANA = re.compile(r"[ぁ-ゖァ-ヺー]")
_KANJI = re.compile(r"[一-鿿々]")


def _is(t, lemma: str, cform: str = "") -> bool:
    return t.pos == "auxiliary" and t.lemma == lemma and t.cform.startswith(cform)


def _read(t) -> str:
    """A token read as the furigana reads it: its reading where it has a
    kanji, else its letters (は stays は)."""
    return t.reading if _KANJI.search(t.surface) else kata_to_hira(t.surface)


def _forms(t) -> dict | None:
    """{plain, masu, nai, ta} of the verb the token is, read, from the
    token as it stands: 行っ → いく, いき, いかない, いった. None for a
    token that does not conjugate as a verb."""
    kind, r = t.ctype, t.reading
    if t.pos not in ("verb", "auxiliary", "suffix") or not r:
        return None
    if kind.startswith("五段-"):
        row = kind[3:].removesuffix("行")
        if row not in _ROWS or r[-1] not in _ROWS[row] + "っんい":
            return None
        a, i, u = _ROWS[row]
        body = r[:-1]
        plain = body + u
        return {
            "plain": plain,
            "masu": body + ("い" if plain in _I_STEM else i),
            "nai": "ない" if plain == "ある" else body + a + "ない",
            "ta": body + ("った" if plain in ("いく", "ゆく") else _TA[row]),
        }
    whole = t.cform.startswith(("終止形", "連体形"))
    if kind.startswith(("上一段", "下一段")) or kind == "助動詞-レル":
        if whole and not r.endswith("る"):
            return None
        stem = r[:-1] if whole else r
        return {"plain": stem + "る", "masu": stem, "nai": stem + "ない", "ta": stem + "た"}
    if kind in ("カ行変格", "サ行変格"):
        head = r[:-2] if whole else r[:-1]
        if kind == "カ行変格":
            return {"plain": head + "くる", "masu": head + "き", "nai": head + "こない", "ta": head + "きた"}
        return {"plain": head + "する", "masu": head + "し", "nai": head + "しない", "ta": head + "した"}
    return None


def _written(t, new: str) -> str:
    """`new`, a reading of the verb `t`, in the kanji the sentence writes
    it with: 思い (おもい) and おもう make 思う. In kana where the kanji's
    own reading changes, but for 来, which keeps it (来ない)."""
    cut = len(t.surface)
    while cut and _KANA.match(t.surface[cut - 1]):
        cut -= 1
    if not cut:
        return new
    head = t.surface[:cut]
    head_read = t.reading[:len(t.reading) - (len(t.surface) - cut)]
    if head_read and new.startswith(head_read):
        return head + new[len(head_read):]
    if head == "来":
        return head + new[1:]
    return new


def _guarded(pattern: str) -> tuple[bool, bool]:
    """(polite point, form point): whether the point is the polite ending
    itself, and whether it is a form (た形, ない形) a verb's other
    register would not show."""
    names = {re.sub(r"[〜～\s]|（.*?）|\(.*?\)", "", p) for p in pattern.split("／")}
    return bool(names & _POLITE_POINTS), "形" in pattern.replace("形容詞", "")


def _swaps(tokens: list, last: int, question: bool, pattern: str):
    """(register, first, [(written, read), ...]) for the ending whose last
    token is tokens[last]: the register it is written in, and what may
    stand in the other one for tokens[first:last + 1]. None for an ending
    read one way only."""
    polite_point, form_point = _guarded(pattern)
    t = tokens[last]
    p1, p2, p3 = (tokens[i] if i >= 0 else None for i in range(last - 1, last - 4, -1))

    def verb(i: int, form: str, ending: str, polite: bool) -> list | None:
        v = tokens[i] if i >= 0 else None
        forms = _forms(v) if v is not None else None
        if forms is None or form_point or (polite and (question or polite_point or forms["plain"] in _POLITE_ONLY)):
            return None
        return [(_written(v, forms[form]) + ending, forms[form] + ending)]

    # ── polite: です and ます, and their forms ──
    if _is(t, "です", "意志推量形"):                                # でしょう
        return POLITE, last, [("だろう", "だろう")]
    if _is(t, "た") and p1 and _is(p1, "です", "連用形"):           # でした
        if p2 and p3 and _is(p2, "ず") and _is(p3, "ます", "未然形"):  # ませんでした
            got = verb(last - 4, "nai", "", polite=True)
            return got and (POLITE, last - 4, [(w[:-1] + "かった", r[:-1] + "かった") for w, r in got])
        if question or not _nominal(p2):
            return None
        return POLITE, last - 1, [("だった", "だった")]
    if _is(t, "です", "終止形"):
        if question:
            return None
        if _adjectival(p1):
            return POLITE, last, [("", "")]
        return (POLITE, last, [("だ", "だ")]) if _nominal(p1) else None
    for size, form, ends in ((1, "plain", _is(t, "ます", "終止形")),
                             (2, "nai", _is(t, "ず") and p1 and _is(p1, "ます", "未然形")),
                             (2, "ta", _is(t, "た") and p1 and _is(p1, "ます", "連用形"))):
        if ends:
            got = verb(last - size, form, "", polite=True)
            return got and (POLITE, last - size, got)

    # ── plain: だ, the adjectives, the verbs ──
    if _is(t, "だ", "終止形"):
        return PLAIN, last, [("です", "です")]
    if _is(t, "だ", "意志推量形"):                                 # だろう
        return PLAIN, last, [("でしょう", "でしょう")]
    past = _is(t, "た")
    head, at = (p1, last - 1) if past else (t, last)     # the word, before its past
    if head is None:
        return None
    if past and _is(head, "だ", "連用形"):                          # だった
        return PLAIN, at, [("でした", "でした")]
    if head.pos == "adjective" and head.lemma == "無い":           # ない, なかった
        polite = "ありませんでした" if past else "ありません"
        return PLAIN, at, [(polite, polite), _plus(tokens, at, last)]
    if head.pos == "adjective" or _is(head, "たい") or _is(head, "らしい"):
        return PLAIN, at, [_plus(tokens, at, last)]
    if _is(head, "ない"):                                           # 行かない
        got = verb(at - 1, "masu", "ませんでした" if past else "ません", polite=False)
        if got:
            return PLAIN, at - 1, got + [_plus(tokens, at - 1, last)]
        return PLAIN, at, [_plus(tokens, at, last)]
    if head.cform.startswith("連用形" if past else "終止形"):         # 行く, 行った
        got = verb(at, "masu", "ました" if past else "ます", polite=False)
        return got and (PLAIN, at, got)
    return None


def _plus(tokens: list, first: int, last: int) -> tuple[str, str]:
    """tokens[first:last + 1] and です after them: 高い → 高いです."""
    run = tokens[first:last + 1]
    return "".join(t.surface for t in run) + "です", "".join(_read(t) for t in run) + "です"


def _adjectival(t) -> bool:
    """Whether です after `t` only adds politeness, and drops in plain
    speech: 高いです, 行きたいです, 高かったです."""
    if t is None:
        return False
    return t.pos == "adjective" or (t.pos == "auxiliary" and t.lemma in ("ない", "たい", "らしい", "た"))


def _nominal(t) -> bool:
    """Whether です after `t` is the copula, だ in plain speech: 学生です,
    しずかです, 行くんです, そうです."""
    if t is None:
        return False
    return t.pos in ("noun", "pronoun", "other", "suffix", "adverb") or (t.pos == "particle" and t.lemma == "の")


@lru_cache(maxsize=4096)
def other_register(jp: str, start: int, end: int, reading: str, pattern: str = "") -> tuple | None:
    """(register, ((written, read), ...)): the register the hole
    jp[start:end] (read `reading`) ends in, and the hole in the other
    one, where it closes its sentence on an ending read both ways; None
    elsewhere. `pattern` is the point asked, which can refuse a swap."""
    tokens = tokenize(jp)
    if not tokens:
        return None
    inside = [i for i, t in enumerate(tokens) if start <= t.start and t.end <= end]
    if not inside or tokens[inside[-1]].end != end:
        return None
    question = False
    after = [t for t in tokens if t.start >= end]
    while after and after[0].pos == "particle" and after[0].surface in _FINAL:
        question |= after[0].surface == "か"
        after.pop(0)
    if after and after[0].surface not in _CLOSE:
        return None
    last = inside[-1]
    while last >= inside[0] and tokens[last].pos == "particle" and tokens[last].surface in _FINAL:
        question |= tokens[last].surface == "か"
        last -= 1
    if last < inside[0]:
        return None
    swapped = _swaps(tokens, last, question, pattern)
    if not swapped:
        return None
    register, first, news = swapped
    if first < inside[0]:
        return None
    if register == POLITE and any(
            t.pos == "auxiliary" and t.lemma in ("です", "ます")
            for i, t in enumerate(tokens) if not first <= i <= last):
        return None
    # The hole before what is replaced, and the final particles after it.
    tail = jp[tokens[last].end:end]
    cut_read = "".join(_read(t) for t in tokens[first:last + 1]) + kata_to_hira(tail)
    if not reading.endswith(cut_read):
        return None
    lead_written = jp[start:tokens[first].start]
    lead_read = reading[:len(reading) - len(cut_read)]
    out = []
    for written, read in news:
        form = (lead_written + written + tail, lead_read + read + kata_to_hira(tail))
        if form[1] and form[1] != reading and form not in out:
            out.append(form)
    return (register, tuple(out)) if out else None
