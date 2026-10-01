# 問題の名前 -- a served paper names its parts (plan 171). A generated
# paper keeps a mondai's id and number only, and the same id names a
# different mondai at another level, so the server adds the blueprint's
# name when it serves the paper; the phone prints it on the cover, at
# the head of every question and on the answer sheet.
from study.exam_blueprint import name_mondai


def _paper(level, ids):
    return {"level": level, "sections": [{"id": "s", "mondai": [{"id": i, "number": n} for n, i in enumerate(ids, 1)]}]}


def test_each_mondai_is_named_for_its_level():
    n5 = name_mondai(_paper("N5", ["moji_1", "moji_3"]))
    n2 = name_mondai(_paper("N2", ["moji_3"]))
    assert [m["nameJp"] for m in n5["sections"][0]["mondai"]] == ["漢字読み", "文脈規定"]
    assert n2["sections"][0]["mondai"][0]["nameJp"] == "語形成"


def test_listening_and_reading_ids_are_named():
    paper = name_mondai(_paper("N4", ["dokkai_5", "choukai_2"]))
    assert [m["nameJp"] for m in paper["sections"][0]["mondai"]] == ["内容理解（中文）", "ポイント理解"]


def test_an_unknown_mondai_is_left_as_it_is_and_the_paper_is_not_mutated():
    raw = _paper("N4", ["m1"])
    served = name_mondai(raw)
    assert "nameJp" not in served["sections"][0]["mondai"][0]
    assert served is not raw
    assert "nameJp" not in name_mondai(raw)["sections"][0]["mondai"][0]


def test_a_paper_without_a_known_level_is_served_unchanged():
    assert name_mondai({"level": "N9", "sections": []}) == {"level": "N9", "sections": []}
