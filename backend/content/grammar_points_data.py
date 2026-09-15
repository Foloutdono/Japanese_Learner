"""
The grammar catalogue: content/grammar/N5.json … N1.json (plan 087).

One JSON list per level, one object per grammar point. What a point
carries beyond its identity -- the bilingual gloss, the lesson steps, the
neighbours it is confused with, the example sentences -- is documented
in content/grammar/README.md and held to study/grammar_check.py, which
tests/test_grammar_points.py runs over the whole catalogue.

Original curation, not derived from content/grammar_data.py (the
scraped-from-jlptsensei.com file, which nothing serves any more and
which tests/test_grammar_points.py keeps as the corpus our wording must
never coincide with). There is no official JLPT grammar list; every
study site's inventory is its own observation of what recurs on real
papers, and this catalogue is that same kind of observation,
cross-checked against several such lists per pattern rather than lifted
from any one of them.

The level counts are floors that rise with the level (MIN_PER_LEVEL),
not one number for all five: a level with more to know lists more.

Public API mirrors kanji_data.py/vocab_data.py's own conventions
(KANJI_BY_LEVEL, get_kanji, ...) for consistency across content/.
"""
import json
import os

_BASE_DIR = os.path.join(os.path.dirname(__file__), "grammar")

LEVELS: tuple[str, ...] = ("N5", "N4", "N3", "N2", "N1")

# Levels whose points carry the full lesson (steps, compare, 4-5 examples
# in both languages). A level joins in the same commit as its lessons,
# one level per content wave; study/grammar_check holds a rich level to
# the full bar and the others to gloss + sentences.
RICH_LEVELS: frozenset[str] = frozenset()

# The smallest catalogue each level may carry. Raised in the same commit
# as the content that meets it, never ahead of it. Monotonic on purpose:
# see tests/test_grammar_points.py.
MIN_PER_LEVEL: dict[str, int] = {"N5": 90, "N4": 100, "N3": 100, "N2": 110, "N1": 110}

_TEXT_LANGS = ("en", "fr")


def _load(level: str) -> list[dict]:
    with open(os.path.join(_BASE_DIR, f"{level}.json"), encoding="utf-8") as f:
        return json.load(f)


GRAMMAR_POINTS_BY_LEVEL: dict[str, list[dict]] = {level: _load(level) for level in LEVELS}


def get_grammar_points(level: str) -> list[dict]:
    return GRAMMAR_POINTS_BY_LEVEL.get(level, [])


def grammar_to_id(entry: dict, level: str) -> str:
    """
    The card id for a grammar point, matching kana_to_id/kanji_to_id/
    vocab_to_id's convention of "{category}_{...}" with no ":" (core.auth
    prefixes ids as "{user_id}:{raw_id}" and splits on the first one).

    The pattern string IS the id, so it is kept verbatim for every point
    that survives a catalogue revision; a point that is renamed or moved
    is recorded in content/grammar/renames.py and its rows migrated by
    scripts/migrate_grammar_ids.py (plan 087). srs/srs.py parses the
    `grammar_{level}_` prefix, so that shape is also fixed.
    """
    return f"grammar_{level}_{entry['pattern']}"


def localise(pair, lang: str) -> str:
    """One language out of an {en, fr} pair, English when the asked-for
    language is missing. A bare string passes through, so a caller can
    hand this a field that was never bilingual."""
    if isinstance(pair, str):
        return pair
    if not pair:
        return ""
    return pair.get(lang) or pair.get("en") or ""


def gloss(entry: dict, lang: str = "en") -> str:
    """The one-line meaning in the learner's language."""
    return localise(entry.get("meaning"), lang)


# Built once: the catalogue is static and the two lookups below are asked
# per card, per chip, per dictionary row.
_BY_PATTERN: dict[str, tuple[str, dict]] = {}
_BY_ID: dict[str, tuple[str, dict]] = {}
for _level, _entries in GRAMMAR_POINTS_BY_LEVEL.items():
    for _entry in _entries:
        _BY_PATTERN.setdefault(_entry["pattern"], (_level, _entry))
        _BY_ID.setdefault(grammar_to_id(_entry, _level), (_level, _entry))


def find(pattern: str) -> tuple[str, dict] | None:
    """(level, entry) for a pattern, at whichever level it is filed."""
    return _BY_PATTERN.get(pattern)


def entry_by_id(raw_id: str) -> tuple[str, dict] | None:
    """(level, entry) for a raw card id, or None -- a retired point, or a
    personal card's id that merely looks like one."""
    return _BY_ID.get(raw_id)


def all_ids() -> frozenset[str]:
    """Every raw card id the catalogue serves today."""
    return frozenset(_BY_ID)
