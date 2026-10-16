"""
The gate every grammar point passes before it reaches a learner (plan 087).

content/grammar/*.json was drafted with an AI model and is edited in place,
which means any edit can break it, and a grammar lesson is the one place
a learner cannot spot the error themselves: they are reading it because
they do not know the pattern yet. So the shape of an entry, the two languages, the example sentences
and the contrast marks are all checked in code, here, by one function
that tests/test_grammar_points.py runs over the whole catalogue and
scripts/check_grammar.py runs from the command line while authoring.

No database, no FastAPI: this imports content and the two grammar
helpers only, so it runs in a clone with nothing configured.

Every rule returns a one-line reason in the style of
study/grammar_sentence_gen.check_sentence, prefixed with the level and
the pattern, so a failing build names the entry to fix.
"""
import re
import unicodedata

from content.grammar_points_data import (
    GRAMMAR_POINTS_BY_LEVEL, LEVELS, RICH_LEVELS, find,
)
from study.furigana import is_kanji
from study.grammar_examples import KANA_READING, blank_span, pattern_furigana, structure_furigana
from study.grammar_match import contains_pattern, verifiable
from study.grammar_sentence_gen import check_sentence
from study.llm_shared import sentence_kanji_ok

ENTRY_KEYS = frozenset({"pattern", "reading", "structure", "structure_reading", "structure_fr", "meaning", "register", "steps", "compare", "examples", "choose", "tour"})
REQUIRED_KEYS = frozenset({"pattern", "structure", "structure_fr", "meaning", "steps", "compare", "examples"})
STEP_KINDS = ("rule", "use", "careful")
REGISTERS = frozenset({"neutral", "casual", "polite", "formal", "written"})
EXAMPLE_KEYS = frozenset({"jp", "en", "fr", "register", "contrast"})
LANGS = ("en", "fr")

# Caps that keep a step a step and not an essay (README: rule <= 2
# sentences, use <= 3 bullets, careful <= 2 sentences). Characters, per
# language, generous enough for French.
MAX_STEP_CHARS = 420
MAX_COMPARE_CHARS = 220

# Rich levels need this many examples; the others keep today's two.
MIN_EXAMPLES_RICH = 3
MIN_EXAMPLES = 2

_CJK = re.compile(r"[぀-ヿ一-鿿]")
_LATIN = re.compile(r"[A-Za-zÀ-ÿ]{3}")


def _text_problems(what: str, pair, rich: bool, max_chars: int, bullets: bool = False) -> list[str]:
    """An {en, fr} pair: both present, both prose, within the cap, and
    (at a rich level) actually two languages. A gloss or a note may name
    a Japanese form ("in (formal 〜で)"); only a sentence's translation
    may not (see check_entry's example loop). `bullets` turns on the
    "- " rule, which only a lesson step uses -- a gloss such as "-ish"
    starts with a hyphen and is not a list."""
    out = []
    if not isinstance(pair, dict):
        return [f"{what}: expected {{en, fr}}, got {type(pair).__name__}"]
    for lang in LANGS:
        text = pair.get(lang)
        if not isinstance(text, str) or not text.strip():
            out.append(f"{what}.{lang} is empty")
            continue
        if text != text.strip():
            out.append(f"{what}.{lang} has surrounding whitespace")
        if not _LATIN.search(text):
            out.append(f"{what}.{lang} is not prose")
        if len(text) > max_chars:
            out.append(f"{what}.{lang} is {len(text)} chars, cap {max_chars}")
        if text.count("**") % 2:
            out.append(f"{what}.{lang} has an unbalanced ** run")
        if bullets:
            for line in text.split("\n"):
                if line.startswith("-") and not line.startswith("- "):
                    out.append(f"{what}.{lang}: a bullet line must start with '- '")
    if rich and isinstance(pair.get("en"), str) and pair.get("en") == pair.get("fr"):
        out.append(f"{what}: fr is a copy of en (rich levels are written in both languages)")
    return out


# ── The formation line in French (plan 210) ──
# `structure_fr` is the same formula as `structure` with its English
# words in French: "verb て-form + ください" is "verbe forme en て +
# ください". Its Japanese is the English line's, character for
# character and in order, because the French furigana is carried over
# from `structure_reading` by matching those runs
# (grammar_examples.structure_furigana) -- and because the formula is
# the same formula. A word of English left in it is a line half done.
_FR_ENGLISH = re.compile(
    r"\b(verb|verbs|noun|nouns|form|stem|adjective|sentence|clause|the|or|and|with|without|plain|polite|dictionary)\b",
    re.IGNORECASE)


def _japanese_skeleton(text: str) -> str:
    """What is left of a formation line once its Latin words, spaces and
    their punctuation are gone: its Japanese, its + and its brackets."""
    return "".join(
        c for c in text
        if not (c.isspace() or c in ".,'-" or "LATIN" in unicodedata.name(c, ""))
    )


def _structure_fr_problems(entry: dict) -> list[str]:
    fr = entry.get("structure_fr")
    if not isinstance(fr, str) or not fr.strip():
        return ["structure_fr is empty"]
    out = []
    if fr != fr.strip():
        out.append("structure_fr has surrounding whitespace")
    english = entry["structure"]
    if _japanese_skeleton(fr) != _japanese_skeleton(english):
        out.append(f"structure_fr {fr!r} does not carry structure {english!r}'s Japanese, in order")
    left = _FR_ENGLISH.findall(fr)
    if left:
        out.append(f"structure_fr {fr!r} still has English: {sorted(set(w.lower() for w in left))}")
    if entry.get("structure_reading") and not any(
            p.get("reading") for p in structure_furigana(entry, "fr")):
        out.append(f"structure_fr {fr!r} takes no ruby from the English line's reading")
    return out


def _reading_problems(what: str, key: str, text: str, reading) -> list[str]:
    """A text's reading, which the app prints over its kanji -- the
    pattern's `reading`, the formation's `structure_reading`: on every
    such text with a kanji and on no other, spelling the text with each
    kanji run written in kana -- so that it divides run by run, and no
    reading lands on 〜, a particle, a bracket or an English word."""
    has_kanji = any(is_kanji(c) or c == "々" for c in text)
    if reading is None:
        return [f"a {what} with kanji carries its {key}"] if has_kanji else []
    if not has_kanji:
        return [f"{key} on a {what} with no kanji"]
    if not isinstance(reading, str) or not reading.strip() or reading != reading.strip():
        return [f"{key} is empty or has surrounding whitespace"]
    parts = pattern_furigana(text, reading)
    read = [p["reading"] for p in parts if p.get("reading")]
    if not read:
        return [f"{key} {reading!r} does not spell the {what} (everything as written, each kanji run in kana)"]
    return [f"{key} {r!r} is not kana" for r in read if not KANA_READING.fullmatch(r)]


# ── The tour's authored block (plan 187c) ──────────────────────────
# A point's `tour` is the stops the catalogue cannot derive: the twists
# (each a sentence that shows the point in one of its notions -- a second
# use, a sense, a form, or the nearest rival -- and three readings of it)
# and the scene (a short dialogue at a station place in which the point
# does its job, then the learner's own line chosen from three). Both are
# required where a tour is written at all. Plan 189 made the twist a list,
# one per notion the point has beyond the meaning the guess asks, each
# named by its `notion`, so the tour walks every one.
TOUR_KEYS = frozenset({"twists", "scene", "quiz"})
# The quiz (plan 196) is written for every point's tour; a tour without one
# is the half-written shape the catalogue was moved off.
QUIZ_REQUIRED = True
TWIST_KEYS = frozenset({"notion", "jp", "ask", "choices", "why", "pair", "tr", "kind"})
# What a twist is (plan 194): another use of the point, or a trap set
# against it -- a rival that looks like it. The tutorial's usages stop
# and its quiz read it.
TWIST_KINDS = frozenset({"usage", "trap"})
TWIST_REQUIRED = frozenset({"notion", "jp", "ask", "choices", "why"})
TWISTS = (1, 6)
MAX_NOTION_CHARS = 40
SCENE_KEYS = frozenset({"place", "them", "lines", "note", "ask"})
SCENE_ASK_KEYS = frozenset({"cue", "task", "choices", "why"})
SCENE_LINES = (2, 5)
# The quiz's authored questions (plan 196), each of one kind: read a
# sentence (`meaning`: its translation held back), build a form (`form`:
# the form blanked, three fillings), say the right thing in a situation
# (`use`: three Japanese lines). None of them is the old "which of these
# uses it?", which asked the eye and not the learner.
QUIZ_KINDS = {
    "meaning": frozenset({"kind", "ask", "jp", "tr", "choices", "why"}),
    "form": frozenset({"kind", "ask", "jp", "tr", "choices", "why"}),
    "use": frozenset({"kind", "ask", "choices", "why"}),
}
QUIZ_QUESTIONS = (4, 6)
TOUR_CHOICES = 3
MAX_LINE_CHARS = 60
MAX_TOUR_CHARS = 220


def _carries(jp: str, pattern: str, level: str) -> bool | None:
    """Whether `jp` writes the point: the detector's word where it can be
    trusted on this point (grammar_detect.can_find), else the stems'
    where the pattern has any, else no answer (None)."""
    from study.grammar_detect import can_find, hits
    if can_find(pattern):
        return any((h["pattern"], h["level"]) == (pattern, level) for h in hits(jp))
    if verifiable(pattern):
        return contains_pattern(jp, pattern)
    return None


def _line_problems(what: str, jp, level: str, pattern: str) -> list[str]:
    """One Japanese line of a tour: a whole sentence, short, in the
    level's kanji (the pattern's own exempt, as an example's are)."""
    if not isinstance(jp, str) or not jp.strip():
        return [f"{what} is empty"]
    out = []
    if jp != jp.strip():
        out.append(f"{what} has surrounding whitespace")
    if jp[-1] not in "。！？":
        out.append(f"{what} does not end in 。！？")
    if len(jp) > MAX_LINE_CHARS:
        out.append(f"{what} is {len(jp)} chars, cap {MAX_LINE_CHARS}")
    if _LATIN.search(jp):
        out.append(f"{what} has Latin letters in it")
    if not _CJK.search(jp):
        out.append(f"{what} is not Japanese")
    bad = sorted({
        c for c in jp
        if "一" <= c <= "鿿" and c not in set(pattern) and not sentence_kanji_ok(c, level)
    })
    if bad:
        out.append(f"{what} uses kanji above {level}: {''.join(bad)}")
    return out


def _spoken_problems(what: str, line, level: str, pattern: str, rich: bool) -> list[str]:
    """A line of a scene: who says it, what, and its translation."""
    from study.grammar_tour import SCENE_WHO
    if not isinstance(line, dict) or set(line) != {"who", "jp", "en", "fr"}:
        return [f"{what} must be {{who, jp, en, fr}}"]
    out = []
    if line["who"] not in SCENE_WHO:
        out.append(f"{what} who {line['who']!r} not in {SCENE_WHO}")
    out += _line_problems(f"{what} jp", line["jp"], level, pattern)
    for lang in LANGS:
        tr = line[lang]
        if not isinstance(tr, str) or not tr.strip() or tr != tr.strip():
            out.append(f"{what} {lang} is empty or has surrounding whitespace")
        elif _CJK.search(tr):
            out.append(f"{what} {lang} contains Japanese")
    if rich and line["en"] == line["fr"]:
        out.append(f"{what} fr is a copy of en")
    return out


def _twist_problems(what: str, twist, level: str, pattern: str, rich: bool) -> list[str]:
    """One twist: the notion it shows, a sentence, a question over it,
    three readings with the right one first -- the second the confusion
    the two-choice usages stop asks against (plan 194) -- and the why;
    its translation and its kind where written."""
    if not isinstance(twist, dict) or not TWIST_REQUIRED <= set(twist) or set(twist) - TWIST_KEYS:
        return [f"{what} must be {{notion, jp, ask, choices, why[, pair]}}"]
    out = _text_problems(f"{what} notion", twist["notion"], rich, MAX_NOTION_CHARS)
    out += _line_problems(f"{what} jp", twist["jp"], level, pattern)
    out += _text_problems(f"{what} ask", twist["ask"], rich, MAX_TOUR_CHARS)
    out += _text_problems(f"{what} why", twist["why"], rich, MAX_TOUR_CHARS)
    choices = twist["choices"]
    if not isinstance(choices, list) or len(choices) != TOUR_CHOICES:
        out.append(f"{what} has {len(choices) if isinstance(choices, list) else '?'} choices, needs {TOUR_CHOICES} (the answer first)")
    else:
        for i, choice in enumerate(choices):
            out += _text_problems(f"{what} choice {i}", choice, rich, MAX_TOUR_CHARS)
        texts = [c.get("en") for c in choices if isinstance(c, dict)]
        if len(set(texts)) != len(texts):
            out.append(f"{what} choices repeat")
    tr = twist.get("tr")
    if tr is not None:
        # The sentence's translation, shown under it (plan 194): no
        # Japanese, as no translation may hold any.
        out += _text_problems(f"{what} tr", tr, rich, MAX_TOUR_CHARS)
        if isinstance(tr, dict) and any(_CJK.search(tr.get(lang) or "") for lang in LANGS):
            out.append(f"{what} tr holds Japanese")
    if "kind" in twist and twist["kind"] not in TWIST_KINDS:
        out.append(f"{what} kind must be one of {sorted(TWIST_KINDS)}")
    pair = twist.get("pair")
    if pair is not None and (
        not isinstance(pair, list) or len(pair) != 2
        or any(not isinstance(p, str) or not _CJK.search(p) or _LATIN.search(p) for p in pair)
    ):
        out.append(f"{what} pair must be two Japanese forms")
    return out


def _tour_problems(level: str, entry: dict, rich: bool) -> list[str]:
    from study.grammar_tour import SCENE_PLACES
    pattern = entry.get("pattern") or ""
    tour = entry["tour"]
    if not isinstance(tour, dict) or not {"twists", "scene"} <= set(tour) <= TOUR_KEYS:
        return ["tour must be {twists, scene, quiz}"]
    if QUIZ_REQUIRED and "quiz" not in tour:
        return ["tour has no quiz (plan 196)"]
    out: list[str] = []

    twists = tour["twists"]
    if not isinstance(twists, list) or not TWISTS[0] <= len(twists) <= TWISTS[1]:
        out.append(f"tour has {len(twists) if isinstance(twists, list) else '?'} twists, needs {TWISTS[0]}–{TWISTS[1]}")
        twists = twists if isinstance(twists, list) else []
    for n, twist in enumerate(twists):
        out += _twist_problems(f"tour twist {n}", twist, level, pattern, rich)
    sentences = [t.get("jp") for t in twists if isinstance(t, dict)]
    if len(set(sentences)) != len(sentences):
        out.append("tour twists repeat a sentence")
    notions = [(t.get("notion") or {}).get("en") for t in twists if isinstance(t, dict) and isinstance(t.get("notion"), dict)]
    if len(set(notions)) != len(notions):
        out.append("tour twists repeat a notion")

    scene = tour["scene"]
    if not isinstance(scene, dict) or set(scene) != SCENE_KEYS:
        out.append("tour scene must be {place, them, lines, note, ask}")
        return out
    if scene["place"] not in SCENE_PLACES:
        out.append(f"tour scene place {scene['place']!r} not in {sorted(SCENE_PLACES)}")
    out += _text_problems("tour scene them", scene["them"], rich, MAX_TOUR_CHARS)
    out += _text_problems("tour scene note", scene["note"], rich, MAX_TOUR_CHARS)
    lines = scene["lines"]
    if not isinstance(lines, list) or not SCENE_LINES[0] <= len(lines) <= SCENE_LINES[1]:
        out.append(f"tour scene has {len(lines) if isinstance(lines, list) else '?'} lines, needs {SCENE_LINES[0]}–{SCENE_LINES[1]}")
        lines = lines if isinstance(lines, list) else []
    for i, line in enumerate(lines):
        out += _spoken_problems(f"tour scene line {i}", line, level, pattern, rich)

    ask = scene["ask"]
    if not isinstance(ask, dict) or set(ask) != SCENE_ASK_KEYS:
        out.append("tour scene ask must be {cue, task, choices, why}")
        return out
    out += _spoken_problems("tour scene cue", ask["cue"], level, pattern, rich)
    out += _text_problems("tour scene task", ask["task"], rich, MAX_TOUR_CHARS)
    out += _text_problems("tour scene why", ask["why"], rich, MAX_TOUR_CHARS)
    choices = ask["choices"]
    if not isinstance(choices, list) or len(choices) != TOUR_CHOICES:
        out.append(f"tour scene ask has {len(choices) if isinstance(choices, list) else '?'} choices, needs {TOUR_CHOICES} (the answer first)")
        return out
    for i, jp in enumerate(choices):
        out += _line_problems(f"tour scene choice {i}", jp, level, pattern)
    if len(set(choices)) != len(choices):
        out.append("tour scene choices repeat")
    if out:
        return out

    # The scene is about the point: it is written in one of its lines (or
    # the cue), in the learner's answer, and in no wrong answer -- where
    # anything can tell (_carries); a point no rule reads is taken on trust.
    spoken = [line["jp"] for line in lines] + [ask["cue"]["jp"]]
    if not any(_carries(jp, pattern, level) is not False for jp in spoken):
        out.append("tour scene: no line writes the point")
    if _carries(choices[0], pattern, level) is False:
        out.append(f"tour scene: the answer {choices[0]!r} does not write the point")
    # A point that names its own alternatives (〜つ／〜人／〜枚, あります／
    # います) is learned by choosing among them, so a wrong answer may be
    # written with another of its forms; any other point's may not.
    if "／" not in pattern:
        for jp in choices[1:]:
            if _carries(jp, pattern, level) is True:
                out.append(f"tour scene: the wrong answer {jp!r} writes the point too")
    if "quiz" in tour:
        out += _quiz_problems(level, entry, rich)
    out += _repeat_problems(entry)
    return out


def _quiz_problems(level: str, entry: dict, rich: bool) -> list[str]:
    """The authored quiz (plan 196): four to six questions of the three
    kinds, each a sentence or a situation new to the tour, three answers
    with the right one first, and the why.

    What the checker cannot see, a reviewer must: that a wrong answer is
    one someone could say and is wrong for the reason its `why` gives,
    that the one thing the question turns on is the point and not a
    word, and that the right answer is the only right one."""
    from study.grammar_examples import BLANK
    pattern = entry.get("pattern") or ""
    quiz = entry["tour"]["quiz"]
    if not isinstance(quiz, list) or not QUIZ_QUESTIONS[0] <= len(quiz) <= QUIZ_QUESTIONS[1]:
        return [f"tour quiz has {len(quiz) if isinstance(quiz, list) else '?'} questions, needs {QUIZ_QUESTIONS[0]}–{QUIZ_QUESTIONS[1]}"]
    out: list[str] = []
    kinds = [q.get("kind") for q in quiz if isinstance(q, dict)]
    if len(set(kinds)) < 2:
        out.append("tour quiz asks one kind of question only")
    if any(kinds.count(k) > 3 for k in QUIZ_KINDS):
        out.append("tour quiz asks one kind of question more than three times")
    for n, q in enumerate(quiz):
        what = f"tour quiz {n}"
        if not isinstance(q, dict) or q.get("kind") not in QUIZ_KINDS:
            out.append(f"{what} kind must be one of {sorted(QUIZ_KINDS)}")
            continue
        kind = q["kind"]
        if set(q) != QUIZ_KINDS[kind]:
            out.append(f"{what} ({kind}) must be {{{', '.join(sorted(QUIZ_KINDS[kind]))}}}")
            continue
        out += _text_problems(f"{what} ask", q["ask"], rich, MAX_TOUR_CHARS)
        out += _text_problems(f"{what} why", q["why"], rich, MAX_TOUR_CHARS)
        choices = q["choices"]
        if not isinstance(choices, list) or len(choices) != TOUR_CHOICES:
            out.append(f"{what} has {len(choices) if isinstance(choices, list) else '?'} choices, needs {TOUR_CHOICES} (the answer first)")
            continue
        if kind == "meaning":
            out += _line_problems(f"{what} jp", q["jp"], level, pattern)
            out += _text_problems(f"{what} tr", q["tr"], rich, MAX_TOUR_CHARS)
            if isinstance(q["tr"], dict) and any(_CJK.search(q["tr"].get(lang) or "") for lang in LANGS):
                out.append(f"{what} tr holds Japanese")
            for i, choice in enumerate(choices):
                out += _text_problems(f"{what} choice {i}", choice, rich, MAX_TOUR_CHARS)
            texts = [c.get("en") for c in choices if isinstance(c, dict)]
            if len(set(texts)) != len(texts):
                out.append(f"{what} choices repeat")
            if isinstance(q["jp"], str) and _carries(q["jp"], pattern, level) is False:
                out.append(f"{what}: the sentence {q['jp']!r} does not write the point")
            continue
        # form and use hold Japanese in their choices.
        if kind == "form":
            jp = q["jp"]
            out += _text_problems(f"{what} tr", q["tr"], rich, MAX_TOUR_CHARS)
            if isinstance(q["tr"], dict) and any(_CJK.search(q["tr"].get(lang) or "") for lang in LANGS):
                out.append(f"{what} tr holds Japanese")
            if not isinstance(jp, str) or jp.count(BLANK) != 1:
                out.append(f"{what} jp must hold the blank {BLANK!r} once")
                continue
            if any(not isinstance(c, str) or not c.strip() or c != c.strip() or BLANK in c or _LATIN.search(c) or not _CJK.search(c) for c in choices):
                out.append(f"{what} choices must be Japanese forms")
                continue
            lines = [jp.replace(BLANK, c) for c in choices]
        else:
            if any(not isinstance(c, str) for c in choices):
                out.append(f"{what} choices must be Japanese lines")
                continue
            lines = list(choices)
        if len(set(lines)) != len(lines):
            out.append(f"{what} choices repeat")
        for i, line in enumerate(lines):
            out += _line_problems(f"{what} choice {i}", line, level, pattern)
        if _carries(lines[0], pattern, level) is False:
            out.append(f"{what}: the answer {lines[0]!r} does not write the point")
        if kind == "use" and "／" not in pattern:
            from study.grammar_detect import can_find
            # What the situation turns on is the point, never its presence
            # in a line: where the detector reads it, a wrong line writes it
            # too (the same verb in the wrong tense, the wrong register,
            # beside a rival that carries it).
            if can_find(pattern) and not any(_carries(line, pattern, level) for line in lines[1:]):
                out.append(f"{what}: no wrong line writes the point, so finding it answers the question")
    return out


# ── Choisir's own questions (plan 201) ─────────────────────────────
# A point the contrast drill cannot be drawn on is asked from its `choose`
# list (study/grammar_choose.py): a sentence with the hole, what it says,
# the fillings with the right one first, and a line for whoever takes a
# wrong one. Held here as the tour's quiz is: by shape, by kanji, by where
# the detector reads the point -- on the right filling's hole and on no
# wrong one's -- and by never being a sentence the tutorial showed. What
# the checker cannot see, a reviewer must: that the right filling is the
# only right one, that each wrong one is a slip someone could make and is
# wrong for the reason the line gives, and that what the hole turns on is
# the point and not a word.
CHOOSE_REQUIRED = frozenset({"jp", "tr", "choices", "why"})
# `slips` names the wrong fillings the detector may read as the point
# although the sentence rules them out: a form no one says (まちた for まった,
# which the detector reads as た形 like any た after a stem), or the point in
# the wrong tense or polarity (だったし where the sentence says あした). The
# author vouches for each, and the reviewer checks them: a wrong filling that
# is just as good an answer (なかった beside ない, where nothing in the
# sentence says the tense) is a second answer, never a slip.
CHOOSE_KEYS = CHOOSE_REQUIRED | {"slips"}


def _written_in(jp: str, span: tuple[int, int], pattern: str, level: str) -> bool | None:
    """Whether the point is written ON `span` of `jp`: a stretch the
    detector reads as the point overlaps it. The detector's word where it
    can be trusted on this point, else no answer (None)."""
    from study.grammar_detect import can_find, hits
    if not can_find(pattern):
        return None
    return any(
        (h["pattern"], h["level"]) == (pattern, level)
        and any(a < span[1] and span[0] < b for a, b in h["segments"])
        for h in hits(jp)
    )


def _tutorial_sentences(entry: dict) -> set[str]:
    """Every sentence the point's lesson and tour show or ask."""
    from study.grammar_tour import _met
    try:
        return _met(entry, [])
    except (KeyError, TypeError, AttributeError):
        return {ex["jp"] for ex in entry.get("examples") or [] if isinstance(ex, dict) and ex.get("jp")}


def _choose_problems(level: str, entry: dict, rich: bool) -> list[str]:
    from study.grammar_choose import CHOICES, MIN_ITEMS, cut
    from study.grammar_examples import BLANK
    pattern = entry.get("pattern") or ""
    items = entry["choose"]
    if not isinstance(items, list) or len(items) < MIN_ITEMS:
        return [f"choose has {len(items) if isinstance(items, list) else '?'} questions, needs at least {MIN_ITEMS} "
                "(one for each step of Choisir)"]
    out: list[str] = []
    tutorial = _tutorial_sentences(entry)
    seen: dict[str, int] = {}
    for n, item in enumerate(items):
        what = f"choose {n}"
        if not isinstance(item, dict) or not CHOOSE_REQUIRED <= set(item) <= CHOOSE_KEYS:
            out.append(f"{what} must be {{{', '.join(sorted(CHOOSE_REQUIRED))}}} and may carry slips")
            continue
        before = len(out)
        out += _text_problems(f"{what} tr", item["tr"], rich, MAX_TOUR_CHARS)
        if isinstance(item["tr"], dict) and any(_CJK.search(item["tr"].get(lang) or "") for lang in LANGS):
            out.append(f"{what} tr holds Japanese")
        out += _text_problems(f"{what} why", item["why"], rich, MAX_TOUR_CHARS)
        jp, choices = item["jp"], item["choices"]
        if not isinstance(jp, str) or jp.count(BLANK) != 1:
            out.append(f"{what} jp must hold the blank {BLANK!r} once")
            continue
        if any(c.isspace() for c in jp):
            # The tokenizer drops whitespace, so every offset after a space
            # would be one off and the hole would land beside its place.
            out.append(f"{what} jp holds a space, which the furigana would drop and shift the hole")
            continue
        if not isinstance(choices, list) or len(choices) not in CHOICES:
            out.append(f"{what} has {len(choices) if isinstance(choices, list) else '?'} choices, "
                       f"needs {' or '.join(map(str, CHOICES))} (the answer first)")
            continue
        if any(not isinstance(c, str) or not c.strip() or c != c.strip() or BLANK in c
               or _LATIN.search(c) or not _CJK.search(c) for c in choices):
            out.append(f"{what} choices must be Japanese fillings")
            continue
        if len(set(choices)) != len(choices):
            out.append(f"{what} choices repeat")
            continue
        slips = item.get("slips", [])
        if not isinstance(slips, list) or any(c not in choices[1:] for c in slips) or len(set(slips)) != len(slips):
            out.append(f"{what} slips must be wrong choices, each once")
            continue
        lines = [jp.replace(BLANK, c) for c in choices]
        for i, line in enumerate(lines):
            out += _line_problems(f"{what} choice {i}", line, level, pattern)
        at = jp.index(BLANK)
        for i, c in enumerate(choices):
            if cut(jp, c) is None:
                out.append(f"{what} choice {i} {c!r} falls inside a word's reading, so the hole would blank more than it fills")
        if lines[0] in tutorial or any(line in tutorial for line in lines[1:]):
            out.append(f"{what}: a sentence the lesson or the tutorial already shows")
        if lines[0] in seen:
            out.append(f"{what} asks the sentence of choose {seen[lines[0]]} again")
        seen.setdefault(lines[0], n)
        if len(out) > before:
            continue
        # The point is written in the right filling's hole, and in no wrong
        # one's -- where anything can tell; a point no rule reads is taken
        # on trust. A point that names its own alternatives (〜つ／〜人／
        # 〜枚, です／だ) is learned by choosing among them, so a wrong
        # filling may be written with another of its forms.
        if _written_in(lines[0], (at, at + len(choices[0])), pattern, level) is False:
            out.append(f"{what}: the right filling {choices[0]!r} does not write the point where the hole is")
        if "／" not in pattern:
            for i in range(1, len(choices)):
                if choices[i] in slips:
                    continue
                if _written_in(lines[i], (at, at + len(choices[i])), pattern, level) is True:
                    out.append(f"{what}: the wrong filling {choices[i]!r} writes the point too "
                               "(if the sentence rules it out -- a form no one says, the wrong tense -- it is a slip)")
    return out


def _repeat_problems(entry: dict) -> list[str]:
    """No sentence stands twice in a tutorial (plan 196): not an example,
    a twist, a line or an answer of the scene, nor anything the quiz asks
    or offers. And no question is put twice."""
    tour = entry["tour"]
    seen: dict[str, str] = {}
    out: list[str] = []

    def see(where: str, jp) -> None:
        if not isinstance(jp, str):
            return
        if jp in seen:
            out.append(f"{jp!r} is in the tour twice ({seen[jp]}, {where})")
        else:
            seen[jp] = where

    for i, example in enumerate(entry.get("examples") or []):
        see(f"example {i}", example.get("jp") if isinstance(example, dict) else None)
    for i, twist in enumerate(tour.get("twists") or []):
        see(f"twist {i}", twist.get("jp") if isinstance(twist, dict) else None)
    scene = tour.get("scene") or {}
    for i, line in enumerate(scene.get("lines") or []):
        see(f"scene line {i}", line.get("jp") if isinstance(line, dict) else None)
    ask = scene.get("ask") or {}
    if isinstance(ask.get("cue"), dict):
        see("scene cue", ask["cue"].get("jp"))
    for i, jp in enumerate(ask.get("choices") or []):
        see(f"scene choice {i}", jp)
    from study.grammar_tour import quiz_sentences
    # A form is asked as « which form completes it? » whatever its sentence,
    # and the sentence is what is checked; every other question is worded
    # for what it asks, so the wording is.
    questions = [q.get("ask", {}).get("en") for q in tour.get("quiz") or []
                 if isinstance(q, dict) and q.get("kind") != "form"]
    questions += [t.get("ask", {}).get("en") for t in tour.get("twists") or [] if isinstance(t, dict)]
    for n, q in enumerate(tour.get("quiz") or []):
        if isinstance(q, dict) and q.get("kind") in QUIZ_KINDS:
            try:
                for jp in quiz_sentences(q):
                    see(f"quiz {n}", jp)
            except (KeyError, TypeError, AttributeError):
                pass
    asked = [q for q in questions if isinstance(q, str)]
    if len(set(asked)) != len(asked):
        out.append("a question is put twice (the same wording over a twist or a quiz question that is not a form)")
    return out


def check_entry(level: str, entry: dict, catalogue: dict[str, list[dict]] | None = None) -> list[str]:
    """Every problem with one entry, as reasons; [] when it is clean."""
    catalogue = catalogue if catalogue is not None else GRAMMAR_POINTS_BY_LEVEL
    rich = level in RICH_LEVELS
    pattern = entry.get("pattern") if isinstance(entry, dict) else None
    tag = f"{level} {pattern!r}"
    out: list[str] = []

    if not isinstance(entry, dict):
        return [f"{tag}: entry is not an object"]
    unknown = set(entry) - ENTRY_KEYS
    missing = REQUIRED_KEYS - set(entry)
    if unknown:
        out.append(f"{tag}: unknown keys {sorted(unknown)}")
    if missing:
        out.append(f"{tag}: missing keys {sorted(missing)}")
        return out

    for field in ("pattern", "structure"):
        value = entry[field]
        if not isinstance(value, str) or not value.strip():
            out.append(f"{tag}: {field} is empty")
        elif value != value.strip():
            out.append(f"{tag}: {field} has surrounding whitespace")
    if isinstance(entry["structure"], str):
        out += [f"{tag}: {p}" for p in _reading_problems(
            "structure", "structure_reading", entry["structure"], entry.get("structure_reading"))]
        out += [f"{tag}: {p}" for p in _structure_fr_problems(entry)]
    if isinstance(pattern, str) and ":" in pattern:
        # core.auth splits "{user_id}:{raw_id}" on the first colon.
        out.append(f"{tag}: pattern contains ':'")
    if isinstance(pattern, str):
        out += [f"{tag}: {p}" for p in _reading_problems("pattern", "reading", pattern, entry.get("reading"))]
        elsewhere = [
            lvl for lvl, entries in catalogue.items()
            if lvl != level and any(e.get("pattern") == pattern for e in entries)
        ]
        if elsewhere:
            out.append(f"{tag}: also filed under {elsewhere} (a pattern names one point)")

    out += [f"{tag}: {p}" for p in _text_problems("meaning", entry["meaning"], rich, MAX_COMPARE_CHARS)]

    register = entry.get("register")
    if register is not None and register not in REGISTERS:
        out.append(f"{tag}: register {register!r} not in {sorted(REGISTERS)}")

    # ── steps ──
    steps = entry["steps"]
    if not isinstance(steps, list):
        out.append(f"{tag}: steps is not a list")
        steps = []
    kinds = []
    for i, step in enumerate(steps):
        if not isinstance(step, dict) or set(step) != {"kind", "en", "fr"}:
            out.append(f"{tag}: step {i} must be {{kind, en, fr}}")
            continue
        if step["kind"] not in STEP_KINDS:
            out.append(f"{tag}: step {i} kind {step['kind']!r} not in {STEP_KINDS}")
        kinds.append(step["kind"])
        out += [f"{tag}: step {i} {p}" for p in _text_problems(
            "text", {"en": step["en"], "fr": step["fr"]}, rich, MAX_STEP_CHARS, bullets=True)]
    if rich and (not kinds or kinds[0] != "rule"):
        out.append(f"{tag}: a rich level's lesson opens with a 'rule' step")
    if len(kinds) != len(set(kinds)):
        out.append(f"{tag}: a step kind appears twice")

    # ── compare ──
    compare = entry["compare"]
    if not isinstance(compare, list):
        out.append(f"{tag}: compare is not a list")
        compare = []
    rivals: list[str] = []
    for i, rival in enumerate(compare):
        if not isinstance(rival, dict) or set(rival) != {"pattern", "en", "fr"}:
            out.append(f"{tag}: compare {i} must be {{pattern, en, fr}}")
            continue
        rp = rival["pattern"]
        if rp == pattern:
            out.append(f"{tag}: compares itself")
        elif find(rp) is None and not any(
            e.get("pattern") == rp for entries in catalogue.values() for e in entries
        ):
            out.append(f"{tag}: compare {rp!r} names no catalogue point")
        if rp in rivals:
            out.append(f"{tag}: compare {rp!r} listed twice")
        rivals.append(rp)
        out += [f"{tag}: compare {rp!r} {p}" for p in _text_problems(
            "text", {"en": rival["en"], "fr": rival["fr"]}, rich, MAX_COMPARE_CHARS)]

    # ── examples ──
    examples = entry["examples"]
    if not isinstance(examples, list):
        out.append(f"{tag}: examples is not a list")
        examples = []
    floor = MIN_EXAMPLES_RICH if rich else MIN_EXAMPLES
    if len(examples) < floor:
        out.append(f"{tag}: {len(examples)} example(s), needs {floor}")
    seen_jp: set[str] = set()
    checkable_rivals = [r for r in rivals if verifiable(r)]
    for i, ex in enumerate(examples):
        if not isinstance(ex, dict) or not {"jp", "en", "fr"} <= set(ex) or set(ex) - EXAMPLE_KEYS:
            out.append(f"{tag}: example {i} must be {{jp, en, fr[, register][, contrast]}}")
            continue
        jp = ex["jp"]
        if jp in seen_jp:
            out.append(f"{tag}: example {i} repeats {jp!r}")
        seen_jp.add(jp)
        for lang in LANGS:
            why = check_sentence(jp, ex[lang], pattern, level)
            if why:
                out.append(f"{tag}: example {i} ({lang}) {why}")
            tr = ex[lang]
            if isinstance(tr, str):
                if _CJK.search(tr):
                    out.append(f"{tag}: example {i} {lang} contains Japanese")
                if not _LATIN.search(tr):
                    out.append(f"{tag}: example {i} {lang} is not prose")
        if rich and ex["en"] == ex["fr"]:
            out.append(f"{tag}: example {i} fr is a copy of en")
        if ex.get("register") is not None and ex["register"] not in REGISTERS:
            out.append(f"{tag}: example {i} register {ex['register']!r} unknown")
        if ex.get("contrast"):
            if ex["contrast"] is not True:
                out.append(f"{tag}: example {i} contrast must be true or absent")
            if not rivals:
                out.append(f"{tag}: example {i} is a contrast example but the point compares nothing")
            if not verifiable(pattern) and blank_span(jp, pattern, level) is None:
                # A bare particle is blanked where the detector finds it
                # (plan 190): once, on one piece, or not at all.
                out.append(f"{tag}: example {i} is a contrast example but the detector does not find "
                           f"{pattern!r} in it exactly once, so it cannot be blanked")
            for rp in checkable_rivals:
                if contains_pattern(jp, rp):
                    out.append(f"{tag}: example {i} also contains rival {rp!r}, so the drill would have two answers")
    if rich and rivals and verifiable(pattern) and not any(ex.get("contrast") for ex in examples if isinstance(ex, dict)):
        out.append(f"{tag}: compares {len(rivals)} rival(s) but marks no contrast example")
    # A bare particle or a class label (は, い形容詞／な形容詞) has letters
    # that point at nothing, so only the detector can blank it (plan 190),
    # and only a sentence its rivals cannot stand in is worth marking --
    # は, が and も share too many. Such a point is asked from questions of
    # its own instead (`choose`, plan 201): every point is asked in
    # Choisir, none is left to fall back to the flashcard.
    if (rich and not verifiable(pattern) and not entry.get("choose")
            and not (rivals and any(ex.get("contrast") and blank_span(ex["jp"], pattern, level)
                                    for ex in examples if isinstance(ex, dict) and isinstance(ex.get("jp"), str)))):
        out.append(f"{tag}: nothing asks it in Choisir -- mark a contrast sentence the detector can blank, "
                   "or write `choose` (plan 201)")
    if rich and not rivals:
        out.append(f"{tag}: a rich level's point names at least one neighbour to compare")

    if "choose" in entry:
        out += [f"{tag}: {p}" for p in _choose_problems(level, entry, rich)]

    if "tour" in entry:
        out += [f"{tag}: {p}" for p in _tour_problems(level, entry, rich)]

    return out


def problems(levels=LEVELS) -> list[str]:
    """Every problem across the catalogue (or the given levels)."""
    out: list[str] = []
    for level in levels:
        for entry in GRAMMAR_POINTS_BY_LEVEL.get(level, []):
            out += check_entry(level, entry)
    return out


def _fr_pending(entry: dict) -> bool:
    m = entry.get("meaning", {})
    if isinstance(m, dict) and m.get("en") == m.get("fr"):
        return True
    return any(ex.get("en") == ex.get("fr") for ex in entry.get("examples", []) if isinstance(ex, dict))


def report(levels=LEVELS) -> dict[str, dict]:
    """Per level: how much of the catalogue is written, for the authoring
    loop and for the README's coverage table."""
    from content.grammar_sentences_data import contrast_examples
    from study.grammar_ladder import can_blank
    out = {}
    for level in levels:
        entries = GRAMMAR_POINTS_BY_LEVEL.get(level, [])
        counts = [len(e.get("examples", [])) for e in entries]
        out[level] = {
            "points": len(entries),
            "rich": level in RICH_LEVELS,
            "with_steps": sum(1 for e in entries if e.get("steps")),
            "with_compare": sum(1 for e in entries if e.get("compare")),
            "contrast_ok": sum(
                1 for e in entries
                if e.get("choose")
                or (verifiable(e["pattern"]) and e.get("compare") and contrast_examples(level, e["pattern"]))
                or can_blank(level, e["pattern"])
            ),
            "fill_ok": sum(1 for e in entries if verifiable(e["pattern"]) and e.get("examples")),
            "fr_pending": sum(1 for e in entries if _fr_pending(e)),
            "examples_min": min(counts) if counts else 0,
            "examples_avg": round(sum(counts) / len(counts), 2) if counts else 0,
        }
    return out
