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

from content.grammar_points_data import find
from content.grammar_sentences_data import translation
from srs import ladder as steps
from study.furigana import align_sentence, mark_spans
from study.grammar_examples import blank_span
from study.grammar_detect import can_find
from study.grammar_match import verifiable
from study.grammar_tour import _dictionary_form, lit_spans
from study.morphology import kata_to_hira, tokenize
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
            out.append((f"ex:{n}", ex["jp"], {"en": ex["en"], "fr": ex["fr"]}))
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
            out.append((f"sc:{n}", line["jp"], {"en": line["en"], "fr": line["fr"]}))
    return out


MAX_GAPS = 2


@lru_cache(maxsize=1024)
def _build_items(level: str, pattern: str) -> tuple:
    """The point's sentences a Construire can be cut from, each as (key,
    jp, spans, en, fr): the point lit in one stretch, or two for a point
    written in two pieces (あまり〜ない), never the whole sentence, every
    edge between ruby parts. Cached: the tokenizer reads each sentence
    once."""
    found = find(pattern)
    if found is None or found[0] != level:
        return ()
    out = []
    for key, jp, tr in _sources(found[1]):
        spans = [tuple(sp) for sp in lit_spans(jp, pattern, level)]
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
        out.append((key, jp, tuple(spans), tr["en"], tr["fr"]))
    return tuple(out)


def can_build(level: str, pattern: str) -> bool:
    """Whether a Construire can be cut for the point -- the slow answer,
    which reads every sentence through the tokenizer and the detector.
    build_ok() reads it from the snapshot."""
    return bool(_build_items(level, pattern))


def build_payload(level: str, entry: dict, lang: str, turn: int = 0) -> dict | None:
    """{key, tr, pieces} for one of the point's sentences, or None where
    none can be cut (build_ok). `pieces` is the sentence in order, each
    {furigana} or a gap {gap: n, size} -- `size` the kana it holds, so its
    width gives nothing away. `turn` picks the sentence, so each review
    asks another one (the review count); the order is shuffled once per
    point. The answer stays here: the client sends what was typed to
    check_build with the `key`."""
    items = list(_build_items(level, entry["pattern"]))
    if not items:
        return None
    random.Random(f"build:{level}:{entry['pattern']}").shuffle(items)
    key, jp, spans, en, fr = items[turn % len(items)]
    parts = align_sentence(jp)
    pieces, pos = [], 0
    for n, (a, b) in enumerate(spans):
        if a > pos:
            pieces.append({"furigana": _slice(parts, pos, a)})
        pieces.append({"gap": n, "size": len(_reading(_slice(parts, a, b)))})
        pos = b
    if pos < len(jp):
        pieces.append({"furigana": _slice(parts, pos, len(jp))})
    return {"key": key, "tr": translation({"en": en, "fr": fr}, lang), "pieces": pieces}


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


def _gap_verdict(given: str, written: str, reading: str) -> str:
    if given in (_norm(written), reading):
        return "right"
    ops = difflib.SequenceMatcher(a=given, b=reading, autojunk=False).get_opcodes()
    changed = sum(max(i2 - i1, j2 - j1) for op, i1, i2, j1, j2 in ops if op != "equal")
    return "close" if given and changed == 1 and len(reading) > 1 else "wrong"


def check_build(level: str, pattern: str, key: str, answers: list[str], lang: str) -> dict | None:
    """The verdict on a Construire, gap by gap: `right` when what was typed
    is the point as written or as read, `close` when one kana is off (書い
    で for 書いて), else `wrong`; the whole is right when every gap is,
    close when none is wrong. Each gap carries its answer, its reading and
    the runs that draw the correction; the whole sentence comes back lit.
    None for a key the point has no sentence under. Nothing typed is kept."""
    item = next((i for i in _build_items(level, pattern) if i[0] == key), None)
    if item is None:
        return None
    _, jp, spans, en, fr = item
    parts = align_sentence(jp)
    gaps = []
    for n, (a, b) in enumerate(spans):
        written = jp[a:b]
        reading = _reading(_slice(parts, a, b))
        given = _norm(answers[n] if n < len(answers) else "")
        verdict = _gap_verdict(given, written, reading)
        gaps.append({
            "verdict": verdict, "answer": written, "reading": reading,
            "marks": [] if verdict == "right" else _marks(given, reading),
        })
    verdicts = {g["verdict"] for g in gaps}
    whole = "right" if verdicts == {"right"} else "wrong" if "wrong" in verdicts else "close"
    return {
        "verdict": whole,
        "gaps": gaps,
        "jp": jp,
        "tr": translation({"en": en, "fr": fr}, lang),
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
    tr = translation({"en": example.get("en", ""), "fr": example.get("fr", "")}, lang)
    return {
        "situation": tr,
        "helpers": _helpers(jp, spans[0]),
        "model": {"jp": jp, "tr": tr, "furigana": mark_spans(align_sentence(jp), list(spans))},
    }
