"""
The example sentences of the grammar catalogue, read off the points
themselves (content/grammar/*.json, `examples`) -- plan 087 folded
content/grammar_sentences.json into the entry that owns each sentence.

Companion to grammar_points_data.py: that file says which patterns
exist, this one shows them at work. Consumed by indice_2 (sentences with
the translation hidden until asked for), fill_in (a sentence shown
intact, name the rule) and contrast (a sentence with the pattern blanked,
pick it from among its rivals).

Every sentence is authored, not generated, and passes
study/grammar_sentence_gen.check_sentence -- see content/grammar/README.md
and tests/test_grammar_sentences.py. The generator in
study/grammar_sentence_gen.py is kept for drafting.
"""
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, localise

SENTENCES_BY_LEVEL: dict[str, dict[str, list[dict]]] = {
    level: {entry["pattern"]: entry.get("examples", []) for entry in entries}
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items()
}


def get_sentences(level: str, pattern: str) -> list[dict]:
    """
    [{"jp": ..., "en": ..., "fr": ..., "register"?: ..., "contrast"?: ...}, ...]
    for one grammar point, or [] when the point has none. An empty list
    is a real answer, not an error: a mode that needs sentences hides
    rather than showing a card it cannot fill.
    """
    return SENTENCES_BY_LEVEL.get(level, {}).get(pattern, [])


def has_sentences(level: str, pattern: str) -> bool:
    """Whether fill_in can offer this point -- see study/modes.eligible_for."""
    return bool(get_sentences(level, pattern))


def translation(example: dict, lang: str) -> str:
    """The sentence's translation in the learner's language, English
    when the French is not written yet."""
    if lang == "fr":
        return example.get("fr") or example.get("en", "")
    return localise({"en": example.get("en", ""), "fr": example.get("fr", "")}, lang)


def contrast_examples(level: str, pattern: str) -> list[dict]:
    """The sentences the author marked as telling this pattern apart from
    its rivals -- what the contrast drill draws from."""
    return [ex for ex in get_sentences(level, pattern) if ex.get("contrast")]
