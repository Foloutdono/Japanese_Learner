import random
from functools import lru_cache

from fastapi import APIRouter, HTTPException

from content import frequency_data as freq
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, gloss
from content.grammar_sentences_data import get_sentences
from content.kana_data import KANA_SETS
from content.kanji_data import KANJI_BY_LEVEL
from content.kanji_meanings import KANJI_FR
from content.kanji_readings import display_reading, split_readings
from content.radical_data import radical_for
from content.vocab_data import VOCAB_BY_LEVEL
from study.grammar_lesson import contrast_payload
from translations import get_meaning
from translations.fr.vocab_fr import VOCAB_FR

# ── 見本 — what each stop of a line holds (plan 136) ──────────────
# The desk's station split draws a line's stops beside the open stop's
# platforms, and since plan 136 both columns take the window: each stop
# prints a few of the things it teaches under its name, and each
# platform prints the card it will ask, in a small well beside its
# description (the owner's pick A of the station screens canvas). This
# is where both come from: per stop, `sample` (the first things the
# stop teaches, in the order a learner meets them -- frequency for
# vocab and kanji, the catalogue's own order for grammar, the chart's
# for kana) and `card` (one item with every field a platform's
# specimen draws from).
#
# Static content, no learner and no database: the answer is the same
# for everyone, so it is built once per (source, lang) and kept. The
# frontend asks once per line (stores/stationSamples.js).
#
# A specimen is the card as the run would build it, not an invented
# illustration: the gloss is the one the card prints (get_meaning /
# gloss in `lang`), the grammar's sentence is the fill-in card's own
# (get_sentences' first), its blank is the contrast card's own
# (contrast_payload, with a fixed seed so the sentence does not change
# from one call to the next), and its choices are the rivals the lesson
# names beside the point.

router = APIRouter()

SOURCES = ("kana", "kanji", "vocab", "grammar")
LEVELS = ("N5", "N4", "N3", "N2", "N1")
LANGS = ("fr", "en")

SAMPLE_SIZE = {"kana": 11, "kanji": 10, "vocab": 8, "grammar": 6}


def _kana_line(lang: str) -> dict:
    stops = {}
    for slug, entries in KANA_SETS.items():
        if not entries:
            continue
        first = entries[0]
        stops[slug] = {
            "sample": [e["kana"] for e in entries[: SAMPLE_SIZE["kana"]]],
            "card": {"jp": first["kana"], "romaji": first["romaji"]},
        }
    return stops


def _by_frequency(domain: str) -> dict[str, list[dict]]:
    """Each level's entries in the frequency order the tiers walk, each
    counted at the level it is taught at (freq.resolve's native level)."""
    out: dict[str, list[dict]] = {level: [] for level in LEVELS}
    for key in freq.standard_order(domain):
        resolved = freq.resolve(domain, key)
        if resolved is None:
            continue
        level, entry = resolved
        if level in out:
            out[level].append(entry)
    return out


def _kanji_reading(entry: dict) -> str:
    """The first on'yomi and the first kun'yomi, as a learner says them."""
    split = split_readings(entry.get("kana"))
    firsts = [display_reading(r[0]) for r in (split.get("on"), split.get("kun")) if r]
    return "・".join(firsts)


def _kanji_line(lang: str) -> dict:
    ordered = _by_frequency("kanji")
    stops = {}
    for level in LEVELS:
        entries = ordered[level] or KANJI_BY_LEVEL.get(level, [])
        if not entries:
            continue
        first = entries[0]
        rad = radical_for(first.get("kanji", ""))
        stops[level] = {
            "sample": [e["kanji"] for e in entries[: SAMPLE_SIZE["kanji"]]],
            "card": {
                "jp": first["kanji"],
                "meaning": get_meaning(first, lang, KANJI_FR),
                "reading": _kanji_reading(first),
                "radical": rad["char"] if rad else None,
            },
        }
    return stops


def _vocab_line(lang: str) -> dict:
    ordered = _by_frequency("vocab")
    stops = {}
    for level in LEVELS:
        entries = ordered[level] or VOCAB_BY_LEVEL.get(level, [])
        if not entries:
            continue
        # The reading platform serves only words written with a kanji
        # (a kana-only prompt would print its answer), so the specimen
        # is the first word that every platform can ask.
        first = next((e for e in entries if e.get("kanji")), entries[0])
        stops[level] = {
            "sample": [e.get("kanji") or e.get("kana", "") for e in entries[: SAMPLE_SIZE["vocab"]]],
            "card": {
                "jp": first.get("kanji") or first.get("kana", ""),
                "reading": (first.get("kana") or "").split("/")[0].strip(),
                "meaning": get_meaning(first, lang, VOCAB_FR),
            },
        }
    return stops


def _grammar_card(level: str, entry: dict, points: list[dict], lang: str) -> dict | None:
    contrast = contrast_payload(level, entry, points, lang, random.Random(0))
    sentences = get_sentences(level, entry["pattern"])
    if contrast is None or not sentences:
        return None
    parts = contrast["furigana"]
    cut = next(i for i, p in enumerate(parts) if p.get("blank"))
    # The rivals the lesson names, then the point: the card pads a short
    # list with random same-level fillers, which would change the
    # specimen from one process to the next. Those fillers only when the
    # lesson names no rival at all.
    pattern = entry["pattern"]
    rivals = list(dict.fromkeys(r["pattern"] for r in entry.get("compare", []) if r["pattern"] != pattern))
    choices = (rivals or [c for c in contrast["choices"] if c != pattern])[:3] + [pattern]
    return {
        "jp": pattern,
        "meaning": gloss(entry, lang),
        "sentence": sentences[0]["jp"],
        "blank": {
            "before": "".join(p["text"] for p in parts[:cut]),
            "after": "".join(p["text"] for p in parts[cut + 1:]),
            "choices": choices,
        },
    }


def _grammar_line(lang: str) -> dict:
    stops = {}
    for level in LEVELS:
        points = GRAMMAR_POINTS_BY_LEVEL.get(level, [])
        if not points:
            continue
        # The first point every platform can ask: one with a sentence of
        # its own and a contrast example. A level with none (its lessons
        # not yet written) still gets the first point's gloss, and the
        # two sentence platforms are not offered there anyway.
        card = next((c for c in (_grammar_card(level, p, points, lang) for p in points) if c), None)
        if card is None:
            card = {"jp": points[0]["pattern"], "meaning": gloss(points[0], lang)}
        stops[level] = {
            "sample": [p["pattern"] for p in points[: SAMPLE_SIZE["grammar"]]],
            "card": card,
        }
    return stops


LINES = {
    "kana": _kana_line,
    "kanji": _kanji_line,
    "vocab": _vocab_line,
    "grammar": _grammar_line,
}


@lru_cache(maxsize=len(SOURCES) * len(LANGS))
def station_samples(source: str, lang: str) -> dict:
    return {"source": source, "stops": LINES[source](lang)}


@router.get("/api/station/{source}/samples")
def get_station_samples(source: str, lang: str = "fr"):
    if source not in LINES:
        raise HTTPException(status_code=404, detail=f"Unknown line: {source}")
    return station_samples(source, lang if lang in LANGS else "fr")
