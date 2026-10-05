"""
基礎 — the basics course on the Learn gate (plan 186g).

The course (study/basics.py) as a plate: its fourteen units as the stops,
each with how far the learner has come on its cards, and a unit's station
-- its grammar points, its words, its kanji and its sentences, each card
with its bar. Boarding a unit is Today's run held to the unit's cards
(routes/today.py's `unit`), so nothing here schedules anything.

A card counts in its line's primary mode, the mode the course deals it
in (routes/today._course): a word met as a flashcard is met, whichever
other platforms it has not been ridden on. And the course is the
learner's lines' part of it, as Today deals it: a learner riding vocab
alone has a unit of words, and the plate's figures, the unit it is at
and the gate's agree.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, grammar_to_id
from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from content.kanji_meanings import KANJI_FR
from content.reading_sentences import N5 as READING_N5
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from core.auth import get_user_id, prefixed
from core.lines import lines_or_all
from core.srs_instance import srs
from core.user_level import resolve_level
from routes.profile import _profile_row
from routes.today import _riding_basics
from study import basics
from study.level_rule import primary_mode
from study.modes import GRAMMAR, KANJI, VOCAB
from translations import get_meaning
from translations.fr.vocab_fr import VOCAB_FR

logger = logging.getLogger(__name__)
router = APIRouter()


def _sources(user_id: str) -> tuple[str, ...]:
    """The course's lines the learner rides, in the course's order."""
    lines = lines_or_all(_profile_row(user_id)[9])
    return tuple(source for source in basics.SOURCES if source in lines)


def _progress(user_id: str, sources) -> dict[str, dict[str, float]]:
    """source -> {raw id: progress} over the course's cards, 0.0 for a
    card never met -- one query a line."""
    out: dict[str, dict[str, float]] = {}
    for source in sources:
        ids = basics.course_ids(source)
        found = srs.get_bulk_progress(prefixed(ids, user_id), primary_mode(source))
        cut = len(user_id) + 1
        out[source] = {cid[cut:]: p for cid, p in found.items()}
    return out


def _met(user_id: str, sources) -> set[str]:
    """The course's raw ids the learner has reviewed at least once in
    their line's primary mode -- get_new_cards' own negative fact."""
    met: set[str] = set()
    for source in sources:
        ids = basics.course_ids(source)
        unmet = set(srs.get_new_cards(primary_mode(source), limit=len(ids),
                                      card_ids=prefixed(ids, user_id), ordered=True))
        met |= {raw_id for raw_id, cid in zip(ids, prefixed(ids, user_id)) if cid not in unmet}
    return met


def _unit_figures(unit: dict, progress: dict, met: set) -> dict:
    ids = [(source, raw_id) for source in progress for raw_id in unit["cards"][source]]
    return {
        "total": len(ids),
        "met": sum(1 for _, raw_id in ids if raw_id in met),
        "learned": srs.whole_cards(progress[source].get(raw_id, 0.0) for source, raw_id in ids),
    }


@router.get("/api/basics")
def get_basics(user_id: str = Depends(get_user_id)):
    """The course as the plate's stops: each unit with its figures --
    `total` cards, `met` (reviewed once) and `learned` (the cards'
    progress summed, plan 184) -- and `at`, the first unit with a card
    not yet met (1-based; null once every unit is). `riding` says whether
    Today deals it (an N5 learner); one above N5 sees the course whole
    and met, since the level rule seeded N5 known."""
    sources = _sources(user_id)
    progress = _progress(user_id, sources)
    met = _met(user_id, sources)
    units = []
    at = None
    for n, unit in enumerate(basics.units()):
        figures = _unit_figures(unit, progress, met)
        if at is None and figures["met"] < figures["total"]:
            at = n + 1
        units.append({
            "unit": n + 1,
            "id": unit["id"],
            "jp": unit["jp"],
            "title": unit["title"],
            "kanji": unit["kanji"],
            "points": unit["grammar"],
            **figures,
        })
    return {
        "riding": _riding_basics(resolve_level(user_id)),
        "at": at,
        "done": at is None,
        "units": units,
    }


def _index(level_entries: list[dict], to_id) -> dict[str, dict]:
    return {to_id(e, basics.LEVEL): e for e in level_entries}


_GRAMMAR = None
_VOCAB = None
_KANJI = None


def _entries():
    """raw id -> its N5 entry, for each line (built once)."""
    global _GRAMMAR, _VOCAB, _KANJI
    if _GRAMMAR is None:
        _GRAMMAR = _index(GRAMMAR_POINTS_BY_LEVEL[basics.LEVEL], grammar_to_id)
        _VOCAB = _index(VOCAB_BY_LEVEL[basics.LEVEL], vocab_to_id)
        _KANJI = _index(KANJI_BY_LEVEL[basics.LEVEL], kanji_to_id)
    return _GRAMMAR, _VOCAB, _KANJI


@router.get("/api/basics/{unit_id}")
def get_basics_unit(unit_id: str, lang: str = "fr", user_id: str = Depends(get_user_id)):
    """A unit's station: its points, words and kanji in the order the
    course deals them, each with its `progress` (0 new to 1 mastered) and
    whether it is `met`, and the unit's sentences from the reading bank
    -- with their translation in English, the bank's one language (a
    French reader gets none rather than an English one)."""
    found = next(((n, u) for n, u in enumerate(basics.units()) if u["id"] == unit_id), None)
    if found is None:
        raise HTTPException(status_code=404, detail="no such unit")
    n, unit = found
    lang = "en" if lang == "en" else "fr"
    grammar, vocab, kanji = _entries()
    sources = _sources(user_id)
    progress = _progress(user_id, sources)
    met = _met(user_id, sources)

    def card(source: str, raw_id: str, **fields) -> dict:
        return {"card_id": raw_id, "progress": progress[source].get(raw_id, 0.0), "met": raw_id in met, **fields}

    points = [
        card(GRAMMAR, raw_id, pattern=grammar[raw_id]["pattern"],
             meaning=grammar[raw_id]["meaning"].get(lang) or grammar[raw_id]["meaning"].get("en", ""))
        for raw_id in unit["cards"][GRAMMAR] if GRAMMAR in sources
    ]
    words = [
        card(VOCAB, raw_id, kanji=vocab[raw_id].get("kanji", ""), kana=vocab[raw_id].get("kana", ""),
             meaning=get_meaning(vocab[raw_id], lang, VOCAB_FR))
        for raw_id in unit["cards"][VOCAB] if VOCAB in sources
    ]
    chars = [
        card(KANJI, raw_id, kanji=kanji[raw_id]["kanji"], meaning=get_meaning(kanji[raw_id], lang, KANJI_FR))
        for raw_id in unit["cards"][KANJI] if KANJI in sources
    ]
    bank = {row["jp"]: row for row in READING_N5}
    sentences = [
        {"jp": jp, "translation": bank[jp]["en"] if lang == "en" else None}
        for jp in unit["sentences"] if jp in bank
    ]
    return {
        "unit": n + 1,
        "of": len(basics.units()),
        "id": unit["id"],
        "jp": unit["jp"],
        "title": unit["title"],
        **_unit_figures(unit, progress, met),
        "grammar": points,
        "vocab": words,
        "kanji": chars,
        "sentences": sentences,
    }
