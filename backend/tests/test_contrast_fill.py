"""What stands in Choisir's hole once it is answered (`fill`).

The hole is filled with what the sentence has there, never with the
pattern poured back in: から〜まで is blanked on its から alone and
〜てしまう on the てしま of てしまいました, so the pattern in the hole read
十時から〜まで七時まで and 食べてしまういました."""
import pytest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from study.grammar_examples import BLANK, blank_span, blanked_payload


def _answered(payload: dict) -> str:
    fill = "".join(p["text"] for p in payload["fill"])
    return "".join(fill if p.get("blank") else p["text"] for p in payload["furigana"])


@pytest.mark.parametrize("jp, pattern, level, hole", [
    ("店は十時から七時までです。", "から〜まで", "N5", "から"),
    ("ケーキを全部食べてしまいました。", "〜てしまう", "N4", "てしま"),
])
def test_the_hole_holds_the_sentence_s_own_text(jp, pattern, level, hole):
    payload = blanked_payload({"jp": jp, "fr": "-"}, pattern, "fr", level)
    assert [p["text"] for p in payload["furigana"] if p.get("blank")] == [BLANK]
    assert "".join(p["text"] for p in payload["fill"]) == hole
    assert _answered(payload) == jp


def test_every_contrast_sentence_reads_whole_once_answered():
    # The sweep: whatever piece of a pattern the drill blanks, the answer
    # put back gives the sentence the catalogue wrote, not a doubled まで.
    wrong = []
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
        for entry in entries:
            for ex in entry.get("examples", []):
                if not ex.get("contrast") or not blank_span(ex["jp"], entry["pattern"], level):
                    continue
                payload = blanked_payload(ex, entry["pattern"], "fr", level)
                if _answered(payload) != ex["jp"]:
                    wrong.append((level, entry["pattern"], ex["jp"], _answered(payload)))
    assert not wrong, wrong[:10]


def test_a_rival_the_lesson_calls_the_same_is_never_offered():
    # Plan 319: だろう in でしょう's hole, から in ので's, the potential in
    # ことができます's said the same as the answer, and no translation told
    # them apart. A compare entry marked `same` stays in the lesson and is
    # offered neither as a named rival nor as a filler, whatever the seed.
    import random

    from study.grammar_lesson import contrast_payload

    offered, asked = [], 0
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
        for entry in entries:
            same = {r["pattern"] for r in entry.get("compare", []) if r.get("same")}
            if not same:
                continue
            for ex in entry.get("examples", []):
                if not ex.get("contrast"):
                    continue
                for seed in range(4):
                    payload = contrast_payload(level, entry, entries, "en", rng=random.Random(seed), example=ex)
                    if payload is None:
                        continue
                    asked += 1
                    offered += [(level, entry["pattern"], ex["jp"], rule)
                                for rule in payload.get("rules", {}).values() if rule in same]
    assert asked
    assert not offered, offered[:10]


# A twin the catalogue joins to a point only through another (plan 320b):
# no compare line names it beside the point, yet it says the same in the
# point's hole: 日本語のみならず for 日本語ばかりか, 世界中で起きている after
# 日本ばかりか as after 日本に限らず, 雨なら for 雨の場合, 急いだとしても for
# 急いだところで, 若いにもかかわらず for 若いながらも.
CHAINED_TWINS = [
    ("N2", "〜ばかりか", "〜のみならず"),
    ("N2", "〜に限らず", "〜ばかりか"),
    ("N4", "〜場合", "〜なら"),
    ("N2", "〜たところで", "〜としても"),
    ("N2", "〜ながらも", "〜にもかかわらず"),
]


@pytest.mark.parametrize("level, pattern, twin", CHAINED_TWINS)
def test_a_twin_reached_through_another_is_never_drawn_either(level, pattern, twin):
    # `same` is followed through the whole catalogue, not one link: a mark
    # joins two points that fill each other's holes, and the chain finds
    # the twins no line names. Stopping at one link would draw these as
    # fillers, a second right answer.
    import random

    from study.grammar_lesson import _same_family, contrast_payload

    entries = GRAMMAR_POINTS_BY_LEVEL[level]
    entry = next(e for e in entries if e["pattern"] == pattern)
    direct = {r["pattern"] for r in entry.get("compare", []) if r.get("same")}
    assert twin in _same_family(pattern) and twin not in direct
    assert any(e["pattern"] == twin for e in entries), "the twin is a filler only at the point's level"
    examples = [ex for ex in entry["examples"] if ex.get("contrast")]
    assert examples
    for ex in examples:
        for seed in range(12):
            payload = contrast_payload(level, entry, entries, "en", rng=random.Random(seed), example=ex)
            assert twin not in payload["rules"].values(), (ex["jp"], seed)


def test_the_family_s_reach_costs_no_question_a_choice():
    # The chain also joins points that are not twins (〜通りに to 〜うちに,
    # through とともに and につれて). What that costs is a filler that would
    # have been wrong, and only while the level has others: every question
    # of a point with a family still offers its full set.
    import random

    from study.grammar_lesson import CONTRAST_CHOICES, _same_family, contrast_payload, verifiable

    short = []
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
        for entry in entries:
            if not verifiable(entry["pattern"]) or not _same_family(entry["pattern"]):
                continue
            for ex in entry.get("examples", []):
                if not ex.get("contrast"):
                    continue
                for seed in range(3):
                    payload = contrast_payload(level, entry, entries, "en", rng=random.Random(seed), example=ex)
                    if payload is None or len(payload["choices"]) < CONTRAST_CHOICES:
                        short.append((level, entry["pattern"], ex["jp"]))
    assert not short, short[:10]
