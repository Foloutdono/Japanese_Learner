"""The carousel bank's cut of a sentence into rows (plan 248,
scripts/carousel_bank.py): a word the page writes in kana is read as the
word it spells, a number, でも and an honorific prefix stay whole, and a
katakana word is romanised as it is written."""
from scripts import carousel_bank as cb


def rows(jp: str, level: str = "N5") -> list[dict]:
    return cb.rows_of(cb._analyze(jp, level)["tokens"])


def row(jp: str, t: str, level: str = "N5") -> dict:
    return next(r for r in rows(jp, level) if r["t"] == t)


def test_a_kana_word_is_read_as_the_word_it_spells():
    r = row("としょかんで本を読みました。", "としょかん")
    assert r["ro"] == "toshokan"
    assert r["en"] == ["library"]
    # Positions are the page's own: the line is rebuilt from its rows.
    analysis = cb._analyze("としょかんで本を読みました。", "N5")
    assert analysis["text"] == "としょかんで本を読みました。"
    assert "".join(t["surface"] for t in analysis["tokens"]) == analysis["text"]
    for tok in analysis["tokens"]:
        assert analysis["text"][tok["start"]:tok["end"]] == tok["surface"]


def test_a_verb_is_respelled_only_where_a_word_starts():
    assert row("はやくねます。", "ねます")["en"][0].startswith("to go to bed")
    # かねます is 兼ねる, never 寝る: no token starts at its ね.
    assert all("sleep" not in " ".join(r.get("en") or []) for r in rows("わかりかねます。"))


def test_a_number_demo_and_an_honorific_stay_whole():
    assert [r["t"] for r in rows("二十五歳です。")][0] == "二十五歳"
    assert row("七万円です。", "七万円")["ro"].startswith("nanaman")
    assert row("でも、行きます。", "でも")["ro"] == "demo"
    # でも after a word is で and も, each its own.
    assert [r["t"] for r in rows("駅でも待ちます。")][:3] == ["駅", "で", "も"]
    assert row("お茶をください。", "お茶")["ro"] == "ocha"
    assert row("ご家族はお元気ですか。", "ご家族", "N4")["ro"] == "gokazoku"


def test_a_katakana_word_is_romanised_as_written():
    assert row("コーヒーを飲みます。", "コーヒー")["ro"] == "koohii"
