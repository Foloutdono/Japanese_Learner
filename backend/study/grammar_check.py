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

from content.grammar_points_data import (
    GRAMMAR_POINTS_BY_LEVEL, LEVELS, RICH_LEVELS, find,
)
from study.furigana import is_kanji
from study.grammar_examples import KANA_READING, pattern_furigana
from study.grammar_match import contains_pattern, verifiable
from study.grammar_sentence_gen import check_sentence
from study.llm_shared import sentence_kanji_ok

ENTRY_KEYS = frozenset({"pattern", "reading", "structure", "structure_reading", "meaning", "register", "steps", "compare", "examples", "tour"})
REQUIRED_KEYS = frozenset({"pattern", "structure", "meaning", "steps", "compare", "examples"})
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
# A point's `tour` is the two stops the catalogue cannot derive: the
# twist (a sentence that shows the point doing something else, or its
# nearest rival, and three readings of it) and the scene (a short
# dialogue at a station place in which the point does its job, then the
# learner's own line chosen from three). Both are required where a tour
# is written at all.
TOUR_KEYS = frozenset({"twist", "scene"})
TWIST_KEYS = frozenset({"jp", "ask", "choices", "why", "pair"})
SCENE_KEYS = frozenset({"place", "them", "lines", "note", "ask"})
SCENE_ASK_KEYS = frozenset({"cue", "task", "choices", "why"})
SCENE_LINES = (2, 5)
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


def _tour_problems(level: str, entry: dict, rich: bool) -> list[str]:
    from study.grammar_tour import SCENE_PLACES
    pattern = entry.get("pattern") or ""
    tour = entry["tour"]
    if not isinstance(tour, dict) or set(tour) != TOUR_KEYS:
        return [f"tour must be {{twist, scene}}, both written"]
    out: list[str] = []

    twist = tour["twist"]
    if not isinstance(twist, dict) or not {"jp", "ask", "choices", "why"} <= set(twist) or set(twist) - TWIST_KEYS:
        out.append("tour twist must be {jp, ask, choices, why[, pair]}")
    else:
        out += _line_problems("tour twist jp", twist["jp"], level, pattern)
        out += _text_problems("tour twist ask", twist["ask"], rich, MAX_TOUR_CHARS)
        out += _text_problems("tour twist why", twist["why"], rich, MAX_TOUR_CHARS)
        choices = twist["choices"]
        if not isinstance(choices, list) or len(choices) != TOUR_CHOICES:
            out.append(f"tour twist has {len(choices) if isinstance(choices, list) else '?'} choices, needs {TOUR_CHOICES} (the answer first)")
        else:
            for i, choice in enumerate(choices):
                out += _text_problems(f"tour twist choice {i}", choice, rich, MAX_TOUR_CHARS)
            texts = [c.get("en") for c in choices if isinstance(c, dict)]
            if len(set(texts)) != len(texts):
                out.append("tour twist choices repeat")
        pair = twist.get("pair")
        if pair is not None and (
            not isinstance(pair, list) or len(pair) != 2
            or any(not isinstance(p, str) or not _CJK.search(p) or _LATIN.search(p) for p in pair)
        ):
            out.append("tour twist pair must be two Japanese forms")

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
            if not verifiable(pattern):
                out.append(f"{tag}: example {i} is a contrast example but {pattern!r} cannot be blanked")
            for rp in checkable_rivals:
                if contains_pattern(jp, rp):
                    out.append(f"{tag}: example {i} also contains rival {rp!r}, so the drill would have two answers")
    # A bare particle or a class label (は, い形容詞／な形容詞) cannot be
    # blanked, so the drill never draws it; its lesson still names the
    # neighbours, it just marks no sentence for them.
    if rich and rivals and verifiable(pattern) and not any(ex.get("contrast") for ex in examples if isinstance(ex, dict)):
        out.append(f"{tag}: compares {len(rivals)} rival(s) but marks no contrast example")
    if rich and not rivals:
        out.append(f"{tag}: a rich level's point names at least one neighbour to compare")

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
                if verifiable(e["pattern"]) and e.get("compare") and contrast_examples(level, e["pattern"])
            ),
            "fill_ok": sum(1 for e in entries if verifiable(e["pattern"]) and e.get("examples")),
            "fr_pending": sum(1 for e in entries if _fr_pending(e)),
            "examples_min": min(counts) if counts else 0,
            "examples_avg": round(sum(counts) / len(counts), 2) if counts else 0,
        }
    return out
