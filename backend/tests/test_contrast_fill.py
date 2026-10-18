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
