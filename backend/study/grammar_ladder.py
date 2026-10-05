"""
The grammar ladder: one track whose exercise climbs with the card (plan 187e).

A grammar card in the day's run used to be one exercise for ever -- the
recognition flashcard, Today's main lane. On the ladder (`grammar.ladder`,
study/modes.py) the card is ONE scheduler row whose exercise is read from
how far the card has come (`srs._progress`, 0 new to 1 mastered):

    rung  progress   exercise                         falls back to
    0     < 0.25     fill_in: the sentence intact,     the f2b flashcard
                     name the rule at work
    1     < 0.5      contrast: the point blanked,      rung 0's
                     its rivals as the choices
    2     < 0.75     build: the sentence as tiles,     rung 1's
                     one or two missing, a rival's
                     form as the wrong tile
    3     >= 0.75    write: a situation, two words     rung 2's
                     to use, a field; the detector
                     says whether the point is there

A miss lowers the progress, so the card steps down a rung by itself. What
the scheduler records is the one ladder key whatever was asked, the
argument study/modes.py makes for hints: a rung must not fork a track.

`build` and `write` are platforms of their own as well (grammar.build,
grammar.write), each served only where its payload can be made:

- build needs a sentence its author marked as telling the point from its
  rivals (card_index.contrast_ok, the contrast drill's own), the point
  written there in one stretch, and a rival whose form can stand as the
  wrong tile. Contrast's marking is what makes the wrong tile certainly
  wrong; a tile invented for a sentence nobody marked could be right.
- write needs the detector trusted on the point (grammar_detect.can_find,
  composition's rule, plan 125) and an example to set the situation. The
  check is composition's own POST /api/composition/check -- free, local,
  nothing written -- and the learner rates themselves (ADR 0013).
"""
import json
import random
import re
from functools import lru_cache
from pathlib import Path

from content.grammar_points_data import find
from content.grammar_sentences_data import translation
from study.furigana import align_sentence, mark_spans
from study.grammar_detect import can_find
from study.grammar_match import contains_pattern, verifiable
from study.grammar_tour import _dictionary_form, lit_spans
from study.morphology import tokenize

# Where a rung starts, on the card's own progress (plan 147's bar).
THRESHOLDS = (0.25, 0.5, 0.75)
RUNGS = ("recognise", "choose", "build", "write")

# The exercise each rung asks, by the mode's base, and the bases each one
# falls back through, highest first (study/modes.py's names).
FLASHCARD, FILL_IN, CONTRAST, BUILD, WRITE = "flashcard", "fill_in", "contrast", "build", "write"
_CHAIN = (FLASHCARD, FILL_IN, CONTRAST, BUILD, WRITE)
# The rung an exercise stands for: the flashcard, a fallback, is rung 0's.
RUNG_OF_BASE = {FLASHCARD: 0, FILL_IN: 0, CONTRAST: 1, BUILD: 2, WRITE: 3}

# A sentence's last mark stays where it is: it is not a tile.
_TAIL = "。！？!?"
# What leans on the word before it, so never opens a tile.
_BOUND = {"particle", "auxiliary", "suffix", "symbol"}
# The fewest tiles a build is worth asking with, and from how many two
# are missing rather than one.
MIN_TILES = 3
TWO_GAPS = 4
HELPERS = 2
_HELPER_POS = ("noun", "verb", "adjective")


def rung_of(progress: float | None) -> int:
    """The rung a card at `progress` stands on, 0 to 3."""
    p = progress or 0.0
    return sum(p >= t for t in THRESHOLDS)


def chain_for(rung: int) -> tuple[str, ...]:
    """The bases a card on `rung` is asked in, the rung's own first, then
    each one under it: rung 2 is build, else contrast, else fill_in, else
    the flashcard."""
    top = {0: FILL_IN, 1: CONTRAST, 2: BUILD, 3: WRITE}[rung]
    return tuple(reversed(_CHAIN[: _CHAIN.index(top) + 1]))


# ── 組立 build ────────────────────────────────────────────────

def _rival_form(pattern: str) -> str | None:
    """A rival's pattern as a tile can write it: 〜をください → をください.
    None where the pattern is no one stretch (あまり〜ない) or names a
    class rather than a form (い形容詞／な形容詞)."""
    form = re.sub(r"[（(][^）)]*[）)]", "", pattern).split("／")[0].strip()
    form = form.removeprefix("〜").removeprefix("～")
    if not form or "〜" in form or "～" in form or re.search(r"[A-Za-z]", form):
        return None
    return form


def _tile_cuts(jp: str, span: tuple[int, int], parts: list[dict]) -> list[int] | None:
    """Where the sentence's tiles begin: a phrase's start (a word that is no
    particle, auxiliary, suffix or mark, after no prefix), and the point's
    two edges, so the point is one tile; never inside the point or inside
    a ruby part, whose reading would be cut in half."""
    tokens = tokenize(jp)
    if not tokens:
        return None
    cuts = {t.start for i, t in enumerate(tokens)
            if i and t.pos not in _BOUND and tokens[i - 1].pos != "prefix"}
    cuts |= {span[0], span[1]}
    pos, inside = 0, set()
    for part in parts:
        if part.get("reading") is not None:
            inside |= set(range(pos + 1, pos + len(part["text"])))
        pos += len(part["text"])
    return sorted(c for c in cuts if 0 < c < len(jp) and c not in inside
                  and not span[0] < c < span[1])


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


def _missing(cuts: tuple[int, ...], span: tuple[int, int], body_len: int) -> tuple[list, list[int]]:
    """The tiles as (start, end), and the ones a build leaves out: the
    point, and with TWO_GAPS tiles or more the one before it (after it,
    when the point opens the sentence)."""
    edges = [0, *cuts, body_len]
    tiles = [(edges[k], edges[k + 1]) for k in range(len(edges) - 1)]
    point = next(k for k, edge in enumerate(tiles) if edge == span)
    missing = [point]
    if len(tiles) >= TWO_GAPS:
        missing.append(point - 1 if point > 0 else point + 1)
    return tiles, sorted(missing)


@lru_cache(maxsize=1024)
def _build_sentences(level: str, pattern: str) -> tuple:
    """The point's contrast sentences a build can be made of, each as
    (example index, span, tile cuts, wrong forms). Cached: the tokenizer
    reads each sentence once."""
    found = find(pattern)
    if found is None or found[0] != level:
        return ()
    entry = found[1]
    if not verifiable(pattern) or not entry.get("compare"):
        return ()
    out = []
    for i, example in enumerate(entry.get("examples", [])):
        jp = example.get("jp") or ""
        if not example.get("contrast") or not jp:
            continue
        spans = lit_spans(jp, pattern, level)
        if len(spans) != 1:
            continue
        span = tuple(spans[0])
        body = len(jp.rstrip(_TAIL))
        if span[1] > body:
            continue
        written = jp[span[0]:span[1]]
        wrong = []
        for rival in entry["compare"]:
            r = rival["pattern"]
            if r == pattern or (verifiable(r) and contains_pattern(jp, r)):
                continue
            form = _rival_form(r)
            if form and form != written and form not in wrong:
                wrong.append(form)
        if not wrong:
            continue
        cuts = _tile_cuts(jp[:body], span, align_sentence(jp[:body]))
        if cuts is None or len(cuts) + 1 < MIN_TILES:
            continue
        # Never a wrong piece that reads as a right one: the や of 花や木
        # など, missing beside など, cannot be など's wrong tile too.
        tiles, missing = _missing(tuple(cuts), span, body)
        taken = {jp[a:b] for a, b in (tiles[k] for k in missing)}
        wrong = [form for form in wrong if form not in taken]
        if not wrong:
            continue
        out.append((i, span, tuple(cuts), tuple(wrong)))
    return tuple(out)


def can_build(level: str, pattern: str) -> bool:
    """Whether a build can be cut for the point -- the slow answer, which
    reads every marked sentence through the tokenizer and the detector.
    build_ok() reads it from the snapshot."""
    return bool(_build_sentences(level, pattern))


def build_payload(level: str, entry: dict, lang: str, rng: random.Random | None = None) -> dict | None:
    """{tr, tiles, tail, tray, answer, jp, furigana} for one of the point's
    marked sentences, or None where none can be built (build_ok).

    `tiles` is the sentence in order, each {furigana} or, for a missing
    one, {slot: n}; `tray` the missing tiles and one wrong tile -- a
    rival's form -- shuffled, each {id, text, furigana}; `answer` the tray
    id each slot takes. The point is always a missing tile; with
    TWO_GAPS tiles or more, so is the one before it (the one after when
    the point opens the sentence), so the learner builds the point onto
    its word rather than picking it out."""
    rng = rng or random
    options = _build_sentences(level, entry["pattern"])
    if not options:
        return None
    index, span, cuts, wrong = rng.choice(options)
    example = entry["examples"][index]
    jp = example["jp"]
    body_len = len(jp.rstrip(_TAIL))
    body, tail = jp[:body_len], jp[body_len:]
    parts = align_sentence(body)

    tiles, missing = _missing(cuts, span, body_len)

    tray = [{"text": body[a:b], "furigana": _slice(parts, a, b)} for a, b in (tiles[k] for k in missing)]
    form = rng.choice(wrong)
    tray.append({"text": form, "furigana": align_sentence(form), "wrong": True})
    order = list(range(len(tray)))
    rng.shuffle(order)
    shuffled = [{"id": n, **{k: v for k, v in tray[i].items() if k != "wrong"}} for n, i in enumerate(order)]
    answer = [order.index(i) for i in range(len(missing))]

    return {
        "tr": translation({"en": example.get("en", ""), "fr": example.get("fr", "")}, lang),
        "tiles": [
            {"slot": missing.index(k)} if k in missing else {"furigana": _slice(parts, a, b)}
            for k, (a, b) in enumerate(tiles)
        ],
        "tail": tail,
        "tray": shuffled,
        "answer": answer,
        "jp": jp,
        "furigana": mark_spans(align_sentence(jp), [span]),
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


def can_write(level: str, pattern: str) -> bool:
    """Whether the point can be written and checked -- the slow answer,
    as can_build. write_ok() reads it from the snapshot."""
    return bool(_write_examples(level, pattern))


# ── The snapshot ──────────────────────────────────────────────
# Asking can_build and can_write of all 545 points takes some twelve
# seconds -- the detector over every example -- and the card index asks
# them of every point to count the two platforms' totals. So the answers
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
        }
        for level, entries in GRAMMAR_POINTS_BY_LEVEL.items()
    }


def build_ok(level: str, pattern: str) -> bool:
    return pattern in _snapshot().get(level, {}).get(BUILD, ())


def write_ok(level: str, pattern: str) -> bool:
    return pattern in _snapshot().get(level, {}).get(WRITE, ())


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
