"""
Loads content/grammar_sentences.json -- two hand-written example
sentences per grammar point, with literal English translations.

Companion to grammar_points_data.py: that file says which patterns exist,
this one shows them at work. Consumed by indice_2 (sentences with the
translation hidden until asked for) and fill_in (a sentence shown intact,
name the rule).

See the JSON's own "_meta" for why these are authored rather than
generated, and what the generator in study/grammar_sentence_gen.py is
still for.
"""
import json
import os

_BASE_DIR = os.path.dirname(__file__)

with open(os.path.join(_BASE_DIR, "grammar_sentences.json"), encoding="utf-8") as f:
    _RAW: dict = json.load(f)

SENTENCES_BY_LEVEL: dict[str, dict[str, list[dict]]] = {
    level: entries for level, entries in _RAW.items() if not level.startswith("_")
}


def get_sentences(level: str, pattern: str) -> list[dict]:
    """
    [{"jp": ..., "en": ...}, ...] for one grammar point, or [] when the
    point has none. An empty list is a real answer, not an error: a mode
    that needs sentences hides rather than showing a card it cannot fill.
    """
    return SENTENCES_BY_LEVEL.get(level, {}).get(pattern, [])


def has_sentences(level: str, pattern: str) -> bool:
    """Whether fill_in can offer this point -- see study/modes.eligible_for."""
    return bool(get_sentences(level, pattern))
