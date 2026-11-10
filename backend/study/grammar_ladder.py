"""
The grammar ladder's exercises (plan 187e; walked as steps since plan 194).

A ladder card is one scheduler row (`grammar.ladder`) whose exercise is
read from where the point stands on its walk -- srs/ladder.py, the step
machine: Choisir three times, Construire four times, then mastered, where
the flashcard and Construire take turns. This module builds what each
step asks, and which exercise stands in where a point cannot be asked
on its own (EXERCISES):

    choose      contrast: the point blanked, its rivals as the choices;
                else fill_in (name the rule at work); else the flashcard
    build       Construire: the sentence's translation given, the point
                blanked, the learner types it (kana or romaji), checked
                here by check_build and then self-rated (ADR 0013);
                else choose's chain
    flashcard   the f2b flashcard, which every point can be

Construire (plan 194) replaced plan 187e's tiles, at the owner's word:
"fill the gaps typing, no choices, with the translation provided". It
needs no rival and no marked sentence, only a sentence where the point
is written in one stretch -- an example, a twist with its translation,
or a scene's line -- so every point a tour can light can be built.

`write` is a platform of its own (grammar.write), served only where the
detector is trusted on the point (grammar_detect.can_find, composition's
rule, plan 125); the check is composition's own POST
/api/composition/check -- free, local, nothing written -- and the
learner rates themselves.
"""
import difflib
import json
import random
import re
import unicodedata
from functools import lru_cache
from pathlib import Path

from content.grammar_points_data import find, texts
from content.grammar_sentences_data import translation
from srs import ladder as steps
from study.furigana import align_sentence, hold_word, mark_spans
from study.grammar_examples import blank_span
from study.grammar_detect import can_find
from study.grammar_match import verifiable
from study.grammar_tour import _dictionary_form, lit_spans
from study.morphology import kata_to_hira, tokenize
from study.plain_polite import contracted, other_register
from study.romaji import kana_of

# The exercise each step kind asks, by the mode's base, and what stands
# in for it, first to last (study/modes.py's names).
FLASHCARD, FILL_IN, CONTRAST, BUILD, WRITE = "flashcard", "fill_in", "contrast", "build", "write"
# The snapshot's third list: the points the detector blanks (can_blank).
BLANK = "blank"
EXERCISES = {
    steps.CHOOSE: (CONTRAST, FILL_IN, FLASHCARD),
    steps.BUILD_KIND: (BUILD, CONTRAST, FILL_IN, FLASHCARD),
    steps.FLASHCARD: (FLASHCARD,),
}
# The step kind an exercise stands for, which the point's line lights.
KIND_OF_BASE = {CONTRAST: steps.CHOOSE, FILL_IN: steps.CHOOSE, BUILD: steps.BUILD_KIND,
                FLASHCARD: steps.FLASHCARD}

HELPERS = 2
_HELPER_POS = ("noun", "verb", "adjective")


def chain_for(kind: str) -> tuple[str, ...]:
    """The bases a step of `kind` is asked in, its own first."""
    return EXERCISES[kind]


# ── 作る Construire ───────────────────────────────────────────

_MARKS = re.compile(r"[\s。、．，,.！？!?「」『』（）()・…〜～]+")
_KANJI = re.compile(r"[\u4e00-\u9fff\u3005]")


def _slice(parts: list[dict], a: int, b: int) -> list[dict]:
    """The furigana parts between offsets a and b; a part with no reading
    is cut at the edges, a ruby part never is (the cuts avoid them)."""
    out, pos = [], 0
    for part in parts:
        start, end = pos, pos + len(part["text"])
        pos = end
        if end <= a or start >= b:
            continue
        if part.get("reading") is not None:
            out.append(dict(part))
        else:
            out.append({**part, "text": part["text"][max(a, start) - start: min(b, end) - start]})
    return out


def _cuts_ruby(parts: list[dict], at: int) -> bool:
    """Whether offset `at` falls inside a ruby part (its reading would be
    cut in half)."""
    pos = 0
    for part in parts:
        end = pos + len(part["text"])
        if part.get("reading") is not None and pos < at < end:
            return True
        pos = end
    return False


def _reading(parts: list[dict]) -> str:
    """What a run of parts says, in hiragana."""
    return kata_to_hira("".join(p.get("reading") or p["text"] for p in parts))


def _sources(entry: dict) -> list[tuple[str, str, dict]]:
    """Every sentence of the point with its translation, keyed: the
    examples (ex:n), the twists that carry one (tw:n), the scene's lines
    and its cue (sc:n)."""
    out = []
    for n, ex in enumerate(entry.get("examples") or []):
        if ex.get("jp") and ex.get("en") and ex.get("fr"):
            out.append((f"ex:{n}", ex["jp"], texts(ex)))
    tour = entry.get("tour") or {}
    for n, tw in enumerate(tour.get("twists") or []):
        tr = tw.get("tr") or {}
        if tw.get("jp") and tr.get("en") and tr.get("fr"):
            out.append((f"tw:{n}", tw["jp"], tr))
    scene = tour.get("scene") or {}
    lines = list(scene.get("lines") or [])
    if (scene.get("ask") or {}).get("cue"):
        lines.append(scene["ask"]["cue"])
    for n, line in enumerate(lines):
        if line.get("jp") and line.get("en") and line.get("fr"):
            out.append((f"sc:{n}", line["jp"], texts(line)))
    return out


MAX_GAPS = 2

# A point the detector lights with the word it follows, whose hole holds
# its own piece alone (plan 319): 〜も（強調） is lit on 三度も, and the
# hole asked for the count too -- under « three whole times », 三回も
# was refused. The count stays in the sentence; the hole holds も.
_PIECE_ONLY = {"〜も（強調）": "も"}


_INFLECTING = ("verb", "adjective", "suffix")


def _ends_in_inflection(t, cut: int) -> bool:
    """Whether the cut at `cut` letters into the token falls in the part
    that inflects -- the ませ of ます past its ま, the っ of 思っ, the かっ
    of ほしかっ -- and not inside the word itself. An auxiliary is all
    ending (で|す, だ|った); a verb, adjective or suffix inflects past the
    letters its dictionary form shares (おもっ and おもう share おも); a
    noun never does. So ごろ|つき, まま|ね and がい|が, where the tokenizer
    read ごろつく, まねる and 衣蛾 across the point, are no word cut."""
    rest = t.surface[cut:]
    if not rest or _KANJI.search(rest):
        return False
    if t.pos == "auxiliary":
        return True
    if t.pos not in _INFLECTING or not t.cform or not t.reading or not t.lemma_reading:
        return False
    reading, lemma = kata_to_hira(t.reading), kata_to_hira(t.lemma_reading)
    at = len(reading) - len(kata_to_hira(rest))
    shared = 0
    while shared < min(len(reading), len(lemma)) and reading[shared] == lemma[shared]:
        shared += 1
    return at >= shared


def _word_kept(jp: str, spans: list[tuple[int, int]]) -> list[tuple[int, int]]:
    """Each gap carried to the end of a word it would cut (plan 295).

    A hole may stop where a word's ending begins -- てしまい + ました,
    なかっ + た: what the point is stays inside it and the sentence's
    inflection outside. Not inside the ending itself: the stems lit
    ことがあ|ります, が分かりま|せん, おかげで|す, and a learner who typed
    the word was one kana or two off. Nor inside ありません, which is ない
    said politely, one word (grammar_detect's _tail reads it so): the
    detector lights the copula's negative to its あり (これはわたしのかさ
    ではあり|ません) and a negative ない to its ませ (もうお金がありませ|ん),
    and the hole held the word without its negation -- ありません typed
    in it was one kana too many, and あり typed in the first was
    corrected to ではあり, which is no form of です. So a gap that ends
    inside a word's ending takes the rest of that token
    (_ends_in_inflection), and one that then ends on that あり, or on the
    ませ of any ません, takes the rest of the negative: ことがあり,
    ができません, ではありません. Where the rest belongs to the point's
    next piece the gap is left as it is. A gap's start is never moved:
    a point's piece is often an ending (大き + く, 書き + 直す) -- but
    for the ん of ません, which the detector lights as a negative's
    piece (どこへも行きませ|ん|でした, 何も／誰も〜ない): the hole takes
    its ませ, so it holds the word ません and no kana of it (plan 319)."""
    tokens = tokenize(jp) or []
    if not tokens:
        return spans
    out = []
    for a, b in spans:
        k = next((i for i, t in enumerate(tokens) if t.start == a), None)
        if (k and tokens[k].lemma == "ず" and tokens[k].surface == "ん"
                and tokens[k - 1].lemma == "ます" and tokens[k - 1].surface == "ませ"
                and not any(b2 > tokens[k - 1].start for _a2, b2 in out)):
            a = tokens[k - 1].start                                  # ませ|ん
        end = b
        inside = next((t for t in tokens if t.start < end < t.end), None)
        if inside is not None and inside.start >= a and _ends_in_inflection(inside, end - inside.start):
            end = inside.end
        k = next((i for i, t in enumerate(tokens) if t.end == end), None)
        if k is not None:
            t, after = tokens[k], tokens[k + 1:k + 3]
            if t.lemma == "ます" and t.surface == "ませ" and after and after[0].lemma == "ず":
                end = after[0].end                                   # ありませ|ん
            elif (t.lemma in ("有る", "ある") and len(after) == 2 and after[0].lemma == "ます"
                  and after[0].surface == "ませ" and after[1].lemma == "ず"):
                end = after[1].end                                   # ではあり|ません
        if any(b <= a2 < end for a2, _ in spans):
            end = b
        out.append((a, end))
    return out


@lru_cache(maxsize=1024)
def _build_items(level: str, pattern: str) -> tuple:
    """The point's sentences a Construire can be cut from, each as (key,
    jp, spans, tr): the point lit in one stretch, or two for a point
    written in two pieces (あまり〜ない), never the whole sentence, every
    edge between ruby parts, no word's ending cut in two (_word_kept).
    Cached: the tokenizer reads each sentence once. `tr` is the
    translation as (lang, text) pairs, every language it is written in
    (Spanish where it is, plan 302), frozen with the rest of the cached
    item."""
    found = find(pattern)
    if found is None or found[0] != level:
        return ()
    out = []
    for key, jp, tr in _sources(found[1]):
        # A twist or a scene line is cut only where the detector reads the
        # point in it (plan 319). A tour's lines are written to set the
        # point against its rivals and its lookalikes, and where the
        # detector finds nothing the stems' first match cut the rival's
        # sentence on the point's letters: ないで in 話さないでください,
        # ことに in 行くことにしました under 〜ことになる, そう in
        # おいしそうです under the hearsay, あそこの's この. The examples
        # are the point's own, and keep the stems' match.
        spans = _word_kept(jp, [tuple(sp) for sp in lit_spans(jp, pattern, level,
                                                              fallback=key.startswith("ex:"))])
        piece = _PIECE_ONLY.get(pattern)
        if piece:
            spans = [(b - len(piece), b) if jp[a:b].endswith(piece) else (a, b) for a, b in spans]
        if not 1 <= len(spans) <= MAX_GAPS:
            continue
        body = jp.rstrip("。！？!?")
        if sum(b - a for a, b in spans) >= len(body):
            continue
        parts = align_sentence(jp)
        if any(_cuts_ruby(parts, edge) for span in spans for edge in span):
            continue
        if not all(_reading(_slice(parts, a, b)) for a, b in spans):
            continue
        out.append((key, jp, tuple(spans), tuple(sorted(texts(tr).items()))))
    return tuple(out)


def can_build(level: str, pattern: str) -> bool:
    """Whether a Construire can be cut for the point -- the slow answer,
    which reads every sentence through the tokenizer and the detector.
    build_ok() reads it from the snapshot."""
    return bool(_build_items(level, pattern))


def _build_item(level: str, pattern: str, turn: int = 0) -> tuple | None:
    """The sentence a Construire asks on its `turn`: the point's items in
    an order shuffled once per point, so each review asks another one."""
    items = list(_build_items(level, pattern))
    if not items:
        return None
    random.Random(f"build:{level}:{pattern}").shuffle(items)
    return items[turn % len(items)]


def build_payload(level: str, entry: dict, lang: str, turn: int = 0) -> dict | None:
    """{key, tr, pieces} for one of the point's sentences, or None where
    none can be cut (build_ok). `pieces` is the sentence in order, each
    {furigana} or a gap {gap: n, size} -- `size` the kana it holds, so its
    width gives nothing away. `turn` picks the sentence, so each review
    asks another one (the review count); the order is shuffled once per
    point. The answer stays here: the client sends what was typed to
    check_build with the `key`. The word before a gap is a part of its
    own (hold_word), so the client holds the gap to that word and not to
    the whole run of kana before it."""
    item = _build_item(level, entry["pattern"], turn)
    if item is None:
        return None
    key, jp, spans, tr = item
    parts = align_sentence(jp)
    pieces, pos = [], 0
    for n, (a, b) in enumerate(spans):
        if a > pos:
            pieces.append({"furigana": hold_word(_slice(parts, pos, a), jp, a)})
        pieces.append({"gap": n, "size": len(_reading(_slice(parts, a, b)))})
        pos = b
    if pos < len(jp):
        pieces.append({"furigana": _slice(parts, pos, len(jp))})
    return {"key": key, "tr": translation(dict(tr), lang), "pieces": pieces}


def build_specimen(level: str, entry: dict, lang: str) -> dict | None:
    """Construire's first card with what is typed into its holes, for a
    line's station to show the exercise by (plan 251): {pieces, tr}, the
    pieces {text} or {gap} with the gap's text. The sentence is the one
    build_payload asks first; the station is static content, the same
    for every learner, so the answer it shows is one illustration's."""
    item = _build_item(level, entry["pattern"])
    if item is None:
        return None
    _key, jp, spans, tr = item
    pieces, pos = [], 0
    for a, b in spans:
        if a > pos:
            pieces.append({"text": jp[pos:a]})
        pieces.append({"gap": jp[a:b]})
        pos = b
    if pos < len(jp):
        pieces.append({"text": jp[pos:]})
    return {"pieces": pieces, "tr": translation(dict(tr), lang)}


def _norm(text: str) -> str:
    """What was typed, in the form it is compared in: kana in hiragana,
    no marks or spaces; romaji read as kana first."""
    text = unicodedata.normalize("NFKC", text or "").strip()
    as_kana = kana_of(text)
    if as_kana is not None:
        text = as_kana
    return kata_to_hira(_MARKS.sub("", text))


def _marks(given: str, expected: str) -> list[dict]:
    """The answer against what was typed, as runs to draw: {ok} where they
    agree, {wrong, fix} where they differ (either may be empty)."""
    out = []
    matcher = difflib.SequenceMatcher(a=given, b=expected, autojunk=False)
    for op, i1, i2, j1, j2 in matcher.get_opcodes():
        if op == "equal":
            out.append({"ok": expected[j1:j2]})
        else:
            out.append({"wrong": given[i1:i2], "fix": expected[j1:j2]})
    return out


def _heard(given: str) -> str:
    """What was typed, read: a kanji the keyboard put in (下さい for
    ください, 思う for おもう) is read as the tokenizer reads it."""
    return _reading(align_sentence(given)) if _KANJI.search(given) else given


def _one_off(given: str, reading: str) -> bool:
    ops = difflib.SequenceMatcher(a=given, b=reading, autojunk=False).get_opcodes()
    changed = sum(max(i2 - i1, j2 - j1) for op, i1, i2, j1, j2 in ops if op != "equal")
    return bool(given) and changed == 1 and len(reading) > 1


def _gap_verdict(typed: str, forms: list[tuple[str, str]]) -> tuple[str, int, str]:
    """(verdict, form, heard): what was typed against each of the gap's
    forms (written, read), the sentence's own first -- `right` as one is
    written or read, `close` one kana off one, else `wrong`; the form it
    was judged against (the sentence's own for a wrong answer), and what
    was typed, read."""
    given = _norm(typed)
    heard = _heard(given)
    for n, (written, reading) in enumerate(forms):
        if given == _norm(written) or heard == reading:
            return "right", n, heard
    for n, (_, reading) in enumerate(forms):
        if _one_off(heard, reading):
            return "close", n, heard
    return "wrong", 0, heard


# A point written two ways the translation cannot tell apart (plan 319):
# the hole holds the sentence's, and the other is as right -- なきゃ and
# なくちゃ, the two contractions 〜なきゃ／〜なくちゃ teaches, and
# によらず and にかかわらず, which 〜いかんによらず's rule gives both.
VARIANT = "variant"
_VARIANTS = {
    "〜なきゃ／〜なくちゃ": (("なきゃ", "なくちゃ"),),
    "〜いかんによらず": (("によらず", "にかかわらず"),),
}
_CAUSATIVE_PASSIVE = "使役受身形 〜させられる"
# The あ-row kana a う-verb's stem ends in before せる (習わ, 待た, 働か),
# less さ: 話させられる has no 話さされる.
_A_ROW = frozenset("かがたなばまらわ")


def _variants(jp: str, a: int, written: str, reading: str, pattern: str) -> list[tuple[str, str]]:
    """The hole's other spellings of the same point (plan 319): a pair of
    _VARIANTS, and a う-verb's causative passive, as right short
    (習わされた, the usual one) as long (習わせられた), both ways."""
    out = []
    for x, y in _VARIANTS.get(pattern, ()):
        for old, new in ((x, y), (y, x)):
            if old in written and old in reading:
                out.append((written.replace(old, new, 1), reading.replace(old, new, 1)))
    if pattern == _CAUSATIVE_PASSIVE and a > 0 and jp[a - 1] in _A_ROW:
        for old, new in (("せられ", "され"), ("され", "せられ")):
            if written.startswith(old) and reading.startswith(old):
                out.append((new + written[len(old):], new + reading[len(old):]))
                break
    return out


def _gap_forms(jp: str, a: int, b: int, written: str, reading: str, pattern: str) -> list[tuple]:
    """Every (written, read, how) the hole jp[a:b] is right as: the
    sentence's own first (how None), then the other register (how the
    sentence's register), then では or じゃ said the other way, in each of
    those (how the sentence's: full or contracted, but the register where
    that differs too), then the point's other spelling (how VARIANT).
    かさではありません takes じゃありません, ではない and じゃない."""
    forms = [(written, reading, None)]
    other = other_register(jp, a, b, reading, pattern)
    if other:
        forms += [(w, r, other[0]) for w, r in other[1]]
    spoken = contracted(jp, a, b, reading)
    if spoken:
        said, old, new = spoken
        forms += [(w.replace(old, new, 1), r.replace(old, new, 1), how or said)
                  for w, r, how in list(forms) if old in w and old in r]
    forms += [(w, r, VARIANT) for w, r in _variants(jp, a, written, reading, pattern)]
    out, seen = [], set()
    for form in forms:
        if form[1] not in seen:
            seen.add(form[1])
            out.append(form)
    return out


def check_build(level: str, pattern: str, key: str, answers: list[str], lang: str) -> dict | None:
    """The verdict on a Construire, gap by gap: `right` when what was typed
    is the point as written or as read, `close` when one kana is off (書い
    で for 書いて), else `wrong`; the whole is right when every gap is,
    close when none is wrong. A gap that closes its sentence is right in
    either register too (plan 241): the translation does not say which,
    so です answers あしたはテストだ (study/plain_polite.py), and では
    before a negative is right said じゃ, and じゃ said では (plan 295):
    the translation says neither. Each gap carries its answer, its
    reading and the runs that draw the correction, and, where it was
    judged in another form, what the sentence `said` and how
    (`register`: plain or polite, else full or contracted); the whole
    sentence comes back lit. None for a key the point has no sentence
    under. Nothing typed is kept."""
    item = next((i for i in _build_items(level, pattern) if i[0] == key), None)
    if item is None:
        return None
    _, jp, spans, tr = item
    parts = align_sentence(jp)
    gaps = []
    for n, (a, b) in enumerate(spans):
        written = jp[a:b]
        reading = _reading(_slice(parts, a, b))
        forms = _gap_forms(jp, a, b, written, reading, pattern)
        verdict, form, heard = _gap_verdict(answers[n] if n < len(answers) else "", [f[:2] for f in forms])
        gap = {
            "verdict": verdict, "answer": forms[form][0], "reading": reading,
            "marks": [] if verdict == "right" else _marks(heard, forms[form][1]),
        }
        if form:
            gap.update(said=written, register=forms[form][2])
        gaps.append(gap)
    verdicts = {g["verdict"] for g in gaps}
    whole = "right" if verdicts == {"right"} else "wrong" if "wrong" in verdicts else "close"
    return {
        "verdict": whole,
        "gaps": gaps,
        "jp": jp,
        "tr": translation(dict(tr), lang),
        "furigana": mark_spans(parts, list(spans)),
    }


# ── 書く write ────────────────────────────────────────────────

def _helpers(jp: str, span: tuple[int, int]) -> list[dict]:
    """Up to HELPERS words of the sentence the learner may use, in their
    dictionary form, outside the point: nouns first, then verbs and
    adjectives, as {text, reading}."""
    tokens = tokenize(jp) or []
    picked = []
    for pos in _HELPER_POS:
        for t in tokens:
            if t.pos != pos or span[0] <= t.start < span[1]:
                continue
            text = _dictionary_form(t) if pos != "noun" else t.surface
            if not text or any(h["text"] == text for h in picked):
                continue
            reading = t.lemma_reading if pos != "noun" else t.reading
            picked.append({"text": text, "reading": reading if reading and reading != text else None})
            if len(picked) == HELPERS:
                return picked
    return picked


@lru_cache(maxsize=1024)
def _write_examples(level: str, pattern: str) -> tuple:
    found = find(pattern)
    if found is None or found[0] != level or not can_find(pattern):
        return ()
    out = []
    for i, example in enumerate(found[1].get("examples", [])):
        jp = example.get("jp") or ""
        if not jp or not (example.get("en") and example.get("fr")):
            continue
        spans = lit_spans(jp, pattern, level)
        if spans:
            out.append((i, tuple(tuple(s) for s in spans)))
    return tuple(out)


def can_blank(level: str, pattern: str) -> bool:
    """Whether the contrast drill can be drawn for a point the stems cannot
    point at (a bare particle, plan 190): it compares something and the
    detector blanks one of its marked sentences (blank_span). False for a
    verifiable point, which card_index.contrast_ok answers on its own."""
    found = find(pattern)
    if verifiable(pattern) or found is None or found[0] != level or not found[1].get("compare"):
        return False
    return any(blank_span(ex.get("jp") or "", pattern, level)
               for ex in found[1].get("examples", []) if ex.get("contrast"))


def can_write(level: str, pattern: str) -> bool:
    """Whether the point can be written and checked -- the slow answer,
    as can_build. write_ok() reads it from the snapshot."""
    return bool(_write_examples(level, pattern))


# ── The snapshot ──────────────────────────────────────────────
# Asking can_build and can_write of all 545 points takes some twelve
# seconds -- the detector over every example -- and the card index asks
# them of every point to count the two platforms' totals. `blank` is the
# same for the contrast drill's points the stems cannot blank (can_blank,
# plan 190), which the index asks of every point too. So the answers
# are written down: content/grammar/ladder.json, which
# `python -m scripts.build_ladder_flags` rewrites after a catalogue change
# and tests/test_grammar_ladder.py holds equal to what the two compute.
# A stale entry costs a card, never an error: build_payload and
# write_payload return None and the ladder falls back a rung.
SNAPSHOT = Path(__file__).resolve().parents[1] / "content" / "grammar" / "ladder.json"


@lru_cache(maxsize=1)
def _snapshot() -> dict[str, dict[str, frozenset[str]]]:
    try:
        data = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    return {level: {k: frozenset(v) for k, v in flags.items()} for level, flags in data.items()}


def snapshot_now() -> dict[str, dict[str, list[str]]]:
    """What the snapshot should hold for the catalogue as it stands."""
    from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
    return {
        level: {
            BUILD: [e["pattern"] for e in entries if can_build(level, e["pattern"])],
            WRITE: [e["pattern"] for e in entries if can_write(level, e["pattern"])],
            BLANK: [e["pattern"] for e in entries if can_blank(level, e["pattern"])],
        }
        for level, entries in GRAMMAR_POINTS_BY_LEVEL.items()
    }


def build_ok(level: str, pattern: str) -> bool:
    return pattern in _snapshot().get(level, {}).get(BUILD, ())


def write_ok(level: str, pattern: str) -> bool:
    return pattern in _snapshot().get(level, {}).get(WRITE, ())


def blank_ok(level: str, pattern: str) -> bool:
    return pattern in _snapshot().get(level, {}).get(BLANK, ())


def write_payload(level: str, entry: dict, lang: str, rng: random.Random | None = None) -> dict | None:
    """{situation, helpers, model} for one of the point's examples: the
    sentence's meaning to say in Japanese, two of its words to say it
    with, and the sentence itself, lit, for after the check. None where
    the detector cannot judge the point (write_ok)."""
    rng = rng or random
    options = _write_examples(level, entry["pattern"])
    if not options:
        return None
    index, spans = rng.choice(options)
    example = entry["examples"][index]
    jp = example["jp"]
    tr = translation(example, lang)
    return {
        "situation": tr,
        "helpers": _helpers(jp, spans[0]),
        "model": {"jp": jp, "tr": tr, "furigana": mark_spans(align_sentence(jp), list(spans))},
    }
