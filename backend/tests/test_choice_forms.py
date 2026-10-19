"""What a Choisir option prints (plan 254, study/grammar_forms.py).

The catalogue quotes a rule whole and a sentence holds one form of it:
あの人はだれですか is blanked on あの, and its options were the two
series この／その／あの／どの and これ／それ／あれ／どれ, a list against a
hole that takes one word. Each option now prints the one form its rule
would take there -- あの, あれ -- and a rule whose lone piece would be
another rule, and fit, stays whole."""
import random
import re

import pytest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, find
from routes import grammar as grammar_route
from study.grammar_examples import blank_span
from study.grammar_forms import choice_forms
from study.grammar_lesson import contrast_payload
from study.grammar_match import stems, verifiable
from study.grammar_tour import _gap_questions
from study.modes import resolve

# The rules an option still prints with a 〜 between two of its pieces:
# a lone one-character piece would read as another rule (か, に, も, は)
# and fit the hole as one (電話＿＿メール takes か), and a circumfix's
# になる alone is "become".
WHOLE = {"〜か〜か", "〜に〜回", "〜も〜も", "〜は〜が", "〜つ〜つ", "〜も〜ば〜も",
         "お〜になる／お〜する", "お〜ください"}


def _question(pattern: str, jp: str, offer: str | None = None) -> dict:
    level, entry = find(pattern)
    example = next(ex for ex in entry["examples"] if ex["jp"] == jp)
    return contrast_payload(level, entry, GRAMMAR_POINTS_BY_LEVEL[level], "en", random.Random(0),
                            example=example, offer=offer)


def _form(drill: dict, rule: str) -> str:
    return next(form for form, r in drill["rules"].items() if r == rule)


def test_a_series_prints_the_member_its_sentence_holds():
    drill = _question("この／その／あの／どの", "あの人はだれですか。")
    assert drill["answer"] == "あの"
    # The rival series by the member in the same place: あれ beside あの.
    assert _form(drill, "これ／それ／あれ／どれ") == "あれ"
    assert not any("／" in c for c in drill["choices"])
    # The lesson's line on the trap is keyed by the form the learner took.
    assert set(drill["why"]) == {"あれ"}


def test_a_rule_in_two_pieces_prints_the_one_in_the_hole():
    drill = _question("から〜まで", "九時から五時まではたらきます。")
    assert drill["answer"] == "から"
    drill = _question("あまり〜ない", "この本はあまりおもしろくないです。")
    assert drill["answer"] == "あまり" and _form(drill, "ぜんぜん〜ない") == "ぜんぜん"


def test_the_lesson_s_line_names_the_member_of_a_rival_series():
    # "ていません leaves the door open; ませんでした closes it."
    drill = _question("まだ〜ていません", "まだごはんを食べていません。")
    assert drill["answer"] == "ていません"
    assert _form(drill, "〜ました／〜ませんでした") == "ませんでした"
    assert _form(drill, "もう〜ました") == "ました"


def test_a_series_of_another_length_offers_the_member_that_opens_alike():
    drill = _question("〜てくださる／〜ていただく", "先生が本を貸してくださいました。")
    assert drill["answer"] == "てくださる"
    assert _form(drill, "〜てあげる／てくれる／てもらう") == "てくれる"


@pytest.mark.parametrize("pattern, jp, rival, printed", [
    # 電話かメール: a lone か would be right.
    ("または", "電話またはメールで知らせてください。", "〜か〜か", "か〜か"),
    ("〜おきに", "バスは十分おきに来ます。", "〜に〜回", "に〜回"),
    # になる alone is "become", not the honorific.
    ("〜ていらっしゃる", "先生は今、本を読んでいらっしゃいます。", "お〜になる／お〜する", "お〜になる"),
])
def test_a_rule_no_piece_can_stand_for_stays_whole(pattern, jp, rival, printed):
    drill = _question(pattern, jp)
    assert _form(drill, rival) == printed


def test_a_word_class_is_not_a_form():
    drill = _question("〜さ", "母のやさしさを思い出した。")
    assert _form(drill, "い形容詞／な形容詞") == "い形容詞／な形容詞"


def test_a_label_stays_with_its_form():
    forms = choice_forms("〜なさい", "なさい", ["〜なさい", "命令形 〜ろ／〜え"])
    assert forms["命令形 〜ろ／〜え"].text == "命令形 ろ"


def test_a_form_carries_its_own_ruby():
    drill = _question("〜が上手です／下手です", "わたしは日本語が下手です。")
    assert drill["answer"] == "下手です"
    assert drill["readings"]["下手です"] == [{"text": "下手", "reading": "へた"}, {"text": "です"}]


def test_two_options_never_print_alike():
    # もう〜ました prints ました, which 〜ました／〜ませんでした says first
    # beside 〜ています: the filler is left out rather than printed whole.
    level, entry = find("〜ています")
    for seed in range(30):
        random.seed(seed)
        drill = contrast_payload(level, entry, GRAMMAR_POINTS_BY_LEVEL[level], "en", random.Random(seed),
                                 example=entry["examples"][0])
        assert len(set(drill["choices"])) == len(drill["choices"])
        assert not any(re.search(r"[^ 〜]〜", c) for c in drill["choices"])


def test_every_question_prints_one_form_an_option():
    """The sweep: over every marked sentence of the catalogue, each option
    is one form of its rule -- no series, no rule in pieces but the few
    no piece can stand for -- the answer is the form the hole holds, and
    the lesson's lines and the ruby are keyed by what is printed."""
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
        for entry in entries:
            pattern = entry["pattern"]
            for ex in entry.get("examples", []):
                if not ex.get("contrast") or not (verifiable(pattern) or blank_span(ex["jp"], pattern, level)):
                    continue
                for seed in range(3):
                    random.seed(seed)
                    drill = contrast_payload(level, entry, GRAMMAR_POINTS_BY_LEVEL[level], "en",
                                             random.Random(seed), example=ex)
                    where = f"{level} {pattern} {ex['jp']}"
                    choices, rules = drill["choices"], drill["rules"]
                    assert len(set(choices)) == len(choices) and set(rules) == set(choices), where
                    assert rules[drill["answer"]] == pattern, where
                    for c in choices:
                        assert "／" not in c or c.endswith("詞"), (where, c)
                        assert not re.search(r"[^ 〜]〜", c) or rules[c] in WHOLE, (where, c)
                    fill = "".join(p["text"] for p in drill["fill"])
                    answer = drill["answer"]
                    assert fill == answer or fill in stems(answer) or answer.startswith(fill), (where, fill, answer)
                    assert set(drill["why"]) <= set(choices) - {answer}, where
                    for form, parts in drill["readings"].items():
                        assert form in choices and "".join(p["text"] for p in parts) == form, where


def test_the_tour_s_gap_question_prints_the_forms_too():
    level, entry = find("この／その／あの／どの")
    rival_level, rival = find("これ／それ／あれ／どれ")
    gaps = _gap_questions(rival_level, rival, "en", set(), random.Random(0))
    assert gaps
    for q in gaps:
        for c in q["choices"]:
            assert "／" not in c["form"] and c["pattern"] in {p["pattern"] for p in GRAMMAR_POINTS_BY_LEVEL[level]}
        assert {c["form"] for c in q["choices"] if c["correct"] or c["trap"]} <= {"これ", "それ", "あれ", "どれ",
                                                                                "この", "その", "あの", "どの"}


def test_the_card_ships_the_forms_and_their_ruby_but_not_the_rules():
    level, entry = find("〜が上手です／下手です")
    card = grammar_route._build_grammar_card(entry, level, GRAMMAR_POINTS_BY_LEVEL[level],
                                             resolve("grammar.contrast"), "en")
    assert "rules" not in card["contrast"] and "readings" not in card["contrast"]
    assert set(card["choices_furigana"]) <= set(card["contrast"]["choices"])
    assert card["contrast"]["answer"] in {"が上手です", "下手です"}
