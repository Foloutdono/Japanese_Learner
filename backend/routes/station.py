import random
import re
from functools import lru_cache

from fastapi import APIRouter, HTTPException

from content import comprehension_seed, listening_clips, reading_sentences
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

# ── 見本 — what each stop of a line holds (plan 137) ──────────────
# The desk's station split draws a line's stops beside the open stop's
# platforms, and since plan 137 both columns take the window: each stop
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

SOURCES = (
    "kana", "kanji", "vocab", "grammar",
    # The practice platforms (plan 159), below the Learn lines.
    "reading", "translation", "comprehension", "dictation", "composition", "exam",
)
LEVELS = ("N5", "N4", "N3", "N2", "N1")
LANGS = ("fr", "en")

SAMPLE_SIZE = {"kana": 11, "kanji": 10, "vocab": 8, "grammar": 6, "composition": 6}


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


# ── 実践の見本 — what each grade of a practice platform holds (plan 159) ──
# Plan 137 filled the Learn stations; plan 159 fills the Practice ones
# the same way (the owner's pick A of the practice stations canvas: a
# platform's grades as a line's split, filled), with reading's and
# translation's sources folded into the station as a switch (S1). A
# practice stop is a grade, and what it holds is a bank rather than a
# deck, so beside `sample` and `card` a practice stop carries two more:
#
#   points  the grammar the stop's bank is written around, in the
#           bank's own order -- what the grade page lists under the
#           specimen, and what the learner's `known` patterns
#           (/api/practice/stop) are read against
#   size    how much the bank holds: sentences, clips or points, or for
#           comprehension the questions one text asks
#
# The same rule as the Learn lines: a specimen is content the run will
# serve, never an illustration written for the page -- the bank's first
# sentence, the first seed text, the first clip, the catalogue's first
# point. `lang` reaches only what the bank carries in two languages
# (comprehension's questions, composition's gloss); the reading bank
# carries `en` alone, which is what translation prompts every learner
# with (routes/reading.get_reading_batch's `translation_lang` note).

# A sentence ends at 。, and at the bracket that closes on it: a
# quoted line (「……。」) is cut after its 」, not inside it.
_SENTENCE_END = re.compile(r"。[」』）)]*")

# A focus word "written with a kanji": one ideograph (or 々) at least.
_KANJI = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff々]")


def _first_sentences(text: str, count: int) -> str:
    """The text up to the end of its `count`th sentence, or all of it
    when it has fewer -- the lead a well can print whole."""
    ends = [m.end() for m in _SENTENCE_END.finditer(text)]
    return text[: ends[count - 1]] if len(ends) >= count else text


def _sentence_line(lang: str) -> dict:
    """Reading and translation: the curated bank the level's run opens
    on (routes/reading.get_reading_batch serves it before any corpus
    sentence), the same stop for both platforms -- one prints the
    Japanese, the other the English it prompts with."""
    stops = {}
    for level in LEVELS:
        bank = reading_sentences.BY_LEVEL.get(level, [])
        if not bank:
            continue
        first = bank[0]
        stops[level] = {
            "sample": [first["jp"]],
            "card": {"jp": first["jp"], "en": first["en"], "grammar": first["grammar"]},
            "points": list(dict.fromkeys(row["grammar"] for row in bank)),
            "size": len(bank),
        }
    return stops


def _comprehension_line(lang: str) -> dict:
    """理解: the hand-written seeds (plan 111), which a new learner's
    first texts at every grade are served from. The card is the first
    seed's opening and its first question, as comprehension_seed.render
    puts it in `lang`; `size` is the questions a text asks."""
    stops = {}
    for level, seeds in comprehension_seed.by_level().items():
        if level not in LEVELS or not seeds:
            continue
        first = seeds[0]
        question = comprehension_seed.render(first, lang)["questions"][0]
        stops[level] = {
            "sample": [seed["title"] for seed in seeds],
            "card": {
                "title": first["title"],
                "text": _first_sentences(first["text"], 3),
                "question": question["question"],
                "options": question["options"],
            },
            "points": list(dict.fromkeys(p for seed in seeds for p in seed.get("grammar", []))),
            "size": len(first["questions"]),
        }
    return stops


def _dictation_line(lang: str) -> dict:
    """書取: the level's clips (content/listening_clips). A line is heard,
    not read, so the specimen is the sentence alone and no grammar is
    named -- the bank names none."""
    stops = {}
    for level in LEVELS:
        clips = listening_clips.BY_LEVEL.get(level, [])
        if not clips:
            continue
        stops[level] = {
            "sample": [clips[0]["jp"]],
            "card": {"jp": clips[0]["jp"]},
            "points": [],
            "size": len(clips),
        }
    return stops


def _composition_line(lang: str) -> dict:
    """作文: the level's catalogue, the list routes/composition's batch
    hands points from, in the catalogue's order."""
    stops = {}
    for level in LEVELS:
        points = GRAMMAR_POINTS_BY_LEVEL.get(level, [])
        if not points:
            continue
        stops[level] = {
            "sample": [p["pattern"] for p in points[: SAMPLE_SIZE["composition"]]],
            "card": {"jp": points[0]["pattern"], "meaning": gloss(points[0], lang)},
            "points": [p["pattern"] for p in points],
            "size": len(points),
        }
    return stops


def _deck_readings(level: str) -> list[dict[str, str]]:
    """kanji -> kana over the vocab deck, the level's own words first
    and then every level from N5 up, so a focus word the level's deck
    does not teach still finds the lowest card that does."""
    def readings(entries):
        out: dict[str, str] = {}
        for e in entries:
            kanji, kana = e.get("kanji"), (e.get("kana") or "").split("/")[0].strip()
            if kanji and kana:
                out.setdefault(kanji, kana)
        return out
    return [
        readings(VOCAB_BY_LEVEL.get(level, [])),
        readings(e for lvl in LEVELS for e in VOCAB_BY_LEVEL.get(lvl, [])),
    ]


def _exam_vocab(level: str) -> dict | None:
    """The 漢字読み item: a sentence with a word in kanji to be read.
    Drawn from the reading bank -- a sentence of the level whose focus
    word is spelled with a kanji and stands in the sentence as written
    (読む is the focus of 読んでください and is not there to underline),
    with the reading the deck's card gives it."""
    bank = reading_sentences.BY_LEVEL.get(level, [])
    for readings in _deck_readings(level):
        for row in bank:
            focus = row.get("focus", "")
            if _KANJI.search(focus) and focus in row["jp"] and focus in readings:
                return {"sentence": row["jp"], "word": focus, "reading": readings[focus]}
    return None


def _exam_line(lang: str) -> dict:
    """模試: one specimen per paper kind, each drawn from the content the
    app already teaches at the grade (a paper is generated per learner
    and has no item to show before it exists): the vocabulary paper's
    漢字読み, the grammar paper's sentence and its point, the reading
    paper's passage. A kind the grade has nothing to draw from is left
    out rather than filled. No sample: a paper is not a list."""
    seeds = comprehension_seed.by_level()
    stops = {}
    for level in LEVELS:
        card = {}
        vocab = _exam_vocab(level)
        if vocab:
            card["vocab"] = vocab
        bank = reading_sentences.BY_LEVEL.get(level, [])
        if bank:
            card["grammar"] = {"sentence": bank[0]["jp"], "point": bank[0]["grammar"]}
        if seeds.get(level):
            first = seeds[level][0]
            card["reading"] = {"title": first["title"], "text": _first_sentences(first["text"], 2)}
        stops[level] = {"sample": [], "card": card}
    return stops


LINES = {
    "kana": _kana_line,
    "kanji": _kanji_line,
    "vocab": _vocab_line,
    "grammar": _grammar_line,
    "reading": _sentence_line,
    "translation": _sentence_line,
    "comprehension": _comprehension_line,
    "dictation": _dictation_line,
    "composition": _composition_line,
    "exam": _exam_line,
}


@lru_cache(maxsize=len(SOURCES) * len(LANGS))
def station_samples(source: str, lang: str) -> dict:
    return {"source": source, "stops": LINES[source](lang)}


@router.get("/api/station/{source}/samples")
def get_station_samples(source: str, lang: str = "fr"):
    if source not in LINES:
        raise HTTPException(status_code=404, detail=f"Unknown line: {source}")
    return station_samples(source, lang if lang in LANGS else "fr")
