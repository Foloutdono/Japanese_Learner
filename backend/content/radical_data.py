"""
The 214 classical (Kangxi) radicals, and which one each kanji is filed
under.

Owns the two JSON dumps under datas/kanji/ so they are read once at
import rather than per consumer: routes/dictionary.py's radical browser
needs them, and so does kanji's `radical` study mode (see
study/modes.py's eligible_for, which asks for entry["radical"]).

Shape:
    ALL_RADICALS       [{number, char, stroke_count, kanji_count}, ...]
    RADICAL_BY_NUMBER  {number: {...}}
    KANJI_RADICALS     {kanji: {radical: int, stroke_count: int}} -- THE
                       APP'S OWN DECK ONLY, see the memory note below.
                       radical_for() is the accessor that answers for any
                       character; reach for that unless you know the
                       character is a deck one.

`stroke_count` means two different things in the two files and that is
not a mistake: on a radical it is the strokes in the RADICAL, on a kanji
entry it is the strokes in the whole KANJI. Only the first is used to
group radicals into distractor buckets.

MEMORY NOTE (2026-09): KANJI_RADICALS used to be all 13,108 rows of
kanji_radicals.json, loaded here AND again in routes/dictionary.py AND
again in study/exam_kanji_gen.py — three copies of the same dump, despite
this module's whole reason for owning it being to read it once. It is now
the 2,212 deck characters, resolved in one query against
datas/kanji/kanji.sqlite3, and radical_for() falls through to that same
database for anything else. Callers see no change: every character
KANJIDIC2 covers still resolves, it just isn't all held in RAM to do it.
"""
import json
import os

import content.kanji_pool_data as _db
from content.kanji_data import DECK_BY_CHAR

_DATA_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "datas", "kanji"
)


def _load(name: str):
    with open(os.path.join(_DATA_DIR, name), encoding="utf-8") as f:
        return json.load(f)


ALL_RADICALS: list[dict] = _load("radicals.json")
KANJI_RADICALS: dict[str, dict] = _db.radicals_for(DECK_BY_CHAR)

RADICAL_BY_NUMBER: dict[int, dict] = {r["number"]: r for r in ALL_RADICALS}

# number -> [same-stroke-count radical numbers], for distractors that are
# actually hard. ⺅ / 亻 / 人 are indistinguishable at choice-row size, so
# picking from the whole 214 would make the mode trivial by accident.
_BY_STROKE: dict[int, list[int]] = {}
for _r in ALL_RADICALS:
    _BY_STROKE.setdefault(_r["stroke_count"], []).append(_r["number"])


def radical_for(kanji: str) -> dict | None:
    """
    {number, char, stroke_count} for a kanji, or None when the KANJIDIC2
    dump doesn't cover it. stroke_count here is the RADICAL's.

    Answers for ANY character, not just a deck one: the deck's 2,212 come
    from the table above, everything else from the database. A personal
    card written around an obscure character resolves its radical exactly
    as it did when the whole dump was in memory.
    """
    if not kanji:
        return None
    info = KANJI_RADICALS.get(kanji)
    if info is None:
        row = _db.get(kanji)
        info = {"radical": row["radical"]} if row and row["radical"] else None
    if info is None:
        return None
    r = RADICAL_BY_NUMBER.get(info["radical"])
    if r is None:
        return None
    return {
        "number": r["number"],
        "char": r["char"],
        "stroke_count": r["stroke_count"],
    }


def siblings_by_stroke(number: int, want: int = 3) -> list[int]:
    """
    Radical numbers to draw distractors from: same stroke count first,
    then widening to the nearest counts until at least `want` are
    available. Excludes `number` itself.

    The widening is not decoration. Four radicals sit in buckets too thin
    to fill a choice grid on their own -- 黍 (12 strokes) has one sibling,
    鼻 (14) has one, 齒 (15) has none at all -- so a strict same-count rule
    would hand those cards a two- or three-option grid, silently, and make
    them markedly easier than every other card in the mode. Widening keeps
    the grid full; a 15-stroke radical against 14- and 16-stroke ones is
    still a real discrimination, unlike one against a 1-stroke radical.
    """
    r = RADICAL_BY_NUMBER.get(number)
    if r is None:
        return []
    own = r["stroke_count"]
    out = [n for n in _BY_STROKE.get(own, []) if n != number]
    if len(out) >= want:
        return out
    # Nearest stroke counts outward, closest first; ties resolved low-first
    # so the widening is deterministic.
    for _distance, count in sorted(
        (abs(c - own), c) for c in _BY_STROKE if c != own
    ):
        out.extend(n for n in _BY_STROKE[count] if n != number)
        if len(out) >= want:
            break
    return out


# ── Study by radical (plan 086) ─────────────────────────────
# The inverse of KANJI_RADICALS: for each radical number, the course's
# own kanji filed under it, one row per character at its native level
# (DECK_BY_CHAR's rule — 23 characters sit on two levels and a family
# lists a character once), ordered N5 → N1 and then by stroke count so
# a learner meeting the family reads it easy-first and the drill serves
# it in that order (routes/kanji.py passes ordered=True). Radicals with
# no deck kanji are simply absent: twenty of the 214 (爿 牙 瓜 …) file
# nothing the course teaches, and a lesson with no family is not a
# lesson.
from content.kanji_data import LEVELS as _LEVELS
from content.radical_info import RADICAL_INFO

_LEVEL_RANK = {lv: i for i, lv in enumerate(_LEVELS)}


def _build_deck_by_radical() -> dict[int, list[tuple[str, dict]]]:
    out: dict[int, list[tuple[str, dict]]] = {}
    for char, info in KANJI_RADICALS.items():
        native = DECK_BY_CHAR.get(char)
        if native is None:
            continue
        out.setdefault(info["radical"], []).append(native)
    # The deck's own entries carry no stroke count; KANJI_RADICALS does
    # (the whole kanji's, from the database).
    def _rank(row):
        level, entry = row
        strokes = KANJI_RADICALS[entry["kanji"]].get("stroke_count") or 0
        return (_LEVEL_RANK[level], strokes, entry["kanji"])
    for rows in out.values():
        rows.sort(key=_rank)
    return out


DECK_BY_RADICAL: dict[int, list[tuple[str, dict]]] = _build_deck_by_radical()


def deck_kanji_for(number: int) -> list[tuple[str, dict]]:
    """[(native level, deck entry), ...] filed under `number`, easy-first.
    Empty for a radical the course never reaches, and for an unknown
    number — callers that need to tell those apart check
    RADICAL_BY_NUMBER first."""
    return DECK_BY_RADICAL.get(number, [])


def info_for(number: int, lang: str = "fr") -> dict | None:
    """The radical as a lesson knows it: the index row merged with the
    authored table (content/radical_info.py).

        {number, char, stroke_count, glyph, forms, meaning, names_ja,
         position}

    `char` is still the index's identity (what the dictionary browses
    by and the radical mode answers with); `glyph` is the form the
    study screens print large — the first of `forms`, which is how the
    learner meets it. They differ for the two dozen radicals KANJIDIC2
    files under a form nobody writes (才 for hand, 邗 for city).
    `meaning` is in the learner's language, English unless French is
    asked for — the two the table is written in."""
    r = RADICAL_BY_NUMBER.get(number)
    if r is None:
        return None
    meaning_en, meaning_fr, names_ja, forms, position = RADICAL_INFO[number]
    return {
        "number": r["number"],
        "char": r["char"],
        "stroke_count": r["stroke_count"],
        "glyph": forms[0],
        "forms": list(forms),
        "meaning": meaning_fr if lang == "fr" else meaning_en,
        "names_ja": list(names_ja),
        "position": position,
    }
