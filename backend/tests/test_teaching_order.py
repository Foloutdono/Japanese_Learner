# ── 教順 — the order a deck's new cards are taught in (plan 186a) ──
# New cards were a random draw from the whole level, so a learner's
# first day could hold 〜なければなりません before は. The pure half here;
# the queue's half is in test_today_ration.py.
from content.frequency_data import KANJI_FREQUENCY_ORDER, VOCAB_FREQUENCY_ORDER
from study import card_index, teaching_order
from study.modes import GRADED_FOR_SOURCE, GRAMMAR, KANA, KANJI, VOCAB


def test_every_deck_is_a_reordering_of_itself():
    # Nothing dropped for being unranked, nothing added, nothing twice --
    # in every mode of every deck.
    for source in (KANA, VOCAB, KANJI, GRAMMAR):
        for deck_key in card_index.deck_keys(source):
            for mode_key in GRADED_FOR_SOURCE[source]:
                given = card_index.raw_ids(source, deck_key, mode_key)
                ordered = teaching_order.raw_ids(source, deck_key, mode_key)
                assert sorted(ordered) == sorted(given), (source, deck_key, mode_key)


def test_grammar_is_taught_in_the_catalogue_order():
    # です／だ, は, が, を, に... -- N5.json is written in teaching order.
    first = teaching_order.raw_ids(GRAMMAR, "N5", "grammar.flashcard.f2b")[:6]
    assert first == [f"grammar_N5_{p}" for p in ("です／だ", "は", "が", "を", "に", "で")]
    # The point that prompted the plan is nowhere near the front.
    order = teaching_order.raw_ids(GRAMMAR, "N5", "grammar.flashcard.f2b")
    assert order.index("grammar_N5_〜なければなりません") > order.index("grammar_N5_〜ます／〜ません")


def test_kana_keep_the_syllabary_order():
    mode = "kana.flashcard.f2b"
    assert teaching_order.raw_ids(KANA, "hiragana_basic", mode) == card_index.raw_ids(KANA, "hiragana_basic", mode)
    assert teaching_order.raw_ids(KANA, "hiragana_basic", mode)[:5] == ["kana_あ", "kana_い", "kana_う", "kana_え", "kana_お"]


def _rank(order: list[str]) -> dict:
    return {key: i for i, key in enumerate(order)}


def test_vocab_is_taught_commonest_first():
    ranks = _rank(VOCAB_FREQUENCY_ORDER)
    ids = teaching_order.raw_ids(VOCAB, "N5", "vocab.flashcard.f2b")

    def rank(raw_id):
        e = card_index.entry_for(VOCAB, raw_id)
        return ranks.get(f"{e.get('kanji', '')}::{e.get('kana', '')}")

    seen = [rank(i) for i in ids]
    ranked = [r for r in seen if r is not None]
    assert ranked == sorted(ranked)
    # Every ranked card before every unranked one.
    assert None not in seen[:len(ranked)]
    assert ids.index("vocab_N5_何_なん/なに") < ids.index("vocab_N5_郵便局_ゆうびんきょく")


def test_kanji_are_taught_commonest_first():
    ranks = _rank(KANJI_FREQUENCY_ORDER)
    ids = teaching_order.raw_ids(KANJI, "N5", "kanji.flashcard.f2b")
    seen = [ranks.get(card_index.entry_for(KANJI, i)["kanji"]) for i in ids]
    ranked = [r for r in seen if r is not None]
    assert ranked == sorted(ranked)
    assert ids[:2] == ["kanji_N5_日", "kanji_N5_一"]


def test_an_unknown_id_keeps_its_place_after_the_ranked():
    given = ["nothing_here", "vocab_N5_郵便局_ゆうびんきょく", "also_nothing", "vocab_N5_何_なん/なに"]
    assert teaching_order.in_order(VOCAB, given) == [
        "vocab_N5_何_なん/なに", "vocab_N5_郵便局_ゆうびんきょく", "nothing_here", "also_nothing",
    ]


# ── The section runs (plan 186a, Q5) ────────────────────────────
# Sorting a route's ids apart from its entries would pair a card with
# another card's word; each card served must still be its own entry.

def test_a_section_run_serves_a_level_in_teaching_order_with_each_card_its_own(client):
    import srs.batch_cache as batch_cache
    from core.auth import get_user_id
    from main import app
    from tests.test_today_ration import _wipe
    user = "teaching-order-section-user"
    _wipe(user)
    app.dependency_overrides[get_user_id] = lambda: user
    batch_cache.reset()
    try:
        for source, mode, word in (
            (VOCAB, "vocab.flashcard.f2b", lambda c: f"vocab_N5_{c.get('kanji') or ''}_{c['kana']}"),
            (KANJI, "kanji.flashcard.f2b", lambda c: f"kanji_N5_{c['kanji']}"),
            (GRAMMAR, "grammar.flashcard.f2b", lambda c: f"grammar_N5_{c['grammar']}"),
            (KANA, "kana.flashcard.f2b", lambda c: f"kana_{c['kana']}"),
        ):
            deck = "hiragana_basic" if source == KANA else "N5"
            params = {"mode": mode, "count": 5, ("set_name" if source == KANA else "level"): deck}
            r = client.get(f"/api/{source}/cards", params=params)
            assert r.status_code == 200, r.text
            cards = r.json()["cards"]
            ids = [c["card_id"] for c in cards]
            assert ids == teaching_order.raw_ids(source, deck, mode)[:5], source
            for c in cards:
                assert word(c) == c["card_id"], (source, c["card_id"])
    finally:
        app.dependency_overrides.pop(get_user_id, None)
        batch_cache.reset()
        _wipe(user)
