"""A kana card's choices (`hints.indice_1`) are four distinct values.

A set can spell two kana alike: じ and ぢ are both "ji", ず and づ both
"zu", so a pool taken kana by kana could deal the same romaji twice.
"""
import random

from content.kana_data import KANA_SETS
from routes.kana import _build_kana_card
from study.modes import INDICE_CHOICES, KANA, MODES


def _choice_modes():
    return [m for m in MODES.values() if m.source == KANA and INDICE_CHOICES in m.hints]


def test_a_kana_cards_choices_are_distinct_and_hold_the_answer():
    modes = _choice_modes()
    assert modes, "no kana mode offers choices"
    random.seed(0)
    for m in modes:
        for name, kana_list in KANA_SETS.items():
            for entry in kana_list:
                for _ in range(20):
                    card = _build_kana_card(entry, kana_list, m, None)
                    choices = card["hints"][INDICE_CHOICES]
                    field = "kana" if card["direction"] == "b2f" else "romaji"
                    assert entry[field] in choices
                    assert len(choices) == len(set(choices)), (name, entry, choices)
