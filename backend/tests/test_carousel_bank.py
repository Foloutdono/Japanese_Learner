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


# ── Read it's bonus and its own sentences (plan 254) ──────────────


def test_a_sentence_is_said_the_other_way_by_the_apps_own_reading():
    v = cb.version("頭が痛い。", "N5", rows("頭が痛い。"))
    assert v["to"] == "polite"
    assert "".join(r["t"] for r in v["rows"]) == "頭が痛いです。"
    # An adjective takes です and nothing else changes.
    assert v["from"] == ["", ""] and v["into"] == ["です", "です"]
    v = cb.version("水を飲む。", "N5", rows("水を飲む。"))
    assert (v["from"], v["into"]) == (["飲む", "のむ"], ["飲みます", "のみます"])
    v = cb.version("お金がない。", "N5", rows("お金がない。"))
    assert v["into"][0] == "ありません"
    # Polite to plain, the final よ kept out of what changed.
    v = cb.version("あの店は安いですよ。", "N5", rows("あの店は安いですよ。"))
    assert v["to"] == "plain" and v["from"][0] == "です" and v["into"] == ["", ""]
    # A question reads one way only: 行きますか is no 行くか.
    assert cb.version("明日、行きますか。", "N5", rows("明日、行きますか。")) is None


def test_a_card_says_the_sense_the_sentence_picked_from_the_decks_own():
    assert cb._card_gloss(["tall, high, expensive"], "high") == ["high", "tall"]
    assert cb._card_gloss(["spacious, wide"], None) == ["spacious", "wide"]
    # A bracket's commas are no gloss's end, and a bracket is left off the card.
    assert cb._card_gloss(["to play (have fun, not sports/instruments), to make a visit"], "have fun") == ["have fun", "to play"]
    assert cb._card_gloss(["to take a photo or record a film"], "to take a photo") == ["to take a photo", ""]


def test_every_short_sentence_is_a_noun_a_particle_and_a_word_said_politely():
    out = cb.shorts()["sentences"]
    assert len(out) >= 40
    for s in out:
        words = [r for r in s["rows"] if r["k"] != "punct"]
        assert [r["k"] for r in words] == ["word", "particle", "word"], s["id"]
        assert all(r["lv"] == "N5" for r in (words[0], words[2])), s["id"]
        assert all(r["gen"][0] and r["gfr"][0] for r in words), s["id"]
        assert s["v"]["to"] == "polite" and s["v"]["when"]["en"] and s["v"]["when"]["fr"], s["id"]
