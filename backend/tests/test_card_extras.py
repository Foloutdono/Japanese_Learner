"""札の中身 / 札の帯 — what a flip card shows besides its answer (plan 326).

The learner's choice (study/card_contents.py) is a closed set, and the
strip under the answer (study/card_extras.py) says only what the
dictionary already says, in the learner's language, and nothing where
the content has nothing.
"""
import json
from pathlib import Path

import pytest

from content.vocab_data import VOCAB_BY_LEVEL
from content.vocab_extras import get_vocab_extras
from study import card_contents
from study.card_extras import extras_for, pairs, parse_id

ALL = {
    "vocab": list(card_contents.FIELDS["vocab"]["question"] + card_contents.FIELDS["vocab"]["answer"]),
    "kanji": list(card_contents.FIELDS["kanji"]["answer"]),
}
PAIRS_FILE = Path(__file__).resolve().parent.parent / "datas" / "vocab" / "verb_pairs.json"


# ── the choice ──

def test_clean_orders_the_fields_and_drops_repeats():
    assert card_contents.clean({"vocab": ["verb", "example", "verb"]}) == {"vocab": ["example", "verb"]}


@pytest.mark.parametrize("value", [
    {"grammar": ["example"]},          # no such line
    {"vocab": ["words"]},              # a kanji field on the vocab line
    {"kanji": ["sentence"]},           # a vocab field on the kanji line
    {"vocab": "example"},              # not a list
    ["vocab"],                         # not a map
])
def test_clean_refuses_what_is_not_on_offer(value):
    with pytest.raises(ValueError):
        card_contents.clean(value)


def test_nothing_chosen_is_todays_card():
    assert card_contents.resolve(None) == {"vocab": [], "kanji": []}
    # A field no longer offered is dropped, never served.
    assert card_contents.resolve({"vocab": ["example", "gone"]}) == {"vocab": ["example"], "kanji": []}


# ── the pairs ──

def test_every_pair_is_two_deck_words():
    deck = {f"{e['kanji']}::{e['kana']}" for es in VOCAB_BY_LEVEL.values() for e in es}
    data = json.loads(PAIRS_FILE.read_text(encoding="utf-8"))["pairs"]
    assert data, "the pair list is empty"
    for vt, vi in data:
        assert vt in deck, vt
        assert vi in deck, vi
    assert len({tuple(p) for p in data}) == len(data), "a pair is listed twice"


def test_every_pair_is_what_jmdict_says_it_is():
    """The transitive member is tagged vt, the intransitive one vi: a pair
    is written by hand, and JMdict holds the hand to it."""
    def codes(key):
        kanji, kana = key.split("::")
        return {t["code"] for s in get_vocab_extras(kanji, kana, "", "en")["senses"] for t in s.get("tags", [])}
    for vt, vi in json.loads(PAIRS_FILE.read_text(encoding="utf-8"))["pairs"]:
        assert "vt" in codes(vt), vt
        assert "vi" in codes(vi), vi


def test_a_pair_reads_both_ways():
    assert ("届く::とどく", "vi") in pairs()["届ける::とどける"]
    assert ("届ける::とどける", "vt") in pairs()["届く::とどく"]
    # A transitive verb may have two intransitive partners.
    assert {k for k, _ in pairs()["起こす::おこす"]} == {"起きる::おきる", "起こる::おこる"}


# ── the strip ──

def test_ids_the_app_owns_and_no_other():
    assert parse_id("vocab_N4_届ける_とどける")[0] == "vocab"
    assert parse_id("kanji_N4_送")[0] == "kanji"
    for other in ("deck_12_3", "vocab_N9_x_y", "vocab_N4_nothere_なし", "kanji_N4_龘", "", None):
        assert parse_id(other) is None


@pytest.mark.parametrize("lang,tr,gloss", [
    ("en", "Can you deliver it to my house?", "deliver"),
    ("fr", "Pourriez-vous me le livrer à domicile ?", "livrer"),
    ("es", "¿Podría entregármelo a domicilio?", "entregar"),
])
def test_a_word_in_each_language(lang, tr, gloss):
    x = extras_for(["vocab_N4_届ける_とどける"], ALL, lang)["vocab_N4_届ける_とどける"]
    assert x["example"]["jp"] == "家に届けていただけますか。"
    assert x["example"]["tr"] == tr
    # The word is marked in its sentence.
    assert "".join(s["text"] for s in x["example"]["segments"] if s["highlight"]).startswith("届け")
    assert x["kanji"][0]["char"] == "届" and x["kanji"][0]["reading"] == "とど"
    assert gloss in x["kanji"][0]["meaning"]
    assert x["pair"][0]["kanji"] == "届く" and x["pair"][0]["kind"] == "vi"
    assert len(x["verb"]) == 2
    assert x["meanings"]


def test_a_kanji():
    x = extras_for(["kanji_N4_送"], ALL, "fr")["kanji_N4_送"]
    assert {"送る", "放送"} <= {w["kanji"] for w in x["words"]}
    # The words of the card's level come before the ones above it.
    levels = [w["level"] for w in x["words"]]
    assert levels == sorted(levels, key=lambda lv: lv != "N5" and lv != "N4")
    assert x["radical"]["glyph"] == "辶"
    assert x["strokes"] == 9


def test_only_what_was_chosen():
    x = extras_for(["vocab_N4_届ける_とどける"], {"vocab": ["pair"], "kanji": []}, "en")
    assert set(x["vocab_N4_届ける_とどける"]) == {"pair"}
    assert extras_for(["vocab_N4_届ける_とどける", "kanji_N4_送"], {"vocab": [], "kanji": []}, "en") == {}


def test_nothing_where_the_content_has_nothing():
    # A noun has no verb row and no pair; a word in kana has no kanji row.
    x = extras_for(["vocab_N5_学校_がっこう"], {"vocab": ["verb", "pair", "kanji"], "kanji": []}, "en")
    assert set(x.get("vocab_N5_学校_がっこう", {})) == {"kanji"}
    kana_word = next(e for e in VOCAB_BY_LEVEL["N5"] if e["kanji"] == e["kana"] or not e["kanji"])
    kid = f"vocab_N5_{kana_word['kanji']}_{kana_word['kana']}"
    assert "kanji" not in extras_for([kid], {"vocab": ["kanji"], "kanji": []}, "en").get(kid, {})


# ── the account ──

def test_a_choice_is_kept_and_served(client):
    try:
        r = client.patch("/api/profile/learning", json={"cardContents": {"vocab": ["pair", "example"]}})
        assert r.status_code == 200
        assert r.json()["cardContents"]["vocab"] == ["example", "pair"]
        got = client.get("/api/profile/card-contents").json()
        assert got["vocab"] == ["example", "pair"] and got["kanji"] == []
        assert got["choices"]["kanji"]["answer"] == ["words", "radical", "strokes"]
        x = client.get("/api/card-extras", params={"ids": "vocab_N4_届ける_とどける,kanji_N4_送", "lang": "fr"}).json()
        assert set(x["extras"]) == {"vocab_N4_届ける_とどける"}
        assert set(x["extras"]["vocab_N4_届ける_とどける"]) == {"example", "pair"}
        # A line sent replaces that line alone.
        client.patch("/api/profile/learning", json={"cardContents": {"kanji": ["strokes"]}})
        got = client.get("/api/profile/card-contents").json()
        assert got["vocab"] == ["example", "pair"] and got["kanji"] == ["strokes"]
        assert client.patch("/api/profile/learning", json={"cardContents": {"vocab": ["nope"]}}).status_code == 422
    finally:
        client.patch("/api/profile/learning", json={"cardContents": {"vocab": [], "kanji": []}})
