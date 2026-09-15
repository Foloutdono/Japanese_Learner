"""
The gate every grammar point passes before it reaches a learner (plan 087).

content/grammar/*.json is hand-written, which means it is hand-breakable,
and a grammar lesson is the one place a learner cannot spot the error
themselves: they are reading it because they do not know the pattern
yet. So the shape of an entry, the two languages, the example sentences
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
from study.grammar_match import contains_pattern, verifiable
from study.grammar_sentence_gen import check_sentence

ENTRY_KEYS = frozenset({"pattern", "structure", "meaning", "register", "steps", "compare", "examples"})
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
    if isinstance(pattern, str) and ":" in pattern:
        # core.auth splits "{user_id}:{raw_id}" on the first colon.
        out.append(f"{tag}: pattern contains ':'")
    if isinstance(pattern, str):
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
    if rich and rivals and not any(ex.get("contrast") for ex in examples if isinstance(ex, dict)):
        out.append(f"{tag}: compares {len(rivals)} rival(s) but marks no contrast example")
    if rich and not rivals:
        out.append(f"{tag}: a rich level's point names at least one neighbour to compare")

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
